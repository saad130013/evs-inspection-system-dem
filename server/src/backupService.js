import fs from "node:fs/promises";
import path from "node:path";
import { resolveStorageRoot, serverDir } from "./paths.js";

const DEFAULT_BACKUP_TIME = "02:00";
const DEFAULT_RETENTION_DAYS = 30;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localTimeString(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function backupRoot() {
  return path.join(resolveStorageRoot(), "backups");
}

function backupStatePath() {
  return path.join(backupRoot(), "backup_state.json");
}

async function readBackupState() {
  try {
    return JSON.parse(await fs.readFile(backupStatePath(), "utf8"));
  } catch {
    return {};
  }
}

async function writeBackupState(state) {
  await fs.mkdir(backupRoot(), { recursive: true });
  await fs.writeFile(backupStatePath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(source, destination, options = {}) {
  if (!(await pathExists(source))) return false;
  await fs.cp(source, destination, {
    recursive: true,
    force: true,
    errorOnExist: false,
    ...options
  });
  return true;
}

async function copyStorageContents(storageRoot, destination) {
  if (!(await pathExists(storageRoot))) return false;
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(storageRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "backups") continue;
    const source = path.join(storageRoot, entry.name);
    const target = path.join(destination, entry.name);
    await fs.cp(source, target, {
      recursive: true,
      force: true,
      errorOnExist: false
    });
  }
  return true;
}

async function cleanupOldBackups(retentionDays) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;
  const root = backupRoot();
  let entries = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(entry.name)) continue;
    const backupTime = new Date(`${entry.name}T23:59:59`).getTime();
    if (backupTime < cutoff) {
      await fs.rm(path.join(root, entry.name), { recursive: true, force: true });
    }
  }
}

export async function createDailyBackup(reason = "manual") {
  const storageRoot = resolveStorageRoot();
  const date = localDateString();
  const destination = path.join(backupRoot(), date);
  const dataDestination = path.join(destination, "server-data");
  const storageDestination = path.join(destination, "storage");
  const startedAt = new Date().toISOString();

  await fs.mkdir(destination, { recursive: true });

  const copiedData = await copyIfExists(path.join(serverDir, "data"), dataDestination);
  const copiedStorage = await copyStorageContents(storageRoot, storageDestination);

  const manifest = {
    date,
    reason,
    startedAt,
    completedAt: new Date().toISOString(),
    copied: {
      serverData: copiedData,
      storage: copiedStorage
    },
    source: {
      serverData: path.join(serverDir, "data"),
      storage: storageRoot
    },
    destination
  };

  await fs.writeFile(path.join(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeBackupState({
    lastBackupDate: date,
    lastBackupAt: manifest.completedAt,
    lastBackupPath: destination,
    lastReason: reason
  });

  const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  await cleanupOldBackups(retentionDays);
  return manifest;
}

export async function getBackupStatus() {
  const root = backupRoot();
  const state = await readBackupState();
  let backups = [];
  try {
    backups = (await fs.readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse();
  } catch {
    backups = [];
  }

  return {
    backupRoot: root,
    backupTime: process.env.BACKUP_TIME || DEFAULT_BACKUP_TIME,
    retentionDays: Number(process.env.BACKUP_RETENTION_DAYS || DEFAULT_RETENTION_DAYS),
    ...state,
    backups
  };
}

async function runScheduledBackupIfDue() {
  const backupTime = process.env.BACKUP_TIME || DEFAULT_BACKUP_TIME;
  const today = localDateString();
  const nowTime = localTimeString();
  const state = await readBackupState();
  if (state.lastBackupDate === today) return;
  if (nowTime < backupTime) return;
  try {
    const manifest = await createDailyBackup("scheduled");
    console.log(`Daily EVS backup completed: ${manifest.destination}`);
  } catch (error) {
    console.error("Daily EVS backup failed:", error);
  }
}

export function startDailyBackupSchedule() {
  const intervalMs = 60 * 1000;
  runScheduledBackupIfDue();
  setInterval(runScheduledBackupIfDue, intervalMs).unref?.();
}
