import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { appendSubmission, ensureJsonStores, readJson, readSubmissions, writeJson } from "./fileStore.js";
import { calculateScore } from "./scoring.js";
import { generateReport } from "./reportService.js";
import { buildReportHtml } from "./reportHtml.js";
import { defaultMonthRange, defaultWeekRange, generateMonthlyReport, generateWeeklyReport } from "./weeklyReportService.js";
import { appendExcelSummary, flushPendingExcelRows } from "./excelService.js";
import { resolveStorageRoot } from "./paths.js";
import { v4 as uuidv4 } from "uuid";
import { allowRoles, canExport, canViewDashboard, requireAuth } from "./authMiddleware.js";
import { createToken, createUser, ensureUsersStore, findUserByUsername, listPublicUsers, resetPassword, toPublicUser, updateUser, verifyPassword } from "./authService.js";
import { createDailyBackup, getBackupStatus, startDailyBackupSchedule } from "./backupService.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const configuredOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://172.20.10.2:5173",
  ...configuredOrigins
]);

function isAllowedDevOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:" && parsed.port === "5173";
  } catch {
    return false;
  }
}

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (isAllowedDevOrigin(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.options("*", cors({
  origin(origin, callback) {
    if (isAllowedDevOrigin(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "30mb" }));
app.use(morgan("dev"));

await ensureJsonStores();
await ensureUsersStore();
startDailyBackupSchedule();

function publicRecord(record) {
  return {
    submissionId: record.submissionId,
    inspectorName: record.inspectorName,
    areaRoom: record.areaRoom,
    areaType: record.areaType,
    areaCategory: record.areaCategory,
    visitLocation: record.visitLocation,
    totalScore: record.totalScore,
    maximumScore: record.maximumScore,
    percentage: record.percentage,
    ratingStatus: record.ratingStatus,
    date: record.date,
    time: record.time,
    supervisorName: record.supervisorName,
    notes: record.notes,
    submittedBy: record.submittedBy,
    submittedByName: record.submittedByName,
    photos: Array.isArray(record.photos) ? record.photos.map((photo) => ({
      id: photo.id,
      name: photo.name,
      caption: photo.caption || ""
    })) : [],
    reportFilePath: record.reportFilePath,
    htmlReportPath: record.htmlReportPath
  };
}

function normalizePhotos(photos = []) {
  if (!Array.isArray(photos)) return [];
  return photos.slice(0, 6).flatMap((photo, index) => {
    const dataUrl = String(photo.dataUrl || "");
    if (!dataUrl.startsWith("data:image/")) return [];
    return [{
      id: String(photo.id || `photo-${index + 1}`),
      name: String(photo.name || `photo-${index + 1}`),
      type: String(photo.type || "image"),
      size: Number(photo.size || 0),
      dataUrl,
      caption: String(photo.caption || "").trim()
    }];
  });
}

function visibleSubmissionsFor(user, records) {
  if (user.role === "Inspector") {
    return records.filter((item) => item.submittedBy === user.id || item.inspectorName === user.name || item.inspectorName === user.username);
  }
  return records;
}

function monthlyRangeFromQuery(query) {
  const requestedMonth = String(query.month || query.fromDate || "").slice(0, 7);
  let defaults = defaultMonthRange();
  if (/^\d{4}-\d{2}$/.test(requestedMonth)) {
    const [year, month] = requestedMonth.split("-").map(Number);
    defaults = defaultMonthRange(new Date(year, month - 1, 1));
  }
  return defaults;
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/auth/login", async (req, res) => {
  const user = await findUserByUsername(req.body.username || "");
  if (!user || user.active === false || !verifyPassword(req.body.password || "", user)) {
    return res.status(401).json({ message: "Invalid username or password." });
  }
  res.json({ token: createToken(user), user: toPublicUser(user) });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

app.get("/api/config", requireAuth, async (_req, res) => {
  const [checklists, masterData] = await Promise.all([
    readJson("data/checklists.json"),
    readJson("data/masterData.json")
  ]);
  res.json({ checklists, masterData });
});

app.put("/api/checklists", requireAuth, allowRoles("Admin"), async (req, res) => {
  if (!Array.isArray(req.body.checklists)) return res.status(400).json({ message: "checklists array is required." });
  await writeJson("data/checklists.json", req.body.checklists);
  res.json({ checklists: req.body.checklists });
});

app.put("/api/master-data", requireAuth, allowRoles("Admin"), async (req, res) => {
  const current = await readJson("data/masterData.json");
  const next = {
    ...current,
    inspectors: Array.isArray(req.body.inspectors) ? req.body.inspectors.filter(Boolean) : current.inspectors,
    supervisors: Array.isArray(req.body.supervisors) ? req.body.supervisors.filter(Boolean) : current.supervisors,
    locations: Array.isArray(req.body.locations) ? req.body.locations.filter(Boolean) : current.locations,
    areaCategories: Array.isArray(req.body.areaCategories) ? req.body.areaCategories : current.areaCategories,
    issueOptions: Array.isArray(req.body.issueOptions) ? req.body.issueOptions.filter(Boolean) : current.issueOptions
  };
  await writeJson("data/masterData.json", next);
  res.json({ masterData: next });
});

app.post("/api/submissions", requireAuth, allowRoles("Inspector", "Supervisor", "Manager", "Admin"), async (req, res) => {
  try {
    const checklists = await readJson("data/checklists.json");
    const template = checklists.find((item) => item.id === req.body.checklistType);
    if (!template) return res.status(400).json({ message: "Invalid checklist type." });

    const required = ["areaRoom", "date", "time", "inspectorName", "supervisorName", "visitLocation"];
    const missing = required.filter((field) => !String(req.body[field] || "").trim());
    if (missing.length) return res.status(400).json({ message: `Missing required fields: ${missing.join(", ")}` });

    // Extra guard: inspectorName must not be tampered with to an empty string.
    // We do not enforce exact match to allow Supervisors/Managers to submit
    // on behalf of an inspector, but empty is never acceptable.
    if (!String(req.body.inspectorName).trim()) {
      return res.status(400).json({ message: "inspectorName cannot be empty." });
    }

    const incomplete = template.items.filter((item) => req.body.responses?.[item.id]?.score === undefined);
    if (incomplete.length) return res.status(400).json({ message: "All checklist items require a selected score." });

    const submissionId = uuidv4().slice(0, 8).toUpperCase();
    const score = calculateScore(template, req.body.responses);
    const submission = {
      submissionId,
      checklistType: template.id,
      formCode: template.formCode,
      areaType: template.riskType,
      areaRoom: req.body.areaRoom,
      date: req.body.date,
      time: req.body.time,
      inspectorName: req.body.inspectorName,
      signature: req.body.signature || "",
      reviewedBySupervisor: req.body.reviewedBySupervisor || "",
      approvedByManager: req.body.approvedByManager || "",
      notes: req.body.notes || "",
      unavailableChemicalTools: req.body.unavailableChemicalTools || "",
      chemicalToolsAvailability: ["Available", "Not Available"].includes(req.body.chemicalToolsAvailability) ? req.body.chemicalToolsAvailability : "Available",
      supervisorName: req.body.supervisorName,
      areaCategory: req.body.areaCategory || "",
      visitLocation: req.body.visitLocation,
      submittedBy: req.user.id,
      submittedByName: req.user.name,
      submittedByRole: req.user.role,
      photos: normalizePhotos(req.body.photos),
      responses: req.body.responses,
      createdAt: new Date().toISOString(),
      ...score
    };

    const report = await generateReport({ submission, template });
    const record = { ...submission, ...report };
    const excelRecord = publicRecord(record);
    const excel = await appendExcelSummary(excelRecord);
    await appendSubmission({ ...record, excel });
    res.status(201).json({ submission: publicRecord({ ...record, excel }), excel });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Inspection submission failed.", detail: error.message });
  }
});

app.get("/api/submissions", requireAuth, async (req, res) => {
  let submissions = visibleSubmissionsFor(req.user, await readSubmissions()).map(publicRecord);
  const { inspector, areaType, status, fromDate, toDate, minScore } = req.query;
  if (inspector) submissions = submissions.filter((item) => item.inspectorName === inspector);
  if (areaType) submissions = submissions.filter((item) => item.areaType === areaType);
  if (status) submissions = submissions.filter((item) => item.ratingStatus === status);
  if (fromDate) submissions = submissions.filter((item) => item.date >= fromDate);
  if (toDate) submissions = submissions.filter((item) => item.date <= toDate);
  if (minScore) submissions = submissions.filter((item) => item.percentage >= Number(minScore));
  res.json({ submissions });
});

app.get("/api/dashboard", requireAuth, async (req, res) => {
  if (!canViewDashboard(req.user.role) && req.user.role !== "Inspector") {
    return res.status(403).json({ message: "Permission denied." });
  }

  // Read raw records (with responses) for deep analytics, then scope by role.
  const rawAll = visibleSubmissionsFor(req.user, await readSubmissions());

  // Apply optional query filters sent from the dashboard UI.
  const { inspector, areaType, fromDate, toDate, location } = req.query;
  const raw = rawAll.filter((r) => {
    if (inspector && r.inspectorName !== inspector) return false;
    if (areaType  && r.areaType      !== areaType)  return false;
    if (location  && r.visitLocation !== location)   return false;
    if (fromDate  && r.date          <  fromDate)    return false;
    if (toDate    && r.date          >  toDate)      return false;
    return true;
  });

  const submissions = raw.map(publicRecord);
  const total = submissions.length;

  // ── KPI: totals ────────────────────────────────────────────────────────────
  const averageScore = total
    ? Number((submissions.reduce((s, r) => s + r.percentage, 0) / total).toFixed(2))
    : 0;
  const averageTotalScore = total
    ? Number((submissions.reduce((s, r) => s + r.totalScore, 0) / total).toFixed(2))
    : 0;
  const lowOrFailed = submissions.filter((r) => ["Low", "Bad"].includes(r.ratingStatus)).length;

  // ── KPI: today vs yesterday ────────────────────────────────────────────────
  const todayStr     = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  // Use rawAll (unfiltered) so "today" count is never hidden by date filters.
  const allForDate   = visibleSubmissionsFor(req.user, await readSubmissions());
  const todayCount     = allForDate.filter((r) => r.date === todayStr).length;
  const yesterdayCount = allForDate.filter((r) => r.date === yesterdayStr).length;

  // ── Group helpers ──────────────────────────────────────────────────────────
  const group = (key) =>
    submissions.reduce((acc, r) => ({ ...acc, [r[key]]: (acc[r[key]] || 0) + 1 }), {});

  // ── Lowest rated locations (top 5) ────────────────────────────────────────
  const locationMap = {};
  for (const r of submissions) {
    const loc = r.visitLocation || r.areaRoom || "Unknown";
    if (!locationMap[loc]) locationMap[loc] = { total: 0, count: 0 };
    locationMap[loc].total += r.percentage;
    locationMap[loc].count += 1;
  }
  const lowestLocations = Object.entries(locationMap)
    .map(([name, { total: t, count: c }]) => ({
      name,
      avgPercentage: Number((t / c).toFixed(1)),
      count: c
    }))
    .sort((a, b) => a.avgPercentage - b.avgPercentage)
    .slice(0, 5);

  // ── Most failed checklist items (Low or Bad score < maxScore) ─────────────
  // Need checklists for label lookup and maxScore.
  const checklists = await readJson("data/checklists.json");
  const itemMeta = {};
  for (const cl of checklists) {
    for (const item of cl.items) {
      if (!itemMeta[item.id]) {
        itemMeta[item.id] = { label: item.label, maxScore: item.maxScore, failCount: 0, total: 0 };
      }
    }
  }
  for (const r of raw) {
    const responses = r.responses || {};
    for (const [id, resp] of Object.entries(responses)) {
      if (!itemMeta[id]) continue;
      itemMeta[id].total += 1;
      const score = Number(resp.score ?? resp.Score ?? -1);
      if (score < itemMeta[id].maxScore) itemMeta[id].failCount += 1;
    }
  }
  const topFailedItems = Object.entries(itemMeta)
    .filter(([, m]) => m.total > 0 && m.failCount > 0)
    .map(([id, m]) => ({
      id,
      label: m.label,
      failCount: m.failCount,
      total: m.total,
      failPercentage: Number(((m.failCount / m.total) * 100).toFixed(1))
    }))
    .sort((a, b) => b.failCount - a.failCount)
    .slice(0, 8);

  res.json({
    // backward-compatible fields
    total,
    averageScore,
    lowOrFailed,
    byAreaType: group("areaType"),
    byInspector: group("inspectorName"),
    latest: submissions.slice(0, 20),
    // new fields
    averageTotalScore,
    todayCount,
    yesterdayCount,
    lowestLocations,
    topFailedItems
  });
});

app.get("/api/reports/:submissionId", requireAuth, async (req, res) => {
  const record = visibleSubmissionsFor(req.user, await readSubmissions()).find((item) => item.submissionId === req.params.submissionId);
  if (!record) return res.status(404).json({ message: "Report not found." });
  res.sendFile(record.reportFilePath);
});

app.get("/api/reports/:submissionId/html", requireAuth, async (req, res) => {
  const record = visibleSubmissionsFor(req.user, await readSubmissions()).find((item) => item.submissionId === req.params.submissionId);
  if (!record) return res.status(404).json({ message: "Report not found." });
  const checklists = await readJson("data/checklists.json");
  const template = checklists.find((item) => item.id === record.checklistType);
  if (!template) return res.sendFile(record.htmlReportPath || record.reportFilePath);
  res.type("html").send(buildReportHtml({ submission: record, template }));
});

app.get("/api/reports/weekly/summary", requireAuth, async (req, res) => {
  if (!canViewDashboard(req.user.role)) return res.status(403).json({ message: "Permission denied." });
  const defaults = defaultWeekRange();
  const fromDate = String(req.query.fromDate || defaults.fromDate);
  const toDate = String(req.query.toDate || defaults.toDate);
  const records = visibleSubmissionsFor(req.user, await readSubmissions())
    .filter((record) => record.date >= fromDate && record.date <= toDate);
  const report = await generateWeeklyReport({ records, fromDate, toDate });
  res.download(report.filePath);
});

app.get("/api/reports/monthly/summary", requireAuth, async (req, res) => {
  if (!canViewDashboard(req.user.role)) return res.status(403).json({ message: "Permission denied." });
  const { fromDate, toDate } = monthlyRangeFromQuery(req.query);
  const records = visibleSubmissionsFor(req.user, await readSubmissions())
    .filter((record) => record.date >= fromDate && record.date <= toDate);
  const report = await generateMonthlyReport({ records, fromDate, toDate });
  res.download(report.filePath);
});

app.get("/api/reports/monthly/excel", requireAuth, async (req, res) => {
  if (!canViewDashboard(req.user.role)) return res.status(403).json({ message: "Permission denied." });
  const { fromDate, toDate } = monthlyRangeFromQuery(req.query);
  const records = visibleSubmissionsFor(req.user, await readSubmissions())
    .filter((record) => record.date >= fromDate && record.date <= toDate);
  const report = await generateMonthlyReport({ records, fromDate, toDate });
  res.download(report.excelPath);
});

app.get("/api/export/excel", requireAuth, async (req, res) => {
  if (!canExport(req.user.role)) return res.status(403).json({ message: "Permission denied." });
  await flushPendingExcelRows();
  res.download(path.join(resolveStorageRoot(), "excel", "inspection_summary.xlsx"));
});

app.get("/api/backups/status", requireAuth, allowRoles("Admin"), async (_req, res) => {
  res.json({ backup: await getBackupStatus() });
});

app.post("/api/backups/run", requireAuth, allowRoles("Admin"), async (_req, res) => {
  res.json({ backup: await createDailyBackup("manual") });
});

app.get("/api/users", requireAuth, allowRoles("Admin"), async (_req, res) => {
  res.json({ users: await listPublicUsers() });
});

app.post("/api/users", requireAuth, allowRoles("Admin"), async (req, res) => {
  try {
    res.status(201).json({ user: await createUser(req.body) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put("/api/users/:id", requireAuth, allowRoles("Admin"), async (req, res) => {
  try {
    res.json({ user: await updateUser(req.params.id, req.body) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/users/:id/reset-password", requireAuth, allowRoles("Admin"), async (req, res) => {
  try {
    res.json({ user: await resetPassword(req.params.id, req.body.password) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.listen(port, () => {
  console.log(`EVS inspection API running at http://localhost:${port}`);
});
