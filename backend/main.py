from decimal import Decimal, ROUND_HALF_UP
from datetime import date

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr, Field
from fastapi.middleware.cors import CORSMiddleware
from connection import create_connection


from cart import (
    add_to_cart,
    get_cart,
    remove_from_cart,
    clear_cart,
    get_cart_total,
    update_cart_quantity,
    add_course_bundle_to_cart,
    set_cart_item_discount,
)

from user import (
    get_products_by_category,
    get_products_grouped_by_category,
    get_user,
    get_student,
)
from catalog import (
    get_all_products,
    add_product,
    edit_product,
    apply_low_stock_discount,
    update_product_discount_price,
    get_product_price_history,
    remove_product,
    get_all_courses_with_products,  
    get_all_products_with_color,
    get_all_colors,
    get_product_by_id_with_color,
    get_all_products_with_size,
    get_all_sizes,
    get_product_by_id_with_size,
)
from payment import pay_with_cash, pay_with_card, pay_with_voucher, refund_voucher
from receipt import create_order
from staff_activity import log_staff_activity, get_staff_activity


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------
# Request models
# -------------------------

class DeleteProductRequest(BaseModel):
    user_name: str
    password: str


class CreateProductRequest(BaseModel):
    user_name: str
    password: str
    product_id: int = Field(gt=0)
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    price: float = Field(ge=0)
    quantity: int = Field(ge=0)
    category: str = Field(min_length=1)


class UpdateProductRequest(BaseModel):
    user_name: str
    password: str
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    price: float = Field(ge=0)
    quantity: int = Field(ge=0)
    category: str = Field(min_length=1)


class ProductDiscountRequest(BaseModel):
    user_name: str
    password: str
    reason: str = Field(min_length=1, max_length=500)


class ProductPriceDiscountRequest(BaseModel):
    user_name: str
    password: str
    new_price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    reason: str = Field(min_length=1, max_length=500)


class ProductRequest(BaseModel):
    user_name: str
    password: str


class DailyAnalyticsRequest(BaseModel):
    user_name: str
    password: str
    report_date: date


class StaffTransactionRequest(BaseModel):
    user_name: str
    password: str


class StaffActivityRequest(BaseModel):
    user_name: str
    password: str
    start_date: date
    end_date: date


class StaffTransactionDiscountRequest(StaffTransactionRequest):
    new_price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    reason: str = Field(min_length=1, max_length=500)


class LoginRequest(BaseModel):
    username: str
    password: str


class StudentRegistrationRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=255)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)


class StudentProfileUpdateRequest(BaseModel):
    current_username: str
    current_password: str
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    new_password: str | None = Field(default=None, min_length=8, max_length=255)


class UpdateQuantityRequest(BaseModel):
    quantity: int


class CashPaymentRequest(BaseModel):
    cash_received: str
    student_id: str | None = None


class CardPaymentRequest(BaseModel):
    approved: bool
    student_id: str | None = None


class VoucherPaymentRequest(BaseModel):
    student_id: str = Field(..., min_length=1, max_length=20)

class CourseProductAssignmentRequest(BaseModel):
    user_name: str
    password: str
    required: bool = False


class CourseCreateRequest(BaseModel):
    user_name: str
    password: str
    course_number: str = Field(..., min_length=1, max_length=20)
    course_name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="", max_length=255)


class SupplyBundleCreateRequest(BaseModel):
    user_name: str
    password: str
    bundle_name: str = Field(..., min_length=1, max_length=100)
    product_ids: list[int] = Field(..., min_length=1, max_length=100)


# -------------------------
# Checkout / receipt helpers
# -------------------------

def calculate_checkout_totals(user_id: int, student_id: str | None = None):
    """
    Calculate the checkout subtotal and final total.

    Existing cart item discounts are retained. If a valid student ID is
    provided, apply an additional 10% discount to Books-category items only.

    Returns the subtotal, student discount, final total, and order items
    with the final unit prices that should be saved to the order.
    """
    cart_items = get_cart(user_id)

    if not cart_items:
        raise HTTPException(
            status_code=400,
            detail="Cart is empty.",
        )

    valid_student = None

    if student_id and student_id.strip():
        valid_student = get_student(student_id.strip())

        if not valid_student:
            raise HTTPException(
                status_code=400,
                detail="Invalid student ID. Please enter a valid student ID.",
            )

        # If the users table has an active field, reject inactive accounts.
        if (
            valid_student.get("active") is not None
            and not bool(valid_student["active"])
        ):
            raise HTTPException(
                status_code=400,
                detail="This student account is inactive.",
            )

    subtotal = Decimal("0.00")
    final_total = Decimal("0.00")
    order_items = []

    for item in cart_items:
        quantity = int(item["quantity"])

        if quantity < 1:
            raise HTTPException(
                status_code=400,
                detail="Cart item quantity must be at least 1.",
            )

        # Use the cart's current discounted price when available.
        if item.get("discounted_price") is not None:
            unit_price = Decimal(str(item["discounted_price"]))
        elif item.get("price") is not None:
            unit_price = Decimal(str(item["price"]))
        elif item.get("line_total") is not None:
            unit_price = Decimal(str(item["line_total"])) / quantity
        else:
            raise HTTPException(
                status_code=500,
                detail="Cart item is missing its price.",
            )

        unit_price = unit_price.quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

        item_subtotal = unit_price * quantity
        subtotal += item_subtotal

        final_unit_price = unit_price

        # Apply the student discount only to Books.
        category = str(item.get("category", "")).strip().lower()

        if valid_student and category == "books":
            final_unit_price = (
                unit_price * Decimal("0.90")
            ).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )

        final_total += final_unit_price * quantity

        order_items.append(
            {
                "product_id": int(item["product_id"]),
                "quantity": quantity,
                "price": str(final_unit_price),
            }
        )

    subtotal = subtotal.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    final_total = final_total.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    student_discount = (subtotal - final_total).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    return {
        "subtotal": subtotal,
        "student_discount": student_discount,
        "total": final_total,
        "order_items": order_items,
        "student_discount_applied": student_discount > 0,
    }


