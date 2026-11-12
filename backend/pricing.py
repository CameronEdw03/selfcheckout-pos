"""Multi-item pricing ("3 for $5", "Buy 2, get 1 free").

Managers create deals; the cart and checkout apply them automatically, so the
price shown to the customer is always the price that is charged.
"""

from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from connection import create_connection

CENT = Decimal("0.01")
DEAL_TYPES = ("bundle_price", "buy_get_free")


def to_money(value) -> Decimal:
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def describe_deal(deal) -> str:
    if deal["deal_type"] == "bundle_price":
        return f"{deal['quantity']} for ${to_money(deal['bundle_price'])}"
    return f"Buy {deal['quantity']}, get {deal['free_quantity']} free"


def _serialize_deal(row):
    deal = {
        "deal_id": row["deal_id"],
        "product_id": row["product_id"],
        "deal_type": row["deal_type"],
        "quantity": int(row["quantity"]),
        "free_quantity": (
            int(row["free_quantity"]) if row["free_quantity"] is not None else None
        ),
        "bundle_price": (
            str(to_money(row["bundle_price"]))
            if row["bundle_price"] is not None
            else None
        ),
        "starts_on": row["starts_on"].isoformat() if row["starts_on"] else None,
        "ends_on": row["ends_on"].isoformat() if row["ends_on"] else None,
        "is_active": bool(row["is_active"]),
    }
    deal["label"] = describe_deal(deal)

    for key in ("product_name", "product_price", "created_by", "created_at"):
        if key in row:
            value = row[key]
            if key == "product_price" and value is not None:
                value = str(to_money(value))
            deal[key] = value

    return deal


def get_active_deals(product_ids=None, on_date=None):
    """Return {product_id: [deal, ...]} for deals that apply on ``on_date``."""
    on_date = on_date or date.today()
    product_ids = [int(pid) for pid in (product_ids or [])]

    connection = create_connection()
    if not connection:
        # Fail open to regular pricing rather than blocking checkout.
        return {}

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)
        query = """
            SELECT deal_id, product_id, deal_type, quantity, free_quantity,
                   bundle_price, starts_on, ends_on, is_active
            FROM multi_item_deals
            WHERE is_active = TRUE
              AND (starts_on IS NULL OR starts_on <= %s)
              AND (ends_on IS NULL OR ends_on >= %s)
        """
        params = [on_date, on_date]

        if product_ids:
            placeholders = ", ".join(["%s"] * len(product_ids))
            query += f" AND product_id IN ({placeholders})"
            params.extend(product_ids)

        cursor.execute(query, params)

        deals = {}
        for row in cursor.fetchall():
            deals.setdefault(row["product_id"], []).append(_serialize_deal(row))
        return deals

    except Exception as error:
        print(f"Error loading multi-item deals: {error}")
        return {}

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def _deal_line_total(deal, quantity: int, base_price: Decimal):
    """Line total for ``quantity`` units under one deal, or None if N/A."""
    if deal["deal_type"] == "bundle_price":
        group_size = deal["quantity"]
        group_price = to_money(deal["bundle_price"])
    else:
        group_size = deal["quantity"] + (deal["free_quantity"] or 0)
        group_price = base_price * deal["quantity"]

    if group_size < 1 or quantity < group_size:
        return None

    groups, remainder = divmod(quantity, group_size)
    return to_money(groups * group_price + remainder * base_price)


