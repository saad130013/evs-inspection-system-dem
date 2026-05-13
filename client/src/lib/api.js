function resolveApiBase() {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE.replace(/\/$/, "");
  return "";
}

const API_BASE = resolveApiBase();
let authToken = localStorage.getItem("evs_auth_token") || "";

export function setAuthToken(token) {
  authToken = token || "";
  if (authToken) localStorage.setItem("evs_auth_token", authToken);
  else localStorage.removeItem("evs_auth_token");
}

export function getAuthToken() {
  return authToken;
}

let onSessionExpired = null;

export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {})
      },
      ...options
    });
  } catch (error) {
    throw new Error("Failed to fetch API. Check that the backend server is running on port 4000 and the Vite proxy is active.");
  }

  if (response.status === 401) {
    setAuthToken("");
    if (onSessionExpired) onSessionExpired();
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Session expired. Please log in again.");
  }

  if (!response.ok) {
    const message = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(message.message || "Request failed");
  }
  return response.json();
}

export const api = {
  base: API_BASE,
  login: (payload) => request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/api/auth/me"),
  config: () => request("/api/config"),
  updateMasterData: (payload) => request("/api/master-data", { method: "PUT", body: JSON.stringify(payload) }),
  updateChecklists: (checklists) => request("/api/checklists", { method: "PUT", body: JSON.stringify({ checklists }) }),
  submitInspection: (payload) => request("/api/submissions", { method: "POST", body: JSON.stringify(payload) }),
  submissions: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== "")).toString();
    return request(`/api/submissions${query ? `?${query}` : ""}`);
  },
  dashboard: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== "")).toString();
    return request(`/api/dashboard${query ? `?${query}` : ""}`);
  },
  users: () => request("/api/users"),
  createUser: (payload) => request("/api/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (id, payload) => request(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  resetPassword: (id, password) => request(`/api/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
  reportUrl: (id) => `${API_BASE}/api/reports/${id}`,
  reportHtmlUrl: (id) => `${API_BASE}/api/reports/${id}/html`,
  weeklyReportPath: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== "")).toString();
    return `/api/reports/weekly/summary${query ? `?${query}` : ""}`;
  },
  monthlyReportPath: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== "")).toString();
    return `/api/reports/monthly/summary${query ? `?${query}` : ""}`;
  },
  monthlyExcelPath: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== "")).toString();
    return `/api/reports/monthly/excel${query ? `?${query}` : ""}`;
  },
  excelUrl: () => `${API_BASE}/api/export/excel`,
  authorizedBlobUrl: async (path) => {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
    });
    if (!response.ok) throw new Error("Unable to open protected file.");
    return URL.createObjectURL(await response.blob());
  }
};