def save_checkout_order(
    user_id: int,
    total: Decimal,
    order_items: list[dict],
):
    """
    Save the completed checkout as an order.

    create_order is expected to insert the order and order items,
    decrement inventory, commit the transaction, and return the order ID.
    """
    if not order_items:
        raise HTTPException(
            status_code=400,
            detail="Cart is empty.",
        )

    try:
        receipt_id = create_order(user_id, total, order_items)
    except Exception as error:
        print(f"Error creating checkout order: {error}")
        raise HTTPException(
            status_code=500,
            detail="Payment succeeded, but the order could not be saved.",
        )

    if not receipt_id:
        raise HTTPException(
            status_code=500,
            detail="Payment succeeded, but the order could not be saved.",
        )

    # Clear the cart only after create_order succeeds.
    clear_cart(user_id)

    return receipt_id


# -------------------------
# Login and user routes
# -------------------------

@app.post("/auth/login")
def login(request: LoginRequest):
    user = get_user(request.username)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if user["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    return {
        "message": "Login successful",
        "user_id": user["user_id"],
        "username": user["username"],
        "role": user["role"],
        "student_id": user["student_id"],
        "first_name": user.get("first_name"),
        "last_name": user.get("last_name"),
        "email": user.get("email"),
        "phone": user.get("phone"),
    }


@app.post("/auth/register", status_code=201)
def register_student(request: StudentRegistrationRequest):
    """Create a student account without allowing self-assigned staff roles."""
    username = request.username.strip()
    first_name = request.first_name.strip()
    last_name = request.last_name.strip()
    email = str(request.email).strip() if request.email else None
    phone = request.phone.strip() if request.phone else None

    if not username or not first_name or not last_name:
        raise HTTPException(
            status_code=422,
            detail="Username, first name, and last name cannot be blank",
        )

    connection = create_connection()

    if connection is None:
        raise HTTPException(
            status_code=500,
            detail="Unable to connect to the database.",
        )

    cursor = None

    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO users
                (username, password, role, first_name, last_name, email, phone)
            VALUES (%s, %s, 'student', %s, %s, %s, %s)
            """,
            (
                username,
                request.password,
                first_name,
                last_name,
                email or None,
                phone or None,
            ),
        )
        user_id = cursor.lastrowid
        student_id = f"S{user_id}"
        cursor.execute(
            "UPDATE users SET student_id = %s WHERE user_id = %s",
            (student_id, user_id),
        )
        connection.commit()

        return {
            "message": "Student account created successfully",
            "user_id": user_id,
            "username": username,
            "role": "student",
            "student_id": student_id,
            "first_name": first_name,
            "last_name": last_name,
            "email": email or None,
            "phone": phone or None,
        }

    except Exception as error:
        connection.rollback()
        error_code = getattr(error, "errno", None)

        if error_code == 1062:
            database_message = str(getattr(error, "msg", error)).lower()
            if "username" in database_message:
                detail = "That username is already registered. Choose another username."
            else:
                detail = (
                    "That username or generated Student ID is already in use. "
                    "Contact a manager if this continues."
                )
            raise HTTPException(
                status_code=409,
                detail=detail,
            ) from error

        if error_code in {1054, 1364}:
            raise HTTPException(
                status_code=500,
                detail=(
                    "The database is missing fields required for student registration. "
                    "Apply migrations 011_enable_student_registration.sql and "
                    "012_add_student_profile_fields.sql, then restart the backend."
                ),
            ) from error

        if error_code == 1146:
            raise HTTPException(
                status_code=500,
                detail=(
                    "The users table is missing. Initialize the database with "
                    "backend/database/schema.sql, then apply migrations 011 and 012."
                ),
            ) from error

        print(f"Error registering student: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to create the student account.",
        ) from error

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


@app.put("/students/profile")
def update_student_profile(request: StudentProfileUpdateRequest):
    """Update student profile details without allowing student ID changes."""
    current_user = get_user(request.current_username)

    if not current_user or current_user.get("password") != request.current_password:
        raise HTTPException(
            status_code=401,
            detail="Current username or password is incorrect.",
        )

    if current_user.get("role") != "student":
        raise HTTPException(
            status_code=403,
            detail="Only student accounts can update a student profile.",
        )

    first_name = request.first_name.strip()
    last_name = request.last_name.strip()
    email = str(request.email).strip() if request.email else None
    phone = request.phone.strip() if request.phone else None

    if not first_name or not last_name:
        raise HTTPException(
            status_code=422,
            detail="First name and last name cannot be blank",
        )

    connection = create_connection()

    if connection is None:
        raise HTTPException(
            status_code=500,
            detail="Unable to connect to the database.",
        )

    cursor = None

    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE users
            SET first_name = %s,
                last_name = %s,
                email = %s,
                phone = %s,
                password = COALESCE(%s, password)
            WHERE user_id = %s
              AND role = 'student'
            """,
            (
                first_name,
                last_name,
                email or None,
                phone or None,
                request.new_password or None,
                current_user["user_id"],
            ),
        )
        connection.commit()

        return {
            "message": "Profile updated successfully",
            "user_id": current_user["user_id"],
            "username": current_user["username"],
            "role": "student",
            "student_id": current_user["student_id"],
            "first_name": first_name,
            "last_name": last_name,
            "email": email or None,
            "phone": phone or None,
        }

    except Exception as error:
        connection.rollback()

        if getattr(error, "errno", None) == 1062:
            raise HTTPException(
                status_code=409,
                detail="Unable to update the profile because a value is already in use.",
            ) from error

        print(f"Error updating student profile: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to update the student profile.",
        ) from error

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


