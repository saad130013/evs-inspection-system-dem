import React, { useEffect, useMemo, useState } from "react";
import { api, getAuthToken, setAuthToken, setSessionExpiredHandler } from "./lib/api";
import { dictionaries } from "./lib/i18n";
import { AppShell } from "./components/AppShell";
import { InspectionForm } from "./pages/InspectionForm";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { AdminUsers } from "./pages/AdminUsers";

export default function App() {
  const [lang, setLang]               = useState("en");
  const [page, setPage]               = useState("form");
  const [config, setConfig]           = useState(null);
  const [error, setError]             = useState("");
  const [selectedReport, setSelectedReport] = useState("");
  const [user, setUser]               = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const t = useMemo(() => dictionaries[lang], [lang]);

  // Register the 401 handler once — when any API call gets a 401 response,
  // clear state and return to Login without any manual navigation.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setConfig(null);
      setPage("form");
      setError("");
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  // On first load: if a token is stored, verify it is still valid.
  useEffect(() => {
    if (!getAuthToken()) {
      setAuthChecked(true);
      return;
    }
    api.me()
      .then((result) => setUser(result.user))
      .catch(() => {
        setAuthToken("");          // stale token — discard silently
        setAuthChecked(true);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  // Load config whenever we have a valid user.
  useEffect(() => {
    if (!user) return;
    setError("");
    api.config().then(setConfig).catch((err) => setError(err.message));
  }, [user]);

  function handleLogin(nextUser) {
    setUser(nextUser);
    setPage("form");              // always land on the form after login
  }

  function logout() {
    setAuthToken("");
    setUser(null);
    setConfig(null);
    setPage("form");
    setError("");
  }

  if (!authChecked) {
    return <div className="p-6 text-slate-700">Loading EVS inspection system...</div>;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (error) {
    return <div className="p-6 text-red-700">{error}</div>;
  }

  if (!config) {
    return <div className="p-6 text-slate-700">Loading EVS inspection system...</div>;
  }

  return (
    <AppShell page={page} setPage={setPage} lang={lang} setLang={setLang} t={t} user={user} onLogout={logout}>
      {page === "admin" && user.role === "Admin" ? (
        <AdminUsers />
      ) : page === "form" ? (
        <InspectionForm
          config={config}
          t={t}
          user={user}
          onSubmitted={(submission) => {
            setSelectedReport(submission.submissionId);
            setPage("dashboard");
          }}
        />
      ) : (
        <Dashboard
          config={config}
          setConfig={setConfig}
          t={t}
          selectedReport={selectedReport}
          setSelectedReport={setSelectedReport}
          user={user}
        />
      )}
    </AppShell>
  );
}
