
from decimal import Decimal
from connection import create_connection


def add_to_cart(user_id, product_id):
    """Add a product to a user's cart."""

    connection = create_connection()

    if not connection:
        return False

    cursor = None

    try:
        cursor = connection.cursor()

        # Check whether the product exists.
        cursor.execute(
            "SELECT product_id FROM products WHERE product_id = %s",
            (product_id,)
        )

        if not cursor.fetchone():
            return False

        # Check whether the product is already in the cart.
        cursor.execute(
            """
            SELECT cart_item_id, quantity
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


def get_cart(user_id):
    """Get all products currently in a user's cart."""

    connection = create_connection()

    if not connection:
        return []

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                c.cart_item_id,
                c.user_id,
                c.product_id,
                c.quantity,
                p.name,
                p.description,
                p.price,
                p.category,
                (p.price * c.quantity) AS line_total
            FROM cart_items AS c
            JOIN products AS p
                ON c.product_id = p.product_id
            WHERE c.user_id = %s
        """

        cursor.execute(query, (user_id,))

        return cursor.fetchall()

    except Exception as error:
        print(f"Error getting cart: {error}")
        return []

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def get_cart_total(user_id):
    """Calculate the total price of all items in a user's cart."""

    connection = create_connection()

    if not connection:
        return Decimal("0.00")

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT SUM(p.price * c.quantity)
            FROM cart_items AS c
            JOIN products AS p
                ON c.product_id = p.product_id
            WHERE c.user_id = %s
            """,
            (user_id,)
        )

        result = cursor.fetchone()

        if result is None or result[0] is None:
            return Decimal("0.00")

        return Decimal(str(result[0]))

    except Exception as error:
        print(f"Error calculating cart total: {error}")
        return Decimal("0.00")

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def update_cart_quantity(user_id, product_id, quantity):
    """Update the quantity of an item in the user's cart."""

    if not isinstance(quantity, int) or isinstance(quantity, bool):
        return False

    if quantity < 1:
        return False

    connection = create_connection()

    if not connection:
        return False

    cursor = None

    try:
        cursor = connection.cursor()

        # Make sure the item exists in the cart.
        cursor.execute(
            """
            SELECT cart_item_id
            FROM cart_items
            WHERE user_id = %s AND product_id = %s
            """,
            (user_id, product_id)
        )

        if cursor.fetchone() is None:
            return False

        # Update the quantity.
        cursor.execute(
            """
            UPDATE cart_items
            SET quantity = %s
            WHERE user_id = %s AND product_id = %s
            """,
            (quantity, user_id, product_id)
        )

        connection.commit()
        return True

    except Exception as error:
        connection.rollback()
        print(f"Error updating cart quantity: {error}")
        return False

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def save_order(user_id):
    """
    Prepare order information from the user's current cart.

    This does not insert an order into the database.
    """

    cart = get_cart(user_id)

    if not cart:
        return None

    total = sum(
        (
            Decimal(str(item["price"])) * item["quantity"]
            for item in cart
        ),
        Decimal("0.00")
    )

    products = [
        {
            "product_id": item["product_id"],
            "name": item["name"],
            "quantity": item["quantity"],
            "unit_price": str(item["price"])
        }
        for item in cart
    ]

    return {
        "user_id": user_id,
        "products": products,
        "total": str(total)
    }