@app.get("/user")
def user(username: str):
    return get_user(username)


@app.get("/student{student_id}")
def student(student_id: str):
    return get_student(student_id)


# -------------------------
# Cart routes
# -------------------------

@app.post("/cart")
def add_item(user_id: int, product_id: int):
    return add_to_cart(user_id, product_id)


@app.post("/cart/{user_id}/courses/{course_id}")
def add_course_bundle(user_id: int, course_id: int):
    return add_course_bundle_to_cart(user_id, course_id)



@app.get("/cart/{user_id}")
def get_user_cart(user_id: int):
    return get_cart(user_id)


# Clear the user's entire cart.
@app.delete("/cart/{user_id}")
def clear_user_cart(user_id: int):
    return clear_cart(user_id)


# Remove one product from the cart.
@app.delete("/cart/{user_id}/{product_id}")
def remove_item(user_id: int, product_id: int):
    return remove_from_cart(user_id, product_id)


@app.put("/cart/{user_id}/{product_id}")
def update_item_quantity(
    user_id: int,
    product_id: int,
    request: UpdateQuantityRequest,
):
    if request.quantity < 1:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be at least 1",
        )

    updated = update_cart_quantity(
        user_id,
        product_id,
        request.quantity,
    )

    if not updated:
        raise HTTPException(
            status_code=404,
            detail="Cart item not found or could not be updated",
        )

    return {
        "message": "Cart quantity updated successfully",
        "cart": get_cart(user_id),
        "total": get_cart_total(user_id),
    }


# -------------------------
# Checkout routes
# -------------------------

@app.post("/checkout/{user_id}/cash")
def cash_checkout(user_id: int, request: CashPaymentRequest):
    checkout = calculate_checkout_totals(
        user_id,
        request.student_id,
    )

    total = checkout["total"]

    if total <= 0:
        raise HTTPException(
            status_code=400,
            detail="Cart total must be greater than zero.",
        )

    # Validate/process the simulated cash payment using the final total.
    payment_result = pay_with_cash(total, request.cash_received)

    if not payment_result["success"]:
        raise HTTPException(
            status_code=400,
            detail=payment_result["message"],
        )

    # Save the order using the same discounted prices used for payment.
    receipt_id = save_checkout_order(
        user_id,
        total,
        checkout["order_items"],
    )

    return {
        "message": payment_result["message"],
        "subtotal": str(checkout["subtotal"]),
        "student_discount": str(checkout["student_discount"]),
        "student_discount_applied": checkout["student_discount_applied"],
        "total": str(total),
        "cash_received": request.cash_received,
        "change": payment_result["change"],
        "receipt_id": receipt_id,
    }


@app.post("/checkout/{user_id}/card")
def card_checkout(user_id: int, request: CardPaymentRequest):
    checkout = calculate_checkout_totals(
        user_id,
        request.student_id,
    )

    total = checkout["total"]

    if total <= 0:
        raise HTTPException(
            status_code=400,
            detail="Cart total must be greater than zero.",
        )

    # Validate/process the simulated card payment using the final total.
    payment_result = pay_with_card(total, request.approved)

    if not payment_result["success"]:
        raise HTTPException(
            status_code=400,
            detail=payment_result["message"],
        )

    # Save the order using the same discounted prices used for payment.
    receipt_id = save_checkout_order(
        user_id,
        total,
        checkout["order_items"],
    )

    return {
        "message": payment_result["message"],
        "subtotal": str(checkout["subtotal"]),
        "student_discount": str(checkout["student_discount"]),
        "student_discount_applied": checkout["student_discount_applied"],
        "total": str(total),
        "receipt_id": receipt_id,
    }


