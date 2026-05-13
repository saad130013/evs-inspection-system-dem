import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
export const serverDir = path.resolve(path.dirname(__filename), "..");
export const projectRoot = path.resolve(serverDir, "..");

export function resolveStorageRoot() {
  return path.resolve(serverDir, process.env.REPORT_STORAGE_PATH || "../storage");
}
