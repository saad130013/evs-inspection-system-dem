import React from "react";

function statusClass(status) {
  if (status === "Excellent") return "bg-emerald-100 text-emerald-800";
  if (status === "Good") return "bg-teal-100 text-teal-800";
  if (status === "Low") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

export function ScoreSummary({ total, max, percentage, rating, t }) {
  return (
    <aside className="sticky top-4 rounded-lg border border-hospital-line bg-white p-4 shadow-panel">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">{t.totalScore}</p>
          <p className="text-2xl font-bold text-hospital-ink">{total}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">{t.maximumScore}</p>
          <p className="text-2xl font-bold text-hospital-ink">{max}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">{t.percentage}</p>
          <p className="text-2xl font-bold text-hospital-ink">{percentage.toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">{t.rating}</p>
          <span className={`mt-1 inline-flex rounded-full px-3 py-1 text-sm font-bold ${statusClass(rating)}`}>{rating}</span>
        </div>
      </div>
    </aside>
  );
}
