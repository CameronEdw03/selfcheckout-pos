from decimal import Decimal
from connection import create_connection


def add_to_cart(user_id, product_id):
    """Add a product to a user's cart."""

    connection = create_connection()

    if not connection:
        return False

    try:
        cursor = connection.cursor()

        # Check if the product exists
        cursor.execute(
            "SELECT product_id FROM products WHERE product_id = %s",
            (product_id,)
        )

        product = cursor.fetchone()

        if not product:
            return False

        # Check if the product is already in the user's cart
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
            # Product is already in the cart, so increase quantity
            cursor.execute(
                """
                UPDATE cart_items
                SET quantity = quantity + 1
                WHERE cart_item_id = %s
                """,
                (cart_item[0],)
            )
        else:
            # Product is not in the cart, so add it
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
        print(f"Error adding item to cart: {error}")
        return False

    finally:
        cursor.close()
        connection.close()


def remove_from_cart(user_id, product_id):
    """Remove a product completely from a user's cart."""

    connection = create_connection()

    if not connection:
        return False

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM cart_items
            WHERE user_id = %s AND product_id = %s
            """,
            (user_id, product_id)
        )

        connection.commit()

        if cursor.rowcount == 0:
            return False

        return True

    except Exception as error:
        print(f"Error removing item from cart: {error}")
        return False

    finally:
        cursor.close()
        connection.close()


def get_cart(user_id):
    """Get all products currently in a user's cart."""

    connection = create_connection()

    if not connection:
        return []

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
                p.category
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
        cursor.close()
        connection.close()


def get_cart_total(user_id):
    """Calculate the total price of everything in a user's cart."""

    connection = create_connection()

    if not connection:
        return Decimal("0.00")

    try:
        cursor = connection.cursor()

        query = """
            SELECT SUM(p.price * c.quantity)
            FROM cart_items AS c
            JOIN products AS p
                ON c.product_id = p.product_id
            WHERE c.user_id = %s
        """

        cursor.execute(query, (user_id,))

        result = cursor.fetchone()

        if result[0] is None:
            return Decimal("0.00")

        return Decimal(str(result[0]))

    except Exception as error:
        print(f"Error calculating cart total: {error}")
        return Decimal("0.00")

    finally:
        cursor.close()
        connection.close()

