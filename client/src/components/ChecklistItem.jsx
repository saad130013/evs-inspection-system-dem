import React from "react";
import { ratingLabels } from "../lib/i18n";
import { inputClass } from "./Field";

export function ChecklistItem({ item, index, value, onChange, issueOptions, t }) {
  const current = value || { issues: [], other: "" };
  const toggleIssue = (issue) => {
    const set = new Set(current.issues || []);
    set.has(issue) ? set.delete(issue) : set.add(issue);
    onChange({ ...current, issues: [...set] });
  };

  return (
    <section className="rounded-lg border border-hospital-line bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-hospital-teal">#{index + 1}</p>
          <h3 className="text-base font-bold text-hospital-ink">{item.label}</h3>
        </div>
        <span className="w-fit rounded-full bg-hospital-mint px-3 py-1 text-xs font-bold text-hospital-teal">
          Max {item.maxScore}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {item.scores.map((score, scoreIndex) => {
          const labelKey = ratingLabels[scoreIndex];
          return (
            <label
              key={score}
              className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                Number(current.score) === score ? "border-hospital-teal bg-hospital-mint" : "border-hospital-line bg-white hover:border-hospital-teal"
              }`}
            >
              <span className="font-semibold">{t[labelKey]}</span>
              <span className="flex items-center gap-2">
                <span className="font-bold">{score}</span>
                <input
                  type="radio"
                  name={item.id}
                  checked={Number(current.score) === score}
                  onChange={() => onChange({ ...current, score, ratingLabel: t[labelKey] })}
                />
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-slate-700">{t.issues}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {issueOptions.map((issue) => (
            <label key={issue} className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" checked={(current.issues || []).includes(issue)} onChange={() => toggleIssue(issue)} />
              {issue}
            </label>
          ))}
        </div>
        <input
          className={`${inputClass} mt-3`}
          value={current.other || ""}
          onChange={(event) => onChange({ ...current, other: event.target.value })}
          placeholder={t.other}
        />
      </div>
    </section>
  );
}
