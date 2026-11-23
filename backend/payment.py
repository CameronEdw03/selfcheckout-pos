
from decimal import Decimal, InvalidOperation

from connection import create_connection


def pay_with_cash(total, cash_received):
    """Process a cash payment and calculate change."""

    try:
        total = Decimal(str(total))
        cash_received = Decimal(str(cash_received))
    except (InvalidOperation, ValueError):
        return {
            "success": False,
            "message": "Invalid payment amount."
        }

    if not total.is_finite() or not cash_received.is_finite():
        return {
            "success": False,
            "message": "Invalid payment amount."
        }

    if total <= 0 or cash_received < 0:
        return {
            "success": False,
            "message": "Invalid payment amount."
        }

    if total != total.quantize(Decimal("0.01")) or cash_received != cash_received.quantize(Decimal("0.01")):
        return {
            "success": False,
            "message": "Amounts must have no more than two decimal places."
        }

    if cash_received < total:
        return {
            "success": False,
            "message": "Insufficient cash. Payment declined."
        }

    change = cash_received - total

    return {
        "success": True,
        "message": "Cash payment successful.",
        "change": change
    }



def pay_with_card(total, approved=True):
    """Simulate a card payment without charging a real card."""

    try:
        total = Decimal(str(total))
    except (InvalidOperation, ValueError):
        return {
            "success": False,
            "message": "Invalid payment amount."
        }

    if not total.is_finite() or total <= 0:
        return {
            "success": False,
            "message": "Invalid payment amount."
        }

    if total != total.quantize(Decimal("0.01")):
        return {
            "success": False,
            "message": "Invalid payment amount."
        }

    if type(approved) is not bool:
        return {
            "success": False,
            "message": "Invalid approval status."
        }

    if approved:
        return {
            "success": True,
            "message": "Card payment approved."
        }

    return {
        "success": False,
        "message": "Card payment declined."
    }


def pay_with_voucher(student_id, total):
    """Deduct the checkout total from a student's voucher balance."""

    try:
        total = Decimal(str(total))
    except (InvalidOperation, ValueError):
        return {
            "success": False,
            "message": "Invalid payment amount."
        }

    if not total.is_finite() or total <= 0:
        return {
            "success": False,
            "message": "Invalid payment amount."
        }

    if total != total.quantize(Decimal("0.01")):
        return {
            "success": False,
            "message": "Invalid payment amount."
        }

    connection = create_connection()
    if not connection:
        return {
            "success": False,
            "message": "Voucher service is unavailable. Please try again."
        }

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT balance
            FROM student_vouchers
            WHERE student_id = %s
            FOR UPDATE
            """,
            (student_id,)
        )
        voucher = cursor.fetchone()

        if voucher is None:
            connection.rollback()
            return {
                "success": False,
                "message": "No voucher found for this student ID."
            }

        balance = Decimal(str(voucher[0]))

        if balance < total:
            connection.rollback()
            return {
                "success": False,
                "message": (
                    f"Insufficient voucher balance (${balance:.2f} available). "
                    "Payment declined."
                )
            }

        cursor.execute(
            """
            UPDATE student_vouchers
            SET balance = balance - %s
            WHERE student_id = %s
            """,
            (total, student_id)
        )
        connection.commit()

        return {
            "success": True,
            "message": "Student voucher payment approved.",
            "remaining_balance": balance - total
        }

    except Exception as error:
        connection.rollback()
        print(f"Error processing voucher payment: {error}")
        return {
            "success": False,
            "message": "Voucher payment failed. Please try again."
        }

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def refund_voucher(student_id, amount):
    """Return an amount to a student's voucher balance."""

    connection = create_connection()
    if not connection:
        return False

    cursor = None

    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE student_vouchers
            SET balance = balance + %s
            WHERE student_id = %s
            """,
            (Decimal(str(amount)), student_id)
        )
        connection.commit()
        return cursor.rowcount == 1

    except Exception as error:
        connection.rollback()
        print(f"Error refunding voucher: {error}")
        return False

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()