@app.post("/checkout/{user_id}/voucher")
def voucher_checkout(user_id: int, request: VoucherPaymentRequest):
    student_id = request.student_id.strip()

    # Validates the student ID and applies the student discount.
    checkout = calculate_checkout_totals(
        user_id,
        student_id,
    )

    # A voucher can only pay for the cart of the student who owns it.
    student = get_student(student_id)

    if int(student["user_id"]) != user_id:
        raise HTTPException(
            status_code=403,
            detail="This student ID does not match the signed-in account.",
        )

    total = checkout["total"]

    if total <= 0:
        raise HTTPException(
            status_code=400,
            detail="Cart total must be greater than zero.",
        )

    payment_result = pay_with_voucher(student_id, total)

    if not payment_result["success"]:
        raise HTTPException(
            status_code=400,
            detail=payment_result["message"],
        )

    # Put the money back on the voucher if the order can't be saved.
    try:
        receipt_id = save_checkout_order(
            user_id,
            total,
            checkout["order_items"],
        )
    except HTTPException:
        if not refund_voucher(student_id, total):
            print(
                f"Voucher refund failed for {student_id} "
                f"after order save failure: {total}"
            )
        raise HTTPException(
            status_code=500,
            detail="The order could not be saved. Your voucher was not charged.",
        )

    return {
        "message": payment_result["message"],
        "subtotal": str(checkout["subtotal"]),
        "student_discount": str(checkout["student_discount"]),
        "student_discount_applied": checkout["student_discount_applied"],
        "total": str(total),
        "voucher_balance": str(payment_result["remaining_balance"]),
        "receipt_id": receipt_id,
    }


# -------------------------
# Manager product routes
# -------------------------

def _verify_employee(user_name: str, password: str):
    staff_member = get_user(user_name)

    if not staff_member or staff_member["password"] != password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if staff_member["role"] != "employee":
        raise HTTPException(
            status_code=403,
            detail="Only staff can manage student transactions",
        )

    return staff_member


def _get_student_transaction(student_id: str):
    student = get_student(student_id.strip())

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    return student


@app.post("/staff/transactions/{student_id}")
def load_staff_student_transaction(
    student_id: str,
    request: StaffTransactionRequest,
):
    _verify_employee(request.user_name, request.password)
    student = _get_student_transaction(student_id)
    items = get_cart(student["user_id"])

    return {
        "student_id": student["student_id"],
        "username": student["username"],
        "cart": items,
        "total": str(get_cart_total(student["user_id"])),
    }


@app.post("/staff/transactions/{student_id}/cancel")
def cancel_staff_student_transaction(
    student_id: str,
    request: StaffTransactionRequest,
):
    staff_member = _verify_employee(request.user_name, request.password)
    student = _get_student_transaction(student_id)

    # Capture the cart before it is cleared so the manager can see what
    # was in the canceled transaction.
    items = get_cart(student["user_id"])
    cart_total = get_cart_total(student["user_id"])

    if not clear_cart(student["user_id"]):
        raise HTTPException(
            status_code=500,
            detail="Unable to cancel the student transaction.",
        )

    log_staff_activity(
        staff_member["username"],
        "transaction_canceled",
        student_id=student["student_id"],
        quantity=sum(int(item["quantity"]) for item in items),
        amount=cart_total,
        details=", ".join(
            f"{item['name']} x{item['quantity']}" for item in items
        )[:500] or None,
    )

    return {"message": "Student transaction canceled successfully"}


@app.post("/staff/transactions/{student_id}/items/{product_id}/remove")
def remove_staff_student_transaction_item(
    student_id: str,
    product_id: int,
    request: StaffTransactionRequest,
):
    staff_member = _verify_employee(request.user_name, request.password)
    student = _get_student_transaction(student_id)

    removed_item = next(
        (
            item
            for item in get_cart(student["user_id"])
            if int(item["product_id"]) == product_id
        ),
        None,
    )

    if not remove_from_cart(student["user_id"], product_id):
        raise HTTPException(
            status_code=404,
            detail="Product was not found in the student transaction.",
        )

    log_staff_activity(
        staff_member["username"],
        "item_removed",
        student_id=student["student_id"],
        product_id=product_id,
        product_name=removed_item["name"] if removed_item else None,
        quantity=int(removed_item["quantity"]) if removed_item else None,
        amount=removed_item["line_total"] if removed_item else None,
    )

    return {"message": "Product removed from the student transaction"}


@app.post("/staff/transactions/{student_id}/items/{product_id}/discount")
def discount_staff_student_transaction_item(
    student_id: str,
    product_id: int,
    request: StaffTransactionDiscountRequest,
):
    staff_member = _verify_employee(request.user_name, request.password)
    student = _get_student_transaction(student_id)
    reason = request.reason.strip()

    if not reason:
        raise HTTPException(
            status_code=422,
            detail="A reason is required for a transaction discount",
        )

    try:
        result, prices = set_cart_item_discount(
            student["user_id"],
            product_id,
            request.new_price,
            reason,
            staff_member["username"],
        )
    except Exception as error:
        print(f"Error applying staff transaction discount: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to apply the transaction discount.",
        ) from error

    if result == "not_found":
        raise HTTPException(
            status_code=404,
            detail="Product was not found in the student transaction.",
        )

    if result == "price_not_lower":
        raise HTTPException(
            status_code=409,
            detail="The new transaction price must be lower than the current price.",
        )

    return {
        "message": "Transaction discount applied successfully",
        "previous_price": str(prices["previous_price"]),
        "new_price": str(prices["new_price"]),
    }


