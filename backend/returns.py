from datetime import datetime, timedelta
from decimal import Decimal

from connection import create_connection


# Items can be returned for this many days after purchase.
RETURN_WINDOW_DAYS = 30

REFUND_METHOD_LABELS = {
    "cash": "Cash",
    "card": "Card",
    "voucher": "Student Voucher",
}


class ReturnError(Exception):
    """A return that can't be completed. status_code maps to the HTTP status."""

    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def _return_deadline(created_at: datetime) -> datetime:
    return created_at + timedelta(days=RETURN_WINDOW_DAYS)


def _load_order(cursor, order_id: int, lock: bool = False):
    """Load an order, its receipt lines, and how much of each was returned."""

    cursor.execute(
        """
        SELECT order_id, user_id, total, payment_method, student_id, created_at
        FROM orders
        WHERE order_id = %s
        """ + (" FOR UPDATE" if lock else ""),
        (order_id,),
    )
    order = cursor.fetchone()

    if not order:
        return None, []

    cursor.execute(
        """
        SELECT
            oi.order_item_id,
            oi.product_id,
            COALESCE(p.name, CONCAT('Product #', oi.product_id)) AS name,
            oi.quantity,
            oi.price_each,
            COALESCE(SUM(ri.quantity), 0) AS returned_quantity
        FROM order_items oi
        LEFT JOIN products p ON p.product_id = oi.product_id
        LEFT JOIN order_return_items ri ON ri.order_item_id = oi.order_item_id
        WHERE oi.order_id = %s
        GROUP BY oi.order_item_id, oi.product_id, p.name,
                 oi.quantity, oi.price_each
        ORDER BY oi.order_item_id
        """,
        (order_id,),
    )
    items = cursor.fetchall()

    return order, items


def _serialize_order(order, items, returns=None):
    deadline = _return_deadline(order["created_at"])
    within_window = datetime.now() <= deadline

    serialized_items = []
    for item in items:
        purchased = int(item["quantity"])
        returned = int(item["returned_quantity"])
        serialized_items.append(
            {
                "order_item_id": item["order_item_id"],
                "product_id": item["product_id"],
                "name": item["name"],
                "quantity": purchased,
                "returned_quantity": returned,
                "returnable_quantity": max(purchased - returned, 0)
                if within_window
                else 0,
                "price_each": str(Decimal(str(item["price_each"]))),
            }
        )

    payment_method = order["payment_method"]

    return {
        "order_id": order["order_id"],
        "total": str(order["total"]),
        "payment_method": payment_method,
        "refund_method_label": REFUND_METHOD_LABELS.get(
            payment_method, "Original payment"
        ),
        "created_at": order["created_at"].isoformat(),
        "return_deadline": deadline.isoformat(),
        "within_return_window": within_window,
        "items": serialized_items,
        "returns": returns or [],
    }


def _load_previous_returns(cursor, order_id: int):
    cursor.execute(
        """
        SELECT return_id, refund_total, refund_method, reason, created_at
        FROM order_returns
        WHERE order_id = %s
        ORDER BY created_at, return_id
        """,
        (order_id,),
    )
    return [
        {
            "return_id": row["return_id"],
            "refund_total": str(row["refund_total"]),
            "refund_method": row["refund_method"],
            "reason": row["reason"],
            "created_at": row["created_at"].isoformat(),
        }
        for row in cursor.fetchall()
    ]


def get_order_for_return(order_id: int, user_id: int):
    """Return the order details a customer needs to choose items to return."""

    connection = create_connection()
    if not connection:
        raise ReturnError(503, "Returns are unavailable. Please try again.")

    cursor = connection.cursor(dictionary=True)

    try:
        order, items = _load_order(cursor, order_id)

        # Use the same message for "missing" and "not yours" so transaction
        # numbers belonging to other people can't be discovered.
        if not order or int(order["user_id"]) != int(user_id):
            raise ReturnError(
                404, "No transaction with that number was found on your account."
            )

        return _serialize_order(
            order, items, _load_previous_returns(cursor, order_id)
        )

    finally:
        cursor.close()
        connection.close()


