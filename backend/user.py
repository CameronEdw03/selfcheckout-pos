from connection import create_connection 

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


def verify_manager(user_id, password):
    connection = create_connection()

    if not connection:
        return False

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT role, password
            FROM users
            WHERE user_id = %s
            """,
            (user_id,)
        )

        user = cursor.fetchone()

        if not user:
            return False

        if user["role"] != "manager":
            return False

        if user["password"] != password:
            return False

        return True

    finally:
        cursor.close()
        connection.close()
