import crypto from "node:crypto";
import { readJson, writeJson } from "./fileStore.js";

const usersFile = "data/users.json";
const roles = ["Inspector", "Supervisor", "Manager", "Admin"];

const IS_PRODUCTION = process.env.NODE_ENV === "production";

if (IS_PRODUCTION && !process.env.JWT_SECRET) {
  throw new Error(
    "[EVS] JWT_SECRET environment variable is required in production. " +
    "Set it in your .env file before starting the server."
  );
}

const jwtSecret = process.env.JWT_SECRET || "dev-only-secret-do-not-use-in-production";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(data) {
  return crypto.createHmac("sha256", jwtSecret).update(data).digest("base64url");
}

export function createToken(user) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    sub: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8
  }));
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

export function verifyToken(token) {
  const [header, payload, signature] = String(token || "").split(".");
  if (!header || !payload || !signature || sign(`${header}.${payload}`) !== signature) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
  return data;
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

export function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.passwordHash, "hex"));
}

function publicUser(user) {
  // name must never be empty — fall back to username so the client
  // always has a valid display name and inspectorName for submissions.
  const name = (user.name || "").trim() || (user.username || "").trim();
  return {
    id: user.id,
    username: user.username,
    name,
    role: user.role,
    active: user.active !== false,
    assignedLocations: user.assignedLocations || []
  };
}

function demoUser(username, password, role, name) {
  const { salt, hash } = hashPassword(password, `demo-${username}-salt`);
  return {
    id: crypto.createHash("sha1").update(username).digest("hex").slice(0, 10),
    username,
    name,
    role,
    active: true,
    assignedLocations: [],
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: new Date().toISOString()
  };
}

export async function ensureUsersStore() {
  let users = [];
  try {
    users = await readJson(usersFile);
  } catch {
    users = [];
  }

  // Demo accounts are only seeded in development (NODE_ENV !== "production").
  // In production, create real users through the Admin panel instead.
  if (!IS_PRODUCTION) {
    const demos = [
      demoUser("admin", "admin123", "Admin", "System Admin"),
      demoUser("supervisor", "super123", "Supervisor", "EVS Supervisor"),
      demoUser("manager", "manager123", "Manager", "EVS Manager"),
      demoUser("inspector", "inspect123", "Inspector", "Demo Inspector")
    ];
    let changed = false;
    for (const demo of demos) {
      if (!users.some((user) => user.username === demo.username)) {
        users.push(demo);
        changed = true;
      }
    }
    if (changed || !users.length) await writeJson(usersFile, users);
  } else if (!users.length) {
    // Production with empty users.json — write empty array to ensure file exists.
    await writeJson(usersFile, users);
  }

  return users;
}

export async function readUsers() {
  return ensureUsersStore();
}

export async function findUserByUsername(username) {
  const users = await readUsers();
  return users.find((user) => user.username.toLowerCase() === String(username).toLowerCase());
}

export async function findUserById(id) {
  const users = await readUsers();
  return users.find((user) => user.id === id);
}

export async function listPublicUsers() {
  return (await readUsers()).map(publicUser);
}

export async function createUser(data) {
  const users = await readUsers();
  if (!data.username || !data.password || !roles.includes(data.role)) throw new Error("Username, password, and valid role are required.");
  if (users.some((user) => user.username.toLowerCase() === data.username.toLowerCase())) throw new Error("Username already exists.");
  const { salt, hash } = hashPassword(data.password);
  const user = {
    id: crypto.randomUUID(),
    username: data.username,
    name: (data.name || "").trim() || data.username,
    role: data.role,
    active: data.active !== false,
    assignedLocations: data.assignedLocations || [],
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  await writeJson(usersFile, users);
  return publicUser(user);
}

export async function updateUser(id, data) {
  const users = await readUsers();
  const user = users.find((item) => item.id === id);
  if (!user) throw new Error("User not found.");
  if (data.name !== undefined) user.name = data.name;
  if (data.role !== undefined) {
    if (!roles.includes(data.role)) throw new Error("Invalid role.");
    user.role = data.role;
  }
  if (data.active !== undefined) user.active = Boolean(data.active);
  if (data.assignedLocations !== undefined) user.assignedLocations = Array.isArray(data.assignedLocations) ? data.assignedLocations : [];
  await writeJson(usersFile, users);
  return publicUser(user);
}

export async function resetPassword(id, password) {
  const users = await readUsers();
  const user = users.find((item) => item.id === id);
  if (!user) throw new Error("User not found.");
  const { salt, hash } = hashPassword(password);
  user.passwordSalt = salt;
  user.passwordHash = hash;
  await writeJson(usersFile, users);
  return publicUser(user);
}

export function toPublicUser(user) {
  return publicUser(user);
}