@app.post("/manager/staff-activity")
def get_manager_staff_activity(request: StaffActivityRequest):
    manager = get_user(request.user_name)

    if not manager or manager["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if manager["role"] != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can view staff activity",
        )

    if request.end_date < request.start_date:
        raise HTTPException(
            status_code=422,
            detail="The end date must be on or after the start date.",
        )

    result = get_staff_activity(request.start_date, request.end_date)

    if result is None:
        raise HTTPException(
            status_code=500,
            detail="Unable to load staff activity.",
        )

    activities = result["activities"]
    action_counts = {
        "price_change": 0,
        "transaction_discount": 0,
        "item_removed": 0,
        "transaction_canceled": 0,
    }
    staff_totals = {
        username: {
            "staff_username": username,
            "total_actions": 0,
            "discount_amount": 0.0,
            "removed_amount": 0.0,
            **action_counts,
        }
        for username in result["staff_members"]
    }
    total_discount = Decimal("0.00")
    total_removed = Decimal("0.00")

    for activity in activities:
        action = activity["action"]
        staff = staff_totals.setdefault(
            activity["staff_username"],
            {
                "staff_username": activity["staff_username"],
                "total_actions": 0,
                "discount_amount": 0.0,
                "removed_amount": 0.0,
                **action_counts,
            },
        )

        staff["total_actions"] += 1
        staff[action] = staff.get(action, 0) + 1
        action_counts[action] = action_counts.get(action, 0) + 1

        if activity["discount_amount"] is not None:
            total_discount += Decimal(str(activity["discount_amount"]))
            staff["discount_amount"] += activity["discount_amount"]

        if activity["amount"] is not None:
            total_removed += Decimal(str(activity["amount"]))
            staff["removed_amount"] += activity["amount"]

    staff_breakdown = sorted(
        staff_totals.values(),
        key=lambda staff: (
            -staff["total_actions"],
            staff["staff_username"].lower(),
        ),
    )

    for staff in staff_breakdown:
        staff["discount_amount"] = round(staff["discount_amount"], 2)
        staff["removed_amount"] = round(staff["removed_amount"], 2)

    return {
        "start_date": request.start_date.isoformat(),
        "end_date": request.end_date.isoformat(),
        "summary": {
            "total_actions": len(activities),
            "active_staff": sum(
                1 for staff in staff_breakdown if staff["total_actions"] > 0
            ),
            "total_discount": float(total_discount),
            "total_removed": float(total_removed),
            "action_counts": action_counts,
        },
        "staff_breakdown": staff_breakdown,
        "activities": activities,
    }


