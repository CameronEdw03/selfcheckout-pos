
import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

export default function CashDrawerSettings({ currentUser }) {
  const [minimumBalance, setMinimumBalance] = useState("");
  const [currentBalance, setCurrentBalance] = useState(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadDrawer() {
      try {
        const response = await fetch(`${API}/cash-drawer/1/status`);
        if (!response.ok) throw new Error("Unable to load drawer status.");

        const data = await response.json();
        setMinimumBalance(String(data.minimum_balance));
        setCurrentBalance(data.current_balance);
      } catch {
        setError("Unable to load cash drawer settings.");
      }
    }

    loadDrawer();
  }, []);

  async function handleSave(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      const response = await fetch(`${API}/cash-drawer/1/minimum`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_name: currentUser.username ?? currentUser.user_name,
          password: password,
          minimum_balance: Number(minimumBalance),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to update minimum balance."
        );
      }

      setMessage("Cash drawer minimum balance updated successfully!");
      setPassword("");
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-slate-900">
        Cash Drawer Settings
      </h2>

      <p className="mt-2 text-sm text-slate-600">
        Current cash balance:{" "}
        {currentBalance === null
          ? "Loading..."
          : `$${Number(currentBalance).toFixed(2)}`}
      </p>

      <form onSubmit={handleSave} className="mt-5 space-y-4">
        <label className="block text-sm font-semibold text-slate-700">
          Minimum cash balance ($)
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={minimumBalance}
            onChange={(event) => setMinimumBalance(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Confirm manager password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="text-sm font-semibold text-green-700">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-950 px-5 py-3 font-bold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Minimum Balance"}
        </button>
      </form>
    </section>
  );
}
