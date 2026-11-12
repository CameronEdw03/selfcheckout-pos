
from decimal import Decimal, ROUND_HALF_UP

from connection import create_connection
from pricing import apply_deals_to_cart


def set_cart_item_discount(user_id, product_id, new_price, reason, changed_by):
    """Set a lower transaction-only price and audit the change atomically."""
    connection = create_connection()
    if not connection:
        raise RuntimeError("Could not connect to the database.")

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                c.cart_item_id,
                p.name,
                p.price,
                c.discounted_price
            FROM cart_items AS c
            JOIN products AS p ON p.product_id = c.product_id
            WHERE c.user_id = %s AND c.product_id = %s
            FOR UPDATE
            """,
            (user_id, product_id),
        )
        item = cursor.fetchone()

        if not item:
            connection.rollback()
            return "not_found", None

        current_price = (
            item["discounted_price"]
            if item["discounted_price"] is not None
            else item["price"]
        )
        previous_price = Decimal(str(current_price)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
        discounted_price = Decimal(str(new_price)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

        if discounted_price >= previous_price:
            connection.rollback()
            return "price_not_lower", None

        cursor.execute(
            """
            INSERT INTO cart_item_price_history
                (user_id, product_id, product_name, previous_price,
                 new_price, reason, changed_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                product_id,
                item["name"],
                previous_price,
                discounted_price,
                reason,
                changed_by,
            ),
        )
        cursor.execute(
            """
            UPDATE cart_items
            SET discounted_price = %s,
                discount_reason = %s,
                discounted_by = %s
            WHERE cart_item_id = %s
            """,
            (discounted_price, reason, changed_by, item["cart_item_id"]),
        )
        connection.commit()
        return "updated", {
            "previous_price": previous_price,
            "new_price": discounted_price,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def add_to_cart(user_id, product_id):
    """Add one unit of a product to the user's cart."""

    connection = create_connection()
    if not connection:
        return False

    cursor = None

    try:
        cursor = connection.cursor()

        # Check that the product exists and get its inventory quantity.
        cursor.execute(
            """
            SELECT quantity
            FROM products
            WHERE product_id = %s
            """,
            (product_id,)
        )
        product = cursor.fetchone()

        if product is None:
            return False

        stock_quantity = product[0]

        # Check whether the product is already in this user's cart.
        cursor.execute(
            """
            SELECT cart_item_id, quantity
            FROM cart_items
            WHERE user_id = %s AND product_id = %s
            """,
            (user_id, product_id)
        )
        cart_item = cursor.fetchone()

        current_quantity = cart_item[1] if cart_item else 0

        # Don't allow cart quantity to exceed current stock.
        if current_quantity + 1 > stock_quantity:
            return False

        if cart_item:
            cursor.execute(
                """
                UPDATE cart_items
                SET quantity = quantity + 1
                WHERE cart_item_id = %s
                """,
                (cart_item[0],)
            )
        else:
            cursor.execute(
                """
                INSERT INTO cart_items (user_id, product_id, quantity)
                VALUES (%s, %s, %s)
                """,
                (user_id, product_id, 1)
            )

        connection.commit()
        return True

    except Exception as error:
        connection.rollback()
        print(f"Error adding item to cart: {error}")
        return False

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def remove_from_cart(user_id, product_id):
    """Remove one product completely from a user's cart."""

    connection = create_connection()
    if not connection:
        return False

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM cart_items
            WHERE user_id = %s AND product_id = %s
            """,
            (user_id, product_id)
        )

        removed = cursor.rowcount > 0
        connection.commit()
        return removed

    except Exception as error:
        connection.rollback()
        print(f"Error removing item from cart: {error}")
        return False

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def clear_cart(user_id):
    """Remove all products from a user's cart."""

    connection = create_connection()
    if not connection:
        return False

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM cart_items
            WHERE user_id = %s
            """,
            (user_id,)
        )

        connection.commit()
        return True

    except Exception as error:
        connection.rollback()
        print(f"Error clearing cart: {error}")
        return False

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def update_cart_quantity(user_id, product_id, quantity):
    """Set a cart item's quantity. A quantity below 1 removes it."""

    # Reject invalid quantity values, including bool (True/False).
    if not isinstance(quantity, int) or isinstance(quantity, bool):
        return False

    if quantity < 1:
        return remove_from_cart(user_id, product_id)

    connection = create_connection()
    if not connection:
        return False

    cursor = None

    try:
        cursor = connection.cursor()

        # Verify the product exists and has enough stock.
        cursor.execute(
            """
            SELECT quantity
            FROM products
            WHERE product_id = %s
            """,
            (product_id,)
        )
        product = cursor.fetchone()

        if product is None or quantity > product[0]:
            return False

        # Update only if the product is already in this user's cart.
        cursor.execute(
            """
            UPDATE cart_items
            SET quantity = %s
            WHERE user_id = %s AND product_id = %s
            """,
            (quantity, user_id, product_id)
        )

        updated = cursor.rowcount > 0
        connection.commit()
        return updated

    except Exception as error:
        connection.rollback()
        print(f"Error updating cart quantity: {error}")
        return False

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def get_cart(user_id):
    """Return cart products with unit-price and line-total information."""

    connection = create_connection()
    if not connection:
        return []

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                c.cart_item_id,
                c.user_id,
                c.product_id,
                c.quantity,
                p.name,
                p.description,
                p.price,
                COALESCE(c.discounted_price, p.price) AS discounted_price,
                c.discount_reason,
                c.discounted_by,
                p.category,
                ROUND(COALESCE(c.discounted_price, p.price) * c.quantity, 2)
                    AS line_total
            FROM cart_items AS c
            JOIN products AS p
                ON c.product_id = p.product_id
            WHERE c.user_id = %s
            ORDER BY c.cart_item_id
            """,
            (user_id,)
        )

        # Apply manager-configured multi-item deals ("3 for $5", etc.).
        return apply_deals_to_cart(cursor.fetchall())

    except Exception as error:
        print(f"Error getting cart: {error}")
        return []

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def get_cart_total(user_id):
    """Calculate the cart total using unit prices."""

    cart = get_cart(user_id)

    total = Decimal("0.00")

    for item in cart:
        line_total = Decimal(str(item["line_total"]))
        total += line_total

    return total.quantize(Decimal("0.01"))


def prepare_receipt_data(user_id):
    """Prepare receipt details from the user's cart.

    This does not save an order or complete checkout.
    """

    cart = get_cart(user_id)

    if not cart:
        return None

    products = []
    total = Decimal("0.00")

    for item in cart:
        unit_price = Decimal(str(item["price"]))
        quantity = int(item["quantity"])
        line_total = Decimal(str(item["line_total"]))

        products.append(
            {
                "product_id": item["product_id"],
                "name": item["name"],
                "quantity": quantity,
                "unit_price": str(unit_price),
                "line_total": str(line_total),
            }
        )

        total += line_total

    return {
        "user_id": user_id,
        "products": products,
        "total": str(total.quantize(Decimal("0.01"))),
    }


def save_order(user_id):
    """Prepare order information from the user's cart.

    This function does not insert an order into the database.
    """

    receipt_data = prepare_receipt_data(user_id)

    if receipt_data is None:
        return None

    return receipt_data

from decimal import Decimal

from connection import create_connection


def add_course_bundle_to_cart(user_id, course_id):
    """Add available course products to the cart and report unavailable items."""

    connection = create_connection()

    if not connection:
        return {
            "success": False,
            "message": "Database connection failed",
            "added": [],
            "unavailable": []
        }

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)

        # Find products assigned to the selected course.
        cursor.execute(
            """
            SELECT p.product_id, p.name, p.quantity
            FROM course_products AS cp
            JOIN products AS p
                ON cp.product_id = p.product_id
            WHERE cp.course_id = %s
            ORDER BY p.product_id
            """,
            (course_id,)
        )

        products = cursor.fetchall()

        added = []
        unavailable = []

        if not products:
            return {
                "success": False,
                "message": "No products found for this course",
                "added": [],
                "unavailable": []
            }

        # Process every product in the course bundle.
        for product in products:
            product_id = product["product_id"]
            product_name = product["name"]

            # Lock the product row while checking its stock.
            cursor.execute(
                """
                SELECT quantity
                FROM products
                WHERE product_id = %s
                FOR UPDATE
                """,
                (product_id,)
            )

            stock = cursor.fetchone()

            if stock is None:
                unavailable.append(product_name)
                continue

            stock_quantity = stock["quantity"]

            # Check whether this product is already in the cart.
            cursor.execute(
                """
                SELECT cart_item_id, quantity
                FROM cart_items
                WHERE user_id = %s AND product_id = %s
                """,
                (user_id, product_id)
            )

            cart_item = cursor.fetchone()

            current_quantity = (
                cart_item["quantity"] if cart_item else 0
            )

            # Skip products without enough available stock.
            if current_quantity + 1 > stock_quantity:
                unavailable.append(product_name)
                continue

            if cart_item:
                # Increase quantity if the product is already in the cart.
                cursor.execute(
                    """
                    UPDATE cart_items
                    SET quantity = quantity + 1
                    WHERE cart_item_id = %s
                    """,
                    (cart_item["cart_item_id"],)
                )
            else:
                # Insert a new product into the cart.
                cursor.execute(
                    """
                    INSERT INTO cart_items
                        (user_id, product_id, quantity)
                    VALUES (%s, %s, %s)
                    """,
                    (user_id, product_id, 1)
                )

            added.append(product_name)

        # Save all successful cart changes together.
        connection.commit()

        if unavailable:
            message = (
                "Available products were added. "
                "Some products could not be added due to insufficient stock."
            )
        else:
            message = "All course products were added successfully."

        return {
            "success": True,
            "message": message,
            "added": added,
            "unavailable": unavailable
        }

    except Exception as error:
        connection.rollback()
        print(f"Error adding course bundle to cart: {error}")

        return {
            "success": False,
            "message": "Failed to add course bundle to cart",
            "added": [],
            "unavailable": []
        }

    finally:
        if cursor is not None:
            cursor.close()

        connection.close()