@app.post("/manager/daily-analytics")
def get_manager_daily_analytics(request: DailyAnalyticsRequest):
    manager = get_user(request.user_name)

    if not manager or manager["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if manager["role"] != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can view sales analytics",
        )

    connection = create_connection()

    if not connection:
        raise HTTPException(
            status_code=500,
            detail="Unable to connect to the database.",
        )

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                o.order_id,
                o.user_id,
                o.total,
                o.created_at,
                oi.product_id,
                COALESCE(p.name, CONCAT('Product #', oi.product_id)) AS product_name,
                COALESCE(NULLIF(TRIM(p.category), ''), 'Uncategorized') AS category,
                oi.quantity,
                oi.price_each
            FROM orders AS o
            LEFT JOIN order_items AS oi ON oi.order_id = o.order_id
            LEFT JOIN products AS p ON p.product_id = oi.product_id
            WHERE DATE(o.created_at) = %s
            ORDER BY o.created_at DESC, o.order_id DESC
            """,
            (request.report_date,),
        )
        rows = cursor.fetchall()
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to load daily sales analytics.",
        ) from error
    finally:
        if cursor:
            cursor.close()
        connection.close()

    transactions_by_id = {}
    product_totals = {}
    category_totals = {}
    total_revenue = Decimal("0.00")
    units_sold = 0

    for row in rows:
        order_id = row["order_id"]

        if order_id not in transactions_by_id:
            total = Decimal(str(row["total"]))
            total_revenue += total
            transactions_by_id[order_id] = {
                "order_id": order_id,
                "user_id": row["user_id"],
                "total": float(total),
                "created_at": row["created_at"],
                "items": [],
            }

        if row["product_id"] is None:
            continue

        quantity = int(row["quantity"])
        item_revenue = Decimal(str(row["price_each"])) * quantity
        product_id = row["product_id"]
        product = product_totals.setdefault(
            product_id,
            {
                "product_id": product_id,
                "product_name": row["product_name"],
                "quantity_sold": 0,
                "revenue": Decimal("0.00"),
            },
        )
        product["quantity_sold"] += quantity
        product["revenue"] += item_revenue

        category = row["category"]
        category_total = category_totals.setdefault(
            category,
            {
                "category": category,
                "quantity_sold": 0,
                "revenue": Decimal("0.00"),
            },
        )
        category_total["quantity_sold"] += quantity
        category_total["revenue"] += item_revenue
        units_sold += quantity

        transactions_by_id[order_id]["items"].append(
            {
                "product_id": product_id,
                "product_name": row["product_name"],
                "quantity": quantity,
                "price_each": float(row["price_each"]),
            }
        )

    best_sellers = sorted(
        product_totals.values(),
        key=lambda product: (
            -product["quantity_sold"],
            -product["revenue"],
            product["product_name"].lower(),
        ),
    )[:5]

    for product in best_sellers:
        product["revenue"] = float(product["revenue"])

    category_breakdown = sorted(
        category_totals.values(),
        key=lambda category: category["category"].lower(),
    )

    for category in category_breakdown:
        category["revenue"] = float(category["revenue"])

    return {
        "report_date": request.report_date.isoformat(),
        "summary": {
            "transaction_count": len(transactions_by_id),
            "total_revenue": float(total_revenue),
            "units_sold": units_sold,
        },
        "category_breakdown": category_breakdown,
        "best_sellers": best_sellers,
        "transactions": list(transactions_by_id.values()),
    }


@app.delete("/products/{product_id}")
def delete_product(product_id: int, request: DeleteProductRequest):
    manager = get_user(request.user_name)

    if not manager:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if manager["role"] != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can delete products",
        )

    if manager["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if not remove_product(product_id):
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    return {"message": "Product deleted successfully"}


@app.post("/products", status_code=201)
def create_product(request: CreateProductRequest):
    manager = get_user(request.user_name)

    if not manager or manager["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if manager["role"] != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can add products",
        )

    product_name = request.name.strip()
    description = request.description.strip()
    category = request.category.strip()

    if not product_name or not description or not category:
        raise HTTPException(
            status_code=422,
            detail="Product name, description, and category cannot be blank",
        )

    if not add_product(
        request.product_id,
        product_name,
        description,
        request.price,
        request.quantity,
        category,
    ):
        raise HTTPException(
            status_code=500,
            detail="Unable to add product. Please verify the details and try again.",
        )

    return {"message": "Product added successfully"}


@app.put("/products/{product_id}")
def update_product(product_id: int, request: UpdateProductRequest):
    manager = get_user(request.user_name)

    if not manager or manager["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if manager["role"] != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can update products",
        )

    product_name = request.name.strip()
    description = request.description.strip()
    category = request.category.strip()

    if not product_name or not description or not category:
        raise HTTPException(
            status_code=422,
            detail="Product name, description, and category cannot be blank",
        )

    if not edit_product(
        product_id,
        product_name,
        description,
        request.price,
        request.quantity,
        category,
    ):
        raise HTTPException(
            status_code=404,
            detail="Product not found or could not be updated",
        )

    return {"message": "Product updated successfully"}


@app.post("/products/{product_id}/discount")
def discount_product(product_id: int, request: ProductDiscountRequest):
    manager = get_user(request.user_name)

    if not manager or manager["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if manager["role"] != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can discount products",
        )

    reason = request.reason.strip()

    if not reason:
        raise HTTPException(
            status_code=422,
            detail="A reason is required for a product discount",
        )

    result = apply_low_stock_discount(
        product_id,
        reason=reason,
        changed_by=manager["username"],
    )

    if result == "not_found":
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    if result == "stock_not_eligible":
        raise HTTPException(
            status_code=409,
            detail="A 5% discount is only available when stock is below 5",
        )

    if result == "already_discounted":
        raise HTTPException(
            status_code=409,
            detail="This product already has a discount",
        )

    if result != "applied":
        raise HTTPException(
            status_code=500,
            detail="Unable to apply the product discount",
        )

    return {"message": "5% discount applied successfully"}


@app.post("/products/{product_id}/price-discount")
def discount_product_price(
    product_id: int,
    request: ProductPriceDiscountRequest,
):
    staff_member = get_user(request.user_name)

    if not staff_member or staff_member["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if staff_member["role"] not in {"employee", "manager"}:
        raise HTTPException(
            status_code=403,
            detail="Only employees and managers can discount product prices",
        )

    reason = request.reason.strip()

    if not reason:
        raise HTTPException(
            status_code=422,
            detail="A reason is required for a price discount",
        )

    result, prices = update_product_discount_price(
        product_id,
        request.new_price,
        reason,
        staff_member["username"],
    )

    if result == "not_found":
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    if result == "price_not_lower":
        raise HTTPException(
            status_code=409,
            detail="The discounted price must be lower than the current price",
        )

    if result != "updated":
        raise HTTPException(
            status_code=500,
            detail="Unable to update the product price",
        )

    return {
        "message": "Product price discounted successfully",
        **prices,
    }


@app.post("/products/price-history")
def read_product_price_history(request: ProductRequest):
    staff_member = get_user(request.user_name)

    if not staff_member or staff_member["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if staff_member["role"] not in {"employee", "manager"}:
        raise HTTPException(
            status_code=403,
            detail="Only employees and managers can view product price history",
        )

    history = get_product_price_history()

    if history is None:
        raise HTTPException(
            status_code=500,
            detail="Unable to load product price history",
        )

    return history


# -------------------------
# Product listing routes
# -------------------------

@app.get("/products")
def get_all_products_endpoint():
    products = get_all_products()

    if products is None:
        raise HTTPException(
            status_code=500,
            detail="Error retrieving products",
        )

    return products


@app.get("/products/category/{category}")
def get_products_by_category_api(
    category: str,
    request: ProductRequest,
):
    manager = get_user(request.user_name)

    if not manager:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if manager["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if manager["role"] != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can view products by category",
        )

    products = get_products_by_category(category)

    if products is None:
        raise HTTPException(
            status_code=500,
            detail="Error retrieving products by category",
        )

    return {
        "category": category,
        "products": products,
    }


@app.get("/products/group-by-category")
def get_products_grouped_by_category_api(request: ProductRequest):
    manager = get_user(request.user_name)

    if not manager:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if manager["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if manager["role"] != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can group products by category",
        )

    products = get_products_grouped_by_category()

    if products is None:
        raise HTTPException(
            status_code=500,
            detail="Error retrieving products by category",
        )

    return {
        "categories": products,
    }

# -------------------------
# Course / product assignment routes
# -------------------------

@app.get("/courses")
def get_courses_with_products_endpoint():
    """Return courses with the products currently assigned to each course."""
    courses = get_all_courses_with_products()

    if courses is None:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to retrieve courses. Check the backend database "
                "connection and apply migration "
                "007_add_course_product_assignments.sql."
            ),
        )

    return courses


@app.get("/bundles")
def get_supply_bundles():
    """Return each supply bundle and its catalog products."""
    connection = create_connection()

    if connection is None:
        raise HTTPException(
            status_code=500,
            detail="Unable to connect to the database.",
        )

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                b.bundle_id,
                b.bundle_name,
                p.product_id,
                p.name AS product_name,
                p.description,
                p.price,
                p.quantity,
                p.category
            FROM supply_bundles AS b
            LEFT JOIN supply_bundle_products AS bp
                ON bp.bundle_id = b.bundle_id
            LEFT JOIN products AS p
                ON p.product_id = bp.product_id
            ORDER BY b.bundle_name, p.name
            """
        )

        bundles_by_id = {}
        for row in cursor.fetchall():
            bundle_id = row["bundle_id"]
            bundle = bundles_by_id.setdefault(
                bundle_id,
                {
                    "bundle_id": bundle_id,
                    "bundle_name": row["bundle_name"],
                    "products": [],
                },
            )

            if row["product_id"] is not None:
                bundle["products"].append(
                    {
                        "product_id": row["product_id"],
                        "name": row["product_name"],
                        "description": row["description"],
                        "price": float(row["price"]),
                        "quantity": row["quantity"],
                        "category": row["category"],
                    }
                )

        return list(bundles_by_id.values())

    except Exception as error:
        print(f"Error retrieving supply bundles: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to load supply bundles.",
        ) from error

    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def _verify_course_assignment_manager(user_name: str, password: str):
    """Verify that the request was made by a manager."""
    manager = get_user(user_name)

    if not manager or manager.get("password") != password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if manager.get("role") != "manager":
        raise HTTPException(
            status_code=403,
            detail=(
                "Only managers can manage courses, supply bundles, "
                "and course products"
            ),
        )

    return manager


