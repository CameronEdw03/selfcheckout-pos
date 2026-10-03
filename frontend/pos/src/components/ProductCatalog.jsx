import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function ProductCatalog() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (!savedUser) {
      navigate("/login");
      return;
    }

    try {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
    } catch (error) {
      localStorage.removeItem("user");
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (!savedUser) {
      return;
    }

    fetch("http://127.0.0.1:8000/products")
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

  const cartProducts = products.filter(
    (product) => cart[product.product_id]
  );

  const cartCount = cartProducts.length;

  const cartTotal = cartProducts.reduce(
    (total, product) => total + Number(product.price),
    0
  );

  function addToCart(product) {
    setCart((currentCart) => {
      if (currentCart[product.product_id]) {
        return currentCart;
      }

      return {
        ...currentCart,
        [product.product_id]: true,
      };
    });
  }

  function handleLogout() {
    localStorage.removeItem("user");
    setCurrentUser(null);
    setCart({});
    navigate("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-900 border-t-transparent" />

          <p className="font-semibold text-slate-700">
            Loading self-checkout...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <span className="text-xl font-bold text-red-600">!</span>
          </div>

          <h2 className="text-xl font-bold text-slate-900">
            Unable to load products
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {error}
          </p>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 rounded-lg bg-blue-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">

      {/* Header */}
      <header className="border-b-4 border-red-600 bg-white shadow-sm">
        <div className="mx-auto max-w-[1600px] px-6 py-4 lg:px-10">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            {/* Dallas College */}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-900">
                <span className="text-lg font-black text-white">
                  DC
                </span>
              </div>

              <div>
                <h1 className="text-2xl font-black tracking-tight text-blue-950">
                  Dallas College
                </h1>

                <p className="text-sm font-semibold text-slate-500">
                  Library Self-Checkout
                </p>
              </div>
            </div>

            {/* Search / User / Cart */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

              {/* Search */}
              <div className="w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Search the library store"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:bg-white"
                />
              </div>

              {/* User */}
              {currentUser && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Customer
                  </p>

                  <p className="text-sm font-bold text-blue-950">
                    {currentUser.username}
                  </p>
                </div>
              )}

              {/* Cart */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCartOpen((open) => !open)}
                  className="flex h-12 items-center gap-3 rounded-lg bg-blue-900 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800"
                >
                  <span>Cart</span>

                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-2 text-xs font-black">
                    {cartCount}
                  </span>
                </button>

                {isCartOpen && (
                  <section
                    className="absolute right-0 top-14 z-30 w-[340px] rounded-xl border border-slate-200 bg-white shadow-2xl"
                  >
                    <div className="border-b border-slate-200 bg-blue-950 px-5 py-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-bold text-white">
                          Selected Items
                        </h2>

                        <span className="text-sm font-semibold text-blue-200">
                          {cartCount}{" "}
                          {cartCount === 1 ? "item" : "items"}
                        </span>
                      </div>
                    </div>

                    {cartProducts.length === 0 ? (
                      <div className="px-5 py-10 text-center">
                        <p className="font-semibold text-slate-700">
                          No items selected
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Select an item to add it to your cart.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="max-h-80 overflow-y-auto">
                          {cartProducts.map((product) => (
                            <div
                              key={product.product_id}
                              className="flex items-center justify-between border-b border-slate-100 px-5 py-4"
                            >
                              <div className="min-w-0 pr-4">
                                <p className="truncate text-sm font-bold text-slate-900">
                                  {product.name}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {product.category}
                                </p>
                              </div>

                              <p className="shrink-0 text-sm font-bold text-blue-950">
                                ${Number(product.price).toFixed(2)}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="border-t-2 border-slate-200 bg-slate-50 px-5 py-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-600">
                              Current Total
                            </span>

                            <span className="text-xl font-black text-blue-950">
                              ${cartTotal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </section>
                )}
              </div>

              {/* Sign Out */}
              <button
                type="button"
                onClick={handleLogout}
                className="h-12 rounded-lg border-2 border-red-600 bg-white px-5 text-sm font-bold text-red-600 transition hover:bg-red-50"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">

        {/* Store Header */}
        <div className="mb-6 rounded-xl bg-blue-950 px-6 py-6 text-white shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wider text-blue-200">
            Dallas College Library
          </p>

          <h2 className="mt-1 text-3xl font-black">
            Self-Checkout
          </h2>

          <p className="mt-2 text-sm text-blue-100">
            Select the items you would like to check out.
          </p>
        </div>

        {/* Categories */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex gap-2 overflow-x-auto">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`whitespace-nowrap rounded-lg px-5 py-3 text-sm font-bold transition ${
                  category === item
                    ? "bg-red-600 text-white shadow-sm"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-900"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Product Count */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              Available Items
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Tap an item to add it to your checkout.
            </p>
          </div>

          <p className="text-sm font-bold text-slate-500">
            {filteredProducts.length}{" "}
            {filteredProducts.length === 1 ? "item" : "items"}
          </p>
        </div>

        {/* Products */}
        {filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">
              No items found
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Try another search or category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

            {filteredProducts.map((product) => {
              const outOfStock = Number(product.quantity) <= 0;
              const alreadySelected = Boolean(
                cart[product.product_id]
              );

              return (
                <button
                  key={product.product_id}
                  type="button"
                  disabled={outOfStock}
                  onClick={() => addToCart(product)}
                  className={`group overflow-hidden rounded-xl border bg-white text-left shadow-sm transition ${
                    outOfStock
                      ? "cursor-not-allowed border-slate-200 opacity-60"
                      : alreadySelected
                      ? "border-blue-700 ring-2 ring-blue-100"
                      : "border-slate-200 hover:-translate-y-1 hover:border-blue-400 hover:shadow-lg"
                  }`}
                >

                  {/* Product Top */}
                  <div className="relative flex h-40 items-center justify-center bg-slate-100">

                    <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-blue-900 shadow-md">
                      <span className="text-3xl font-black text-white">
                        {product.name.charAt(0)}
                      </span>
                    </div>

                    {alreadySelected && (
                      <div className="absolute left-3 top-3 rounded-md bg-blue-900 px-3 py-1 text-xs font-bold text-white">
                        Selected
                      </div>
                    )}

                    {outOfStock && (
                      <div className="absolute right-3 top-3 rounded-md bg-red-600 px-3 py-1 text-xs font-bold text-white">
                        Out of Stock
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="p-5">

                    <p className="mb-2 text-xs font-black uppercase tracking-wide text-red-600">
                      {product.category}
                    </p>

                    <h3 className="min-h-6 text-lg font-black text-slate-900">
                      {product.name}
                    </h3>

                    <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">
                      {product.description}
                    </p>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">

                      <span className="text-xl font-black text-blue-950">
                        ${Number(product.price).toFixed(2)}
                      </span>

                      <span
                        className={`rounded-lg px-4 py-2 text-sm font-black ${
                          outOfStock
                            ? "bg-slate-100 text-slate-400"
                            : alreadySelected
                            ? "bg-blue-100 text-blue-900"
                            : "bg-red-600 text-white group-hover:bg-red-700"
                        }`}
                      >
                        {outOfStock
                          ? "Unavailable"
                          : alreadySelected
                          ? "Selected"
                          : "Add"}
                      </span>

                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom Checkout Bar */}
      {cartCount > 0 && (
        <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4 lg:px-10">

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Current Total
              </p>

              <p className="text-2xl font-black text-blue-950">
                ${cartTotal.toFixed(2)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="rounded-lg bg-red-600 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-700"
            >
              View Selected Items
            </button>

          </div>
        </div>
      )}
    </div>
  );
}

export default ProductCatalog;

