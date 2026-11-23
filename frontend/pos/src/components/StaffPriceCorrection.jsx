import { useState } from "react";

const API = "http://127.0.0.1:8000";

const REASONS = [
  "Item on sale - scanned at regular price",
  "Shelf tag price lower than scanned price",
  "Advertised promotion not applied",
];

function formatMoney(value) {
  return Number(value ?? 0).toFixed(2);
}

const EMPTY_FORM = {
  productId: "",
  newPrice: "",
  reason: REASONS[0],
  otherReason: "",
  staffUsername: "",
  staffPassword: "",
};

// Shown on the customer's self-checkout screen. An employee walks over,
// signs in with their own credentials, and lowers the price of an item in
// this customer's cart that scanned without its sale price. The change is
// audited and shows up in the manager's Staff Activity report.
function StaffPriceCorrection({ userId, cartLines, onApplied, onClose }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    productId: cartLines.length === 1 ? String(cartLines[0].product_id) : "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedItem = cartLines.find(
    (item) => String(item.product_id) === form.productId
  );
  const currentPrice = selectedItem ? Number(selectedItem.unitPrice) : null;

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedItem) {
      setError("Choose the item that scanned at the wrong price.");
      return;
    }

    const newPrice = Number(form.newPrice);

    if (!Number.isFinite(newPrice) || newPrice < 0) {
      setError("Enter a valid sale price.");
      return;
    }

    if (newPrice >= currentPrice) {
      setError(
        `The sale price must be lower than the current $${formatMoney(
          currentPrice
        )}.`
      );
      return;
    }

    const reason =
      form.reason === "Other" ? form.otherReason.trim() : form.reason;

    if (!reason) {
      setError("Enter a reason for the price correction.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API}/cart/${encodeURIComponent(userId)}/items/${
          selectedItem.product_id
        }/staff-discount`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_name: form.staffUsername.trim(),
            password: form.staffPassword,
            new_price: newPrice.toFixed(2),
            reason,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to apply the price correction."
        );
      }

      await onApplied?.();

      setSuccess(
        `${selectedItem.name} corrected from $${formatMoney(
          data.previous_price ?? currentPrice
        )} to $${formatMoney(data.new_price ?? newPrice)}.`
      );
      // Clear the employee's credentials so they are not left on the kiosk.
      setForm((current) => ({
        ...EMPTY_FORM,
        staffUsername: "",
        productId: current.productId,
      }));
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
      setForm((current) => ({ ...current, staffPassword: "" }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-price-correction-title"
    >
      <section className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-blue-950 px-6 py-4">
          <div>
            <h2
              id="staff-price-correction-title"
              className="text-lg font-black text-white"
            >
              Staff Price Correction
            </h2>
            <p className="mt-1 text-sm text-blue-200">
              Employees only: apply a sale price that did not scan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-blue-200 hover:text-white"
            aria-label="Close staff price correction"
          >
            ×
          </button>
        </div>

        {cartLines.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">
            There are no items in this cart to correct.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
            <label className="block text-sm font-semibold text-slate-700">
              Item
              <select
                required
                value={form.productId}
                onChange={(event) =>
                  updateField("productId", event.target.value)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Select the item…</option>
                {cartLines.map((item) => (
                  <option key={item.product_id} value={item.product_id}>
                    {item.name} — ${formatMoney(item.unitPrice)} each
                    {item.quantity > 1 ? ` (×${item.quantity})` : ""}
                  </option>
                ))}
              </select>
            </label>

            {selectedItem && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Scanned price:{" "}
                <span className="font-bold text-slate-900">
                  ${formatMoney(currentPrice)}
                </span>
                {selectedItem.discount_reason && (
                  <span className="block text-xs text-amber-700">
                    Already corrected once ({selectedItem.discount_reason}).
                  </span>
                )}
              </p>
            )}

            <label className="block text-sm font-semibold text-slate-700">
              Correct sale price (each)
              <div className="mt-1 flex items-center rounded-lg border border-slate-300 focus-within:border-blue-700 focus-within:ring-2 focus-within:ring-blue-100">
                <span className="pl-3 text-slate-500">$</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.newPrice}
                  onChange={(event) =>
                    updateField("newPrice", event.target.value)
                  }
                  className="w-full rounded-lg px-2 py-2 outline-none"
                />
              </div>
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Reason
              <select
                value={form.reason}
                onChange={(event) => updateField("reason", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
                <option value="Other">Other…</option>
              </select>
            </label>

            {form.reason === "Other" && (
              <label className="block text-sm font-semibold text-slate-700">
                Describe the reason
                <input
                  required
                  type="text"
                  maxLength={500}
                  value={form.otherReason}
                  onChange={(event) =>
                    updateField("otherReason", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            )}

            <div className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Employee username
                <input
                  required
                  type="text"
                  autoComplete="off"
                  value={form.staffUsername}
                  onChange={(event) =>
                    updateField("staffUsername", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Employee password
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  value={form.staffPassword}
                  onChange={(event) =>
                    updateField("staffPassword", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {error}
              </p>
            )}

            {success && (
              <p
                role="status"
                className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
              >
                {success}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Done
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-950 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Applying..." : "Apply sale price"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

export default StaffPriceCorrection;