def price_cart_line(item, deals_for_product):
    """
    Apply the best multi-item deal to one cart row.

    ``item`` needs ``quantity``, ``price`` (regular shelf price) and
    ``discounted_price`` (the staff-corrected unit price, or the shelf price).
    Returns the fields to merge into the cart row.
    """
    quantity = int(item["quantity"])
    base_price = to_money(item["price"])
    unit_price = to_money(
        item["discounted_price"]
        if item.get("discounted_price") is not None
        else item["price"]
    )

    regular_total = to_money(base_price * quantity)
    best_total = to_money(unit_price * quantity)
    applied = None

    for deal in deals_for_product or []:
        deal_total = _deal_line_total(deal, quantity, base_price)

        # A deal must actually save money, and it must beat any staff
        # price correction already on this line.
        if deal_total is not None and deal_total < best_total:
            best_total = deal_total
            applied = deal

    return {
        "regular_line_total": str(regular_total),
        "line_total": str(best_total),
        "deal_id": applied["deal_id"] if applied else None,
        "deal_label": applied["label"] if applied else None,
        "deal_savings": str(to_money(regular_total - best_total)) if applied else "0.00",
    }


def apply_deals_to_cart(cart_items):
    """Add deal pricing fields to every row returned by ``get_cart``."""
    if not cart_items:
        return cart_items

    deals = get_active_deals([item["product_id"] for item in cart_items])

    for item in cart_items:
        item.update(price_cart_line(item, deals.get(item["product_id"])))

    return cart_items


def split_line_into_order_rows(product_id: int, quantity: int, line_total: Decimal):
    """
    Turn one priced line into order_items rows whose cents add up exactly.

    3 for $5.00 -> [2 @ $1.67, 1 @ $1.66] so reports still sum to $5.00.
    """
    total_cents = int((to_money(line_total) * 100).to_integral_value())
    base_cents, extra = divmod(total_cents, quantity)

    rows = []
    if quantity - extra > 0:
        rows.append(
            {
                "product_id": product_id,
                "quantity": quantity - extra,
                "price": str(Decimal(base_cents) / 100),
            }
        )
    if extra > 0:
        rows.append(
            {
                "product_id": product_id,
                "quantity": extra,
                "price": str(Decimal(base_cents + 1) / 100),
            }
        )
    return rows


# -------------------------
# Manager deal management
# -------------------------

def list_deals():
    connection = create_connection()
    if not connection:
        return None

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT d.*, p.name AS product_name, p.price AS product_price
            FROM multi_item_deals AS d
            JOIN products AS p ON p.product_id = d.product_id
            ORDER BY d.is_active DESC, p.name, d.deal_id
            """
        )
        return [_serialize_deal(row) for row in cursor.fetchall()]

    except Exception as error:
        print(f"Error listing multi-item deals: {error}")
        return None

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def create_deal(
    product_id,
    deal_type,
    quantity,
    free_quantity,
    bundle_price,
    starts_on,
    ends_on,
    created_by,
):
    """Insert a deal. Returns (status, deal_id)."""
    connection = create_connection()
    if not connection:
        raise RuntimeError("Could not connect to the database.")

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT price FROM products WHERE product_id = %s",
            (product_id,),
        )
        product = cursor.fetchone()

        if not product:
            return "product_not_found", None

        if deal_type == "bundle_price":
            regular = to_money(product["price"]) * quantity
            if to_money(bundle_price) >= regular:
                return "no_savings", None

        cursor.execute(
            """
            INSERT INTO multi_item_deals
                (product_id, deal_type, quantity, free_quantity,
                 bundle_price, starts_on, ends_on, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                product_id,
                deal_type,
                quantity,
                free_quantity if deal_type == "buy_get_free" else None,
                to_money(bundle_price) if deal_type == "bundle_price" else None,
                starts_on,
                ends_on,
                created_by,
            ),
        )
        connection.commit()
        return "created", cursor.lastrowid

    except Exception:
        connection.rollback()
        raise

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def set_deal_active(deal_id, is_active: bool) -> bool:
    connection = create_connection()
    if not connection:
        raise RuntimeError("Could not connect to the database.")

    cursor = None

    try:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT 1 FROM multi_item_deals WHERE deal_id = %s",
            (deal_id,),
        )
        if cursor.fetchone() is None:
            return False

        cursor.execute(
            "UPDATE multi_item_deals SET is_active = %s WHERE deal_id = %s",
            (is_active, deal_id),
        )
        connection.commit()
        return True

    except Exception:
        connection.rollback()
        raise

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()
