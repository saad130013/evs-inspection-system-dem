import React from "react";
import { ClipboardCheck, LayoutDashboard, Languages, LogOut, Users } from "lucide-react";

export function AppShell({ children, page, setPage, lang, setLang, t, user, onLogout }) {
  const nav = [{ id: "form", label: t.newInspection, icon: ClipboardCheck }];
  if (["Supervisor", "Manager", "Admin", "Inspector"].includes(user.role)) nav.push({ id: "dashboard", label: t.dashboard, icon: LayoutDashboard });
  if (user.role === "Admin") nav.push({ id: "admin", label: "Users", icon: Users });

  return (
    <div className="min-h-screen bg-hospital-soft">
      <header className="border-b border-hospital-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-3 py-4 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-hospital-teal">Support Services Division</p>
            <h1 className="text-2xl font-bold text-hospital-ink">{t.appName}</h1>
            <p className="text-sm text-slate-600">{t.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex max-w-full overflow-x-auto rounded-lg border border-hospital-line bg-hospital-soft p-1 scrollbar-thin">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setPage(item.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                      page === item.id ? "bg-hospital-teal text-white shadow-sm" : "text-slate-700 hover:bg-white"
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-hospital-line bg-white px-3 py-2 text-sm font-semibold text-hospital-ink hover:border-hospital-teal"
            >
              <Languages size={16} />
              {t.language}
            </button>
            <div className="rounded-lg border border-hospital-line bg-hospital-soft px-3 py-2 text-xs font-semibold text-slate-700">
              {user.name} · {user.role}
            </div>
            <button
              onClick={onLogout}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-hospital-line bg-white px-3 py-2 text-sm font-semibold text-hospital-ink hover:border-hospital-teal"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">{children}</main>
    </div>
  );
}
