from cart import add_to_cart, remove_from_cart, get_cart, get_cart_total
from decimal import Decimal


# Two sample products
book1 = {
    "product_id": 1001,
    "name": "To Kill a Mockingbird",
    "price": Decimal("12.99")
}

book2 = {
    "product_id": 1002,
    "name": "The Great Gatsby",
    "price": Decimal("10.99")
}


# Add both products
add_to_cart(book1)
add_to_cart(book2)


# Show the cart
print("CART:")
for item in get_cart():
    print(f"{item['name']} - ${item['price']}")

print(f"Total: ${get_cart_total()}")


# Remove the first product
print("\nRemoving To Kill a Mockingbird...")
remove_from_cart(1001)


# Show the cart again
print("\nCART AFTER REMOVAL:")
for item in get_cart():
    print(f"{item['name']} - ${item['price']}")

print(f"Total: ${get_cart_total()}")