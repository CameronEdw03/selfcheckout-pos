
from decimal import Decimal, InvalidOperation

from connection import create_connection
from payment import pay_with_campus_card


class CampusCardPaymentError(Exception):
    pass


def create_order(
    user_id: int,
    total,
    cart_items,
    payment_method=None,
    student_id=None,
    voucher_payment=None,
    connection=None,
):
    owns_connection = connection is None

    if owns_connection:
        connection = create_connection()

    if not connection:
        raise RuntimeError("Could not connect to the database.")

    cursor = None

    try:
        cursor = connection.cursor()

        if not cart_items:
            raise ValueError("Cannot create an order with an empty cart.")

        order_total = Decimal(str(total)).quantize(Decimal("0.01"))

        if not order_total.is_finite() or order_total < 0:
            raise ValueError("Invalid order total.")

        # Process Campus Card payment.
        if payment_method == "campus_card":
            payment_result = pay_with_campus_card(
                student_id,
                order_total,
                connection,
            )

            if not payment_result["success"]:
                raise CampusCardPaymentError(
                    payment_result["message"]
                )

        # Create the order.
        cursor.execute(
            """
            INSERT INTO orders
                (user_id, total, payment_method, student_id)
            VALUES (%s, %s, %s, %s)
            """,
            (user_id, order_total, payment_method, student_id),
        )

        order_id = cursor.lastrowid

        for item in cart_items:
            product_id = int(item["product_id"])
            quantity = int(item["quantity"])

            # Accept either price_each or price.
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

            if not price_each.is_finite() or price_each < 0:
                raise ValueError(
                    f"Invalid unit price for product {product_id}."
                )

            # Decrease inventory only when enough stock exists.
            cursor.execute(
                """
                UPDATE products
                SET quantity = quantity - %s
                WHERE product_id = %s
                  AND quantity >= %s
                """,
                (quantity, product_id, quantity),
            )

            if cursor.rowcount != 1:
                raise ValueError(
                    f"Insufficient inventory for product {product_id}."
                )

            # Save the product on the receipt.
            cursor.execute(
                """
                INSERT INTO order_items
                    (order_id, product_id, quantity, price_each)
                VALUES (%s, %s, %s, %s)
                """,
                (order_id, product_id, quantity, price_each),
            )

        # Record voucher payment and approving manager.
        if voucher_payment is not None:
            cursor.execute(
                """
                INSERT INTO voucher_payments (
                    order_id,
                    voucher_amount,
                    remaining_amount,
                    remaining_payment_method,
                    approved_by_staff_id
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    order_id,
                    voucher_payment["voucher_amount"],
                    voucher_payment["remaining_amount"],
                    voucher_payment["payment_method"],
                    voucher_payment["approved_by_staff_id"],
                ),
            )

        # Clear the cart inside the Campus Card transaction.
        if payment_method == "campus_card":
            cursor.execute(
                """
                DELETE FROM cart_items
                WHERE user_id = %s
                """,
                (user_id,),
            )

        # Save all transaction changes together.
        connection.commit()

        return order_id

    except Exception:
        # Undo transaction changes if any operation fails.
        connection.rollback()
        raise

    finally:
        if cursor is not None:
            cursor.close()

        if owns_connection:
            connection.close()
