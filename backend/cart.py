from decimal import Decimal

# This list stores the items currently in the cart
cart = []


def add_to_cart(product):
    """Add a product to the cart."""
    cart.append(product)


def remove_from_cart(product_id):
    """Remove a product from the cart using its product ID."""
    for item in cart:
        if item["product_id"] == product_id:
            cart.remove(item)
            return True

    return False


def get_cart_total():
    """Calculate the total price of everything in the cart."""
    total = Decimal("0.00")

    for item in cart:
        total += Decimal(str(item["price"]))

    return total


def get_cart():
    """Return all items currently in the cart."""
    return cart