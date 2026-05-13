import React, { useEffect, useMemo, useState } from "react";
import { Camera, ImagePlus, Send, X } from "lucide-react";
import { api } from "../lib/api";

const arabicTitle = "تقرير التفتيش والتدقيق اليومي";
const arabicChecklistTitle = "بنود التفتيش والتدقيق";
const arabicSummaryTitle = "ملخص الدرجات";
const scoreKeys = ["excellent", "good", "low", "bad"];
const maxPhotos = 6;
const maxPhotoSizeMb = 4;

const arabicItems = [
  "نظافة الأرضيات والسلالم والأسقف",
  "تلميع الأرضيات الفينيل",
  "استعمال المواد الكيميائية بالطريقة الصحيحة",
  "نظافة المناطق الحرجة حسب المواصفات",
  "الالتزام بنظافة الحمامات ودورات المياه",
  "تلميع الستانلس ستيل",
  "جمع والتخلص من النفايات العادية",
  "الالتزام باستخدام معدات السلامة والوقاية الشخصية",
  "جمع ونقل النفايات الطبية بطريقة سليمة",
  "اتباع تعليمات مكافحة العدوى",
  "زمن الاستجابة للطوارئ",
  "الزي والبطاقة والنظافة الشخصية",
  "نظافة عربة وأدوات ومعدات التدبير المنزلي",
  "سلامة مخزن المواد الكيميائية",
  "الالتزام بتوجيهات الخدمات البيئية",
  "بنود إضافية"
];

