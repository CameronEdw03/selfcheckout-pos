import { useState } from "react";

const API = "http://127.0.0.1:8000";

const LIMIT_OPTIONS = [5, 10, 25, 50];

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

function startOfMonth() {
  const date = new Date();
  return formatDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

const PRESETS = [
  { label: "Today", getRange: () => [daysAgo(0), daysAgo(0)] },
  { label: "Last 7 days", getRange: () => [daysAgo(6), daysAgo(0)] },
  { label: "Last 30 days", getRange: () => [daysAgo(29), daysAgo(0)] },
  { label: "This month", getRange: () => [startOfMonth(), daysAgo(0)] },
];

function formatCurrency(value) {
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function BestSellersReport({ currentUser }) {
  const [startDate, setStartDate] = useState(() => daysAgo(6));
  const [endDate, setEndDate] = useState(() => daysAgo(0));
  const [limit, setLimit] = useState(10);
  const [password, setPassword] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("quantity");

  function resetResults() {
    setReport(null);
    setError("");
  }

  function applyPreset(preset) {
    const [start, end] = preset.getRange();
    setStartDate(start);
    setEndDate(end);
    resetResults();
  }

  async function handleLoadReport(event) {
    event.preventDefault();

    if (endDate < startDate) {
      setError("The end date must be on or after the start date.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/manager/best-sellers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_name: currentUser.username ?? currentUser.user_name,
          password,
          start_date: startDate,
          end_date: endDate,
          limit,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to load best-selling products."
        );
      }

      if (!data.summary || !Array.isArray(data.best_sellers)) {
        throw new Error("The best sellers response was invalid.");
      }

      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setPassword("");
      setLoading(false);
    }
  }

  const sortedSellers = [...(report?.best_sellers ?? [])].sort((a, b) =>
    sortBy === "revenue"
      ? b.revenue - a.revenue || b.quantity_sold - a.quantity_sold
      : b.quantity_sold - a.quantity_sold || b.revenue - a.revenue
  );

  const highestValue = Math.max(
    1,
    ...sortedSellers.map((item) =>
      sortBy === "revenue" ? item.revenue : item.quantity_sold
    )
  );

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-black text-slate-900">Best Sellers</h2>
        <p className="text-sm text-slate-500">
          See which products sold the most over a date range.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset)}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-blue-800 hover:text-blue-900"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleLoadReport}
        className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_1fr_auto] lg:items-end"
      >
        <label className="text-sm font-semibold text-slate-700">
          Start date
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
          End date
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
          Show top
          <select
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              resetResults();
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            {LIMIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
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
          {loading ? "Loading..." : "View best sellers"}
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

      {report && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">
                Transactions
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {report.summary.transaction_count}
              </p>
            </article>
            <article className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">
                Units sold
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {report.summary.units_sold}
              </p>
            </article>
            <article className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">
                Item revenue
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {formatCurrency(report.summary.total_revenue)}
              </p>
            </article>
            <article className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">
                Products sold
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {report.summary.distinct_products}
              </p>
            </article>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-900">
              Top {report.best_sellers.length} products ({report.start_date}
              {report.start_date !== report.end_date &&
                ` to ${report.end_date}`}
              )
            </h3>
            <label className="text-sm font-semibold text-slate-700">
              Sort by{" "}
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="ml-1 rounded-lg border border-slate-300 px-2 py-1"
              >
                <option value="quantity">Units sold</option>
                <option value="revenue">Revenue</option>
              </select>
            </label>
          </div>

          {sortedSellers.length === 0 ? (
            <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              No products were sold in this date range.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Units</th>
                    <th className="px-4 py-3 text-right">Orders</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">% of units</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedSellers.map((product, index) => {
                    const value =
                      sortBy === "revenue"
                        ? product.revenue
                        : product.quantity_sold;

                    return (
                      <tr key={product.product_id}>
                        <td className="px-4 py-3 font-bold text-blue-900">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">
                            {product.product_name}
                          </p>
                          <div className="mt-1 h-2 w-full min-w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-800"
                              style={{
                                width: `${(value / highestValue) * 100}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {product.category}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
                          {product.quantity_sold}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">
                          {product.order_count}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
                          {formatCurrency(product.revenue)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">
                          {product.share_of_units}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default BestSellersReport;
