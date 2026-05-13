import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import puppeteer from "puppeteer";
import { resolveStorageRoot } from "./paths.js";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function todayString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value || "");
}

export function defaultWeekRange(date = new Date()) {
  const day = date.getDay();
  const diffToSunday = day;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - diffToSunday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { fromDate: todayString(start), toDate: todayString(end) };
}

export function defaultMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { fromDate: todayString(start), toDate: todayString(end) };
}

function groupCount(records, key) {
  return records.reduce((acc, record) => {
    const value = record[key] || "Unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function scoreBuckets(records) {
  return {
    below70: records.filter((record) => Number(record.percentage) < 70).length,
    from70To80: records.filter((record) => Number(record.percentage) >= 70 && Number(record.percentage) < 80).length,
    from80To90: records.filter((record) => Number(record.percentage) >= 80 && Number(record.percentage) < 90).length,
    from90To100: records.filter((record) => Number(record.percentage) >= 90).length
  };
}

function weakestAreas(records) {
  const areas = {};
  for (const record of records) {
    const name = record.visitLocation || record.areaRoom || "Unknown";
    if (!areas[name]) areas[name] = { total: 0, count: 0, badCount: 0 };
    areas[name].total += Number(record.percentage || 0);
    areas[name].count += 1;
    if (Number(record.percentage || 0) < 70 || record.ratingStatus === "Bad") areas[name].badCount += 1;
  }
  return Object.entries(areas)
    .map(([name, value]) => ({
      name,
      count: value.count,
      badCount: value.badCount,
      average: value.count ? Number((value.total / value.count).toFixed(1)) : 0
    }))
    .sort((a, b) => b.badCount - a.badCount || a.average - b.average)
    .slice(0, 3);
}

function calculatePerformanceDeduction(averageScore) {
  const score = Math.round(Number(averageScore || 0));
  if (score >= 95) return { score, deduction: 0, label: "95-100" };
  if (score <= 59) return { score, deduction: 18.5, label: "59 or less" };
  if (score >= 77) return { score, deduction: Number(((96 - score) * 0.5).toFixed(1)), label: String(score) };
  if (score >= 60) return { score, deduction: Number((10 + ((76 - score) * 0.5)).toFixed(1)), label: String(score) };
  return { score, deduction: 18.5, label: "59 or less" };
}

function buildPerformanceDeductionSection(avg) {
  const result = calculatePerformanceDeduction(avg);
  const deduction = Number.isInteger(result.deduction) ? result.deduction : result.deduction.toFixed(1);
  return `
        <section class="card full deduction-card">
          <h2>Monthly Performance Deduction / حسم الأداء الشهري</h2>
          <div class="deduction-summary">
            <div>
              <span>Monthly Average</span>
              <strong>${avg}%</strong>
            </div>
            <div>
              <span>Applied Performance Score</span>
              <strong>${escapeHtml(result.label)}</strong>
            </div>
            <div class="deduction-highlight">
              <span>Deduction / الغرامة</span>
              <strong>${deduction}%</strong>
            </div>
          </div>
          <p class="deduction-note">
            The monthly average is rounded to the nearest whole performance score, then matched with the approved deduction table.
            <span dir="rtl">يتم تقريب متوسط الشهر إلى أقرب درجة أداء ثم ربطها بجدول الحسم المعتمد.</span>
          </p>
        </section>`;
}

function rows(items, columns) {
  if (!items.length) {
    return `<tr><td colspan="${columns}" class="empty">No data available for this week.</td></tr>`;
  }
  return items.join("");
}

function buildWeeklyReportHtml({ records, fromDate, toDate }) {
  const total = records.length;
  const avg = total ? Number((records.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / total).toFixed(1)) : 0;
  const supervisors = groupCount(records, "supervisorName");
  const inspectors = groupCount(records, "inspectorName");
  const areaTypes = groupCount(records, "areaType");
  const uniqueAreas = new Set(records.map((record) => record.visitLocation || record.areaRoom || "Unknown")).size;
  const buckets = scoreBuckets(records);
  const weakAreas = weakestAreas(records);

  const supervisorRows = rows(Object.entries(supervisors).map(([name, count]) => `
    <tr><td>${escapeHtml(name)}</td><td>${count}</td></tr>
  `), 2);
  const inspectorRows = rows(Object.entries(inspectors).map(([name, count]) => `
    <tr><td>${escapeHtml(name)}</td><td>${count}</td></tr>
  `), 2);
  const areaRows = rows(Object.entries(areaTypes).map(([name, count]) => `
    <tr><td>${escapeHtml(name)}</td><td>${count}</td></tr>
  `), 2);
  const weakAreaRows = rows(weakAreas.map((area, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(area.name)}</td>
      <td>${area.count}</td>
      <td>${area.badCount}</td>
      <td>${area.average}%</td>
    </tr>
  `), 5);
  const latestRows = rows(records.slice(0, 20).map((record) => `
    <tr>
      <td>${escapeHtml(record.date)} ${escapeHtml(record.time || "")}</td>
      <td>${escapeHtml(record.inspectorName)}</td>
      <td>${escapeHtml(record.supervisorName)}</td>
      <td>${escapeHtml(record.visitLocation || record.areaRoom)}</td>
      <td>${escapeHtml(record.areaType)}</td>
      <td>${record.percentage}%</td>
      <td>${escapeHtml(record.ratingStatus)}</td>
    </tr>
  `), 7);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Weekly EVS Report ${escapeHtml(fromDate)} to ${escapeHtml(toDate)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #e5e7eb; color: #003f52; font-family: Arial, Tahoma, sans-serif; }
    .page { min-height: 281mm; background: #fff; border: 1px solid #b7c3ca; }
    .header { background: #003f52; color: #fff; padding: 20px 26px; display: flex; justify-content: space-between; gap: 20px; }
    .eyebrow { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; opacity: .78; font-weight: 800; }
    h1 { margin: 6px 0 0; font-size: 25px; letter-spacing: .4px; }
    .arabic { direction: rtl; font-size: 13px; margin-top: 4px; opacity: .9; font-weight: 700; }
    .period { text-align: right; font-size: 13px; line-height: 1.45; min-width: 270px; }
    .period-range { display: inline-block; margin-top: 3px; white-space: nowrap; font-size: 15px; letter-spacing: .2px; }
    .content { padding: 18px 22px 22px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #cbd5e1; }
    .kpi { padding: 16px 10px; text-align: center; border-right: 1px solid #cbd5e1; }
    .kpi:last-child { border-right: 0; }
    .kpi-label { color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; }
    .kpi-value { margin-top: 7px; color: #003f52; font-size: 34px; font-weight: 900; line-height: 1; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 16px; }
    .card { border: 1px solid #cbd5e1; page-break-inside: avoid; break-inside: avoid; }
    .card h2 { margin: 0; padding: 9px 11px; background: #eaf2f5; color: #003f52; font-size: 13px; border-bottom: 1px solid #cbd5e1; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #23669d; color: #fff; text-align: left; padding: 7px; border: 1px solid #a9b8c2; }
    td { padding: 7px; border: 1px solid #dbe3e8; color: #111827; }
    .bucket-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 10px; }
    .bucket { border: 1px solid #dbe3e8; padding: 10px; text-align: center; }
    .bucket strong { display: block; font-size: 24px; color: #003f52; }
    .bucket span { font-size: 10px; color: #64748b; font-weight: 800; }
    .full { grid-column: 1 / -1; }
    .deduction-card { border-color: #b91c1c; }
    .deduction-card h2 { background: #fef2f2; color: #991b1b; }
    .deduction-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 12px; }
    .deduction-summary div { border: 1px solid #dbe3e8; padding: 12px; text-align: center; }
    .deduction-summary span { display: block; color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .deduction-summary strong { display: block; margin-top: 6px; color: #003f52; font-size: 28px; line-height: 1; }
    .deduction-summary .deduction-highlight { border-color: #b91c1c; background: #fff7f7; }
    .deduction-summary .deduction-highlight strong { color: #dc2626; }
    .deduction-note { margin: 0; padding: 0 12px 12px; color: #475569; font-size: 11px; line-height: 1.6; }
    .empty { text-align: center; color: #64748b; padding: 18px; }
    .footer { margin-top: 16px; color: #94a3b8; font-size: 10px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <main class="page">
    <section class="header">
      <div>
        <div class="eyebrow">Support Services Division - Environmental Services</div>
        <h1>WEEKLY INSPECTION ACHIEVEMENT REPORT</h1>
        <div class="arabic">تقرير الإنجاز الأسبوعي للتقييمات</div>
      </div>
      <div class="period">
        <div>Period</div>
        <strong class="period-range">${escapeHtml(formatDisplayDate(fromDate))} - ${escapeHtml(formatDisplayDate(toDate))}</strong>
        <div>Generated: ${todayString()}</div>
      </div>
    </section>
    <section class="content">
      <div class="kpis">
        <div class="kpi"><div class="kpi-label">Total Inspections</div><div class="kpi-value">${total}</div></div>
        <div class="kpi"><div class="kpi-label">Average Score</div><div class="kpi-value">${avg}%</div></div>
        <div class="kpi"><div class="kpi-label">Areas Evaluated</div><div class="kpi-value">${uniqueAreas}</div></div>
        <div class="kpi"><div class="kpi-label">Below 70%</div><div class="kpi-value">${buckets.below70}</div></div>
      </div>

      <div class="grid">
        <section class="card">
          <h2>Score Distribution / توزيع التقييمات</h2>
          <div class="bucket-grid">
            <div class="bucket"><strong>${buckets.below70}</strong><span>Less than 70</span></div>
            <div class="bucket"><strong>${buckets.from70To80}</strong><span>70 to 80</span></div>
            <div class="bucket"><strong>${buckets.from80To90}</strong><span>80 to 90</span></div>
            <div class="bucket"><strong>${buckets.from90To100}</strong><span>90 to 100</span></div>
          </div>
        </section>
        <section class="card">
          <h2>Reviewed By Supervisor / التقارير حسب المشرف المراجع</h2>
          <table><thead><tr><th>Reviewed By / Supervisor Name</th><th>Reports Reviewed</th></tr></thead><tbody>${supervisorRows}</tbody></table>
        </section>
        <section class="card">
          <h2>Submitted By Inspector / التقارير حسب المفتش</h2>
          <table><thead><tr><th>Inspected By / Inspector Name</th><th>Reports Submitted</th></tr></thead><tbody>${inspectorRows}</tbody></table>
        </section>
        <section class="card">
          <h2>Area Types / أنواع المناطق</h2>
          <table><thead><tr><th>Area Type</th><th>Count</th></tr></thead><tbody>${areaRows}</tbody></table>
        </section>
        <section class="card full">
          <h2>Top 3 Weak Areas / أكثر 3 مناطق منخفضة</h2>
          <table><thead><tr><th>#</th><th>Area / Location</th><th>Total</th><th>Below 70</th><th>Average</th></tr></thead><tbody>${weakAreaRows}</tbody></table>
        </section>
        <section class="card full">
          <h2>Weekly Inspection List / قائمة تقييمات الأسبوع</h2>
          <table>
            <thead><tr><th>Date</th><th>Inspector</th><th>Supervisor</th><th>Location</th><th>Area Type</th><th>%</th><th>Status</th></tr></thead>
            <tbody>${latestRows}</tbody>
          </table>
        </section>
      </div>
      <div class="footer">
        <span>EVS Inspection System</span>
        <span>Weekly report generated automatically from submitted inspections</span>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function buildMonthlyReportHtml({ records, fromDate, toDate }) {
  const total = records.length;
  const avg = total ? Number((records.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / total).toFixed(1)) : 0;
  return buildWeeklyReportHtml({ records, fromDate, toDate })
    .replaceAll('WEEKLY INSPECTION ACHIEVEMENT REPORT', 'MONTHLY INSPECTION ACHIEVEMENT REPORT')
    .replaceAll('Weekly EVS Report', 'Monthly EVS Report')
    .replaceAll('Weekly Inspection List', 'Monthly Inspection List')
    .replaceAll('Weekly report generated automatically', 'Monthly report generated automatically')
    .replace('</div>\n\n      <div class="grid">', `</div>\n${buildPerformanceDeductionSection(avg)}\n\n      <div class="grid">`);
}

function styleSheetHeader(sheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF003F52" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function addTableSheet(workbook, name, columns, rowsData) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns;
  styleSheetHeader(sheet);
  for (const row of rowsData) sheet.addRow(row);
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD7E0E5" } },
        left: { style: "thin", color: { argb: "FFD7E0E5" } },
        bottom: { style: "thin", color: { argb: "FFD7E0E5" } },
        right: { style: "thin", color: { argb: "FFD7E0E5" } }
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  });
  return sheet;
}

async function writeMonthlyReportExcel({ records, fromDate, toDate, reportDir, fileBase }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EVS Inspection System";
  workbook.created = new Date();
  workbook.modified = new Date();

  const total = records.length;
  const avg = total ? Number((records.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / total).toFixed(1)) : 0;
  const deduction = calculatePerformanceDeduction(avg);
  const buckets = scoreBuckets(records);
  const uniqueAreas = new Set(records.map((record) => record.visitLocation || record.areaRoom || "Unknown")).size;

  const summary = addTableSheet(workbook, "Monthly Summary", [
    { header: "Metric", key: "metric", width: 34 },
    { header: "Value", key: "value", width: 24 },
    { header: "Arabic", key: "arabic", width: 34 }
  ], [
    { metric: "Period From", value: fromDate, arabic: "من تاريخ" },
    { metric: "Period To", value: toDate, arabic: "إلى تاريخ" },
    { metric: "Total Inspections", value: total, arabic: "عدد التقييمات" },
    { metric: "Average Score", value: `${avg}%`, arabic: "متوسط التقييم" },
    { metric: "Applied Performance Score", value: deduction.label, arabic: "درجة الأداء المعتمدة" },
    { metric: "Deduction Percentage", value: `${deduction.deduction}%`, arabic: "نسبة الحسم" },
    { metric: "Areas Evaluated", value: uniqueAreas, arabic: "عدد المناطق المقيمة" },
    { metric: "Below 70%", value: buckets.below70, arabic: "أقل من 70%" },
    { metric: "70 to 80", value: buckets.from70To80, arabic: "من 70 إلى 80" },
    { metric: "80 to 90", value: buckets.from80To90, arabic: "من 80 إلى 90" },
    { metric: "90 to 100", value: buckets.from90To100, arabic: "من 90 إلى 100" }
  ]);
  summary.getColumn(3).alignment = { horizontal: "right", vertical: "middle" };

  addTableSheet(workbook, "Inspections", [
    { header: "Submission ID", key: "submissionId", width: 16 },
    { header: "Date", key: "date", width: 14 },
    { header: "Time", key: "time", width: 12 },
    { header: "Inspector", key: "inspectorName", width: 22 },
    { header: "Supervisor", key: "supervisorName", width: 24 },
    { header: "Area / Room", key: "areaRoom", width: 18 },
    { header: "Area Category", key: "areaCategory", width: 34 },
    { header: "Location", key: "visitLocation", width: 24 },
    { header: "Area Type", key: "areaType", width: 20 },
    { header: "Total Score", key: "totalScore", width: 14 },
    { header: "Maximum Score", key: "maximumScore", width: 16 },
    { header: "Percentage", key: "percentage", width: 14 },
    { header: "Rating", key: "ratingStatus", width: 14 },
    { header: "Notes", key: "notes", width: 42 },
    { header: "Report File Path", key: "reportFilePath", width: 70 }
  ], records.map((record) => ({
    submissionId: record.submissionId,
    date: record.date,
    time: record.time || "",
    inspectorName: record.inspectorName,
    supervisorName: record.supervisorName,
    areaRoom: record.areaRoom,
    areaCategory: record.areaCategory || "",
    visitLocation: record.visitLocation,
    areaType: record.areaType,
    totalScore: record.totalScore,
    maximumScore: record.maximumScore,
    percentage: Number(record.percentage || 0),
    ratingStatus: record.ratingStatus,
    notes: record.notes || "",
    reportFilePath: record.reportFilePath || ""
  })));

  addTableSheet(workbook, "Supervisor Activity", [
    { header: "Supervisor", key: "name", width: 32 },
    { header: "Inspections", key: "count", width: 16 }
  ], Object.entries(groupCount(records, "supervisorName")).map(([name, count]) => ({ name, count })));

  addTableSheet(workbook, "Inspector Activity", [
    { header: "Inspector", key: "name", width: 32 },
    { header: "Inspections", key: "count", width: 16 }
  ], Object.entries(groupCount(records, "inspectorName")).map(([name, count]) => ({ name, count })));

  addTableSheet(workbook, "Top Weak Areas", [
    { header: "#", key: "rank", width: 8 },
    { header: "Area / Location", key: "name", width: 34 },
    { header: "Total Inspections", key: "count", width: 18 },
    { header: "Below 70", key: "badCount", width: 14 },
    { header: "Average", key: "average", width: 14 }
  ], weakestAreas(records).map((area, index) => ({ rank: index + 1, ...area })));

  const excelPath = path.join(reportDir, `${fileBase}.xlsx`);
  await workbook.xlsx.writeFile(excelPath);
  return excelPath;
}

export async function generateWeeklyReport({ records, fromDate, toDate }) {
  const storageRoot = resolveStorageRoot();
  const reportDir = path.join(storageRoot, "weekly-reports", fromDate.slice(0, 7));
  await fs.mkdir(reportDir, { recursive: true });
  const fileBase = `weekly_inspection_report_${fromDate}_to_${toDate}`;
  const htmlPath = path.join(reportDir, `${fileBase}.html`);
  const pdfPath = path.join(reportDir, `${fileBase}.pdf`);
  const sortedRecords = [...records].sort((a, b) => `${b.date} ${b.time || ""}`.localeCompare(`${a.date} ${a.time || ""}`));
  const html = buildWeeklyReportHtml({ records: sortedRecords, fromDate, toDate });
  await fs.writeFile(htmlPath, html, "utf8");

  try {
    const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" }
    });
    await browser.close();
    return { filePath: pdfPath, htmlPath };
  } catch (error) {
    return { filePath: htmlPath, htmlPath, pdfError: error.message };
  }
}

export async function generateMonthlyReport({ records, fromDate, toDate }) {
  const storageRoot = resolveStorageRoot();
  const reportDir = path.join(storageRoot, "monthly-reports", fromDate.slice(0, 7));
  await fs.mkdir(reportDir, { recursive: true });
  const fileBase = `monthly_inspection_report_${fromDate}_to_${toDate}`;
  const htmlPath = path.join(reportDir, `${fileBase}.html`);
  const pdfPath = path.join(reportDir, `${fileBase}.pdf`);
  const sortedRecords = [...records].sort((a, b) => `${b.date} ${b.time || ""}`.localeCompare(`${a.date} ${a.time || ""}`));
  const html = buildMonthlyReportHtml({ records: sortedRecords, fromDate, toDate });
  await fs.writeFile(htmlPath, html, "utf8");
  const excelPath = await writeMonthlyReportExcel({ records: sortedRecords, fromDate, toDate, reportDir, fileBase });

  try {
    const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" }
    });
    await browser.close();
    return { filePath: pdfPath, htmlPath, excelPath };
  } catch (error) {
    return { filePath: htmlPath, htmlPath, excelPath, pdfError: error.message };
  }
}