const issueOptionsByLabel = {
  "Floor & Stair & Ceiling Clean": ["Spots", "Dusty", "Other"],
  "Floor & Vinyl Shining": ["Need scrub", "Polish build", "Need Wax", "Other"],
  "Chemicals Use": ["List", "Date", "Enough", "Dilution", "No chemical label", "Other"],
  "Area Clean & Hygiene per Requirement": ["Sp. disinfected", "Disposable", "Checklist", "High training staff", "Other"],
  "Bathroom & Public Toilet Clean & Checklist": ["Bad smell", "Spots", "Rust", "Checklist N/C", "Trash N/C", "Other"],
  "Stainless Steel Shining": ["Rust", "Not clean", "Other"],
  "Normal Waste Collect & Disposed": ["Over full", "Mixed", "Not collected", "Trash Damage", "Other"],
  PPE: ["Not approved", "Not available", "Damage", "Wet floor signs", "Other"],
  "Medical Waste Collect & Transport": ["Mixed", "Tag", "Tie", "Over full", "Thickness", "Other"],
  "Infection Control Instruction Follow": ["Yes", "No", "Other"],
  "Emergency Respond Time Frame": ["Late", "Not qualified", "Not suitable supply", "Other"],
  "Uniform & ID & Personal Hygiene": ["Not available", "Damage", "Not approved", "Other"],
  "Cleaning of HK Container & Trolley & Equipment": ["Wheel Damage", "Not clean", "Not enough", "Other"],
  "Cleaning of HK Container & Trolley & Equipment & Tools": ["Wheel Damage", "Not clean", "Not enough", "Other"],
  "Chemical Store & Safety": ["MSDS", "Shelves standard", "Other"],
  "Adherence for Environment Service Directive": ["Yes", "No", "Other"],
  "Carpet Clean": ["Spots", "Dusty", "Need shampoo", "Other"],
  "Cleaning Office Furniture, Tables & Chairs": ["Dusty", "Spots", "Not arranged", "Other"]
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

function rating(percentage) {
  if (percentage >= 90) return "Excellent";
  if (percentage >= 80) return "Good";
  if (percentage >= 60) return "Low";
  return "Bad";
}

function fieldClass(extra = "") {
  return `w-full border-0 bg-transparent px-1 py-0 text-[12px] font-semibold text-slate-900 outline-none ${extra}`;
}

function CheckBox({ checked, onChange, label }) {
  return (
    <label className={`mr-1 inline-flex min-h-[22px] cursor-pointer items-center gap-1 rounded-[2px] px-[3px] text-[10.5px] leading-tight text-slate-900 ${checked ? "bg-[#eaf2f5] outline outline-1 outline-[#7aa8b6]" : ""}`}>
      <span className="grid h-4 w-4 shrink-0 place-items-center border border-[#00607a] text-[10px] leading-none text-[#003f52]">
        {checked ? "✓" : ""}
      </span>
      {onChange && <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />}
      <span>{label}</span>
    </label>
  );
}

function Logo() {
  return (
    <div className="flex justify-center">
      <img src="/hospital-logo.png" alt="Hospital logo" className="h-[58px] w-[58px] object-contain" />
    </div>
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper: extract a reliable non-empty inspector name from the user object.
// Tries every possible field the server might return, in priority order.
function resolveInspectorName(user) {
  return (
    (user?.name       || "").trim() ||
    (user?.fullName   || "").trim() ||
    (user?.displayName|| "").trim() ||
    (user?.username   || "").trim()
  );
}

export function InspectionForm({ config, t, user, onSubmitted }) {
  // Always computed directly from the live user prop — never stale.
  const resolvedInspectorName = resolveInspectorName(user);

  const firstType = config.checklists?.[0]?.id || "";
  const [form, setForm] = useState({
    checklistType: firstType,
    areaRoom: "",
    date: today(),
    time: nowTime(),
    inspectorName: resolvedInspectorName,
    signature: "",
    reviewedBySupervisor: "",
    approvedByManager: "",
    notes: "",
    unavailableChemicalTools: "",
    chemicalToolsAvailability: "Available",
    supervisorName: "",
    areaCategory: "",
    visitLocation: "",
    responses: {}
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState([]);

  // Keep inspectorName in sync whenever the user object changes (e.g. after re-login).
  useEffect(() => {
    const name = resolveInspectorName(user);
    if (name) setForm((prev) => ({ ...prev, inspectorName: name }));
  }, [user]);

  const template = config.checklists.find((item) => item.id === form.checklistType) || config.checklists[0];
  const areaCategories = Array.isArray(config.masterData.areaCategories) ? config.masterData.areaCategories : [];
  const selectedAreaCategory = areaCategories.find((category) => category.name === form.areaCategory);
  const availableLocations = selectedAreaCategory?.areas?.length ? selectedAreaCategory.areas : config.masterData.locations;
  const summary = useMemo(() => {
    const total = template.items.reduce((sum, item) => sum + Number(form.responses[item.id]?.score ?? 0), 0);
    const max = template.items.reduce((sum, item) => sum + item.maxScore, 0);
    const percentage = max ? (total / max) * 100 : 0;
    return { total, max, percentage, rating: rating(percentage) };
  }, [form.responses, template]);

  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setAreaCategory = (value) => setForm((prev) => ({ ...prev, areaCategory: value, visitLocation: "" }));
  const setResponse = (id, value) => setForm((prev) => ({ ...prev, responses: { ...prev.responses, [id]: value } }));
  const setPhotoCaption = (id, caption) => setPhotos((prev) => prev.map((photo) => (photo.id === id ? { ...photo, caption } : photo)));
  const removePhoto = (id) => setPhotos((prev) => prev.filter((photo) => photo.id !== id));
  const toggleIssue = (item, issue) => {
    const current = form.responses[item.id] || { issues: [], other: "" };
    const set = new Set(current.issues || []);
    set.has(issue) ? set.delete(issue) : set.add(issue);
    setResponse(item.id, { ...current, issues: [...set] });
  };

  async function addPhotos(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const room = Math.max(0, maxPhotos - photos.length);
    const accepted = files.slice(0, room).filter((file) => file.type.startsWith("image/") && file.size <= maxPhotoSizeMb * 1024 * 1024);
    if (accepted.length < files.length) {
      setMessage(`Only ${maxPhotos} images are allowed. Each image must be ${maxPhotoSizeMb}MB or less.`);
    }

    const nextPhotos = await Promise.all(accepted.map(async (file) => ({
      id: `${Date.now()}-${file.name}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: await fileToDataUrl(file),
      caption: ""
    })));
    setPhotos((prev) => [...prev, ...nextPhotos]);
  }

  async function submit(event) {
    event.preventDefault();

    // Guard 1: resolve inspector name using all available user fields.
    const inspectorName = resolveInspectorName(user);
    if (!inspectorName) {
      setMessage("Session error: could not resolve inspector name. Please log out and log in again.");
      return;
    }

    // Guard 2: location must be selected.
    if (areaCategories.length > 0 && !form.areaCategory) {
      setMessage("Please select the main Category before selecting the Area.");
      return;
    }

    if (!form.visitLocation) {
      setMessage("Please select an Area / Visit Location before submitting.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      // Always stamp the inspector name from the live user object — never trust the form state alone.
      const payload = {
        ...form,
        inspectorName,
        visitLocation: form.visitLocation.trim(),
        photos: photos.map(({ id, name, type, size, dataUrl, caption }) => ({ id, name, type, size, dataUrl, caption }))
      };
      const result = await api.submitInspection(payload);
      setMessage(`${t.created}: ${result.submission.submissionId}`);
      onSubmitted?.(result.submission);
      // Reset only the per-submission fields; keep checklist type and inspector name.
      setForm((prev) => ({
        ...prev,
        areaRoom: "",
        notes: "",
        unavailableChemicalTools: "",
        supervisorName: "",
        areaCategory: "",
        visitLocation: "",
        signature: "",
        reviewedBySupervisor: "",
        approvedByManager: "",
        chemicalToolsAvailability: "Available",
        responses: {}
      }));
      setPhotos([]);
    } catch (error) {
      // 401 errors are handled globally by the session-expiry handler in api.js.
      // Surface any other error to the user.
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  const leftSummary = template.items.slice(0, Math.ceil(template.items.length / 2));
  const rightSummary = template.items.slice(Math.ceil(template.items.length / 2));
  const summaryRows = Array.from({ length: Math.max(leftSummary.length, rightSummary.length) });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="inspection-scroll overflow-x-auto pb-3 scrollbar-thin">
        <main className="inspection-sheet mx-auto min-h-[1123px] w-[794px] border border-[#b7c3ca] bg-white px-[28px] py-[30px] text-[#003f52] shadow-panel">
          <header className="grid min-h-[70px] grid-cols-[1fr_420px_1fr] items-start">
            <div className="mt-[19px] border-l-2 border-[#003f52] pl-[3px] leading-tight">
              <strong className="block text-sm">Support Services Division</strong>
              <div className="text-[10px]">Environmental Services</div>
              <div className="text-[10px]">Housekeeping Department</div>
            </div>
            <div className="text-center">
              <Logo />
              <div className="mt-1 whitespace-nowrap text-[16px] font-black tracking-[.1px]">DAILY INSPECTION &amp; AUDIT REPORT</div>
              <div className="mt-1 text-[11px] font-bold text-slate-800">
                <select className="bg-transparent text-center outline-none" value={form.checklistType} onChange={(event) => setForm({ ...form, checklistType: event.target.value, responses: {} })}>
                  {config.checklists.map((item) => <option key={item.id} value={item.id}>{item.name.en}</option>)}
                </select>
                <span className="mx-2">|</span><span dir="rtl">{arabicTitle}</span>
              </div>
            </div>
            <div dir="rtl" className="mt-[18px] text-right text-[12px] leading-tight">
              <div>المملكة العربية السعودية</div>
              <div>الحرس الوطني — الشؤون الصحية</div>
              <div>مدينة الملك عبدالعزيز الطبية — جدة</div>
              <div dir="ltr" className="mt-1 text-[10px] font-bold">From : {template.formCode}</div>
            </div>
          </header>

          <table className="mt-[18px] w-full border-collapse border border-[#00465c]">
            <tbody>
              <tr>
                <th className="meta-th">Area / Room #</th><td className="meta-td"><input className={fieldClass()} value={form.areaRoom} onChange={(e) => setValue("areaRoom", e.target.value)} /></td>
                <th className="meta-th">Date</th><td className="meta-td"><input type="date" className={fieldClass()} value={form.date} onChange={(e) => setValue("date", e.target.value)} /></td>
                <th className="meta-th">Time</th><td className="meta-td"><input type="time" className={fieldClass()} value={form.time} onChange={(e) => setValue("time", e.target.value)} /></td>
                <th className="meta-th">Inspected By</th><td className="meta-td"><input className={fieldClass("bg-[#f5f9fa] text-slate-500 cursor-not-allowed")} value={resolvedInspectorName} readOnly tabIndex={-1} title="Auto-filled from your login account" /></td>
                <th className="meta-th">Signature</th><td className="meta-td"><input className={fieldClass()} value={form.signature} onChange={(e) => setValue("signature", e.target.value)} /></td>
              </tr>
              <tr>
                <th className="meta-th">Reviewed By Supervisor</th><td className="meta-td" colSpan="3"><input className={fieldClass()} value={form.reviewedBySupervisor} onChange={(e) => setValue("reviewedBySupervisor", e.target.value)} /></td>
                <th className="meta-th" colSpan="2">Approved By PTR / Manager</th><td className="meta-td" colSpan="4"><input className={fieldClass()} value={form.approvedByManager} onChange={(e) => setValue("approvedByManager", e.target.value)} /></td>
              </tr>
            </tbody>
          </table>

          <div className="mt-[14px] border border-[#003f52] bg-[#23669d] py-2 text-center text-xs font-black text-white">
            INSPECTION CHECKLIST <span dir="rtl" className="ml-6 text-[17px]">{arabicChecklistTitle}</span>
          </div>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="table-th w-[30px]">#</th>
                <th className="table-th w-[245px]">Inspection Item</th>
                <th className="table-th w-[63px] bg-[#009b72]">Excellent</th>
                <th className="table-th w-[63px] bg-[#00d65b] text-slate-950">Good</th>
                <th className="table-th w-[63px] bg-[#fff200] text-slate-950">Low</th>
                <th className="table-th w-[63px] bg-[#d71920]">Bad</th>
                <th className="table-th w-[250px]">Issues / Observations</th>
                <th className="table-th w-[60px]">Given<br />Degree</th>
              </tr>
            </thead>
            <tbody>
              {template.items.map((item, index) => {
                const current = form.responses[item.id] || { issues: [], other: "" };
                const issueOptions = issueOptionsByLabel[item.label] || config.masterData.issueOptions.slice(0, 4);
                return (
                  <tr key={item.id}>
                    <td className="sheet-td text-center font-black text-[#00506a]">{index + 1}</td>
                    <td className="sheet-td leading-tight text-slate-950"><strong>{item.label}</strong> <span>(Max: {item.maxScore})</span></td>
                    {item.scores.map((score, scoreIndex) => (
                      <td key={score} className="sheet-td text-center">
                        <label className={`inline-flex min-h-[28px] min-w-[50px] cursor-pointer items-center justify-center gap-1 rounded-[2px] px-2 py-1 text-[12px] font-semibold ${Number(current.score) === score ? "bg-[#eaf2f5] outline outline-2 outline-[#7aa8b6]" : ""}`}>
                          <span className={`grid h-4 w-4 place-items-center border border-[#00607a] text-[10px] ${Number(current.score) === score ? "bg-[#003f52] text-white" : ""}`}>{Number(current.score) === score ? "✓" : ""}</span>
                          <input
                            type="radio"
                            className="sr-only"
                            name={item.id}
                            checked={Number(current.score) === score}
                            onChange={() => setResponse(item.id, { ...current, score, ratingLabel: t[scoreKeys[scoreIndex]] })}
                          />
                          {score}
                        </label>
                      </td>
                    ))}
                    <td className="sheet-td leading-tight text-slate-950">
                      {issueOptions.map((issue) => (
                        <CheckBox key={issue} checked={(current.issues || []).includes(issue)} onChange={() => toggleIssue(item, issue)} label={issue} />
                      ))}
                      <input
                        className="ml-1 inline-block w-20 border-0 border-b border-slate-400 bg-transparent text-[10px] outline-none"
                        value={current.other || ""}
                        onChange={(event) => setResponse(item.id, { ...current, other: event.target.value })}
                        placeholder="Other"
                      />
                    </td>
                    <td className="sheet-td text-center text-xs text-slate-950">( {current.score ?? ""} )</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <section className="mt-[14px] grid grid-cols-[33%_67%] border border-[#c2ccd3]">
            <div>
              <div className="bg-[#16496f] py-2 text-center text-xs font-black text-white">INSPECTOR COMMENTS</div>
              <div className="min-h-[258px] border-r border-[#c2ccd3] p-3">
                <div className="h-[240px] border border-slate-950 p-2">
                  <div className="text-center text-[11px] font-black">Inspector Comment<br />Unavailable Chemical &amp; Tools</div>
                  <textarea className="mt-2 h-[86px] w-full resize-none border-0 bg-transparent text-[13px] leading-[1.5] text-slate-950 outline-none" value={form.notes} onChange={(e) => setValue("notes", e.target.value)} placeholder={"1 - ______________________\n2 - ______________________\n3 - ______________________\n4 - ______________________"} />
                  <div className="mt-5 flex justify-center gap-4 text-slate-950">
                    {["Available", "Not Available"].map((option) => (
                      <label key={option} className="inline-flex min-h-[30px] cursor-pointer items-center gap-1 rounded-[2px] px-2 text-[12px]">
                        <span className={`grid h-4 w-4 place-items-center border border-[#00607a] text-[10px] ${form.chemicalToolsAvailability === option ? "bg-[#003f52] text-white" : ""}`}>{form.chemicalToolsAvailability === option ? "✓" : ""}</span>
                        <input
                          type="radio"
                          className="sr-only"
                          name="chemicalToolsAvailability"
                          checked={form.chemicalToolsAvailability === option}
                          onChange={() => setValue("chemicalToolsAvailability", option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                  <div className="mt-7 text-[11px] font-black">Supervisor Name: <input className="w-36 border-0 border-b border-slate-600 bg-transparent outline-none" value={form.supervisorName} onChange={(e) => setValue("supervisorName", e.target.value)} /></div>
                  {areaCategories.length > 0 && (
                    <select className="mt-2 w-full border-0 border-b border-slate-300 bg-transparent text-[11px] outline-none text-slate-950" value={form.areaCategory} onChange={(e) => setAreaCategory(e.target.value)}>
                      <option value="">-- Main Category --</option>
                      {areaCategories.map((category) => (
                        <option key={category.name} value={category.name}>{category.name}</option>
                      ))}
                    </select>
                  )}
                  <select className="mt-2 w-full border-0 border-b border-slate-300 bg-transparent text-[11px] outline-none text-slate-950" value={form.visitLocation} onChange={(e) => setValue("visitLocation", e.target.value)} disabled={areaCategories.length > 0 && !form.areaCategory}>
                    <option value="">{areaCategories.length > 0 && !form.areaCategory ? "-- Select Category First --" : "-- Visit Location / Area --"}</option>
                    {availableLocations.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                  <input className="mt-2 w-full border-0 border-b border-slate-300 bg-transparent text-[11px] outline-none" value={form.unavailableChemicalTools} onChange={(e) => setValue("unavailableChemicalTools", e.target.value)} placeholder="Unavailable Chemical & Tools" />
                </div>
              </div>
            </div>
            <div>
              <div className="bg-[#16496f] py-2 text-center text-xs font-black text-white"><span dir="rtl" className="mr-5 text-base">{arabicSummaryTitle}</span> | Arabic Summary of Scores</div>
              <div className="p-2">
                <table className="w-full border-collapse text-[11px]">
                  <thead><tr><th className="sum-th">#</th><th className="sum-th">البند</th><th className="sum-th">الدرجة</th><th className="sum-th">الدرجة</th><th className="sum-th">#</th><th className="sum-th">البند</th><th className="sum-th">الدرجة</th><th className="sum-th">الدرجة</th></tr></thead>
                  <tbody>
                    {summaryRows.map((_, index) => {
                      const a = leftSummary[index];
                      const b = rightSummary[index];
                      return (
                        <tr key={index}>
                          {[a, b].map((item, side) => item ? (
                            <React.Fragment key={item.id}>
                              <td className="sum-td text-center font-black">{(side ? rightSummary : leftSummary).indexOf(item) + 1 + (side ? leftSummary.length : 0)}</td>
                              <td dir="rtl" className="sum-td text-right font-bold">{arabicItems[(side ? rightSummary : leftSummary).indexOf(item) + (side ? leftSummary.length : 0)] || item.label}</td>
                              <td className="sum-td text-center">( /{item.maxScore})</td>
                              <td className="sum-td text-center">( {form.responses[item.id]?.score ?? ""} )</td>
                            </React.Fragment>
                          ) : <React.Fragment key={side}><td className="sum-td" /><td className="sum-td" /><td className="sum-td" /><td className="sum-td" /></React.Fragment>)}
                        </tr>
                      );
                    })}
                    <tr className="font-black">
                      <td className="sum-td bg-[#e1edf1] text-center">( {summary.total} )</td>
                      <td dir="rtl" className="sum-td bg-[#e1edf1] text-right" colSpan="3">المجموع الكلي / Total Score</td>
                      <td className="sum-td bg-[#e1edf1]" colSpan="4">{summary.total} / {summary.max} - {summary.percentage.toFixed(2)}% - {summary.rating}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      </div>

      <section className="rounded-lg border border-hospital-line bg-white p-4 shadow-panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-black text-hospital-ink">
              <ImagePlus size={18} /> Photo Attachments / صور المخالفات
            </h2>
            <p className="mt-1 text-sm text-slate-500">Upload up to {maxPhotos} images. Add the violation note under each photo.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-hospital-line bg-hospital-soft px-4 py-2 text-sm font-bold text-hospital-ink hover:border-hospital-teal">
              <Camera size={17} />
              Take Photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={addPhotos} />
            </label>
            <label className="inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-hospital-line bg-hospital-soft px-4 py-2 text-sm font-bold text-hospital-ink hover:border-hospital-teal">
              <ImagePlus size={17} />
              Add Photos
              <input type="file" accept="image/*" multiple className="sr-only" onChange={addPhotos} />
            </label>
          </div>
        </div>

        {photos.length > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, index) => (
              <div key={photo.id} className="overflow-hidden rounded-lg border border-hospital-line bg-white">
                <div className="relative aspect-[4/3] bg-hospital-soft">
                  <img src={photo.dataUrl} alt={photo.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-red-700 shadow-sm hover:bg-white"
                    aria-label="Remove photo"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Photo {index + 1}</span>
                    <span>{Math.round(photo.size / 1024)} KB</span>
                  </div>
                  <textarea
                    className="min-h-[76px] w-full resize-y rounded-md border border-hospital-line px-3 py-2 text-sm outline-none focus:border-hospital-teal"
                    value={photo.caption}
                    onChange={(event) => setPhotoCaption(photo.id, event.target.value)}
                    placeholder="Write violation / observation for this photo..."
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 rounded-lg border border-hospital-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-700">{message || `${t.totalScore}: ${summary.total} / ${summary.max} (${summary.percentage.toFixed(2)}%) - ${summary.rating}`}</p>
        <button disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-hospital-teal px-5 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60">
          <Send size={16} />
          {loading ? t.submitting : t.submit}
        </button>
      </div>
    </form>
  );
}
