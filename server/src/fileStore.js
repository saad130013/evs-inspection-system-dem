import fs from "node:fs/promises";
import path from "node:path";
import { serverDir } from "./paths.js";

const submissionsPath = path.join(serverDir, "data", "submissions.json");

export async function ensureJsonStores() {
  try {
    await fs.access(submissionsPath);
  } catch {
    await fs.writeFile(submissionsPath, "[]\n", "utf8");
  }
}

export async function readJson(relativePath) {
  const file = path.join(serverDir, relativePath);
  return JSON.parse((await fs.readFile(file, "utf8")).replace(/^\uFEFF/, ""));
}

export async function writeJson(relativePath, data) {
  const file = path.join(serverDir, relativePath);
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return data;
}

export async function readSubmissions() {
  await ensureJsonStores();
  return JSON.parse((await fs.readFile(submissionsPath, "utf8")).replace(/^\uFEFF/, ""));
}

export async function appendSubmission(record) {
  const submissions = await readSubmissions();
  submissions.unshift(record);
  await fs.writeFile(submissionsPath, `${JSON.stringify(submissions, null, 2)}\n`, "utf8");
  return submissions;
}
