import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { resolveStorageRoot } from "./paths.js";

const columns = [
  { header: "Submission ID", key: "submissionId", width: 22 },
  { header: "Inspector Name", key: "inspectorName", width: 20 },
  { header: "Area / Room #", key: "areaRoom", width: 18 },
  { header: "Area Type / Risk Type", key: "areaType", width: 24 },
  { header: "Area Category", key: "areaCategory", width: 34 },
  { header: "Visit Location", key: "visitLocation", width: 24 },
  { header: "Total Score", key: "totalScore", width: 14 },
  { header: "Maximum Score", key: "maximumScore", width: 16 },
  { header: "Percentage", key: "percentage", width: 14 },
  { header: "Rating Status", key: "ratingStatus", width: 16 },
  { header: "Date", key: "date", width: 14 },
  { header: "Time", key: "time", width: 12 },
  { header: "Supervisor Name", key: "supervisorName", width: 22 },
  { header: "Notes / Observations", key: "notes", width: 42 },
  { header: "Generated Report File Path", key: "reportFilePath", width: 70 }
];

async function workbookFor(filePath, sheetName) {
  const workbook = new ExcelJS.Workbook();
  try {
    await fs.access(filePath);
    await workbook.xlsx.readFile(filePath);
  } catch {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  return workbook;
}

async function writeWorkbookWithRetry(workbook, filePath) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await workbook.xlsx.writeFile(filePath);
      return;
    } catch (error) {
      lastError = error;
      if (!["EBUSY", "EPERM"].includes(error.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError;
}

function isLockedError(error) {
  return ["EBUSY", "EPERM"].includes(error?.code);
}

function pendingPath(excelDir) {
  return path.join(excelDir, "pending_excel_rows.json");
}

async function readPendingRows(excelDir) {
  try {
    return JSON.parse((await fs.readFile(pendingPath(excelDir), "utf8")).replace(/^\uFEFF/, ""));
  } catch {
    return [];
  }
}

async function writePendingRows(excelDir, rows) {
  await fs.writeFile(pendingPath(excelDir), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
}

async function queuePendingRow(excelDir, record) {
  const rows = await readPendingRows(excelDir);
  if (!rows.some((row) => row.submissionId === record.submissionId)) rows.push(record);
  await writePendingRows(excelDir, rows);
}

async function appendRecordToWorkbooks(record, excelDir) {
  const summaryPath = path.join(excelDir, "inspection_summary.xlsx");
  const monthlyPath = path.join(excelDir, `inspection_summary_${record.date.slice(0, 7)}.xlsx`);

  for (const [filePath, sheetName] of [[summaryPath, "All Inspections"], [monthlyPath, record.date.slice(0, 7)]]) {
    const workbook = await workbookFor(filePath, sheetName);
    const sheet = workbook.worksheets[0];
    sheet.addRow(record);
    sheet.getColumn(8).numFmt = "0.00";
    await writeWorkbookWithRetry(workbook, filePath);
  }

  return { summaryPath, monthlyPath };
}

export async function flushPendingExcelRows() {
  const storageRoot = resolveStorageRoot();
  const excelDir = path.join(storageRoot, "excel");
  await fs.mkdir(excelDir, { recursive: true });
  const rows = await readPendingRows(excelDir);
  if (!rows.length) return { flushed: 0, pending: 0 };

  const remaining = [];
  let flushed = 0;
  for (const row of rows) {
    try {
      await appendRecordToWorkbooks(row, excelDir);
      flushed += 1;
    } catch (error) {
      if (!isLockedError(error)) throw error;
      remaining.push(row);
    }
  }
  await writePendingRows(excelDir, remaining);
  return { flushed, pending: remaining.length };
}

export async function appendExcelSummary(record) {
  const storageRoot = resolveStorageRoot();
  const excelDir = path.join(storageRoot, "excel");
  await fs.mkdir(excelDir, { recursive: true });
  await flushPendingExcelRows().catch((error) => {
    if (!isLockedError(error)) throw error;
  });

  const summaryPath = path.join(excelDir, "inspection_summary.xlsx");
  const monthlyPath = path.join(excelDir, `inspection_summary_${record.date.slice(0, 7)}.xlsx`);

  try {
    return { ...(await appendRecordToWorkbooks(record, excelDir)), excelPending: false };
  } catch (error) {
    if (!isLockedError(error)) throw error;
    await queuePendingRow(excelDir, record);
    return {
      summaryPath,
      monthlyPath,
      pendingRowsPath: pendingPath(excelDir),
      excelPending: true,
      excelWarning: "Excel workbook is open or locked. Summary row was queued and will sync when the workbook is closed."
    };
  }
}
