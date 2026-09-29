from catalog import remove_product


success = remove_product(2001)

if success:
    print("Product removed successfully!")
else:
    print("Product was not removed.")