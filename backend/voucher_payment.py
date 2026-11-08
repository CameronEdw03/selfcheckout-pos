from decimal import Decimal, InvalidOperation


def calculate_voucher_payment(total, voucher_amount):
    try:
        total = Decimal(str(total))
        voucher = Decimal(str(voucher_amount))
    except (InvalidOperation, ValueError):
        return {
            "success": False,
            "message": "Invalid payment amount."
        }

    if not total.is_finite() or not voucher.is_finite():
        return {
            "success": False,
            "message": "Payment amounts must be finite."
        }

    if total <= 0:
        return {
            "success": False,
            "message": "Cart total must be greater than zero."
        }

    if voucher <= 0:
        return {
            "success": False,
            "message": "Voucher amount must be greater than zero."
        }

    if voucher > total:
        return {
            "success": False,
            "message": "Voucher cannot exceed the total."
        }

    if total != total.quantize(Decimal("0.01")) or voucher != voucher.quantize(Decimal("0.01")):
        return {
            "success": False,
            "message": "Amounts cannot have more than two decimal places."
        }

    remaining = total - voucher

    return {
        "success": True,
        "voucher_amount": str(voucher),
        "remaining_amount": str(remaining),
        "message": "Voucher amount calculated successfully."
    }

def process_voucher_split_payment(
    total,
    voucher_amount,
    payment_method,
    cash_received="0",
    card_approved=False
):
    from payment import pay_with_cash, pay_with_card

    result = calculate_voucher_payment(total, voucher_amount)

    if not result["success"]:
        return result

    remaining = Decimal(result["remaining_amount"])

    if payment_method not in ("cash", "card"):
        return {
            "success": False,
            "message": "Payment method must be cash or card."
        }

    if remaining == 0:
        return {
            **result,
            "payment_method": payment_method,
            "change": "0.00",
            "message": "Voucher covers the full purchase."
        }

    if payment_method == "cash":
        payment = pay_with_cash(remaining, cash_received)
    else:
        payment = pay_with_card(remaining, card_approved)

    if not payment["success"]:
        return payment

    return {
        **result,
        "payment_method": payment_method,
        "change": str(payment.get("change", "0.00")),
        "message": "Split payment validated successfully."
    }


def process_voucher_split_payment(
    total,
    voucher_amount,
    payment_method,
    cash_received="0",
    card_approved=False
):
    from payment import pay_with_cash, pay_with_card

    result = calculate_voucher_payment(total, voucher_amount)

    if not result["success"]:
        return result

    remaining = Decimal(result["remaining_amount"])

    if payment_method not in ("cash", "card"):
        return {
            "success": False,
            "message": "Payment method must be cash or card."
        }

    if remaining == 0:
        return {
            **result,
            "payment_method": payment_method,
            "change": "0.00",
            "message": "Voucher covers the full purchase."
        }

    if payment_method == "cash":
        payment = pay_with_cash(remaining, cash_received)
    else:
        payment = pay_with_card(remaining, card_approved)

    if not payment["success"]:
        return payment

    return {
        **result,
        "payment_method": payment_method,
        "change": str(payment.get("change", "0.00")),
        "message": "Split payment validated successfully."
    }


def verify_voucher_approver(username, password):
    from user import get_user

    manager = get_user(username)

    if not manager:
        return {
            "success": False,
            "message": "Invalid username or password."
        }

    if manager["password"] != password:
        return {
            "success": False,
            "message": "Invalid username or password."
        }

    if manager["role"] != "manager":
        return {
            "success": False,
            "message": "Manager approval is required."
        }

    return {
        "success": True,
        "approved_by_staff_id": manager["user_id"],
        "message": "Voucher payment approved."
    }