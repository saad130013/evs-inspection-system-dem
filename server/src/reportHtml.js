import fs from "node:fs";
import path from "node:path";
import { serverDir } from "./paths.js";

const arabicTitle = "تقرير التفتيش والتدقيق اليومي";
const arabicChecklistTitle = "بنود التفتيش والتدقيق";
const arabicSummaryTitle = "ملخص الدرجات";

const arabicItems = [
  "نظافة الأرضيات والسلالم والأسقف",
  "تلميع الأرضيات الفينيل",
  "استعمال المواد الكيميائية بالطريق الصحيحة",
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
  "الالتزام بتوجيهات الخدمات البيئية"
];

const issueOptionsByLabel = {
  "Floor & Stair & Ceiling Clean": ["Spots", "Dusty", "Other"],
  "Floor & Vinyl Shining": ["Need scrub", "Polish build", "Need Wax", "Other"],
  "Chemicals Use": ["List", "Date", "Enough", "Dilution", "No chemical label", "Other"],
  "Area Clean & Hygiene per Requirement": ["Sp. disinfected", "Disposable", "Checklist", "High training staff", "Other"],
  "Bathroom & Public Toilet Clean & Checklist": ["Bad smell", "Spots", "Rust", "Checklist N/C", "Trash N/C", "Other"],
  "Stainless Steel Shining": ["Rust", "Not clean", "Other"],
  "Normal Waste Collect & Disposed": ["Over full", "Mixed", "Not collected", "Trash Damage", "Other"],
  "PPE": ["Not approved", "Not available", "Damage", "Wet floor signs", "Other"],
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

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isSelected(response, score) {
  return Number(response?.score ?? -1) === Number(score);
}

function scoreLabel(index) {
  return ["Excellent", "Good", "Low", "Bad"][index] || "";
}

function checkbox(checked, label = "", mode = "check") {
  const selectedClass = checked ? ` checked ${mode === "solid" ? "solid" : ""}` : "";
  return `<span class="check${selectedClass}">${checked && mode !== "solid" ? "?" : ""}</span>${label ? ` <span>${escapeHtml(label)}</span>` : ""}`;
}
function issueText(item, response) {
  const selected = new Set(response?.issues || []);
  const labels = issueOptionsByLabel[item.label] || ["Dust present", "Stain / spill", "Unavailable", "Other"];
  const other = response?.other ? [`Other: ${response.other}`] : [];
  return [...labels.map((label) => checkbox(selected.has(label), label)), ...other.map((text) => checkbox(true, text))].join(" ");
}

function logo() {
  const logoPath = path.join(serverDir, "assets", "hospital-logo.png");
  const logoData = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString("base64") : "";
  if (logoData) {
    return `<div class="logo"><img class="hospital-logo" src="data:image/png;base64,${logoData}" alt="Hospital logo" /></div>`;
  }
  return `<div class="logo">
    <div class="logo-ring">
      <div class="logo-core">HK</div>
    </div>
  </div>`;
}

function metadataRows(submission) {
  return `
    <table class="meta-table">
      <tr>
        <th>Area / Room #</th><td>${escapeHtml(submission.areaRoom)}</td>
        <th>Date</th><td>${escapeHtml(submission.date)}</td>
        <th>Time</th><td>${escapeHtml(submission.time)}</td>
        <th>Inspected By</th><td>${escapeHtml(submission.inspectorName)}</td>
        <th>Signature</th><td>${escapeHtml(submission.signature || "")}</td>
      </tr>
      <tr>
        <th>Reviewed By Supervisor</th><td colspan="3">${escapeHtml(submission.reviewedBySupervisor || "")}</td>
        <th colspan="2">Approved By PTR / Manager</th><td colspan="4">${escapeHtml(submission.approvedByManager || "")}</td>
      </tr>
    </table>`;
}

function checklistRows(template, submission) {
  return template.items.map((item, index) => {
    const response = submission.responses[item.id] || {};
    const scoreCells = item.scores.map((score, scoreIndex) => `
      <td class="score-cell">${checkbox(isSelected(response, score), score, "solid")}</td>
    `).join("");
    return `
      <tr>
        <td class="num">${index + 1}</td>
        <td class="item"><strong>${escapeHtml(item.label)}</strong> <span>(Max: ${item.maxScore})</span></td>
        ${scoreCells}
        <td class="issues">${issueText(item, response)}</td>
        <td class="given">( ${isSelected(response, response.score) ? escapeHtml(response.score) : ""} )</td>
      </tr>`;
  }).join("");
}

function summaryRows(template, submission) {
  const rows = template.items.map((item, index) => {
    const response = submission.responses[item.id] || {};
    return {
      n: index + 1,
      ar: arabicItems[index] || item.label,
      max: item.maxScore,
      score: response.score ?? ""
    };
  });

  const left = rows.slice(0, Math.ceil(rows.length / 2));
  const right = rows.slice(Math.ceil(rows.length / 2));
  const max = Math.max(left.length, right.length);
  const output = [];
  for (let i = 0; i < max; i += 1) {
    const a = left[i];
    const b = right[i];
    output.push(`
      <tr>
        ${a ? `<td class="summary-num">${a.n}</td><td class="summary-ar">${escapeHtml(a.ar)}</td><td class="summary-max">( /${a.max})</td><td class="summary-score">( ${escapeHtml(a.score)} )</td>` : "<td></td><td></td><td></td><td></td>"}
        ${b ? `<td class="summary-num">${b.n}</td><td class="summary-ar">${escapeHtml(b.ar)}</td><td class="summary-max">( /${b.max})</td><td class="summary-score">( ${escapeHtml(b.score)} )</td>` : "<td></td><td></td><td></td><td></td>"}
      </tr>`);
  }
  output.push(`
    <tr class="total-row">
      <td class="summary-score">( ${submission.totalScore} )</td>
      <td colspan="3" class="summary-ar">المجموع الكلي / Total Score</td>
      <td colspan="4">${submission.totalScore} / ${submission.maximumScore} - ${submission.percentage}% - ${escapeHtml(submission.ratingStatus)}</td>
    </tr>`);
  return output.join("");
}

function photoPages(submission) {
  const photos = Array.isArray(submission.photos) ? submission.photos.filter((photo) => String(photo.dataUrl || "").startsWith("data:image/")) : [];
  if (!photos.length) return "";

  const cards = photos.map((photo, index) => `
    <article class="photo-card">
      <div class="photo-title">
        <span>Photo ${index + 1}</span>
        <span>${escapeHtml(photo.name || "")}</span>
      </div>
      <div class="photo-frame">
        <img src="${escapeHtml(photo.dataUrl)}" alt="Inspection attachment ${index + 1}" />
      </div>
      <div class="photo-caption">
        <strong>Violation / Observation:</strong>
        <div>${escapeHtml(photo.caption || "No violation note entered.")}</div>
      </div>
    </article>
  `).join("");

  return `
    <section class="photo-pages">
      <header class="photo-header">
        <div>
          <div class="photo-eyebrow">Support Services Division — Environmental Services</div>
          <h2>PHOTO ATTACHMENTS</h2>
          <p>صور وملاحظات المخالفات</p>
        </div>
        <div class="photo-meta">
          <div>ID: <strong>${escapeHtml(submission.submissionId)}</strong></div>
          <div>${escapeHtml(submission.date)} ${escapeHtml(submission.time)}</div>
        </div>
      </header>
      <div class="photo-grid">${cards}</div>
    </section>`;
}

function ratingColors(status) {
  if (status === "Excellent") return { bg: "#009b72", text: "#ffffff", border: "#007a5a" };
  if (status === "Good")      return { bg: "#00d65b", text: "#001b12", border: "#00a844" };
  if (status === "Low")       return { bg: "#fff200", text: "#4a3800", border: "#c8bc00" };
  return                             { bg: "#d71920", text: "#ffffff", border: "#a8121a" };
}

function executiveSummaryPage(submission, template) {
  const colors = ratingColors(submission.ratingStatus);
  const itemScores = template.items.map((item, index) => {
    const response = submission.responses?.[item.id] || {};
    const score = Number(response.score ?? 0);
    const maxScore = Number(item.maxScore || 0);
    const percentage = maxScore ? Math.round((score / maxScore) * 100) : 0;
    return { item, index, response, score, maxScore, percentage };
  });
  const failedItems = itemScores.filter((entry) => entry.score === 0);
  const lowItems = itemScores.filter((entry) => entry.score > 0 && entry.score < entry.maxScore);
  const topItems = [...itemScores]
    .sort((a, b) => b.percentage - a.percentage || b.score - a.score || a.index - b.index)
    .slice(0, 3);
  const lowestItems = [...itemScores]
    .sort((a, b) => a.percentage - b.percentage || a.score - b.score || a.index - b.index)
    .slice(0, 3);

  const scoreRows = (entries, accentColor) => entries.map(({ item, response, score, maxScore, percentage }) => {
    const issues = (response.issues || []).join(", ");
    const other = response.other ? (issues ? `, ${response.other}` : response.other) : "";
    return `<tr>
      <td style="padding:5px 8px; border:1px solid #e5e7eb; color:#111827; font-size:11px;">${escapeHtml(item.label)}</td>
      <td style="padding:5px 8px; border:1px solid #e5e7eb; text-align:center; font-weight:700; color:${accentColor}; font-size:11px;">${score} / ${maxScore}</td>
      <td style="padding:5px 8px; border:1px solid #e5e7eb; text-align:center; font-weight:700; color:${accentColor}; font-size:11px;">${percentage}%</td>
      <td style="padding:5px 8px; border:1px solid #e5e7eb; color:#374151; font-size:10px;">${escapeHtml(issues + other) || "—"}</td>
    </tr>`;
  }).join("");

  return `
  <div class="exec-page">
    <!-- Header bar -->
    <div style="background:#003f52; color:#fff; padding:14px 24px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-size:9px; font-weight:700; letter-spacing:1px; opacity:0.75; text-transform:uppercase;">Support Services Division — Environmental Services</div>
        <div style="font-size:16px; font-weight:800; margin-top:3px;">INSPECTION EXECUTIVE SUMMARY</div>
        <div style="font-size:11px; margin-top:2px; opacity:0.85;" dir="rtl">الملخص التنفيذي لتقرير التفتيش</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:9px; opacity:0.7;">${escapeHtml(template.name.en)} — ${escapeHtml(template.formCode)}</div>
        <div style="font-size:10px; margin-top:2px;">ID: <strong>${escapeHtml(submission.submissionId)}</strong></div>
      </div>
    </div>

    <!-- KPI cards row -->
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:0; border-bottom:2px solid #003f52;">

      <div style="padding:20px 16px; border-right:1px solid #d1d5db; text-align:center;">
        <div style="font-size:9px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.5px;">Overall Score</div>
        <div style="font-size:40px; font-weight:800; color:#003f52; line-height:1.1; margin-top:6px;">${submission.totalScore}</div>
        <div style="font-size:12px; color:#6b7280;">/ ${submission.maximumScore}</div>
      </div>

      <div style="padding:20px 16px; border-right:1px solid #d1d5db; text-align:center;">
        <div style="font-size:9px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.5px;">Percentage</div>
        <div style="font-size:40px; font-weight:800; color:#003f52; line-height:1.1; margin-top:6px;">${submission.percentage}%</div>
        <div style="font-size:12px; color:#6b7280;">&nbsp;</div>
      </div>

      <div style="padding:20px 16px; border-right:1px solid #d1d5db; text-align:center;">
        <div style="font-size:9px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.5px;">Rating / التقييم</div>
        <div style="margin-top:10px; display:inline-block; padding:8px 22px; border-radius:6px;
          background:${colors.bg}; color:${colors.text}; border:2px solid ${colors.border};
          font-size:20px; font-weight:800;">${escapeHtml(submission.ratingStatus)}</div>
      </div>

      <div style="padding:20px 16px; text-align:center;">
        <div style="font-size:9px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.5px;">Top / Lowest Items</div>
        <div style="font-size:40px; font-weight:800; line-height:1.1; margin-top:6px;
          color:${failedItems.length > 0 ? "#d71920" : "#009b72"};">3</div>
        <div style="font-size:12px; color:#6b7280;">top 3 + lowest 3</div>
      </div>
    </div>

    <!-- Inspector info -->
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:0; border-bottom:1px solid #e5e7eb; background:#f8fafc;">
      <div style="padding:10px 16px; border-right:1px solid #e5e7eb;">
        <div style="font-size:9px; font-weight:700; color:#6b7280; text-transform:uppercase;">Inspector</div>
        <div style="font-size:12px; font-weight:700; color:#003f52; margin-top:3px;">${escapeHtml(submission.inspectorName)}</div>
      </div>
      <div style="padding:10px 16px; border-right:1px solid #e5e7eb;">
        <div style="font-size:9px; font-weight:700; color:#6b7280; text-transform:uppercase;">Date &amp; Time</div>
        <div style="font-size:12px; font-weight:700; color:#003f52; margin-top:3px;">${escapeHtml(submission.date)} ${escapeHtml(submission.time)}</div>
      </div>
      <div style="padding:10px 16px; border-right:1px solid #e5e7eb;">
        <div style="font-size:9px; font-weight:700; color:#6b7280; text-transform:uppercase;">Location / الموقع</div>
        <div style="font-size:12px; font-weight:700; color:#003f52; margin-top:3px;">${escapeHtml(submission.visitLocation || submission.areaRoom || "—")}</div>
      </div>
      <div style="padding:10px 16px;">
        <div style="font-size:9px; font-weight:700; color:#6b7280; text-transform:uppercase;">Signature</div>
        <div style="font-size:13px; color:#003f52; margin-top:3px; min-height:20px; border-bottom:1px solid #9ca3af; padding-bottom:2px;">${escapeHtml(submission.signature || "")}</div>
      </div>
    </div>

    <!-- Strength and weakness tables -->
    <div style="padding:14px 16px 8px;">
      <div style="font-size:11px; font-weight:800; color:#009b72; margin-bottom:8px; border-left:3px solid #009b72; padding-left:8px;">
        TOP 3 STRENGTH ITEMS - &#1571;&#1593;&#1604;&#1609; 3 &#1576;&#1606;&#1608;&#1583; &#1578;&#1602;&#1610;&#1610;&#1605;
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:14px;">
        <thead>
          <tr style="background:#ecfdf5;">
            <th style="padding:6px 8px; border:1px solid #e5e7eb; text-align:left; font-weight:700; color:#047857; width:43%;">Inspection Item</th>
            <th style="padding:6px 8px; border:1px solid #e5e7eb; text-align:center; font-weight:700; color:#047857; width:14%;">Score</th>
            <th style="padding:6px 8px; border:1px solid #e5e7eb; text-align:center; font-weight:700; color:#047857; width:11%;">%</th>
            <th style="padding:6px 8px; border:1px solid #e5e7eb; text-align:left; font-weight:700; color:#047857; width:32%;">Issues Observed</th>
          </tr>
        </thead>
        <tbody>${scoreRows(topItems, "#009b72")}</tbody>
      </table>

      <div style="font-size:11px; font-weight:800; color:#d71920; margin-bottom:8px; border-left:3px solid #d71920; padding-left:8px;">
        LOWEST 3 WEAKNESS ITEMS - &#1571;&#1602;&#1604; 3 &#1576;&#1606;&#1608;&#1583; &#1578;&#1602;&#1610;&#1610;&#1605;
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:11px;">
        <thead>
          <tr style="background:#fef2f2;">
            <th style="padding:6px 8px; border:1px solid #e5e7eb; text-align:left; font-weight:700; color:#991b1b; width:43%;">Inspection Item</th>
            <th style="padding:6px 8px; border:1px solid #e5e7eb; text-align:center; font-weight:700; color:#991b1b; width:14%;">Score</th>
            <th style="padding:6px 8px; border:1px solid #e5e7eb; text-align:center; font-weight:700; color:#991b1b; width:11%;">%</th>
            <th style="padding:6px 8px; border:1px solid #e5e7eb; text-align:left; font-weight:700; color:#991b1b; width:32%;">Issues Observed</th>
          </tr>
        </thead>
        <tbody>${scoreRows(lowestItems, "#d71920")}</tbody>
      </table>
    </div>

    <!-- Notes -->
    ${submission.notes ? `
    <div style="margin:8px 16px 0; padding:10px 12px; border:1px solid #e5e7eb; border-radius:4px; background:#f9fafb;">
      <div style="font-size:9px; font-weight:700; color:#6b7280; text-transform:uppercase; margin-bottom:4px;">Inspector Comments</div>
      <div style="font-size:11px; color:#374151; white-space:pre-line;">${escapeHtml(submission.notes)}</div>
    </div>` : ""}

    <!-- Footer -->
    <div style="margin-top:auto; padding:10px 16px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; font-size:9px; color:#9ca3af;">
      <span>Generated: ${new Date().toISOString().slice(0, 16).replace("T", " ")}</span>
      <span>EVS Inspection System — King Abdulaziz Medical City, Jeddah</span>
      <span>Submission: ${escapeHtml(submission.submissionId)}</span>
    </div>
  </div>`;
}

export function buildReportHtml({ submission, template }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Inspection Report ${escapeHtml(submission.submissionId)}</title>
  <style>
    @page { size: A4 portrait; margin: 6mm; }
    * { box-sizing: border-box; }
    html, body { width: 100%; margin: 0; padding: 0; }
    body { background: #e5e7eb; color: #003f52; font-family: Arial, Tahoma, sans-serif; font-size: 10px; }
    .exec-page { width: 100%; min-height: 267mm; background: #fff; border: 1px solid #b7c3ca; display: flex; flex-direction: column; page-break-after: always; break-after: page; }
    .sheet { width: 100%; margin: 0 auto; background: #fff; padding: 0; border: 1px solid #b7c3ca; page-break-inside: avoid; break-inside: avoid; }
    .top { display: grid; grid-template-columns: 1fr 420px 1fr; align-items: start; min-height: 70px; page-break-inside: avoid; break-inside: avoid; }
    .left-org { border-left: 2px solid #003f52; padding-left: 3px; margin-top: 17px; line-height: 1.3; color: #003f52; }
    .left-org strong { display: block; font-size: 13px; }
    .right-org { direction: rtl; text-align: right; line-height: 1.3; margin-top: 17px; color: #003f52; font-size: 11px; }
    .right-org .form { direction: ltr; font-weight: 700; font-size: 10px; margin-top: 3px; }
    .center-head { text-align: center; color: #003f52; }
    .logo { display: flex; justify-content: center; margin-bottom: 2px; }
    .hospital-logo { width: 58px; height: 58px; object-fit: contain; display: block; }
    .logo-ring { width: 47px; height: 47px; border: 2px solid #9ca3af; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle, #fff 38%, #e7f5f2 39%, #fff 62%); }
    .logo-core { width: 29px; height: 29px; border: 3px solid #b91c1c; border-radius: 50%; display: grid; place-items: center; color: #0f766e; font-weight: 800; font-size: 9px; }
    .title { font-size: 16px; font-weight: 800; letter-spacing: .1px; margin-top: 2px; white-space: nowrap; }
    .subtitle { margin-top: 4px; font-weight: 700; font-size: 10.5px; color: #1f2937; }
    .subtitle .ar { direction: rtl; display: inline-block; margin-left: 8px; }
    table { border-collapse: collapse; width: 100%; }
    .meta-table { margin-top: 14px; border: 1px solid #00465c; color: #003f52; page-break-inside: avoid; break-inside: avoid; }
    .meta-table th { background: #eaf2f5; color: #003f52; border: 1px solid #00465c; text-align: left; font-weight: 800; font-size: 8.5px; padding: 6px 6px; }
    .meta-table td { border: 1px solid #00465c; color: #111827; font-size: 11px; padding: 6px 6px; height: 26px; }
    .section-band { margin-top: 12px; background: #23669d; color: white; font-weight: 800; text-align: center; border: 1px solid #003f52; padding: 6px 0; font-size: 11px; page-break-inside: avoid; break-inside: avoid; }
    .section-band .ar { direction: rtl; font-size: 15px; margin-left: 20px; }
    .check-table th, .check-table td { border: 1px solid #a9b8c2; }
    .check-table { page-break-inside: avoid; break-inside: avoid; }
    .check-table th { background: #23669d; color: white; padding: 5px 4px; font-size: 10px; text-align: center; }
    .check-table .h-excellent { background: #009b72; }
    .check-table .h-good { background: #00d65b; color: #001b12; }
    .check-table .h-low { background: #fff200; color: #111827; }
    .check-table .h-bad { background: #d71920; }
    .check-table td { padding: 4px 4px; color: #0b4052; vertical-align: middle; }
    .check-table .num { width: 30px; text-align: center; font-weight: 800; color: #00506a; }
    .check-table .item { width: 245px; color: #111827; line-height: 1.12; }
    .check-table .item span { font-weight: 400; color: #111827; }
    .score-cell { width: 63px; text-align: center; }
    .issues { width: 250px; color: #111827; line-height: 1.24; }
    .given { width: 60px; text-align: center; color: #111827; font-size: 12px; }
    .check { display: inline-grid; place-items: center; width: 8px; height: 8px; border: 1px solid #00607a; margin: 0 2px 0 4px; color: #003f52; font-size: 8px; line-height: 1; vertical-align: 1px; }
    .check.checked.solid { background: #000; border-color: #000; }
    .bottom { display: grid; grid-template-columns: 33% 67%; margin-top: 12px; border: 1px solid #c2ccd3; page-break-inside: avoid; break-inside: avoid; }
    .comments-head, .summary-head { background: #16496f; color: #fff; text-align: center; font-weight: 800; padding: 6px 4px; font-size: 11px; }
    .summary-head .ar { direction: rtl; font-size: 15px; margin-right: 17px; }
    .comments-box { padding: 9px; border-right: 1px solid #c2ccd3; min-height: 0; }
    .comment-inner { border: 1px solid #111827; height: 226px; padding: 7px; color: #003f52; }
    .comment-title { text-align: center; font-weight: 800; margin-bottom: 4px; }
    .comment-lines { margin-top: 7px; color: #111827; line-height: 1.68; font-size: 11px; white-space: pre-line; }
    .availability { text-align: center; margin-top: 28px; color: #111827; }
    .supervisor-line { margin-top: 22px; font-weight: 800; color: #003f52; }
    .summary-box { padding: 7px; }
    .summary-table th { background: #16496f; color: #fff; font-size: 10px; padding: 4px 3px; border: 1px solid #9baab4; }
    .summary-table td { border: 1px solid #b6c3cc; padding: 4px 4px; color: #111827; font-size: 9px; }
    .summary-ar { direction: rtl; text-align: right; font-weight: 700; color: #111827; }
    .summary-num { text-align: center; font-weight: 800; width: 26px; }
    .summary-max, .summary-score { text-align: center; width: 56px; font-size: 11px; }
    .total-row td { background: #e1edf1; font-weight: 800; }
    .photo-pages { width: 100%; min-height: 267mm; background: #fff; border: 1px solid #b7c3ca; margin-top: 0; padding: 18px 20px; page-break-before: always; break-before: page; }
    .photo-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #003f52; padding-bottom: 10px; color: #003f52; }
    .photo-eyebrow { font-size: 9px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #64748b; }
    .photo-header h2 { margin: 4px 0 0; font-size: 20px; letter-spacing: .4px; }
    .photo-header p { margin: 3px 0 0; direction: rtl; font-size: 12px; font-weight: 700; }
    .photo-meta { text-align: right; font-size: 11px; line-height: 1.5; color: #334155; }
    .photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
    .photo-card { border: 1px solid #cbd5e1; page-break-inside: avoid; break-inside: avoid; background: #fff; }
    .photo-title { display: flex; justify-content: space-between; gap: 10px; background: #eaf2f5; border-bottom: 1px solid #cbd5e1; padding: 7px 9px; font-size: 10px; font-weight: 800; color: #003f52; }
    .photo-frame { height: 245px; display: grid; place-items: center; background: #f8fafc; overflow: hidden; }
    .photo-frame img { width: 100%; height: 100%; object-fit: contain; }
    .photo-caption { min-height: 62px; border-top: 1px solid #cbd5e1; padding: 8px 9px; font-size: 11px; color: #111827; line-height: 1.4; }
    .photo-caption strong { display: block; color: #d71920; margin-bottom: 3px; }
    .items-16 .top { min-height: 62px; }
    .items-16 .left-org, .items-16 .right-org { margin-top: 14px; }
    .items-16 .meta-table { margin-top: 11px; }
    .items-16 .section-band { margin-top: 10px; padding: 5px 0; }
    .items-16 .check-table th { padding: 4px 4px; font-size: 9.5px; }
    .items-16 .check-table td { padding: 2.7px 4px; }
    .items-16 .issues { line-height: 1.16; }
    .items-16 .bottom { margin-top: 10px; }
    .items-16 .comments-head, .items-16 .summary-head { padding: 5px 4px; }
    .items-16 .comment-inner { height: 205px; }
    .items-16 .comment-lines { line-height: 1.5; font-size: 10.5px; }
    .items-16 .summary-table th { padding: 3px; font-size: 9.5px; }
    .items-16 .summary-table td { padding: 3px 4px; font-size: 8.7px; }
    @media print {
      body { background: #fff; }
      .sheet { border: 0; margin: 0; width: 100%; min-height: 0; }
      header, table, tr, .meta-table, .section-band, .check-table, .bottom, .comments-box, .summary-box { page-break-inside: avoid; break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${executiveSummaryPage(submission, template)}
  <main class="sheet items-${template.items.length}">
    <header class="top">
      <div class="left-org">
        <strong>Support Services Division</strong>
        <div>Environmental Services</div>
        <div>Housekeeping Department</div>
      </div>
      <div class="center-head">
        ${logo()}
        <div class="title">DAILY INSPECTION &amp; AUDIT REPORT</div>
        <div class="subtitle">${escapeHtml(template.name.en)} <span>|</span> <span class="ar">${arabicTitle}</span></div>
      </div>
      <div class="right-org">
        <div>المملكة العربية السعودية</div>
        <div>الحرس الوطني — الشؤون الصحية</div>
        <div>مدينة الملك عبدالعزيز الطبية — جدة</div>
        <div class="form">From : ${escapeHtml(template.formCode)}</div>
      </div>
    </header>

    ${metadataRows(submission)}

    <div class="section-band">INSPECTION CHECKLIST <span class="ar">${arabicChecklistTitle}</span></div>
    <table class="check-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Inspection Item</th>
          <th class="h-excellent">${scoreLabel(0)}</th>
          <th class="h-good">${scoreLabel(1)}</th>
          <th class="h-low">${scoreLabel(2)}</th>
          <th class="h-bad">${scoreLabel(3)}</th>
          <th>Issues / Observations</th>
          <th>Given<br />Degree</th>
        </tr>
      </thead>
      <tbody>${checklistRows(template, submission)}</tbody>
    </table>

    <section class="bottom">
      <div>
        <div class="comments-head">INSPECTOR COMMENTS</div>
        <div class="comments-box">
          <div class="comment-inner">
            <div class="comment-title">Inspector Comment<br />Unavailable Chemical &amp; Tools</div>
            <div class="comment-lines">${escapeHtml(submission.notes || "1 - __________________________\n2 - __________________________\n3 - __________________________\n4 - __________________________\n5 - __________________________\n6 - __________________________")}</div>
            <div class="availability">${checkbox((submission.chemicalToolsAvailability || "Available") === "Available", "Available")} &nbsp;&nbsp; ${checkbox(submission.chemicalToolsAvailability === "Not Available", "Not Available")}</div>
            <div class="supervisor-line">Supervisor Name: ${escapeHtml(submission.supervisorName || "________________")}</div>
          </div>
        </div>
      </div>
      <div>
        <div class="summary-head"><span class="ar">${arabicSummaryTitle}</span> | Arabic Summary of Scores</div>
        <div class="summary-box">
          <table class="summary-table">
            <thead>
              <tr><th>#</th><th>البند</th><th>الدرجة</th><th>الدرجة</th><th>#</th><th>البند</th><th>الدرجة</th><th>الدرجة</th></tr>
            </thead>
            <tbody>${summaryRows(template, submission)}</tbody>
          </table>
        </div>
      </div>
    </section>
  </main>
  ${photoPages(submission)}
</body>
</html>`;
}
