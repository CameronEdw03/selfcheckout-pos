import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv
import os

load_dotenv()


def create_connection():
    try:
        connection = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            port=int(os.getenv("DB_PORT", 3306)),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            use_pure=True
        )

        if connection.is_connected():
            print("Connected to MySQL successfully!")
            return connection

    except Error as error:
        print(f"Error connecting to MySQL: {error}")

    return None


if __name__ == "__main__":
    connection = create_connection()

    if connection:
        connection.close()
        print("Connection closed.")