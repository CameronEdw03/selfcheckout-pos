import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "";
}

function Returns() {
  const navigate = useNavigate();
  const [user] = useState(() => getStoredUser());

  const [transactionNumber, setTransactionNumber] = useState("");
  const [password, setPassword] = useState("");
  const [order, setOrder] = useState(null);
  const [returnQuantities, setReturnQuantities] = useState({});
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!user?.user_id) {
      navigate("/login", { replace: true });
      return;
    }

    // Staff and managers don't make returns for themselves here.
    if (user.role === "manager") navigate("/manager-dashboard", { replace: true });
    if (user.role === "employee") navigate("/staff-dashboard", { replace: true });
  }, [navigate, user]);

  const refundTotal = useMemo(() => {
    if (!order) return 0;

    return order.items.reduce(
      (sum, item) =>
        sum +
        Number(item.price_each) * Number(returnQuantities[item.order_item_id] || 0),
      0
    );
  }, [order, returnQuantities]);

  const selectedItems = useMemo(
    () =>
      Object.entries(returnQuantities)
        .map(([orderItemId, quantity]) => ({
          order_item_id: Number(orderItemId),
          quantity: Number(quantity),
        }))
        .filter((item) => item.quantity > 0),
    [returnQuantities]
  );

  async function lookupTransaction(event) {
    event?.preventDefault();

    const orderId = transactionNumber.trim().replace(/^#/, "");

    if (!/^\d+$/.test(orderId)) {
      setError("Enter the transaction number printed on your receipt.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setOrder(null);
    setReturnQuantities({});

    try {
      const response = await fetch(`${API}/returns/${orderId}/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, password }),
      });

      setOrder(await readResponse(response));
    } catch (lookupError) {
      setError(lookupError.message || "Unable to find that transaction.");
    } finally {
      setLoading(false);
    }
  }

  function setItemQuantity(item, value) {
    const quantity = Math.max(
      0,
      Math.min(Number(value) || 0, item.returnable_quantity)
    );

    setReturnQuantities((current) => ({
      ...current,
      [item.order_item_id]: quantity,
    }));
  }

  async function submitReturn(event) {
    event.preventDefault();

    if (selectedItems.length === 0) {
      setError("Choose at least one item to return.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API}/returns/${order.order_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          password,
          items: selectedItems,
          reason: reason.trim() || null,
        }),
      });

      setResult(await readResponse(response));
      setOrder(null);
      setReturnQuantities({});
      setReason("");
    } catch (returnError) {
      setError(returnError.message || "The return could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setResult(null);
    setOrder(null);
    setTransactionNumber("");
    setReturnQuantities({});
    setReason("");
    setError("");
  }

  if (!user?.user_id || user.role === "manager" || user.role === "employee") {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b-4 border-red-600 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-red-600">
              Dallas College Library
            </p>
            <h1 className="text-2xl font-black text-blue-950">Return an Item</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/ProductCatalog")}
            className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
          >
            Back to catalog
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        {result ? (
          <section className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-black text-green-700">
              Return complete
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Transaction #{result.order_id} · Return #{result.return_id}
            </p>

            <ul className="mt-4 divide-y divide-slate-100">
              {result.items.map((item) => (
                <li
                  key={item.order_item_id}
                  className="flex justify-between py-2 text-sm"
                >
                  <span className="font-semibold text-slate-800">
                    {item.name} x{item.quantity}
                  </span>
                  <span className="text-slate-700">
                    ${formatMoney(item.line_refund)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 text-lg font-black text-slate-900">
              <span>Refund</span>
              <span>${formatMoney(result.refund_total)}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Refunded to: <strong>{result.refund_method_label}</strong>
            </p>
            {result.voucher_balance != null && (
              <p className="mt-1 text-sm text-slate-600">
                New voucher balance: ${formatMoney(result.voucher_balance)}
              </p>
            )}

            <button
              type="button"
              onClick={startOver}
              className="mt-6 rounded-lg bg-blue-900 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800"
            >
              Return another item
            </button>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-black text-slate-900">
              Find your transaction
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter the transaction number from your receipt and confirm your
              password. Items can be returned within 30 days of purchase.
            </p>

            <form
              onSubmit={lookupTransaction}
              className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            >
              <label className="block text-sm font-semibold text-slate-700">
                Transaction number
                <input
                  type="text"
                  inputMode="numeric"
                  value={transactionNumber}
                  onChange={(event) => setTransactionNumber(event.target.value)}
                  placeholder="e.g. 1042"
                  required
                  className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 outline-none focus:border-blue-700"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 outline-none focus:border-blue-700"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {loading ? "Looking up..." : "Look up"}
              </button>
            </form>
          </section>
        )}

        {order && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Transaction #{order.order_id}
                </h2>
                <p className="text-sm text-slate-500">
                  {formatDate(order.created_at)} · Paid with{" "}
                  {order.refund_method_label} · Total ${formatMoney(order.total)}
                </p>
              </div>
              <p
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  order.within_return_window
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {order.within_return_window
                  ? `Returnable until ${new Date(order.return_deadline).toLocaleDateString()}`
                  : "Return window has closed"}
              </p>
            </div>

            <form onSubmit={submitReturn} className="mt-5 space-y-5">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-2">Item</th>
                    <th className="py-2">Price paid</th>
                    <th className="py-2">Purchased</th>
                    <th className="py-2">Return qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <tr key={item.order_item_id}>
                      <td className="py-3 font-semibold text-slate-800">
                        {item.name}
                        {item.returned_quantity > 0 && (
                          <span className="block text-xs font-normal text-slate-500">
                            {item.returned_quantity} already returned
                          </span>
                        )}
                      </td>
                      <td className="py-3">${formatMoney(item.price_each)}</td>
                      <td className="py-3">{item.quantity}</td>
                      <td className="py-3">
                        {item.returnable_quantity > 0 ? (
                          <input
                            type="number"
                            min="0"
                            max={item.returnable_quantity}
                            value={returnQuantities[item.order_item_id] ?? 0}
                            onChange={(event) =>
                              setItemQuantity(item, event.target.value)
                            }
                            aria-label={`Quantity of ${item.name} to return`}
                            className="w-20 rounded-lg border-2 border-slate-200 px-2 py-1 outline-none focus:border-blue-700"
                          />
                        ) : (
                          <span className="text-xs text-slate-400">
                            Not returnable
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {order.within_return_window && (
                <>
                  <label className="block text-sm font-semibold text-slate-700">
                    Reason (optional)
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      maxLength={500}
                      rows={2}
                      className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 outline-none focus:border-blue-700"
                    />
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4">
                    <p className="text-lg font-black text-slate-900">
                      Refund: ${formatMoney(refundTotal)}
                      <span className="block text-xs font-semibold text-slate-500">
                        Refunded to {order.refund_method_label}
                      </span>
                    </p>
                    <button
                      type="submit"
                      disabled={submitting || selectedItems.length === 0}
                      className="rounded-lg bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {submitting ? "Processing..." : "Return selected items"}
                    </button>
                  </div>
                </>
              )}
            </form>

            {order.returns.length > 0 && (
              <div className="mt-6 border-t border-slate-200 pt-4">
                <h3 className="text-sm font-black text-slate-700">
                  Previous returns
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {order.returns.map((previous) => (
                    <li key={previous.return_id}>
                      Return #{previous.return_id} · {formatDate(previous.created_at)} · $
                      {formatMoney(previous.refund_total)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default Returns;
