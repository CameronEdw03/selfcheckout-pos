# cart.py

from decimal import Decimal

from connection import create_connection


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
    """Return cart products with discount and line-total information."""

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
                COALESCE(p.discount_percent, 0) AS discount_percent,
                ROUND(
                    p.price * (1 - COALESCE(p.discount_percent, 0) / 100.0),
                    2
                ) AS discounted_price,
                p.category,
                ROUND(
                    p.price * (1 - COALESCE(p.discount_percent, 0) / 100.0)
                    * c.quantity,
                    2
                ) AS line_total
            FROM cart_items AS c
            JOIN products AS p
                ON c.product_id = p.product_id
            WHERE c.user_id = %s
            ORDER BY c.cart_item_id
            """,
            (user_id,)
        )

        return cursor.fetchall()

    except Exception as error:
        print(f"Error getting cart: {error}")
        return []

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def get_cart_total(user_id):
    """Calculate the cart total using discounted unit prices."""

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
        unit_price = Decimal(str(item["discounted_price"]))
        quantity = int(item["quantity"])
        line_total = Decimal(str(item["line_total"]))

        products.append(
            {
                "product_id": item["product_id"],
                "name": item["name"],
                "quantity": quantity,
                "unit_price": str(unit_price),
                "discount_percent": str(item["discount_percent"]),
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
