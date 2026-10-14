

from decimal import Decimal
from connection import create_connection


def add_to_cart(user_id, product_id):
    """Add a product to a user's cart, incrementing quantity if needed."""
    connection = create_connection()
    if not connection:
        return False

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute(
            "SELECT product_id FROM products WHERE product_id = %s",
            (product_id,)
        )

        if not cursor.fetchone():
            return False

        cursor.execute(
            """
            SELECT cart_item_id
            FROM cart_items
            WHERE user_id = %s AND product_id = %s
            """,
            (user_id, product_id)
        )

        cart_item = cursor.fetchone()

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


def update_cart_quantity(user_id, product_id, quantity):
    """Set a cart item's quantity to the requested amount."""
    if quantity < 1:
        return False

    connection = create_connection()
    if not connection:
        return False

    cursor = None

    try:
        cursor = connection.cursor()

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


def remove_from_cart(user_id, product_id=None):
    """Remove one product or clear the user's entire cart."""
    connection = create_connection()
    if not connection:
        return False

    cursor = None

    try:
        cursor = connection.cursor()

        if product_id is None:
            cursor.execute(
                "DELETE FROM cart_items WHERE user_id = %s",
                (user_id,)
            )
        else:
            cursor.execute(
                """
                DELETE FROM cart_items
                WHERE user_id = %s AND product_id = %s
                """,
                (user_id, product_id)
            )

        deleted = cursor.rowcount > 0
        connection.commit()
        return deleted

    except Exception as error:
        connection.rollback()
        print(f"Error removing item from cart: {error}")
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
    """Calculate the cart total using discounted prices."""
    connection = create_connection()
    if not connection:
        return Decimal("0.00")

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT COALESCE(
                SUM(
                    ROUND(
                        p.price
                        * (1 - COALESCE(p.discount_percent, 0) / 100.0),
                        2
                    ) * c.quantity
                ),
                0
            )
            FROM cart_items AS c
            JOIN products AS p
                ON c.product_id = p.product_id
            WHERE c.user_id = %s
            """,
            (user_id,)
        )

        result = cursor.fetchone()
        return Decimal(str(result[0]))

    except Exception as error:
        print(f"Error calculating cart total: {error}")
        return Decimal("0.00")

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def prepare_receipt_data(user_id):
    """Prepare receipt details from the current cart.

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

        products.append({
            "product_id": item["product_id"],
            "name": item["name"],
            "quantity": quantity,
            "unit_price": str(unit_price),
            "discount_percent": str(item["discount_percent"]),
            "line_total": str(line_total)
        })

        total += line_total

    return {
        "user_id": user_id,
        "products": products,
        "total": str(total.quantize(Decimal("0.01")))
    }

