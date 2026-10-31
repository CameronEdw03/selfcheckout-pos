
from connection import create_connection


def add_product(product_id, name, description, price, quantity, category):
    """Add a new product to the catalog."""
    connection = create_connection()

    if not connection:
        return False

    cursor = None

    try:
        cursor = connection.cursor()

        query = """
            INSERT INTO products
            (product_id, name, description, price, quantity, category)
            VALUES (%s, %s, %s, %s, %s, %s)
        """

        values = (
            product_id,
            name,
            description,
            price,
            quantity,
            category
        )

        cursor.execute(query, values)
        connection.commit()

        return True

    except Exception as error:
        connection.rollback()
        print(f"Error adding product: {error}")
        return False

    finally:
        if cursor:
            cursor.close()
        connection.close()


def edit_product(product_id, name, description, price, quantity, category):
    """Edit an existing product in the catalog."""
    connection = create_connection()

    if not connection:
        return False

    cursor = None

    try:
        cursor = connection.cursor()

        query = """
            UPDATE products
            SET name = %s,
                description = %s,
                price = %s,
                quantity = %s,
                category = %s,
                discount_percent = CASE WHEN %s >= 5 THEN 0 ELSE discount_percent END
            WHERE product_id = %s
        """

        values = (
            name,
            description,
            price,
            quantity,
            category,
            quantity,
            product_id
        )

        cursor.execute(query, values)

        if cursor.rowcount == 0:
            connection.rollback()
            return False

        connection.commit()
        return True

    except Exception as error:
        connection.rollback()
        print(f"Error editing product: {error}")
        return False

    finally:
        if cursor:
            cursor.close()
        connection.close()

def apply_low_stock_discount(product_id, discount_percent=5):
    """Apply the fixed discount only when a product is below the stock threshold."""
    connection = create_connection()

    if not connection:
        return "unavailable"

    cursor = None
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE products
            SET discount_percent = %s
            WHERE product_id = %s
              AND quantity < 5
              AND discount_percent = 0
            """,
            (discount_percent, product_id)
        )
        connection.commit()

        if cursor.rowcount > 0:
            return "applied"

        cursor.execute(
            "SELECT quantity, discount_percent FROM products WHERE product_id = %s",
            (product_id,)
        )
        product = cursor.fetchone()

        if not product:
            return "not_found"
        if product[0] >= 5:
            return "stock_not_eligible"
        return "already_discounted"
    except Exception as error:
        print(f"Error applying product discount: {error}")
        return "unavailable"
    finally:
        if cursor:
            cursor.close()
        connection.close()


def remove_product(product_id):
    """Remove a product from the catalog."""
    connection = create_connection()

    if not connection:
        return False

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute(
            "DELETE FROM products WHERE product_id = %s",
            (product_id,)
        )

        if cursor.rowcount == 0:
            connection.rollback()
            return False

        connection.commit()
        return True

    except Exception as error:
        connection.rollback()
        print(f"Error removing product: {error}")
        return False

    finally:
        if cursor:
            cursor.close()
        connection.close()


def get_all_products():
    """Retrieve all products from the catalog."""
    connection = create_connection()

    if not connection:
        return []

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT * FROM products")
        return cursor.fetchall()

    except Exception as error:
        print(f"Error retrieving products: {error}")
        return []

    finally:
        if cursor:
            cursor.close()
        connection.close()


def deduct_inventory(product_id, quantity):
    """Deduct purchased units without allowing negative inventory."""
    if quantity <= 0:
        return False

    connection = create_connection()

    if not connection:
        return False

    cursor = None

    try:
        cursor = connection.cursor()

        query = """
            UPDATE products
            SET quantity = quantity - %s
            WHERE product_id = %s
              AND quantity >= %s
        """

        cursor.execute(query, (quantity, product_id, quantity))

        if cursor.rowcount == 0:
            connection.rollback()
            return False

        connection.commit()
        return True

    except Exception as error:
        connection.rollback()
        print(f"Error deducting inventory: {error}")
        return False

    finally:
        if cursor:
            cursor.close()
        connection.close()
