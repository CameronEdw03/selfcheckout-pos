import { useEffect, useMemo, useState } from "react";

const API = "http://127.0.0.1:8000";

async function readResponse(response) {
  const body = await response.text();

  if (!response.ok) {
    let message = body || `Request failed (${response.status})`;

    try {
      const parsed = JSON.parse(body);
      message = parsed.detail || parsed.message || message;
    } catch {
      // Keep the response body if it isn't JSON.
    }

    throw new Error(message);
  }

  return body ? JSON.parse(body) : null;
}

async function fetchBundleData() {
  const [productResponse, bundleResponse] = await Promise.all([
    fetch(`${API}/products`),
    fetch(`${API}/bundles`),
  ]);
  const [productData, bundleData] = await Promise.all([
    readResponse(productResponse),
    readResponse(bundleResponse),
  ]);

  if (!Array.isArray(productData) || !Array.isArray(bundleData)) {
    throw new Error("The API returned an invalid product or bundle list.");
  }

  return { productData, bundleData };
}

export default function SupplyBundleManagement() {
  const [products, setProducts] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [bundleName, setBundleName] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [managerPassword, setManagerPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const manager = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const { productData, bundleData } = await fetchBundleData();
      setProducts(productData);
      setBundles(bundleData);
    } catch (loadError) {
      setError(loadError.message || "Unable to load products and bundles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        const { productData, bundleData } = await fetchBundleData();
        if (active) {
          setProducts(productData);
          setBundles(bundleData);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message || "Unable to load products and bundles.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      active = false;
    };
  }, []);

  const matchingProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();

    return products.filter((product) =>
      `${product.name ?? ""} ${product.category ?? ""} ${product.product_id ?? ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [products, productSearch]);

  function toggleProduct(productId) {
    setSelectedProductIds((currentIds) =>
      currentIds.includes(productId)
        ? currentIds.filter((id) => id !== productId)
        : [...currentIds, productId]
    );
  }

  async function createBundle(event) {
    event.preventDefault();

    const managerUsername = manager?.username ?? manager?.user_name;

    if (!managerUsername) {
      setError("Could not find the manager username in the saved login.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API}/bundles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: managerUsername,
          password: managerPassword,
          bundle_name: bundleName.trim(),
          product_ids: selectedProductIds,
        }),
      });

      const data = await readResponse(response);
      setBundleName("");
      setSelectedProductIds([]);
      setManagerPassword("");
      setNotice(data?.message || "Supply bundle created successfully.");
      await loadData();
    } catch (saveError) {
      setError(saveError.message || "Unable to create the supply bundle.");
    } finally {
      setSaving(false);
    }
  }

  if (manager?.role !== "manager") {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
        Only a manager account can create supply bundles.
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
          Catalog administration
        </p>
        <h2 className="mt-1 text-xl font-black text-slate-900">
          Course supply bundles
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Group existing catalog items under a name such as “ARTS 1311 kit”.
          Bundle items keep their normal prices and checkout behavior.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}

      {loading ? (
        <p className="py-8 text-sm text-slate-500">
          Loading catalog products and bundles…
        </p>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <form onSubmit={createBundle} className="space-y-4">
            <label className="block text-sm font-bold text-slate-700">
              Bundle name
              <input
                required
                maxLength={100}
                value={bundleName}
                onChange={(event) => setBundleName(event.target.value)}
                placeholder="e.g. ARTS 1311 kit"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <div>
              <label
                htmlFor="bundle-product-search"
                className="block text-sm font-bold text-slate-700"
              >
                Choose catalog items ({selectedProductIds.length} selected)
              </label>
              <input
                id="bundle-product-search"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Search products by name, category, or ID"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                {matchingProducts.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">
                    No matching catalog items.
                  </p>
                ) : (
                  matchingProducts.map((product) => {
                    const id = Number(product.product_id ?? product.id);

                    return (
                      <label
                        key={id}
                        className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(id)}
                          onChange={() => toggleProduct(id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                          {product.name}
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            {product.category || "Uncategorized"} · ID {id}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <label className="block text-sm font-bold text-slate-700">
              Manager password
              <input
                required
                type="password"
                autoComplete="current-password"
                value={managerPassword}
                onChange={(event) => setManagerPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <button
              type="submit"
              disabled={saving || selectedProductIds.length === 0}
              className="w-full rounded-lg bg-blue-900 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Creating bundle…" : "Create supply bundle"}
            </button>
          </form>

          <div>
            <h3 className="text-lg font-bold text-slate-900">Saved bundles</h3>
            {bundles.length === 0 ? (
              <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                No supply bundles have been created yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {bundles.map((bundle) => (
                  <li
                    key={bundle.bundle_id}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <h4 className="font-bold text-slate-900">
                      {bundle.bundle_name}
                    </h4>
                    {bundle.products.length === 0 ? (
                      <p className="mt-1 text-sm text-slate-500">
                        No catalog items in this bundle.
                      </p>
                    ) : (
                      <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
                        {bundle.products.map((product) => (
                          <li key={product.product_id}>{product.name}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
