from fastapi import FastAPI, HTTPException
from cart import add_to_cart, get_cart, remove_from_cart
from user import get_products_by_category, get_products_grouped_by_category, get_user, get_student
from catalog import (
    get_all_products,
    add_product,
    edit_product,
    apply_low_stock_discount,
    remove_product,
)
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware

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

#zulikha
class ProductRequest(BaseModel):
    user_name: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str



#login logic (cam)
@app.post("/auth/login")
def login(request: LoginRequest):

    user = get_user(request.username)
    print("user------------");
    print(user);
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )
    # if not user["active"]:
    #     raise HTTPException(
    #         status_code=403,
    #         detail="Account is not active"
    #     )
    if user["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )
    return {
        "message": "Login successful",
        "user_id": user["user_id"],
        "username": user["username"],
        "role": user["role"],
        "student_id": user["student_id"]
    }

@app.get("/user")
def user(username: str):
    return get_user(username)


@app.get("/student{student_id}")
def student(student_id: str):
    return get_student(student_id)

@app.post("/cart")
def add_item(user_id: int, product_id: int):
    return add_to_cart(user_id, product_id)


@app.get("/cart/{user_id}")
def get_user_cart(user_id: int):
    return get_cart(user_id)
# zulikha
@app.delete("/cart/{user_id}")
def clear_user_cart(user_id: int):
    return remove_from_cart(user_id)

#remove from cart
@app.delete("/cart/{user_id}/{product_id}")
def remove_item(user_id: int, product_id: int):
    return remove_from_cart(user_id, product_id)


#manager removes item from products database 
@app.delete("/products/{product_id}")
def delete_product(product_id: int, request: DeleteProductRequest):

    user = get_user(request.user_name)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if user["role"] != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can delete products"
        )

    if user["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if not remove_product(product_id):
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    return {"message": "Product deleted successfully"}

@app.post("/products", status_code=201)
def create_product(request: CreateProductRequest):
    user = get_user(request.user_name)

    if not user or user["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if user["role"] != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can add products"
        )

    product_name = request.name.strip()
    description = request.description.strip()
    category = request.category.strip()
    if not product_name or not description or not category:
        raise HTTPException(
            status_code=422,
            detail="Product name, description, and category cannot be blank"
        )

    if not add_product(
        request.product_id,
        product_name,
        description,
        request.price,
        request.quantity,
        category
    ):
        raise HTTPException(
            status_code=500,
            detail="Unable to add product. Please verify the details and try again."
        )

    return {"message": "Product added successfully"}

@app.put("/products/{product_id}")
def update_product(product_id: int, request: UpdateProductRequest):
    user = get_user(request.user_name)

    if not user or user["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if user["role"] != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can update products"
        )

    product_name = request.name.strip()
    description = request.description.strip()
    category = request.category.strip()
    if not product_name or not description or not category:
        raise HTTPException(
            status_code=422,
            detail="Product name, description, and category cannot be blank"
        )

    if not edit_product(
        product_id,
        product_name,
        description,
        request.price,
        request.quantity,
        category
    ):
        raise HTTPException(
            status_code=404,
            detail="Product not found or could not be updated"
        )

    return {"message": "Product updated successfully"}

@app.post("/products/{product_id}/discount")
def discount_product(product_id: int, request: ProductDiscountRequest):
    user = get_user(request.user_name)

    if not user or user["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if user["role"] != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can discount products"
        )

    result = apply_low_stock_discount(product_id)
    if result == "not_found":
        raise HTTPException(status_code=404, detail="Product not found")
    if result == "stock_not_eligible":
        raise HTTPException(
            status_code=409,
            detail="A 5% discount is only available when stock is below 5"
        )
    if result == "already_discounted":
        raise HTTPException(
            status_code=409,
            detail="This product already has a discount"
        )
    if result != "applied":
        raise HTTPException(
            status_code=500,
            detail="Unable to apply the product discount"
        )

    return {"message": "5% discount applied successfully"}

# zulikha
# As a manager, I can load a starting catalog of bookstore items
@app.get("/products")
def get_all_products_endpoint():
    products = get_all_products()

    if products is None:
        raise HTTPException(
            status_code=500,
            detail="Error retrieving products"
        )

    return products

# zulikha as a manager I can get products by category

@app.get("/products/category/{category}")
def get_products_by_category_api(category: str, request: ProductRequest):

    # Get user
    user = get_user(request.user_name)

    # Check user
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    # Check password
    if user["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    # Check manager role
    if user["role"] != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can view products by category"
        )

    # Get products for the requested category
    products = get_products_by_category(category)

    if products is None:
        raise HTTPException(
            status_code=500,
            detail="Error retrieving products by category"
        )

    return {
        "category": category,
        "products": products
    }

@app.get("/products/group-by-category")
def get_products_by_category_api(request: ProductRequest):

    # Get user
    user = get_user(request.user_name)

    # Check if user exists
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    # Check password
    if user["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    # Check manager role
    if user["role"] != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can group products by category"
        )

    # Get products grouped by category
    products = get_products_grouped_by_category()

    # Check for database error
    if products is None:
        raise HTTPException(
            status_code=500,
            detail="Error retrieving products by category"
        )

    return {
        "categories": products
    }
