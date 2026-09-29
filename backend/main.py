from connection import create_connection
from user import get_user


def get_all_users():
    connection = create_connection()

    if connection:
        cursor = connection.cursor(dictionary=True)

        cursor.execute("SELECT * FROM users")

        users = cursor.fetchall()

        cursor.close()
        connection.close()

        return users

    return []


def get_all_products():
    connection = create_connection()

    if connection:
        cursor = connection.cursor(dictionary=True)

        cursor.execute("SELECT * FROM products")

        products = cursor.fetchall()

        cursor.close()
        connection.close()

        return products

    return []


print("USERS")
print("--------------------")

users = get_all_users()

for user in users:
    print(user)


print("\nPRODUCTS")
print("--------------------")

products = get_all_products()

for product in products:
    print(product)