import { useState } from "react";

const API = "http://127.0.0.1:8000";

const ACTION_LABELS = {
  price_change: "Product price discount",
  transaction_discount: "Transaction discount",
  item_removed: "Item removed",
  transaction_canceled: "Transaction canceled",
};

const ACTION_STYLES = {
  price_change: "bg-blue-50 text-blue-800",
  transaction_discount: "bg-green-50 text-green-800",
  item_removed: "bg-amber-50 text-amber-800",
  transaction_canceled: "bg-red-50 text-red-700",
};

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function getDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return formatDate(date);
}

function formatCurrency(value) {
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

// Describe what changed for one activity row.
function describeChange(activity) {
  if (activity.action === "price_change" ||
      activity.action === "transaction_discount") {
    return `${formatCurrency(activity.previous_price)} → ${formatCurrency(
      activity.new_price
    )}`;
  }

  if (activity.action === "item_removed") {
    const quantity = activity.quantity ? `${activity.quantity} × ` : "";
    const value =
      activity.amount != null ? ` (${formatCurrency(activity.amount)})` : "";
    return `${quantity}${activity.product_name ?? `Product #${activity.product_id}`}${value}`;
  }

  if (activity.action === "transaction_canceled") {
    const value =
      activity.amount != null ? formatCurrency(activity.amount) : "—";
    return `${activity.quantity ?? 0} item(s), ${value}`;
  }

  return "—";
}

function StaffActivityDashboard({ currentUser }) {
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(() => formatDate(new Date()));
  const [password, setPassword] = useState("");
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [staffFilter, setStaffFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");

  async function handleLoadActivity(event) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/manager/staff-activity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_name: currentUser.username ?? currentUser.user_name,
          password,
          start_date: startDate,
          end_date: endDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to load staff activity."
        );
      }

      if (
        !data.summary ||
        !Array.isArray(data.staff_breakdown) ||
        !Array.isArray(data.activities)
      ) {
        throw new Error("The staff activity response was invalid.");
      }

      setActivity(data);
    } catch (err) {
      setActivity(null);
      setError(err.message || "Unable to load staff activity.");
    } finally {
      setLoading(false);
    }
  }

  function resetResults() {
    setActivity(null);
    setError("");
  }

  const filteredActivities = (activity?.activities ?? []).filter(
    (entry) =>
      (staffFilter === "All" || entry.staff_username === staffFilter) &&
      (actionFilter === "All" || entry.action === actionFilter)
  );

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-black text-slate-900">
          Staff Activity
        </h2>
        <p className="text-sm text-slate-500">
          See what staff members changed: price discounts, transaction
          discounts, removed items, and canceled transactions.
        </p>
      </div>

      <form
        onSubmit={handleLoadActivity}
        className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
      >
        <label className="text-sm font-semibold text-slate-700">
          From
          <input
            required
            type="date"
            value={startDate}
            max={endDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              resetResults();
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="text-sm font-semibold text-slate-700">
          To
          <input
            required
            type="date"
            value={endDate}
            min={startDate}
            onChange={(event) => {
              setEndDate(event.target.value);
              resetResults();
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

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
          {loading ? "Loading..." : activity ? "Refresh" : "View activity"}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}

      {activity && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <article className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">
                Staff changes
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {activity.summary.total_actions}
              </p>
            </article>
            <article className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">
                Active staff
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {activity.summary.active_staff}
              </p>
            </article>
            <article className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">
                Price reductions (per unit)
              </p>
              <p className="mt-1 text-2xl font-black text-green-700">
                {formatCurrency(activity.summary.total_discount)}
              </p>
            </article>
            <article className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">
                Value removed from carts
              </p>
              <p className="mt-1 text-2xl font-black text-red-700">
                {formatCurrency(activity.summary.total_removed)}
              </p>
            </article>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-bold text-slate-900">By staff member</h3>
            {activity.staff_breakdown.length === 0 ? (
              <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                No staff accounts were found.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[760px] divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Staff member</th>
                      <th className="px-4 py-3 text-right">Price discounts</th>
                      <th className="px-4 py-3 text-right">Txn discounts</th>
                      <th className="px-4 py-3 text-right">Items removed</th>
                      <th className="px-4 py-3 text-right">Txns canceled</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Discounted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activity.staff_breakdown.map((staff) => (
                      <tr
                        key={staff.staff_username}
                        onClick={() =>
                          setStaffFilter(
                            staffFilter === staff.staff_username
                              ? "All"
                              : staff.staff_username
                          )
                        }
                        className={`cursor-pointer hover:bg-slate-50 ${
                          staffFilter === staff.staff_username
                            ? "bg-blue-50"
                            : ""
                        }`}
                      >
                        <th
                          scope="row"
                          className="px-4 py-3 font-semibold text-slate-800"
                        >
                          {staff.staff_username}
                        </th>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {staff.price_change}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {staff.transaction_discount}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {staff.item_removed}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {staff.transaction_canceled}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {staff.total_actions}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-green-700">
                          {formatCurrency(staff.discount_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900">
                Change log
              </h3>

              <div className="flex flex-wrap gap-3">
                <label className="text-sm font-semibold text-slate-700">
                  Staff
                  <select
                    value={staffFilter}
                    onChange={(event) => setStaffFilter(event.target.value)}
                    className="mt-1 block rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="All">All staff</option>
                    {activity.staff_breakdown.map((staff) => (
                      <option
                        key={staff.staff_username}
                        value={staff.staff_username}
                      >
                        {staff.staff_username}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Change type
                  <select
                    value={actionFilter}
                    onChange={(event) => setActionFilter(event.target.value)}
                    className="mt-1 block rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="All">All changes</option>
                    {Object.entries(ACTION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {filteredActivities.length === 0 ? (
              <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                No staff changes match these filters for the selected dates.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[900px] divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Staff</th>
                      <th className="px-4 py-3">Change</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Details</th>
                      <th className="px-4 py-3">Reason / items</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredActivities.map((entry, index) => (
                      <tr key={`${entry.action}-${entry.created_at}-${index}`}>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {new Date(entry.created_at).toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                          {entry.staff_username}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                              ACTION_STYLES[entry.action] ??
                              "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {ACTION_LABELS[entry.action] ?? entry.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {entry.product_name
                            ? `${entry.product_name} (#${entry.product_id})`
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {entry.student_id ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {describeChange(entry)}
                        </td>
                        <td className="max-w-xs px-4 py-3 text-slate-600">
                          {entry.details ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default StaffActivityDashboard;
