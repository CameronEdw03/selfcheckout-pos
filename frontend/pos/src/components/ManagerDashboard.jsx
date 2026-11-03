import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CourseProductAssignment from "../components/CourseProductAssignment";

const API = "http://127.0.0.1:8000";

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

  const [newProduct, setNewProduct] = useState({
    product_id: "",
    name: "",
    description: "",
    price: "",
    quantity: "0",
    category: "",
    password: "",
  });

  const [addingProduct, setAddingProduct] = useState(false);
  const [addProductError, setAddProductError] = useState("");
  const [addProductSuccess, setAddProductSuccess] = useState("");

  const [activeProductAction, setActiveProductAction] = useState(null);
  const [productActionForm, setProductActionForm] = useState(null);
  const [productActionError, setProductActionError] = useState("");
  const [productActionSuccess, setProductActionSuccess] = useState("");
  const [savingProductAction, setSavingProductAction] = useState(false);

  const categories = [
    ...new Set(products.map((product) => product.category).filter(Boolean)),
  ].sort((first, second) => first.localeCompare(second));

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
        const response = await fetch(`${API}/products`);

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

  function handleProductFieldChange(event) {
    const { name, value } = event.target;

    setNewProduct((currentProduct) => ({
      ...currentProduct,
      [name]: value,
    }));
  }

  async function handleAddProduct(event) {
    event.preventDefault();

    setAddingProduct(true);
    setAddProductError("");
    setAddProductSuccess("");

    try {
      const response = await fetch(`${API}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_name: currentUser.username ?? currentUser.user_name,
          password: newProduct.password,
          product_id: Number(newProduct.product_id),
          name: newProduct.name.trim(),
          description: newProduct.description.trim(),
          price: Number(newProduct.price),
          quantity: Number(newProduct.quantity),
          category: newProduct.category.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to add product.");
      }

      setNewProduct({
        product_id: "",
        name: "",
        description: "",
        price: "",
        quantity: "0",
        category: "",
        password: "",
      });

      setSelectedCategory("All");
      setAddProductSuccess("Product added successfully.");
      setReloadProducts((count) => count + 1);
    } catch (error) {
      setAddProductError(
        error.message || "Unable to connect to the server."
      );
    } finally {
      setAddingProduct(false);
    }
  }

  function startProductAction(action, product) {
    setActiveProductAction(action);

    setProductActionForm({
      product_id: product.product_id,
      name: product.name,
      description: product.description,
      price: String(product.price),
      quantity: String(product.quantity),
      category: product.category,
      password: "",
    });

    setProductActionError("");
    setProductActionSuccess("");
  }

  function handleProductActionFieldChange(event) {
    const { name, value } = event.target;

    setProductActionForm((form) => ({
      ...form,
      [name]: value,
    }));
  }

  async function handleProductAction(event) {
    event.preventDefault();

    setSavingProductAction(true);
    setProductActionError("");
    setProductActionSuccess("");

    const isEditing = activeProductAction === "edit";
    const isApplyingDiscount = activeProductAction === "discount";
    const productId = productActionForm.product_id;

    try {
      const response = await fetch(
        `${API}/products/${productId}${
          isApplyingDiscount ? "/discount" : ""
        }`,
        {
          method: isEditing
            ? "PUT"
            : isApplyingDiscount
              ? "POST"
              : "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            isEditing
              ? {
                  user_name: currentUser.username ?? currentUser.user_name,
                  password: productActionForm.password,
                  name: productActionForm.name.trim(),
                  description: productActionForm.description.trim(),
                  price: Number(productActionForm.price),
                  quantity: Number(productActionForm.quantity),
                  category: productActionForm.category.trim(),
                }
              : {
                  user_name: currentUser.username ?? currentUser.user_name,
                  password: productActionForm.password,
                }
          ),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            `Unable to ${
              isEditing
                ? "update"
                : isApplyingDiscount
                  ? "discount"
                  : "remove"
            } product.`
        );
      }

      setProductActionSuccess(
        isEditing
          ? "Product updated successfully."
          : isApplyingDiscount
            ? "5% discount applied successfully."
            : "Product removed successfully."
      );

      setActiveProductAction(null);
      setProductActionForm(null);
      setReloadProducts((count) => count + 1);
    } catch (error) {
      setProductActionError(
        error.message || "Unable to connect to the server."
      );
    } finally {
      setSavingProductAction(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  if (!currentUser || currentUser.role !== "manager") {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Dashboard header */}
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
              {currentUser.username ?? currentUser.user_name}
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
        {/* Welcome panel */}
        <section className="rounded-xl bg-blue-950 px-8 py-10 text-white shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wider text-blue-200">
            Management
          </p>

          <h2 className="mt-2 text-3xl font-black">
            Welcome, {currentUser.username ?? currentUser.user_name}
          </h2>

          <p className="mt-3 text-blue-100">
            You are signed in with manager access.
          </p>
        </section>

        {/* Add product */}
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-900">
            Add Product
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Enter product details and confirm your manager password to add it
            to inventory.
          </p>

          <form onSubmit={handleAddProduct} className="mt-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-semibold text-slate-700">
                Product ID
                <input
                  required
                  type="number"
                  name="product_id"
                  min="1"
                  step="1"
                  value={newProduct.product_id}
                  onChange={handleProductFieldChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Name
                <input
                  required
                  type="text"
                  name="name"
                  value={newProduct.name}
                  onChange={handleProductFieldChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Category
                <input
                  required
                  type="text"
                  name="category"
                  value={newProduct.category}
                  onChange={handleProductFieldChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Description
                <textarea
                  required
                  name="description"
                  rows="2"
                  value={newProduct.description}
                  onChange={handleProductFieldChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Price
                <input
                  required
                  type="number"
                  name="price"
                  min="0"
                  step="0.01"
                  value={newProduct.price}
                  onChange={handleProductFieldChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Stock quantity
                <input
                  required
                  type="number"
                  name="quantity"
                  min="0"
                  step="1"
                  value={newProduct.quantity}
                  onChange={handleProductFieldChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Manager password
                <input
                  required
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={newProduct.password}
                  onChange={handleProductFieldChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            {addProductError && (
              <p role="alert" className="mt-4 text-sm font-semibold text-red-700">
                {addProductError}
              </p>
            )}

            {addProductSuccess && (
              <p role="status" className="mt-4 text-sm font-semibold text-green-700">
                {addProductSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={addingProduct}
              className="mt-5 rounded-lg bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {addingProduct ? "Adding Product..." : "Add Product"}
            </button>
          </form>
        </section>

        {/* NEW: Assign inventory products to courses */}
        <div className="mt-8">
          <CourseProductAssignment />
        </div>

        {/* Product inventory */}
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
                    onChange={(event) =>
                      setSelectedCategory(event.target.value)
                    }
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

          {productActionSuccess && (
            <p
              role="status"
              className="border-b border-green-100 bg-green-50 px-6 py-3 text-sm font-semibold text-green-700"
            >
              {productActionSuccess}
            </p>
          )}

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
                    <th scope="col" className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.product_id}
                      className="hover:bg-slate-50"
                    >
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
                        {Number(product.discount_percent) > 0 ? (
                          <span className="flex flex-col items-end">
                            <span className="text-xs text-slate-400 line-through">
                              ${Number(product.price).toFixed(2)}
                            </span>

                            <span>
                              $
                              {(
                                Number(product.price) *
                                (1 - Number(product.discount_percent) / 100)
                              ).toFixed(2)}
                            </span>

                            <span className="text-xs font-bold text-green-700">
                              {Number(product.discount_percent)}% off
                            </span>
                          </span>
                        ) : (
                          `$${Number(product.price).toFixed(2)}`
                        )}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-slate-700">
                        {product.quantity}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startProductAction("edit", product)}
                            className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-800 transition hover:bg-blue-50"
                          >
                            Edit
                          </button>

                          {Number(product.quantity) < 5 &&
                            Number(product.discount_percent) === 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  startProductAction("discount", product)
                                }
                                className="rounded-md border border-green-200 px-3 py-1.5 text-xs font-bold text-green-800 transition hover:bg-green-50"
                              >
                                Apply 5%
                              </button>
                            )}

                          {Number(product.discount_percent) > 0 && (
                            <span className="rounded-md bg-green-50 px-3 py-1.5 text-xs font-bold text-green-800">
                              5% off
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => startProductAction("delete", product)}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Product edit / discount / delete modal */}
        {activeProductAction && productActionForm && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 px-4 py-8">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-action-title"
              className="max-h-full w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
            >
              <h2
                id="product-action-title"
                className="text-xl font-black text-slate-900"
              >
                {activeProductAction === "edit"
                  ? "Update Product"
                  : activeProductAction === "discount"
                    ? "Apply 5% Discount"
                    : "Remove Product"}
              </h2>

              {activeProductAction === "edit" ? (
                <form
                  onSubmit={handleProductAction}
                  className="mt-5 space-y-4"
                >
                  <p className="text-sm text-slate-600">
                    Editing product ID {productActionForm.product_id}
                  </p>

                  <label className="block text-sm font-semibold text-slate-700">
                    Name
                    <input
                      required
                      name="name"
                      value={productActionForm.name}
                      onChange={handleProductActionFieldChange}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="block text-sm font-semibold text-slate-700">
                    Description
                    <textarea
                      required
                      name="description"
                      rows="2"
                      value={productActionForm.description}
                      onChange={handleProductActionFieldChange}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-slate-700">
                      Category
                      <input
                        required
                        name="category"
                        value={productActionForm.category}
                        onChange={handleProductActionFieldChange}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </label>

                    <label className="text-sm font-semibold text-slate-700">
                      Price
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        name="price"
                        value={productActionForm.price}
                        onChange={handleProductActionFieldChange}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </label>

                    <label className="text-sm font-semibold text-slate-700">
                      Stock quantity
                      <input
                        required
                        type="number"
                        min="0"
                        step="1"
                        name="quantity"
                        value={productActionForm.quantity}
                        onChange={handleProductActionFieldChange}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </label>
                  </div>

                  <ProductActionPasswordInput
                    value={productActionForm.password}
                    onChange={handleProductActionFieldChange}
                  />

                  {productActionError && (
                    <p role="alert" className="text-sm font-semibold text-red-700">
                      {productActionError}
                    </p>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveProductAction(null);
                        setProductActionForm(null);
                        setProductActionError("");
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={savingProductAction}
                      className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {savingProductAction ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              ) : activeProductAction === "delete" ? (
                <form
                  onSubmit={handleProductAction}
                  className="mt-5 space-y-4"
                >
                  <p className="text-sm text-slate-600">
                    Remove{" "}
                    <span className="font-bold">
                      {productActionForm.name}
                    </span>{" "}
                    from the product catalog? This cannot be undone.
                  </p>

                  <ProductActionPasswordInput
                    value={productActionForm.password}
                    onChange={handleProductActionFieldChange}
                  />

                  {productActionError && (
                    <p role="alert" className="text-sm font-semibold text-red-700">
                      {productActionError}
                    </p>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveProductAction(null);
                        setProductActionForm(null);
                        setProductActionError("");
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={savingProductAction}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {savingProductAction ? "Removing..." : "Remove Product"}
                    </button>
                  </div>
                </form>
              ) : (
                <form
                  onSubmit={handleProductAction}
                  className="mt-5 space-y-4"
                >
                  <p className="text-sm text-slate-600">
                    Apply a 5% discount to{" "}
                    <span className="font-bold">
                      {productActionForm.name}
                    </span>
                    ? This item currently has {productActionForm.quantity} in
                    stock. The discount will automatically end if stock reaches
                    5 or more.
                  </p>

                  <ProductActionPasswordInput
                    value={productActionForm.password}
                    onChange={handleProductActionFieldChange}
                  />

                  {productActionError && (
                    <p role="alert" className="text-sm font-semibold text-red-700">
                      {productActionError}
                    </p>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveProductAction(null);
                        setProductActionForm(null);
                        setProductActionError("");
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={savingProductAction}
                      className="rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {savingProductAction ? "Applying..." : "Apply 5% Discount"}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function ProductActionPasswordInput({ value, onChange }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      Confirm manager password
      <input
        required
        type="password"
        name="password"
        autoComplete="current-password"
        value={value}
        onChange={onChange}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
      />
    </label>
  );
}

export default ManagerDashboard;