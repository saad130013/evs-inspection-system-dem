import React, { useEffect, useMemo, useState } from "react";
import { KeyRound, Plus, RefreshCw, Save } from "lucide-react";
import { api } from "../lib/api";
import { Field, inputClass } from "../components/Field";

const roles = ["Inspector", "Supervisor", "Manager", "Admin"];

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function usernameFromName(name) {
  const ascii = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return ascii || "";
}

export function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [masterData, setMasterData] = useState(null);
  const [message, setMessage] = useState("");
  const [newUser, setNewUser] = useState({ username: "", password: "", name: "", role: "Inspector" });
  const [passwords, setPasswords] = useState({});

  async function load() {
    const [result, config] = await Promise.all([api.users(), api.config()]);
    setUsers(result.users);
    setMasterData(config.masterData);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  async function create(event) {
    event.preventDefault();
    try {
      await api.createUser(newUser);
      setNewUser({ username: "", password: "", name: "", role: "Inspector" });
      setMessage("User created");
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function save(user) {
    await api.updateUser(user.id, user);
    setMessage("User saved");
    await load();
  }

  async function reset(user) {
    await api.resetPassword(user.id, passwords[user.id]);
    setPasswords((prev) => ({ ...prev, [user.id]: "" }));
    setMessage("Password reset");
  }

  const setUser = (id, key, value) => {
    setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, [key]: value } : user)));
  };

  const staffWithoutAccounts = useMemo(() => {
    const known = new Set(users.flatMap((user) => [normalize(user.username), normalize(user.name)]).filter(Boolean));
    const inspectors = (masterData?.inspectors || [])
      .filter((name) => !known.has(normalize(name)))
      .map((name) => ({ name, role: "Inspector" }));
    const supervisors = (masterData?.supervisors || [])
      .filter((name) => !known.has(normalize(name)))
      .map((name) => ({ name, role: "Supervisor" }));
    return [...inspectors, ...supervisors];
  }, [masterData, users]);

  function prepareAccount(staff) {
    setNewUser({
      username: usernameFromName(staff.name),
      password: "",
      name: staff.name,
      role: staff.role
    });
    setMessage("Fill username/password, then click Add to create a login account.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-hospital-line bg-white p-4 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-hospital-ink">User Management</h2>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-hospital-line px-3 py-2 text-sm font-bold hover:border-hospital-teal">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
        {message && <p className="mb-3 text-sm font-semibold text-hospital-teal">{message}</p>}
        <form onSubmit={create} className="grid gap-3 md:grid-cols-5">
          <Field label="Username"><input className={inputClass} value={newUser.username} onChange={(event) => setNewUser((prev) => ({ ...prev, username: event.target.value }))} /></Field>
          <Field label="Name"><input className={inputClass} value={newUser.name} onChange={(event) => setNewUser((prev) => ({ ...prev, name: event.target.value }))} /></Field>
          <Field label="Password"><input className={inputClass} type="password" value={newUser.password} onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))} /></Field>
          <Field label="Role"><select className={inputClass} value={newUser.role} onChange={(event) => setNewUser((prev) => ({ ...prev, role: event.target.value }))}>{roles.map((role) => <option key={role}>{role}</option>)}</select></Field>
          <button className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-hospital-teal px-3 text-sm font-bold text-white"><Plus size={15} /> Add</button>
        </form>
      </section>

      <section className="rounded-lg border border-hospital-line bg-white p-4 shadow-panel">
        <div className="overflow-x-auto">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-hospital-ink">Login Accounts</h2>
              <p className="text-sm text-slate-500">These are users who can sign in to the system.</p>
            </div>
            <span className="text-sm font-bold text-hospital-teal">{users.length} accounts</span>
          </div>
          <table className="min-w-[900px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-hospital-teal text-white">
                <th className="p-3 text-start">Username</th>
                <th className="p-3 text-start">Name</th>
                <th className="p-3 text-start">Role</th>
                <th className="p-3 text-start">Active</th>
                <th className="p-3 text-start">Reset Password</th>
                <th className="p-3 text-start">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-hospital-line">
                  <td className="p-3 font-bold">{user.username}</td>
                  <td className="p-3"><input className={inputClass} value={user.name} onChange={(event) => setUser(user.id, "name", event.target.value)} /></td>
                  <td className="p-3"><select className={inputClass} value={user.role} onChange={(event) => setUser(user.id, "role", event.target.value)}>{roles.map((role) => <option key={role}>{role}</option>)}</select></td>
                  <td className="p-3"><input type="checkbox" checked={user.active} onChange={(event) => setUser(user.id, "active", event.target.checked)} /></td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <input className={inputClass} type="password" value={passwords[user.id] || ""} onChange={(event) => setPasswords((prev) => ({ ...prev, [user.id]: event.target.value }))} />
                      <button type="button" onClick={() => reset(user)} className="rounded-md border border-hospital-line px-2 font-bold hover:border-hospital-teal"><KeyRound size={15} /></button>
                    </div>
                  </td>
                  <td className="p-3"><button onClick={() => save(user)} className="inline-flex items-center gap-2 rounded-md border border-hospital-line px-2 py-1 font-bold hover:border-hospital-teal"><Save size={15} /> Save</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {staffWithoutAccounts.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-panel">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-amber-950">Registered Staff Without Login Accounts</h2>
            <p className="text-sm text-amber-800">
              These names are registered in the inspectors/supervisors lists, but they do not have login accounts yet.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {staffWithoutAccounts.map((staff) => (
              <div key={`${staff.role}-${staff.name}`} className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2">
                <div>
                  <p className="font-bold text-slate-900">{staff.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{staff.role}</p>
                </div>
                <button
                  type="button"
                  onClick={() => prepareAccount(staff)}
                  className="rounded-md border border-amber-300 px-3 py-1 text-sm font-bold text-amber-900 hover:bg-amber-100"
                >
                  Create Login
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