@app.post("/bundles", status_code=201)
def create_supply_bundle(request: SupplyBundleCreateRequest):
    """Create a named bundle from existing catalog products."""
    _verify_course_assignment_manager(request.user_name, request.password)

    bundle_name = request.bundle_name.strip()
    product_ids = list(dict.fromkeys(request.product_ids))

    if not bundle_name:
        raise HTTPException(
            status_code=422,
            detail="Bundle name cannot be blank",
        )

    if any(product_id <= 0 for product_id in product_ids):
        raise HTTPException(
            status_code=422,
            detail="Product IDs must be positive integers",
        )

    connection = None
    cursor = None

    try:
        connection = create_connection()

        if connection is None:
            raise HTTPException(
                status_code=500,
                detail="Database connection failed",
            )

        cursor = connection.cursor(dictionary=True)
        placeholders = ", ".join(["%s"] * len(product_ids))
        cursor.execute(
            f"SELECT product_id FROM products WHERE product_id IN ({placeholders})",
            tuple(product_ids),
        )
        found_product_ids = {row["product_id"] for row in cursor.fetchall()}
        missing_product_ids = set(product_ids) - found_product_ids

        if missing_product_ids:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Unknown product IDs: "
                    + ", ".join(map(str, sorted(missing_product_ids)))
                ),
            )

        cursor.execute(
            "INSERT INTO supply_bundles (bundle_name) VALUES (%s)",
            (bundle_name,),
        )
        bundle_id = cursor.lastrowid
        cursor.executemany(
            """
            INSERT INTO supply_bundle_products (bundle_id, product_id)
            VALUES (%s, %s)
            """,
            [(bundle_id, product_id) for product_id in product_ids],
        )
        connection.commit()

        return {
            "bundle_id": bundle_id,
            "bundle_name": bundle_name,
            "products": [
                {"product_id": product_id}
                for product_id in product_ids
            ],
            "message": "Supply bundle created successfully",
        }

    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise

    except Exception as error:
        if connection is not None:
            connection.rollback()

        if getattr(error, "errno", None) == 1062:
            raise HTTPException(
                status_code=409,
                detail="A supply bundle with that name already exists",
            ) from error

        print(f"Error creating supply bundle: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to create supply bundle.",
        ) from error

    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            connection.close()


