from fastapi import FastAPI, HTTPException
from cart import add_to_cart, get_cart, remove_from_cart
from user import get_products_by_category, get_products_grouped_by_category, get_user, get_student
from catalog import get_all_products, add_product, edit_product, remove_product
from pydantic import BaseModel


app = FastAPI()

class DeleteProductRequest(BaseModel):
    user_name: str
    password: str

#zulikha
class ProductRequest(BaseModel):
    user_name: str
    password: str



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

# zulikha
# As a manager, I can load a starting catalog of bookstore items
@app.get("/products")
def get_all_products_endpoint(request: ProductRequest):

    user = get_user(request.user_name)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if user["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if user["role"] != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can load all products"
        )

    products = get_all_products()

    if products is None:
        raise HTTPException(
            status_code=500,
            detail="Error retrieving products"
        )

    return {
        "message": "Products retrieved successfully",
        "products": products
    }

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

