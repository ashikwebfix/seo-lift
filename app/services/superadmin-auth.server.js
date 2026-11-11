import crypto from "node:crypto";
import { redirect } from "react-router";
import prisma from "../db.server.js";

const COOKIE_NAME = "ecomseo_superadmin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const FIXED_SUPERADMIN = Object.freeze({
  username: (process.env.SUPERADMIN_USERNAME || "ecomfixr").trim().toLowerCase(),
  name: "EcomFixr SuperAdmin",
  password: process.env.SUPERADMIN_PASSWORD || "ecomfixr@2026",
  role: "OWNER",
});

function normalizeIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidIdentifier(identifier) {
  return /^[a-z0-9._@+-]{3,100}$/.test(identifier);
}

export function hashPassword(password) {
  const clean = String(password || "");
  if (clean.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(clean, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  const clean = String(password || "");
  const parts = String(storedHash || "").split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;

  try {
    const keyBuffer = Buffer.from(keyHex, "hex");
    const derived = crypto.scryptSync(clean, salt, 64);
    if (keyBuffer.length !== derived.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derived);
  } catch {
    return false;
  }
}

function hashSessionToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken || "")).digest("hex");
}

function parseCookies(cookieHeader) {
  const result = {};
  if (!cookieHeader) return result;
  for (const part of String(cookieHeader).split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function buildCookieHeader(value, maxAgeSeconds, request, cookiePath = "/") {
  const isHttps =
    request?.url?.startsWith("https://") ||
    request?.headers?.get?.("x-forwarded-proto") === "https";
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    `Path=${cookiePath}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isHttps) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    isFixed: user.email === FIXED_SUPERADMIN.username,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export async function ensureFixedSuperAdmin() {
  const existing = await prisma.superAdminUser.findUnique({
    where: { email: FIXED_SUPERADMIN.username },
  });

  if (!existing) {
    const created = await prisma.superAdminUser.create({
      data: {
        email: FIXED_SUPERADMIN.username,
        name: FIXED_SUPERADMIN.name,
        passwordHash: hashPassword(FIXED_SUPERADMIN.password),
        role: FIXED_SUPERADMIN.role,
        isActive: true,
      },
    });
    return sanitizeUser(created);
  }

  const needsSync =
    !existing.isActive ||
    existing.role !== FIXED_SUPERADMIN.role ||
    !verifyPassword(FIXED_SUPERADMIN.password, existing.passwordHash);

  if (needsSync) {
    const updated = await prisma.superAdminUser.update({
      where: { id: existing.id },
      data: {
        name: existing.name || FIXED_SUPERADMIN.name,
        role: FIXED_SUPERADMIN.role,
        isActive: true,
        passwordHash: hashPassword(FIXED_SUPERADMIN.password),
      },
    });
    return sanitizeUser(updated);
  }

  return sanitizeUser(existing);
}

export async function getSuperAdminCount() {
  await ensureFixedSuperAdmin();
  return prisma.superAdminUser.count();
}

export async function authenticateSuperAdmin({ username, email, password }) {
  await ensureFixedSuperAdmin();

  const cleanIdentifier = normalizeIdentifier(username || email);
  if (!cleanIdentifier || !password) {
    throw new Error("Username and password are required.");
  }

  const user = await prisma.superAdminUser.findUnique({
    where: { email: cleanIdentifier },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Invalid username or password.");
  }

  if (!user.isActive) {
    throw new Error("This SuperAdmin account has been disabled.");
  }

  return sanitizeUser(user);
}

export async function createSuperAdminSession(userId, request) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.$transaction([
    prisma.superAdminSession.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    }),
    prisma.superAdminSession.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    }),
    prisma.superAdminUser.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    }),
  ]);

  return buildCookieHeader(rawToken, Math.floor(SESSION_TTL_MS / 1000), request);
}

export async function getAuthenticatedSuperAdmin(request) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const rawToken = cookies[COOKIE_NAME];
  if (!rawToken) return null;

  const tokenHash = hashSessionToken(rawToken);
  const session = await prisma.superAdminSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || new Date() >= new Date(session.expiresAt) || !session.user?.isActive) {
    if (session) {
      await prisma.superAdminSession.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }

  return sanitizeUser(session.user);
}

export async function requireSuperAdmin(request) {
  const user = await getAuthenticatedSuperAdmin(request);
  if (!user) {
    throw redirect("/superadmin/login");
  }
  return user;
}

export function getSuperAdminCookieMigrationHeaders(request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/superadmin") || url.pathname.endsWith(".data")) {
    return [];
  }
  const cookies = parseCookies(request.headers.get("cookie"));
  const rawToken = cookies[COOKIE_NAME];
  if (!rawToken) return [];

  return [
    buildCookieHeader("", 0, request, "/superadmin"),
    buildCookieHeader(rawToken, Math.floor(SESSION_TTL_MS / 1000), request, "/"),
  ];
}

export async function destroySuperAdminSession(request) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const rawToken = cookies[COOKIE_NAME];
  if (rawToken) {
    const tokenHash = hashSessionToken(rawToken);
    await prisma.superAdminSession.deleteMany({ where: { tokenHash } }).catch(() => {});
  }
  return [
    buildCookieHeader("", 0, request, "/"),
    buildCookieHeader("", 0, request, "/superadmin"),
  ];
}

export async function listSuperAdminUsers() {
  await ensureFixedSuperAdmin();
  const users = await prisma.superAdminUser.findMany({
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
  });
  return users.map(sanitizeUser);
}

export async function createSuperAdminUser({ name, username, email, password, role = "ADMIN" }) {
  const cleanName = String(name || "").trim();
  const cleanIdentifier = normalizeIdentifier(username || email);
  const normalizedRole = String(role || "ADMIN").toUpperCase() === "OWNER" ? "OWNER" : "ADMIN";

  if (!cleanName || cleanName.length < 2) {
    throw new Error("Name must be at least 2 characters.");
  }
  if (!isValidIdentifier(cleanIdentifier)) {
    throw new Error("Username or email must be 3-100 valid characters without spaces.");
  }

  const existing = await prisma.superAdminUser.findUnique({
    where: { email: cleanIdentifier },
  });
  if (existing) {
    throw new Error("An admin user with this username or email already exists.");
  }

  const passwordHash = hashPassword(password);
  const created = await prisma.superAdminUser.create({
    data: {
      name: cleanName,
      email: cleanIdentifier,
      passwordHash,
      role: normalizedRole,
      isActive: true,
    },
  });

  return sanitizeUser(created);
}

export async function toggleSuperAdminStatus({ targetUserId, actingUserId, isActive }) {
  if (targetUserId === actingUserId && !isActive) {
    throw new Error("You cannot disable your own currently signed-in account.");
  }

  const target = await prisma.superAdminUser.findUnique({ where: { id: targetUserId } });
  if (!target) {
    throw new Error("Admin user not found.");
  }
  if (target.email === FIXED_SUPERADMIN.username && !isActive) {
    throw new Error("The fixed primary SuperAdmin account cannot be disabled.");
  }

  const updated = await prisma.superAdminUser.update({
    where: { id: targetUserId },
    data: { isActive: Boolean(isActive) },
  });

  if (!isActive) {
    await prisma.superAdminSession.deleteMany({ where: { userId: targetUserId } });
  }

  return sanitizeUser(updated);
}

export async function deleteSuperAdminUser({ targetUserId, actingUserId }) {
  if (targetUserId === actingUserId) {
    throw new Error("You cannot delete your own currently signed-in account.");
  }

  const target = await prisma.superAdminUser.findUnique({ where: { id: targetUserId } });
  if (!target) {
    throw new Error("Admin user not found.");
  }

  if (target.email === FIXED_SUPERADMIN.username) {
    throw new Error("The fixed primary SuperAdmin account cannot be deleted.");
  }

  if (target.role === "OWNER") {
    const ownerCount = await prisma.superAdminUser.count({
      where: { role: "OWNER", isActive: true },
    });
    if (ownerCount <= 1) {
      throw new Error("Cannot delete the last active OWNER account.");
    }
  }

  await prisma.superAdminUser.delete({ where: { id: targetUserId } });
  return { deleted: true };
}
