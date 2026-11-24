
from connection import create_connection


def check_cash_drawer(drawer_id=1):
    """Check whether the cash drawer is below its minimum balance."""
    connection = create_connection()

    if connection is None:
        return {"success": False, "message": "Database connection failed."}

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT current_balance, minimum_balance
            FROM cash_drawer
            WHERE drawer_id = %s
            """,
            (drawer_id,)
        )

        drawer = cursor.fetchone()

        if drawer is None:
            return {"success": False, "message": "Cash drawer not found."}

        balance = drawer["current_balance"]
        minimum = drawer["minimum_balance"]
        low_balance = balance < minimum

        return {
            "success": True,
            "current_balance": float(balance),
            "minimum_balance": float(minimum),
            "low_balance": low_balance,
            "message": (
                "Warning: Cash drawer is low on change!"
                if low_balance
                else "Cash drawer balance is sufficient."
            )
        }

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def update_minimum_balance(drawer_id, new_minimum):
    """Update the minimum cash drawer balance."""
    from decimal import Decimal, InvalidOperation

    try:
        amount = Decimal(str(new_minimum))
        if not amount.is_finite() or amount < 0:
            return {"success": False, "message": "Invalid minimum balance."}
        if amount != amount.quantize(Decimal("0.01")):
            return {"success": False, "message": "Use no more than two decimal places."}
    except (InvalidOperation, ValueError):
        return {"success": False, "message": "Invalid minimum balance."}

    connection = create_connection()

    if connection is None:
        return {"success": False, "message": "Database connection failed."}

    cursor = None

    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE cash_drawer
            SET minimum_balance = %s
            WHERE drawer_id = %s
            """,
            (amount, drawer_id)
        )

        if cursor.rowcount == 0:
            return {"success": False, "message": "Cash drawer not found."}

        connection.commit()

        return {
            "success": True,
            "message": "Minimum cash drawer balance updated.",
            "minimum_balance": float(amount)
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()
