
from decimal import Decimal, InvalidOperation

from connection import create_connection


def create_order(user_id: int, total, cart_items):
    connection = create_connection()

    if not connection:
        raise RuntimeError("Could not connect to the database.")

    cursor = connection.cursor()

    try:
        if not cart_items:
            raise ValueError("Cannot create an order with an empty cart.")

        order_total = Decimal(str(total)).quantize(Decimal("0.01"))

        cursor.execute(
            """
            INSERT INTO orders (user_id, total)
            VALUES (%s, %s)
            """,
            (user_id, order_total)
        )

        order_id = cursor.lastrowid

        for item in cart_items:
            product_id = int(item["product_id"])
            quantity = int(item["quantity"])

            # Accept the price key from the checkout helper,
            # or price_each if another caller uses that format.
            if item.get("price_each") is not None:
                price_value = item["price_each"]
            elif item.get("price") is not None:
                price_value = item["price"]
            else:
                raise ValueError(
                    f"Missing unit price for product {product_id}."
                )

            try:
                price_each = Decimal(str(price_value)).quantize(
                    Decimal("0.01")
                )
            except (InvalidOperation, ValueError):
                raise ValueError(
                    f"Invalid unit price for product {product_id}."
                )

            if quantity <= 0:
                raise ValueError(
                    f"Invalid quantity for product {product_id}."
                )

            if price_each < 0:
                raise ValueError(
                    f"Invalid unit price for product {product_id}."
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
            # The price_each value is the checkout price,
            # including any student discount applied by main.py.
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