@app.post("/courses", status_code=201)
def create_course(request: CourseCreateRequest):
    """Create a course that managers can organize products under."""
    _verify_course_assignment_manager(request.user_name, request.password)

    course_number = request.course_number.strip()
    course_name = request.course_name.strip()

    if not course_number or not course_name:
        raise HTTPException(
            status_code=422,
            detail="Course number and course name are required",
        )

    connection = None
    cursor = None

    try:
        connection = create_connection()

        if connection is None:
            raise HTTPException(
                status_code=500,
                detail="Database connection failed",
            )

        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO courses (course_number, course_name, description)
            VALUES (%s, %s, %s)
            """,
            (
                course_number,
                course_name,
                request.description.strip() or None,
            ),
        )
        course_id = cursor.lastrowid
        connection.commit()

        return {
            "course_id": course_id,
            "course_number": course_number,
            "course_name": course_name,
            "description": request.description.strip() or None,
            "products": [],
            "message": "Course created successfully",
        }

    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise

    except Exception as error:
        if connection is not None:
            connection.rollback()

        if getattr(error, "errno", None) == 1062:
            raise HTTPException(
                status_code=409,
                detail="A course with that course number already exists",
            )

        print(f"Error creating course: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to create course",
        )

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()


@app.post("/courses/{course_id}/products/{product_id}")
def assign_product_to_course(
    course_id: int,
    product_id: int,
    request: CourseProductAssignmentRequest,
):
    """Assign a product to a course, or update its required status."""
    _verify_course_assignment_manager(request.user_name, request.password)

    connection = None
    cursor = None

    try:
        from connection import create_connection

        connection = create_connection()

        if connection is None:
            raise HTTPException(
                status_code=500,
                detail="Database connection failed",
            )

        cursor = connection.cursor(dictionary=True)

        # Confirm the course exists.
        cursor.execute(
            "SELECT course_id FROM courses WHERE course_id = %s",
            (course_id,),
        )

        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=404,
                detail="Course not found",
            )

        # Confirm the product exists.
        cursor.execute(
            "SELECT product_id FROM products WHERE product_id = %s",
            (product_id,),
        )

        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=404,
                detail="Product not found",
            )

        # Check whether this product is already assigned to this course.
        cursor.execute(
            """
            SELECT course_id, product_id
            FROM course_products
            WHERE course_id = %s AND product_id = %s
            """,
            (course_id, product_id),
        )

        already_assigned = cursor.fetchone()

        if already_assigned:
            # Update the required flag if the association already exists.
            cursor.execute(
                """
                UPDATE course_products
                SET required = %s
                WHERE course_id = %s AND product_id = %s
                """,
                (request.required, course_id, product_id),
            )

            message = "Course product assignment updated"

        else:
            # Create a new course/product association.
            cursor.execute(
                """
                INSERT INTO course_products
                    (course_id, product_id, required)
                VALUES (%s, %s, %s)
                """,
                (course_id, product_id, request.required),
            )

            message = "Product assigned to course successfully"

        connection.commit()

        return {
            "message": message,
            "course_id": course_id,
            "product_id": product_id,
            "required": request.required,
        }

    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise

    except Exception as error:
        if connection is not None:
            connection.rollback()

        print(f"Error assigning product to course: {error}")

        raise HTTPException(
            status_code=500,
            detail="Unable to assign product to course",
        )

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()


@app.delete("/courses/{course_id}/products/{product_id}")
def remove_product_from_course(
    course_id: int,
    product_id: int,
    request: CourseProductAssignmentRequest,
):
    """Remove a product from a course; this does not delete the product."""
    _verify_course_assignment_manager(request.user_name, request.password)

    connection = None
    cursor = None

    try:
        from connection import create_connection

        connection = create_connection()

        if connection is None:
            raise HTTPException(
                status_code=500,
                detail="Database connection failed",
            )

        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM course_products
            WHERE course_id = %s AND product_id = %s
            """,
            (course_id, product_id),
        )

        deleted = cursor.rowcount
        connection.commit()

        if deleted == 0:
            raise HTTPException(
                status_code=404,
                detail="That product is not assigned to this course",
            )

        return {
            "message": "Product removed from course successfully"
        }

    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise

    except Exception as error:
        if connection is not None:
            connection.rollback()

        print(f"Error removing product from course: {error}")

        raise HTTPException(
            status_code=500,
            detail="Unable to remove product from course",
        )

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()
#gets all available colors 
@app.get("/colors")
def get_colors():
    return get_all_colors()

#gets all colors assigned to a product 
@app.get("/products/with-colors")
def get_product_color():
    return get_all_products_with_color()

#gets a product assigned to a color 
@app.get("/products/{product_id}/colors")
def read_product_by_id_with_color(product_id: int):
    product = get_product_by_id_with_color(product_id)

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found or no colors assigned"

        )
    return product


#gets all available sizes
@app.get("/sizes")
def get_sizes():
    return get_all_sizes()

#gets all sizes assigned to a product
@app.get("/products/with-sizes")
def get_product_size():
    return get_all_products_with_size()

#gets a product with its assigned sizes
@app.get("/products/{product_id}/sizes")
def read_product_by_id_with_size(product_id: int):
    product = get_product_by_id_with_size(product_id)

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found or no sizes assigned"
        )
    return product
