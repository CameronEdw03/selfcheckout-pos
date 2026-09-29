from connection import create_connection


def add_product(product_id, name, description, price, quantity, category):
    """Add a new product to the catalog."""
    connection = create_connection()

    if not connection:
        return False

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
        print(f"Error adding product: {error}")
        return False

    finally:
        cursor.close()
        connection.close()


def edit_product(product_id, name, description, price, quantity, category):
    """Edit an existing product in the catalog."""
    connection = create_connection()

    if not connection:
        return False

    try:
        cursor = connection.cursor()

        query = """
            UPDATE products
            SET name = %s,
                description = %s,
                price = %s,
                quantity = %s,
                category = %s
            WHERE product_id = %s
        """

        values = (
            name,
            description,
            price,
            quantity,
            category,
            product_id
        )

        cursor.execute(query, values)
        connection.commit()

        if cursor.rowcount == 0:
            return False

        return True

    except Exception as error:
        print(f"Error editing product: {error}")
        return False

    finally:
        cursor.close()
        connection.close()


def remove_product(product_id):
    """Remove a product from the catalog."""
    connection = create_connection()

    if not connection:
        return False

    try:
        cursor = connection.cursor()

        query = """
            DELETE FROM products
            WHERE product_id = %s
        """

        cursor.execute(query, (product_id,))
        connection.commit()

        if cursor.rowcount == 0:
            return False

        return True

    except Exception as error:
        print(f"Error removing product: {error}")
        return False

    finally:
        cursor.close()
        connection.close()