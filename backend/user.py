import mysql

from connection import create_connection 


def insert_user(user_id, username, password, role="student", student_id=None):
    connection = create_connection()

    if not connection:
        return False

    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO users (user_id, username, password, role, student_id)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (user_id, username, password, role, student_id)
        )
        connection.commit()
        return True
    finally:
        cursor.close()
        connection.close()


def get_user(username):
    connection = create_connection()

    if connection:
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT * FROM users WHERE username = %s",
            (username,)
        )

        user = cursor.fetchone()

        cursor.close()

        connection.close()

        return user

def get_user_byrole(role):
    connection = create_connection()

    if connection:
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT * FROM users WHERE role = %s",
            (role,)
        )

        user = cursor.fetchone()

        cursor.close()

        connection.close()

        return user

def delete_user(username):
    connection = create_connection()

    if not connection:
        return False

    cursor = connection.cursor()

    try:
        cursor.execute(
            "DELETE FROM users WHERE username = %s",
            (username,)
        )
        deleted = cursor.rowcount > 0
        if deleted:
            connection.commit()
        return deleted
    finally:
        cursor.close()
        connection.close()

def get_student(student_id):
    connection = create_connection()

    if connection:
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT * FROM users
            WHERE student_id = %s
            AND role = 'student'
            """,
            (student_id,)
        )

        student = cursor.fetchone()

        cursor.close()
        connection.close()

        return student

    # Zulikha as a manager I can load all product

def get_all(products):
    connection = create_connection()

    if connection is None:
        return []

    try:
        cursor = connection.cursor(dictionary=True)

        query = "SELECT * FROM products"
        cursor.execute(query)

        users = cursor.fetchall()

        return users

    except Exception as error:
        print(f"Error getting products: {error}")
        return []

    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

   
# as a manager I can load all products.

def get_all_products():
    connection = create_connection()

    if connection is None:
        return None

    try:
        cursor = connection.cursor(dictionary=True)

        query = "SELECT * FROM products"
        cursor.execute(query)

        products = cursor.fetchall()

        return products

    except Exception as error:
        print(f"Error getting products: {error}")
        return None

    finally:
        if cursor:
            cursor.close()

        if connection.is_connected():
            connection.close()

# Zulikha as a manager I can get products by specificcategory.
def get_products_by_category(category):
    connection = create_connection()

    if connection is None:
        return []

    try:
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT product_id, name, price, category
            FROM products
            WHERE category = %s
        """

        cursor.execute(query, (category,))
        products = cursor.fetchall()

        cursor.close()
        connection.close()

        if products:
            return products
        else:
            print("No products found in this category.")
            return []

    except mysql.connector.Error as e:
        print(f"Error getting products by category: {e}")
        return []

# Zulikha as a manager I can group products by categoryand see the total count.
def get_products_grouped_by_category():
    connection = create_connection()

    if connection is None:
        return []

    try:
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT category,
                   COUNT(*) AS total_items
            FROM products
            GROUP BY category
        """

        cursor.execute(query)
        results = cursor.fetchall()

        cursor.close()
        connection.close()

        return results

    except mysql.connector.Error as e:
        print(f"Error grouping products by category: {e}")
        return []