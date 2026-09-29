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