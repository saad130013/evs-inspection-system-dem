import React from "react";

export function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass = "w-full rounded-lg border border-hospital-line bg-white px-3 py-2 text-sm outline-none transition focus:border-hospital-teal focus:ring-2 focus:ring-hospital-teal/15";
