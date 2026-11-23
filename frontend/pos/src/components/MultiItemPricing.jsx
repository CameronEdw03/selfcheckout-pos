import { useState } from "react";

const API = "http://127.0.0.1:8000";

const EMPTY_FORM = {
  productId: "",
  dealType: "bundle_price",
  quantity: "3",
  freeQuantity: "1",
  bundlePrice: "",
  startsOn: "",
  endsOn: "",
};

function formatCurrency(value) {
  return Number(value ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function todayIso() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function getDealStatus(deal) {
  const today = todayIso();

  if (!deal.is_active) return { label: "Paused", style: "bg-slate-100 text-slate-600" };
  if (deal.starts_on && deal.starts_on > today) {
    return { label: "Scheduled", style: "bg-amber-50 text-amber-800" };
  }
  if (deal.ends_on && deal.ends_on < today) {
    return { label: "Ended", style: "bg-slate-100 text-slate-500" };
  }
  return { label: "Running", style: "bg-green-50 text-green-800" };
}

// Preview what a customer pays for one full deal group.
function describePreview(form, product) {
  if (!product) return "";

  const price = Number(product.price);
  const quantity = Number(form.quantity);

  if (form.dealType === "bundle_price") {
    const bundlePrice = Number(form.bundlePrice);
    if (!quantity || !bundlePrice) return "";
    const regular = price * quantity;
    const savings = regular - bundlePrice;
    return savings > 0
      ? `${quantity} × ${product.name} normally ${formatCurrency(
          regular
        )} → ${formatCurrency(bundlePrice)} (saves ${formatCurrency(savings)})`
      : `This bundle price is not lower than ${formatCurrency(regular)}.`;
  }

  const free = Number(form.freeQuantity);
  if (!quantity || !free) return "";
  return `Customer takes ${quantity + free}, pays ${formatCurrency(
    price * quantity
  )} instead of ${formatCurrency(price * (quantity + free))}.`;
}

function MultiItemPricing({ currentUser, products = [] }) {
  const [password, setPassword] = useState("");
  const [deals, setDeals] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyDealId, setBusyDealId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const userName = currentUser?.username ?? currentUser?.user_name;
  const sortedProducts = [...products].sort((first, second) =>
    String(first.name).localeCompare(String(second.name))
  );
  const selectedProduct = products.find(
    (product) => String(product.product_id) === form.productId
  );
  const preview = describePreview(form, selectedProduct);

  async function postJson(path, body) {
    const response = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_name: userName, password, ...body }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        // Go back to the password prompt.
        setPassword("");
        setDeals(null);
      }
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : "The request could not be completed."
      );
    }

    return data;
  }

  async function loadDeals() {
    const data = await postJson("/manager/deals/list", {});
    if (!Array.isArray(data)) {
      throw new Error("The deals response was invalid.");
    }
    setDeals(data);
  }

  async function handleLoad(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await loadDeals();
    } catch (err) {
      setDeals(null);
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
    setSuccess("");
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const isBundle = form.dealType === "bundle_price";
      await postJson("/manager/deals", {
        product_id: Number(form.productId),
        deal_type: form.dealType,
        quantity: Number(form.quantity),
        free_quantity: isBundle ? null : Number(form.freeQuantity),
        bundle_price: isBundle ? Number(form.bundlePrice).toFixed(2) : null,
        starts_on: form.startsOn || null,
        ends_on: form.endsOn || null,
      });
      await loadDeals();
      setForm(EMPTY_FORM);
      setSuccess("Deal created. It applies automatically at checkout.");
    } catch (err) {
      setError(err.message || "Unable to create the deal.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDeal(deal) {
    setBusyDealId(deal.deal_id);
    setError("");
    setSuccess("");

    try {
      await postJson(`/manager/deals/${deal.deal_id}/active`, {
        is_active: !deal.is_active,
      });
      await loadDeals();
      setSuccess(
        deal.is_active
          ? `Paused "${deal.label}" on ${deal.product_name}.`
          : `Resumed "${deal.label}" on ${deal.product_name}.`
      );
    } catch (err) {
      setError(err.message || "Unable to update the deal.");
    } finally {
      setBusyDealId(null);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-black text-slate-900">
          Multi-Item Pricing
        </h2>
        <p className="text-sm text-slate-500">
          Set up deals like &ldquo;3 for $5&rdquo; or &ldquo;Buy 2, get 1
          free&rdquo;. They are applied automatically in the customer&apos;s
          cart and at checkout.
        </p>
      </div>

      {deals === null ? (
        <form
          onSubmit={handleLoad}
          className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"
        >
          <label className="text-sm font-semibold text-slate-700">
            Confirm manager password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Loading..." : "Manage deals"}
          </button>
        </form>
      ) : (
        <>
          <form
            onSubmit={handleCreate}
            className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <h3 className="font-bold text-slate-900">New deal</h3>

            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-1">
                Product
                <select
                  required
                  value={form.productId}
                  onChange={(event) =>
                    updateField("productId", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="">Select a product…</option>
                  {sortedProducts.map((product) => (
                    <option key={product.product_id} value={product.product_id}>
                      {product.name} ({formatCurrency(product.price)})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Deal type
                <select
                  value={form.dealType}
                  onChange={(event) =>
                    updateField("dealType", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="bundle_price">Quantity for a price (3 for $5)</option>
                  <option value="buy_get_free">Buy X, get Y free</option>
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700">
                {form.dealType === "bundle_price" ? "Quantity" : "Buy quantity"}
                <input
                  required
                  type="number"
                  min={form.dealType === "bundle_price" ? 2 : 1}
                  max="100"
                  step="1"
                  value={form.quantity}
                  onChange={(event) =>
                    updateField("quantity", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                />
              </label>

              {form.dealType === "bundle_price" ? (
                <label className="text-sm font-semibold text-slate-700">
                  Bundle price
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.bundlePrice}
                    onChange={(event) =>
                      updateField("bundlePrice", event.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  />
                </label>
              ) : (
                <label className="text-sm font-semibold text-slate-700">
                  Free quantity
                  <input
                    required
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={form.freeQuantity}
                    onChange={(event) =>
                      updateField("freeQuantity", event.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  />
                </label>
              )}

              <label className="text-sm font-semibold text-slate-700">
                Starts (optional)
                <input
                  type="date"
                  value={form.startsOn}
                  max={form.endsOn || undefined}
                  onChange={(event) =>
                    updateField("startsOn", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Ends (optional)
                <input
                  type="date"
                  value={form.endsOn}
                  min={form.startsOn || undefined}
                  onChange={(event) => updateField("endsOn", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                />
              </label>
            </div>

            {preview && (
              <p className="mt-3 text-sm font-medium text-slate-600">
                {preview}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="mt-4 rounded-lg bg-blue-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Create deal"}
            </button>
          </form>

          <div className="mt-6">
            <h3 className="text-lg font-bold text-slate-900">Deals</h3>

            {deals.length === 0 ? (
              <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                No multi-item deals yet.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Deal</th>
                      <th className="px-4 py-3">Dates</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created by</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deals.map((deal) => {
                      const status = getDealStatus(deal);

                      return (
                        <tr key={deal.deal_id}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">
                              {deal.product_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatCurrency(deal.product_price)} each
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-bold text-green-800">
                            {deal.label}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {deal.starts_on || "Any time"} →{" "}
                            {deal.ends_on || "No end"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-bold ${status.style}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {deal.created_by}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              disabled={busyDealId === deal.deal_id}
                              onClick={() => toggleDeal(deal)}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:opacity-60 ${
                                deal.is_active
                                  ? "border-red-200 text-red-600 hover:bg-red-50"
                                  : "border-green-200 text-green-700 hover:bg-green-50"
                              }`}
                            >
                              {deal.is_active ? "Pause" : "Resume"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
        >
          {success}
        </p>
      )}
    </section>
  );
}

export default MultiItemPricing;
