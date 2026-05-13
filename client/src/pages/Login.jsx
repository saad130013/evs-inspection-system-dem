import React, { useState } from "react";
import { LogIn } from "lucide-react";
import { api, setAuthToken } from "../lib/api";

export function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const result = await api.login({ username, password });
      setAuthToken(result.token);
      onLogin(result.user);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-hospital-soft">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <form onSubmit={submit} className="w-full rounded-lg border border-hospital-line bg-white p-6 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-wide text-hospital-teal">Support Services Division</p>
          <h1 className="mt-1 text-2xl font-bold text-hospital-ink">EVS Inspection Login</h1>
          <p className="mt-1 text-sm text-slate-600">Environmental Services / Housekeeping rounds</p>

          <label className="mt-6 block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Username</span>
            <input className="w-full rounded-lg border border-hospital-line px-3 py-2 outline-none focus:border-hospital-teal focus:ring-2 focus:ring-hospital-teal/15" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Password</span>
            <input type="password" className="w-full rounded-lg border border-hospital-line px-3 py-2 outline-none focus:border-hospital-teal focus:ring-2 focus:ring-hospital-teal/15" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>

          {message && <p className="mt-3 text-sm font-semibold text-red-700">{message}</p>}
          <button disabled={loading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-hospital-teal px-4 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60">
            <LogIn size={16} />
            {loading ? "Signing in..." : "Sign in"}
          </button>


        </form>
      </div>
    </div>
  );
}
