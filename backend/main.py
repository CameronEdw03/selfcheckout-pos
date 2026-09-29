from connection import create_connection
from user import delete_user, get_all, get_products_by_category, get_user, get_user_byrole, insert_user


# def get_all_users():
#     connection = create_connection()

#     if connection:
#         cursor = connection.cursor(dictionary=True)

#         cursor.execute("SELECT * FROM users")

#         users = cursor.fetchall()

#         cursor.close()
#         connection.close()

#         return users

#     return []




# print("USERS")
# print("--------------------")

# users = get_all_users()

# for user in users:
#     print(user)


# print("\nPRODUCTS")
# print("--------------------")

# products = get_all_products()

# for product in products:
#     print(product)





#Zulikha adding mock user
# print("\nINSERT USER")
# new_username = "jane_doe"
# new_password = "securepassword"
# new_role = "student"
# new_student_id = "123456"

# if insert_user(34,new_username, new_password, new_role, new_student_id):
#     print("User inserted.")
# else:
#     print("Could not connect to the database; user was not inserted.")

#zulikha getting user by username
# username = "jane_doe"
# user = get_user(username)
# print(user if user else "User not found.")

#zulikha deleting user by username
# username_to_delete = "jane_doe"
# delete_user(username_to_delete)

# #zulikha getting user by role
# role='student'
# user=get_user_byrole(role)
# print(user if user else "User not found.")

# Zulikha as a manager get all products

# products = get_all("products")
# print(products)

# Zulikha as a manager I can group products by category and load all products in a specific category
category = get_products_by_category("books")
print(category if category else "No products found in this category.")





