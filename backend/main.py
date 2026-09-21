from connection import create_connection

#gets all products when you run python3 main.py
connection = create_connection()

if connection:
    cursor = connection.cursor(dictionary=True)

    cursor.execute("SELECT * FROM products")

    products = cursor.fetchall()

    for product in products:
        print(product)

    cursor.close()
    connection.close()