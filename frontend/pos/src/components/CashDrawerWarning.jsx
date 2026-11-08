
import { useEffect, useState } from "react";

export default function CashDrawerWarning() {
  const [drawer, setDrawer] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkDrawer() {
      try {
        const response = await fetch(
          "http://127.0.0.1:8000/cash-drawer/1/status"
        );

        if (!response.ok) {
          throw new Error("Unable to check cash drawer.");
        }

        const data = await response.json();

        if (active) {
          setDrawer(data);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError("Cash drawer status unavailable.");
        }
      }
    }

    checkDrawer();

    const interval = setInterval(checkDrawer, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (error) {
    return (
      <div role="status" className="mb-5 rounded-lg border border-slate-300 bg-slate-100 p-4 text-sm text-slate-700">
        {error}
      </div>
    );
  }

  if (!drawer?.low_balance) return null;

  return (
    <div
      role="alert"
      className="mb-5 rounded-lg border-2 border-amber-400 bg-amber-50 p-4 text-amber-900"
    >
      <p className="font-bold">
        Warning: Cash drawer is low on change!
      </p>
      <p className="mt-1 text-sm">
        Current balance: ${drawer.current_balance.toFixed(2)}
        {" | "}
        Minimum required: ${drawer.minimum_balance.toFixed(2)}
      </p>
      <p className="mt-1 text-sm">
        Please notify a staff member.
      </p>
    </div>
  );
}
