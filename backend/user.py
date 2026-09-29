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

# Zulikha as a manager I can group products by category so that I can easily view and manage them. The function will return a dictionary where the keys are category names and the values are lists of products in those categories.
def get_products_by_category(category_name):
    connection = create_connection()
    if connection is None:
        return []
    
    try:
        cursor = connection.cursor(dictionary=True)
    
        query = """
            SELECT category_id, category_name, description
            FROM categories
            WHERE category_name = %s
        """

        cursor.execute(query, (category_name,))
        category = cursor.fetchone()

        cursor.close()
        connection.close()

        if category:
            return category
        else:
            print("Category not found.")
            return None

    except mysql.connector.Error as e:
        print(f"Error getting category: {e}")
        return None