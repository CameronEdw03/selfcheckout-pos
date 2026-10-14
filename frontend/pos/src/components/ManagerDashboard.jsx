import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function getStoredUser() {
  const savedUser = localStorage.getItem("user");

  if (!savedUser) {
    return null;
  }

  try {
    return JSON.parse(savedUser);
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

function ManagerDashboard() {
  const navigate = useNavigate();
  const [currentUser] = useState(getStoredUser);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [reloadProducts, setReloadProducts] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const categories = [...new Set(products.map((product) => product.category))]
    .sort((first, second) => first.localeCompare(second));
  const filteredProducts =
    selectedCategory === "All"
      ? products
      : products.filter((product) => product.category === selectedCategory);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login", { replace: true });
    } else if (currentUser.role !== "manager") {
      navigate("/ProductCatalog", { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    let isActive = true;

    async function loadProducts() {
      setLoadingProducts(true);
      setProductsError("");

      try {
        const response = await fetch("http://127.0.0.1:8000/products");

        if (!response.ok) {
          throw new Error("Unable to load products. Please try again.");
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error("The product list response was invalid.");
        }

        if (isActive) {
          setProducts(data);
        }
      } catch (error) {
        if (isActive) {
          setProductsError(error.message);
        }
      } finally {
        if (isActive) {
          setLoadingProducts(false);
        }
      }
    }

    loadProducts();

    return () => {
      isActive = false;
    };
  }, [reloadProducts]);

  function handleLogout() {
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  if (!currentUser || currentUser.role !== "manager") {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b-4 border-red-600 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-red-600">
              Dallas College Library
            </p>
            <h1 className="text-2xl font-black text-blue-950">
              Manager Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <p className="text-sm font-semibold text-slate-600">
              {currentUser.username}
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border-2 border-red-600 bg-white px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <section className="rounded-xl bg-blue-950 px-8 py-10 text-white shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wider text-blue-200">
            Management
          </p>
          <h2 className="mt-2 text-3xl font-black">
            Welcome, {currentUser.username}
          </h2>
          <p className="mt-3 text-blue-100">
            You are signed in with manager access.
          </p>
        </section>

        <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Product Inventory
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Showing {filteredProducts.length} of {products.length}{" "}
                {products.length === 1 ? "product" : "products"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!loadingProducts && !productsError && products.length > 0 && (
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  Category
                  <select
                    value={selectedCategory}
                    onChange={(event) => setSelectedCategory(event.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="All">All categories</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {!loadingProducts && !productsError && (
              <button
                type="button"
                onClick={() => setReloadProducts((count) => count + 1)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-blue-900 transition hover:bg-blue-50"
              >
                Refresh
              </button>
              )}
            </div>
          </div>

          {loadingProducts ? (
            <p className="px-6 py-10 text-center font-semibold text-slate-600">
              Loading products...
            </p>
          ) : productsError ? (
            <div className="px-6 py-10 text-center">
              <p role="alert" className="font-semibold text-red-700">
                {productsError}
              </p>
              <button
                type="button"
                onClick={() => setReloadProducts((count) => count + 1)}
                className="mt-4 rounded-lg bg-blue-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-800"
              >
                Try again
              </button>
            </div>
          ) : products.length === 0 ? (
            <p className="px-6 py-10 text-center font-semibold text-slate-600">
              No products are currently available.
            </p>
          ) : filteredProducts.length === 0 ? (
            <p className="px-6 py-10 text-center font-semibold text-slate-600">
              No products are available in this category.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-6 py-3">ID</th>
                    <th scope="col" className="px-6 py-3">Product</th>
                    <th scope="col" className="px-6 py-3">Category</th>
                    <th scope="col" className="px-6 py-3">Description</th>
                    <th scope="col" className="px-6 py-3 text-right">Price</th>
                    <th scope="col" className="px-6 py-3 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => (
                    <tr key={product.product_id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                        {product.product_id}
                      </td>
                      <th
                        scope="row"
                        className="whitespace-nowrap px-6 py-4 font-bold text-slate-900"
                      >
                        {product.name}
                      </th>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                        {product.category}
                      </td>
                      <td className="max-w-xs px-6 py-4 text-slate-600">
                        {product.description}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-blue-950">
                        ${Number(product.price).toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-slate-700">
                        {product.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default ManagerDashboard;
