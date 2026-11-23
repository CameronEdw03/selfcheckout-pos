from datetime import timedelta
from decimal import Decimal

from connection import create_connection


def log_staff_activity(
    staff_username,
    action,
    student_id=None,
    product_id=None,
    product_name=None,
    quantity=None,
    amount=None,
    details=None,
):
    """Record one staff action. Returns True if the row was saved."""

    connection = create_connection()
    if not connection:
        return False

    cursor = None

    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO staff_activity_log
                (staff_username, action, student_id, product_id,
                 product_name, quantity, amount, details)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                staff_username,
                action,
                student_id,
                product_id,
                product_name,
                quantity,
                amount,
                details,
            ),
        )
        connection.commit()
        return True

    except Exception as error:
        connection.rollback()
        print(f"Error logging staff activity: {error}")
        return False

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def get_staff_activity(start_date, end_date):
    """
    Return every staff (employee) change between two dates, inclusive.

    Combines product price discounts, transaction item discounts, and the
    staff_activity_log into one list, newest first.
    """

    connection = create_connection()
    if not connection:
        return None

    cursor = None

    # Use a half-open range so the index on created_at can be used.
    start = start_date
    end = end_date + timedelta(days=1)

    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                'price_change' AS action,
                h.changed_by AS staff_username,
                NULL AS student_id,
                h.product_id,
                h.product_name,
                NULL AS quantity,
                h.previous_price,
                h.new_price,
                NULL AS amount,
                h.reason AS details,
                h.changed_at AS created_at
            FROM product_price_history AS h
            JOIN users AS u
                ON u.username = h.changed_by
               AND u.role = 'employee'
            WHERE h.changed_at >= %s AND h.changed_at < %s

            UNION ALL

            SELECT
                'transaction_discount',
                h.changed_by,
                s.student_id,
                h.product_id,
                h.product_name,
                NULL,
                h.previous_price,
                h.new_price,
                NULL,
                h.reason,
                h.changed_at
            FROM cart_item_price_history AS h
            JOIN users AS u
                ON u.username = h.changed_by
               AND u.role = 'employee'
            LEFT JOIN users AS s
                ON s.user_id = h.user_id
            WHERE h.changed_at >= %s AND h.changed_at < %s

            UNION ALL

            SELECT
                a.action,
                a.staff_username,
                a.student_id,
                a.product_id,
                a.product_name,
                a.quantity,
                NULL,
                NULL,
                a.amount,
                a.details,
                a.created_at
            FROM staff_activity_log AS a
            WHERE a.created_at >= %s AND a.created_at < %s

            ORDER BY created_at DESC
            """,
            (start, end, start, end, start, end),
        )
        rows = cursor.fetchall()

        cursor.execute(
            """
            SELECT username
            FROM users
            WHERE role = 'employee'
            ORDER BY username
            """
        )
        staff_members = [row["username"] for row in cursor.fetchall()]

    except Exception as error:
        print(f"Error retrieving staff activity: {error}")
        return None

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()

    activities = []

    for row in rows:
        previous_price = row["previous_price"]
        new_price = row["new_price"]
        discount_amount = None

        if previous_price is not None and new_price is not None:
            discount_amount = Decimal(str(previous_price)) - Decimal(
                str(new_price)
            )

        activities.append(
            {
                "action": row["action"],
                "staff_username": row["staff_username"],
                "student_id": row["student_id"],
                "product_id": row["product_id"],
                "product_name": row["product_name"],
                "quantity": row["quantity"],
                "previous_price": (
                    float(previous_price) if previous_price is not None else None
                ),
                "new_price": float(new_price) if new_price is not None else None,
                "discount_amount": (
                    float(discount_amount) if discount_amount is not None else None
                ),
                # Value of the items taken out of a student transaction.
                "amount": (
                    float(row["amount"]) if row["amount"] is not None else None
                ),
                "details": row["details"],
                "created_at": row["created_at"],
            }
        )

    return {
        "activities": activities,
        "staff_members": staff_members,
    }