def process_return(order_id: int, user_id: int, requested_items, reason=None):
    """
    Return items from a past order.

    requested_items is a list of {"order_item_id": int, "quantity": int}.
    Everything happens in one database transaction: the return is recorded,
    the items go back into inventory, and voucher orders are refunded to the
    student's voucher. The order row is locked so two returns of the same
    transaction can't both succeed.
    """

    if not requested_items:
        raise ReturnError(400, "Select at least one item to return.")

    # Combine duplicate lines and validate quantities.
    quantities: dict[int, int] = {}
    for item in requested_items:
        order_item_id = int(item["order_item_id"])
        quantity = int(item["quantity"])
        if quantity < 1:
            raise ReturnError(400, "Return quantities must be at least 1.")
        quantities[order_item_id] = quantities.get(order_item_id, 0) + quantity

    connection = create_connection()
    if not connection:
        raise ReturnError(503, "Returns are unavailable. Please try again.")

    cursor = connection.cursor(dictionary=True)

    try:
        order, items = _load_order(cursor, order_id, lock=True)

        if not order or int(order["user_id"]) != int(user_id):
            raise ReturnError(
                404, "No transaction with that number was found on your account."
            )

        if datetime.now() > _return_deadline(order["created_at"]):
            raise ReturnError(
                400,
                f"This transaction is past the {RETURN_WINDOW_DAYS}-day "
                "return window.",
            )

        items_by_id = {int(item["order_item_id"]): item for item in items}
        refund_total = Decimal("0.00")
        return_lines = []

        for order_item_id, quantity in quantities.items():
            item = items_by_id.get(order_item_id)

            if not item:
                raise ReturnError(
                    400, "One of the selected items is not on this transaction."
                )

            remaining = int(item["quantity"]) - int(item["returned_quantity"])

            if quantity > remaining:
                raise ReturnError(
                    400,
                    f"Only {remaining} of {item['name']} can still be returned.",
                )

            refund_each = Decimal(str(item["price_each"])).quantize(
                Decimal("0.01")
            )
            refund_total += refund_each * quantity
            return_lines.append((item, quantity, refund_each))

        refund_total = refund_total.quantize(Decimal("0.01"))
        refund_method = order["payment_method"] or "original"

        cursor.execute(
            """
            INSERT INTO order_returns
                (order_id, user_id, refund_total, refund_method, reason)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (order_id, user_id, refund_total, refund_method, reason),
        )
        return_id = cursor.lastrowid

        for item, quantity, refund_each in return_lines:
            cursor.execute(
                """
                INSERT INTO order_return_items
                    (return_id, order_item_id, product_id, quantity, refund_each)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    return_id,
                    item["order_item_id"],
                    item["product_id"],
                    quantity,
                    refund_each,
                ),
            )

            # Put the item back on the shelf. A product deleted since the
            # sale simply has nothing to restock.
            cursor.execute(
                """
                UPDATE products
                SET quantity = quantity + %s
                WHERE product_id = %s
                """,
                (quantity, item["product_id"]),
            )

        voucher_balance = None

        if refund_method == "voucher":
            cursor.execute(
                """
                UPDATE student_vouchers
                SET balance = balance + %s
                WHERE student_id = %s
                """,
                (refund_total, order["student_id"]),
            )

            if cursor.rowcount != 1:
                raise ReturnError(
                    500,
                    "The voucher for this transaction could not be refunded. "
                    "Please see library staff.",
                )

            cursor.execute(
                "SELECT balance FROM student_vouchers WHERE student_id = %s",
                (order["student_id"],),
            )
            voucher_balance = str(cursor.fetchone()["balance"])

        connection.commit()

        return {
            "message": "Return completed successfully.",
            "return_id": return_id,
            "order_id": order_id,
            "refund_total": str(refund_total),
            "refund_method": refund_method,
            "refund_method_label": REFUND_METHOD_LABELS.get(
                refund_method, "Original payment"
            ),
            "voucher_balance": voucher_balance,
            "items": [
                {
                    "order_item_id": item["order_item_id"],
                    "name": item["name"],
                    "quantity": quantity,
                    "refund_each": str(refund_each),
                    "line_refund": str(refund_each * quantity),
                }
                for item, quantity, refund_each in return_lines
            ],
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()
