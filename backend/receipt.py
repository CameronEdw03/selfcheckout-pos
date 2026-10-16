# backend/receipt.py

from connection import create_connection


def create_order(user_id: int, total, cart_items):
    connection = create_connection()
    cursor = connection.cursor()

    try:
        if not cart_items:
            raise ValueError("Cannot create an order with an empty cart.")

       
        cursor.execute(
            """
            INSERT INTO orders (user_id, total)
            VALUES (%s, %s)
            """,
            (user_id, total)
        )

       
        order_id = cursor.lastrowid

        
        for item in cart_items:
            product_id = item["product_id"]
            quantity = item["quantity"]
            price_each = item["price_each"]

            if quantity <= 0:
                raise ValueError(
                    f"Invalid quantity for product {product_id}."
                )

            # Decrease inventory only if enough stock is available.
            cursor.execute(
                """
                UPDATE products
                SET quantity = quantity - %s
                WHERE product_id = %s
                  AND quantity >= %s
                """,
                (quantity, product_id, quantity)
            )

            # If no row was updated, the product is missing
            # or there isn't enough inventory.
            if cursor.rowcount != 1:
                raise ValueError(
                    f"Insufficient inventory for product {product_id}."
                )

            # Save this product on the receipt
            cursor.execute(
                """
                INSERT INTO order_items
                    (order_id, product_id, quantity, price_each)
                VALUES (%s, %s, %s, %s)
                """,
                (order_id, product_id, quantity, price_each)
            )

        
        connection.commit()

        return order_id

    except Exception:
        
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()