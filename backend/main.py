
from decimal import Decimal, ROUND_HALF_UP

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware

from cart import (
    add_to_cart,
    get_cart,
    remove_from_cart,
    clear_cart,
    get_cart_total,
    update_cart_quantity,
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
    remove_product,
    get_all_courses_with_products,  
)
from payment import pay_with_cash, pay_with_card
from receipt import create_order


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


class ProductRequest(BaseModel):
    user_name: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UpdateQuantityRequest(BaseModel):
    quantity: int


class CashPaymentRequest(BaseModel):
    cash_received: str
    student_id: str | None = None


class CardPaymentRequest(BaseModel):
    approved: bool
    student_id: str | None = None

class CourseProductAssignmentRequest(BaseModel):
    user_name: str
    password: str
    required: bool = False

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
    }


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


# -------------------------
# Manager product routes
# -------------------------

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

    result = apply_low_stock_discount(product_id)

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


# -------------------------
# Course listing routes
# -------------------------

@app.get("/courses")
def get_courses_with_products_endpoint():
    """Return all courses and their associated products."""
    courses = get_all_courses_with_products()
    return courses


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
            detail="Error retrieving courses",
        )

    return courses


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
            detail="Only managers can assign products to courses",
        )

    return manager


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