from decimal import Decimal

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


class CardPaymentRequest(BaseModel):
    approved: bool


# -------------------------
# Checkout / receipt helpers
# -------------------------

def get_order_items_from_cart(user_id: int):
    """
    Convert the current cart into the item format expected by create_order.

    The receipt/order function expects each item to include:
    product_id, quantity, and price.
    """
    cart_items = get_cart(user_id)

    if not cart_items:
        return []

    order_items = []

    for item in cart_items:
        quantity = int(item["quantity"])

        # Use the discounted unit price when the cart provides it.
        if item.get("discounted_price") is not None:
            unit_price = Decimal(str(item["discounted_price"]))
        elif item.get("price") is not None:
            unit_price = Decimal(str(item["price"]))
        elif item.get("line_total") is not None and quantity > 0:
            unit_price = Decimal(str(item["line_total"])) / quantity
        else:
            raise HTTPException(
                status_code=500,
                detail="Cart item is missing its price",
            )

        order_items.append(
            {
                "product_id": int(item["product_id"]),
                "quantity": quantity,
                "price": str(unit_price.quantize(Decimal("0.01"))),
            }
        )

    return order_items


def save_checkout_order(user_id: int, total: Decimal):
    """
    Save the completed checkout as an order.

    create_order is expected to insert the order and order items,
    decrement inventory, commit the transaction, and return the order ID.
    """
    order_items = get_order_items_from_cart(user_id)

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
    total = get_cart_total(user_id)

    if total <= 0:
        raise HTTPException(
            status_code=400,
            detail="Cart is empty.",
        )

    # Validate/process the simulated cash payment first.
    payment_result = pay_with_cash(total, request.cash_received)

    if not payment_result["success"]:
        raise HTTPException(
            status_code=400,
            detail=payment_result["message"],
        )

    # Save order/receipt and clear cart only after payment succeeds.
    receipt_id = save_checkout_order(user_id, total)

    return {
        "message": payment_result["message"],
        "total": str(total),
        "cash_received": request.cash_received,
        "change": payment_result["change"],
        "receipt_id": receipt_id,
    }


@app.post("/checkout/{user_id}/card")
def card_checkout(user_id: int, request: CardPaymentRequest):
    total = get_cart_total(user_id)

    if total <= 0:
        raise HTTPException(
            status_code=400,
            detail="Cart is empty.",
        )

    # Validate/process the simulated card payment first.
    payment_result = pay_with_card(total, request.approved)

    if not payment_result["success"]:
        raise HTTPException(
            status_code=400,
            detail=payment_result["message"],
        )

    # Save order/receipt and clear cart only after payment succeeds.
    receipt_id = save_checkout_order(user_id, total)

    return {
        "message": payment_result["message"],
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