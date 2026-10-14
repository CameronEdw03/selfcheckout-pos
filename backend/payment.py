
from decimal import Decimal, InvalidOperation


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
