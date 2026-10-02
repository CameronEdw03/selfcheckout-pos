import { useEffect, useMemo, useState } from "react";

function ProductCatalog() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://localhost:8000/products")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch products");
        }

        return response.json();
      })
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Unable to load products.");
        setLoading(false);
      });
  }, []);

  const categories = useMemo(() => {
    return ["All", ...new Set(products.map((product) => product.category))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        category === "All" || product.category === category;

      const searchValue = search.toLowerCase();

      const matchesSearch =
        product.name.toLowerCase().includes(searchValue) ||
        product.description.toLowerCase().includes(searchValue);

      return matchesCategory && matchesSearch;
    });
  }, [products, category, search]);

  const cartCount = Object.values(cart).reduce(
    (total, quantity) => total + quantity,
    0,
  );
  const cartProducts = products.filter((product) => cart[product.product_id]);
  const cartTotal = cartProducts.reduce(
    (total, product) =>
      total + Number(product.price) * cart[product.product_id],
    0,
  );

  function addToCart(product) {
    setCart((currentCart) => {
      const currentQuantity = currentCart[product.product_id] ?? 0;

      if (currentQuantity >= Number(product.quantity)) {
        return currentCart;
      }

      return {
        ...currentCart,
        [product.product_id]: currentQuantity + 1,
      };
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-900 border-t-transparent" />
          <p className="font-medium text-slate-600">Loading products...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <span className="text-xl font-bold text-red-600">!</span>
          </div>

          <h2 className="text-xl font-bold text-slate-900">
            Unable to load products
          </h2>

          <p className="mt-2 text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-6 py-5 lg:px-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-1 rounded-full bg-red-600" />

                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-blue-950">
                    Dallas College
                  </h1>

                  <p className="text-sm font-medium text-slate-500">
                    Self-Check Out
                  </p>
                </div>
              </div>
            </div>

            <div className="flex w-full items-center gap-3 md:w-auto">
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-expanded={isCartOpen}
                  aria-controls="cart-panel"
                  onClick={() => setIsCartOpen((open) => !open)}
                  className="relative flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-900"
                >
                  Cart
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                    {cartCount}
                  </span>
                </button>

                {isCartOpen && (
                  <section
                    id="cart-panel"
                    aria-label="Shopping cart"
                    className="absolute right-0 top-14 z-20 w-[min(22rem,calc(100vw-3rem))] rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
                  >
                    <h2 className="text-base font-bold text-slate-900">
                      Your cart
                    </h2>

                    {cartProducts.length === 0 ? (
                      <p className="mt-4 text-sm text-slate-500">
                        Your cart is empty.
                      </p>
                    ) : (
                      <>
                        <ul className="mt-4 max-h-72 space-y-4 overflow-y-auto">
                          {cartProducts.map((product) => {
                            const quantity = cart[product.product_id];

                            return (
                              <li
                                key={product.product_id}
                                className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-800">
                                    {product.name}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Qty {quantity} x ${Number(product.price).toFixed(2)}
                                  </p>
                                </div>
                                <span className="shrink-0 text-sm font-semibold text-slate-800">
                                  ${(Number(product.price) * quantity).toFixed(2)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>

                        <div className="mt-2 flex justify-between border-t border-slate-200 pt-4 text-sm font-bold text-slate-900">
                          <span>Subtotal</span>
                          <span>${cartTotal.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">
        <div className="mb-8">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Products
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Browse available items and select a product to continue.
              </p>
            </div>

            <p className="hidden text-sm font-medium text-slate-500 sm:block">
              {filteredProducts.length}{" "}
              {filteredProducts.length === 1 ? "item" : "items"}
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  category === item
                    ? "bg-blue-900 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-900"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              No products found
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Try changing your search or selecting another category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredProducts.map((product) => {
              const outOfStock = product.quantity <= 0;
              const lowStock =
                product.quantity > 0 && product.quantity <= 5;

              return (
                <button
                  key={product.product_id}
                  disabled={outOfStock}
                  onClick={() => addToCart(product)}
                  className={`group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition duration-200 ${
                    outOfStock
                      ? "cursor-not-allowed border-slate-200 opacity-60"
                      : "border-slate-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg"
                  }`}
                >
                  <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-900 shadow-md">
                      <span className="text-2xl font-bold text-white">
                        {product.name.charAt(0)}
                      </span>
                    </div>

                    <div className="absolute right-3 top-3">
                      {outOfStock ? (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                          Out of stock
                        </span>
                      ) : lowStock ? (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                          Low stock
                        </span>
                      ) : (
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                          {product.quantity} available
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="mb-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-red-600">
                        {product.category}
                      </span>
                    </div>

                    <h3 className="min-h-6 text-lg font-bold text-slate-900">
                      {product.name}
                    </h3>

                    <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">
                      {product.description}
                    </p>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-xl font-bold text-blue-950">
                        ${Number(product.price).toFixed(2)}
                      </span>

                      <span
                        className={`rounded-lg px-3 py-2 text-sm font-bold ${
                          outOfStock
                            ? "bg-slate-100 text-slate-400"
                            : "bg-red-600 text-white group-hover:bg-red-700"
                        }`}
                      >
                        {outOfStock ? "Unavailable" : "Add to cart"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default ProductCatalog;