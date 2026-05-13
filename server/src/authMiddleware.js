import { findUserById, verifyToken } from "./authService.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ message: "Authentication required." });
  const user = await findUserById(payload.sub);
  if (!user || user.active === false) return res.status(401).json({ message: "Invalid or inactive user." });
  req.user = user;
  next();
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required." });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: "Permission denied." });
    next();
  };
}

export function canViewDashboard(role) {
  return ["Supervisor", "Manager", "Admin"].includes(role);
}

export function canExport(role) {
  return ["Manager", "Admin"].includes(role);
}

export function canAdmin(role) {
  return role === "Admin";
}
