import { useState } from "react";

const API = "http://127.0.0.1:8000";

const DEFAULT_CATEGORY = "Exam Supplies";
const WEEK_OPTIONS = [4, 8, 12, 26];

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

// Start date that covers `weeks` full weeks, ending with the current week.
function startForWeeks(weeks) {
  const date = new Date();
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday - (weeks - 1) * 7);
  return formatDate(date);
}

function formatCurrency(value) {
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatWeekLabel(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function WeeklyCategorySales({ currentUser, categories = [] }) {
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [weekCount, setWeekCount] = useState(8);
  const [password, setPassword] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const categoryOptions = [
    ...new Set([DEFAULT_CATEGORY, ...categories.filter(Boolean)]),
  ].sort((first, second) => first.localeCompare(second));

  function resetResults() {
    setReport(null);
    setError("");
  }

  async function handleLoadReport(event) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/manager/category-weekly-sales`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_name: currentUser.username ?? currentUser.user_name,
          password,
          category,
          start_date: startForWeeks(weekCount),
          end_date: formatDate(new Date()),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to load weekly sales."
        );
      }

      if (
        !data.summary ||
        !Array.isArray(data.weeks) ||
        !Array.isArray(data.products)
      ) {
        throw new Error("The weekly sales response was invalid.");
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

  const highestWeek = Math.max(
    1,
    ...(report?.weeks ?? []).map((week) => week.quantity_sold)
  );

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-black text-slate-900">
          Weekly Category Sales
        </h2>
        <p className="text-sm text-slate-500">
          Track how many exam supplies (or any category) sell each week,
          Monday through Sunday, alongside current stock.
        </p>
      </div>

      <form
        onSubmit={handleLoadReport}
        className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_auto] lg:items-end"
      >
        <label className="text-sm font-semibold text-slate-700">
          Category
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              resetResults();
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-slate-700">
          Weeks
          <select
            value={weekCount}
            onChange={(event) => {
              setWeekCount(Number(event.target.value));
              resetResults();
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            {WEEK_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Last {option} weeks
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
          {loading ? "Loading..." : "View weekly sales"}
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
                Units sold
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {report.summary.units_sold}
              </p>
            </article>
            <article className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">Revenue</p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {formatCurrency(report.summary.total_revenue)}
              </p>
            </article>
            <article className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">
                Avg units / week
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {report.summary.average_units_per_week}
              </p>
            </article>
            <article className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">
                Products in category
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {report.products.length}
              </p>
            </article>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-bold text-slate-900">
              {report.category} by week ({report.start_date} to{" "}
              {report.end_date})
            </h3>

            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Week of</th>
                    <th className="px-4 py-3">Units</th>
                    <th className="px-4 py-3 text-right">Orders</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...report.weeks].reverse().map((week) => (
                    <tr key={week.week_start}>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                        {formatWeekLabel(week.week_start)} –{" "}
                        {formatWeekLabel(week.week_end)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 font-semibold text-slate-900">
                            {week.quantity_sold}
                          </span>
                          <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-800"
                              style={{
                                width: `${
                                  (week.quantity_sold / highestWeek) * 100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">
                        {week.order_count}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(week.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-bold text-slate-900">
              Units sold per product, by week
            </h3>

            {report.products.length === 0 ? (
              <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                No products are in the {report.category} category.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="sticky left-0 bg-slate-50 px-4 py-3">
                        Product
                      </th>
                      {report.weeks.map((week) => (
                        <th
                          key={week.week_start}
                          className="whitespace-nowrap px-3 py-3 text-right"
                        >
                          {formatWeekLabel(week.week_start)}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">In stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.products.map((product) => (
                      <tr key={product.product_id}>
                        <td className="sticky left-0 bg-white px-4 py-3 font-semibold text-slate-800">
                          {product.product_name}
                        </td>
                        {report.weeks.map((week) => {
                          const units =
                            week.products[String(product.product_id)] ?? 0;

                          return (
                            <td
                              key={week.week_start}
                              className={`px-3 py-3 text-right ${
                                units > 0
                                  ? "font-semibold text-slate-900"
                                  : "text-slate-300"
                              }`}
                            >
                              {units}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {product.quantity_sold}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${
                            product.in_stock <= 5
                              ? "text-red-700"
                              : "text-slate-600"
                          }`}
                        >
                          {product.in_stock}
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

export default WeeklyCategorySales;
