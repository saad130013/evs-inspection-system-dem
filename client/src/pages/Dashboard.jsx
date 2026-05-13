import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, ExternalLink, FileText, Filter, RefreshCw, Search, X } from "lucide-react";
import { api } from "../lib/api";
import { Field, inputClass } from "../components/Field";

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-hospital-line bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-hospital-ink">{value}</p>
    </div>
  );
}

function statusClass(status) {
  if (status === "Excellent") return "bg-emerald-100 text-emerald-800";
  if (status === "Good") return "bg-teal-100 text-teal-800";
  if (status === "Low") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function ProtectedReportFrame({ submissionId }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    api.authorizedBlobUrl(`/api/reports/${submissionId}/html`).then((nextUrl) => {
      objectUrl = nextUrl;
      if (active) setUrl(nextUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [submissionId]);

  if (!url) return <div className="rounded-lg border border-hospital-line p-6 text-sm text-slate-500">Loading report...</div>;
  return <iframe title="Inspection report" src={url} className="h-[720px] w-full rounded-lg border border-hospital-line bg-white" />;
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-lg border border-hospital-line bg-hospital-soft px-3 py-2">
      <p className="text-[11px] font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-hospital-ink">{value || "-"}</p>
    </div>
  );
}

export function Dashboard({ config, setConfig, t, selectedReport, setSelectedReport, user }) {
  const [dashboard, setDashboard] = useState(null);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ inspector: "", areaType: "", status: "", fromDate: "", toDate: "", minScore: "" });
  const [quickSearch, setQuickSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const areaTypes = useMemo(() => config.checklists.map((item) => item.riskType), [config]);
  const visibleRows = useMemo(() => {
    const term = quickSearch.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [
      row.submissionId,
      row.inspectorName,
      row.visitLocation,
      row.areaCategory,
      row.areaRoom,
      row.date,
      row.time
    ].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [rows, quickSearch]);
  const selectedRow = useMemo(() => rows.find((row) => row.submissionId === selectedReport), [rows, selectedReport]);

  async function load() {
    setLoading(true);
    try {
      const [dash, list] = await Promise.all([api.dashboard(), api.submissions(filters)]);
      setDashboard(dash);
      setRows(list.submissions);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const [adminDraft, setAdminDraft] = useState({
    inspectors: config.masterData.inspectors.join("\n"),
    supervisors: config.masterData.supervisors.join("\n"),
    locations: config.masterData.locations.join("\n"),
    issueOptions: config.masterData.issueOptions.join("\n")
  });
  const [adminMessage, setAdminMessage] = useState("");

  async function saveAdminLists() {
    const payload = Object.fromEntries(
      Object.entries(adminDraft).map(([key, value]) => [key, value.split("\n").map((item) => item.trim()).filter(Boolean)])
    );
    const result = await api.updateMasterData(payload);
    setConfig((prev) => ({ ...prev, masterData: result.masterData }));
    setAdminMessage("Saved");
  }

  async function openProtected(path) {
    const url = await api.authorizedBlobUrl(path);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label={t.totalInspections} value={dashboard?.total ?? 0} />
        <Stat label={t.averageScore} value={`${dashboard?.averageScore ?? 0}%`} />
        <Stat label={t.lowFailed} value={dashboard?.lowOrFailed ?? 0} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-hospital-line bg-white p-4">
          <h2 className="text-lg font-bold text-hospital-ink">{t.areaType}</h2>
          <div className="mt-3 space-y-2">
            {Object.entries(dashboard?.byAreaType || {}).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-md bg-hospital-soft px-3 py-2 text-sm">
                <span className="font-semibold">{key}</span><span>{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-hospital-line bg-white p-4">
          <h2 className="text-lg font-bold text-hospital-ink">{t.inspector}</h2>
          <div className="mt-3 space-y-2">
            {Object.entries(dashboard?.byInspector || {}).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-md bg-hospital-soft px-3 py-2 text-sm">
                <span className="font-semibold">{key}</span><span>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-hospital-line bg-white p-4 shadow-panel">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-hospital-ink"><Filter size={18} /> {t.filters}</h2>
          <div className="flex gap-2">
            <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-hospital-line px-3 py-2 text-sm font-bold hover:border-hospital-teal">
              <RefreshCw size={15} /> {t.apply}
            </button>
            {["Supervisor", "Manager", "Admin"].includes(user.role) && (
              <button
                type="button"
                onClick={() => openProtected(api.weeklyReportPath({ fromDate: filters.fromDate, toDate: filters.toDate }))}
                className="inline-flex items-center gap-2 rounded-lg border border-hospital-line px-3 py-2 text-sm font-bold hover:border-hospital-teal"
                title="Uses selected From/To dates, or current week if dates are empty."
              >
                <CalendarDays size={15} /> Weekly PDF
              </button>
            )}
            {["Supervisor", "Manager", "Admin"].includes(user.role) && (
              <button
                type="button"
                onClick={() => openProtected(api.monthlyReportPath({ month: filters.fromDate ? filters.fromDate.slice(0, 7) : "" }))}
                className="inline-flex items-center gap-2 rounded-lg border border-hospital-line px-3 py-2 text-sm font-bold hover:border-hospital-teal"
                title="Uses the selected From Date month, or the current month if From Date is empty."
              >
                <CalendarDays size={15} /> Monthly PDF
              </button>
            )}
            {["Supervisor", "Manager", "Admin"].includes(user.role) && (
              <button
                type="button"
                onClick={() => openProtected(api.monthlyExcelPath({ month: filters.fromDate ? filters.fromDate.slice(0, 7) : "" }))}
                className="inline-flex items-center gap-2 rounded-lg border border-hospital-line px-3 py-2 text-sm font-bold hover:border-hospital-teal"
                title="Downloads the monthly report Excel from the monthly reports folder."
              >
                <Download size={15} /> Monthly Excel
              </button>
            )}
            {["Manager", "Admin"].includes(user.role) && (
              <button type="button" onClick={() => openProtected("/api/export/excel")} className="inline-flex items-center gap-2 rounded-lg bg-hospital-teal px-3 py-2 text-sm font-bold text-white hover:bg-teal-800">
                <Download size={15} /> {t.exportExcel}
              </button>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Field label={t.inspector}><select className={inputClass} value={filters.inspector} onChange={(e) => setFilter("inspector", e.target.value)}><option value="">All</option>{config.masterData.inspectors.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label={t.areaType}><select className={inputClass} value={filters.areaType} onChange={(e) => setFilter("areaType", e.target.value)}><option value="">All</option>{areaTypes.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label={t.status}><select className={inputClass} value={filters.status} onChange={(e) => setFilter("status", e.target.value)}><option value="">All</option>{["Excellent", "Good", "Low", "Bad"].map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label={t.fromDate}><input type="date" className={inputClass} value={filters.fromDate} onChange={(e) => setFilter("fromDate", e.target.value)} /></Field>
          <Field label={t.toDate}><input type="date" className={inputClass} value={filters.toDate} onChange={(e) => setFilter("toDate", e.target.value)} /></Field>
          <Field label={t.minScore}><input type="number" className={inputClass} value={filters.minScore} onChange={(e) => setFilter("minScore", e.target.value)} /></Field>
        </div>
      </section>

      <section className="rounded-lg border border-hospital-line bg-white p-4 shadow-panel">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-hospital-ink">
              <FileText size={18} /> {t.report}
            </h2>
            <p className="text-sm text-slate-500">
              {user.role === "Inspector" ? "Showing your submitted inspection reports only." : "Showing all inspection reports available to your role."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="min-h-[42px] w-full rounded-lg border border-hospital-line bg-white py-2 pl-9 pr-10 text-sm font-semibold outline-none focus:border-hospital-teal sm:w-[360px]"
                value={quickSearch}
                onChange={(event) => setQuickSearch(event.target.value)}
                placeholder="Search ID, inspector, area, room, date..."
              />
              {quickSearch && (
                <button
                  type="button"
                  onClick={() => setQuickSearch("")}
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-hospital-soft"
                  aria-label="Clear quick search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <span className="text-sm font-semibold text-slate-500">
              {visibleRows.length} / {rows.length}
            </span>
            {loading && <span className="text-sm text-slate-500">Loading...</span>}
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="min-w-[980px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-hospital-teal text-white">
                <th className="p-3 text-start">ID</th>
                <th className="p-3 text-start">{t.date}</th>
                <th className="p-3 text-start">{t.inspector}</th>
                <th className="p-3 text-start">{t.areaRoom}</th>
                <th className="p-3 text-start">{t.areaType}</th>
                <th className="p-3 text-start">{t.percentage}</th>
                <th className="p-3 text-start">{t.status}</th>
                <th className="p-3 text-start">{t.report}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.submissionId}
                  onClick={() => setSelectedReport(row.submissionId)}
                  className={`cursor-pointer border-b border-hospital-line hover:bg-hospital-soft ${selectedReport === row.submissionId ? "bg-teal-50" : ""}`}
                >
                  <td className="p-3 font-bold">{row.submissionId}</td>
                  <td className="p-3">{row.date} {row.time}</td>
                  <td className="p-3">{row.inspectorName}</td>
                  <td className="p-3">{row.areaRoom}</td>
                  <td className="p-3">{row.areaType}</td>
                  <td className="p-3 font-bold">{row.percentage}%</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(row.ratingStatus)}`}>{row.ratingStatus}</span></td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedReport(row.submissionId);
                        }}
                        className="rounded-md border border-hospital-line px-2 py-1 font-semibold hover:border-hospital-teal"
                      >
                        {t.reportViewer}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openProtected(`/api/reports/${row.submissionId}`);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-hospital-line px-2 py-1 font-semibold hover:border-hospital-teal"
                      >
                        <ExternalLink size={14} /> PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleRows.length && <tr><td colSpan="8" className="p-8 text-center text-slate-500">{rows.length ? "No reports match your search." : t.noRows}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selectedReport && (
        <section className="rounded-lg border border-hospital-line bg-white p-4 shadow-panel">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-hospital-ink">{t.reportViewer}: {selectedReport}</h2>
              {selectedRow && <p className="text-sm text-slate-500">{selectedRow.inspectorName} - {selectedRow.areaRoom} - {selectedRow.date} {selectedRow.time}</p>}
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg border border-hospital-line px-3 py-2 text-sm font-bold hover:border-hospital-teal" onClick={() => setSelectedReport("")}>
              <X size={15} /> {t.clear}
            </button>
          </div>

          {selectedRow && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Submission ID" value={selectedRow.submissionId} />
              <DetailItem label={t.inspector} value={selectedRow.inspectorName} />
              <DetailItem label={t.areaRoom} value={selectedRow.areaRoom} />
              <DetailItem label="Category" value={selectedRow.areaCategory} />
              <DetailItem label={t.location} value={selectedRow.visitLocation} />
              <DetailItem label={t.areaType} value={selectedRow.areaType} />
              <DetailItem label={t.percentage} value={`${selectedRow.percentage}%`} />
              <DetailItem label={t.rating} value={selectedRow.ratingStatus} />
              <DetailItem label={t.supervisor} value={selectedRow.supervisorName} />
              {selectedRow.notes && (
                <div className="rounded-lg border border-hospital-line bg-hospital-soft px-3 py-2 sm:col-span-2 lg:col-span-4">
                  <p className="text-[11px] font-bold uppercase text-slate-500">{t.notes}</p>
                  <p className="mt-1 text-sm font-semibold text-hospital-ink">{selectedRow.notes}</p>
                </div>
              )}
            </div>
          )}
          <ProtectedReportFrame submissionId={selectedReport} />
        </section>
      )}

      {user.role === "Admin" && <section className="rounded-lg border border-hospital-line bg-white p-4 shadow-panel">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-hospital-ink">{t.adminLists}</h2>
            <p className="text-sm text-slate-500">{t.onePerLine}</p>
          </div>
          <button onClick={saveAdminLists} className="rounded-lg bg-hospital-teal px-4 py-2 text-sm font-bold text-white hover:bg-teal-800">{t.saveLists}</button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["inspectors", t.inspectorsList],
            ["supervisors", t.supervisorsList],
            ["locations", t.locationsList],
            ["issueOptions", t.issuesList]
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <textarea
                className={inputClass}
                rows={5}
                value={adminDraft[key]}
                onChange={(event) => setAdminDraft((prev) => ({ ...prev, [key]: event.target.value }))}
              />
            </Field>
          ))}
        </div>
        {adminMessage && <p className="mt-3 text-sm font-semibold text-hospital-teal">{adminMessage}</p>}
      </section>}
    </div>
  );
}
