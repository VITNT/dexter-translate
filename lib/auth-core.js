import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export class AuthValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "AuthValidationError";
    this.field = field;
  }
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function validateEmail(value) {
  const email = normalizeEmail(value);
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new AuthValidationError("Enter a valid email address.", "email");
  }
  return email;
}

export function validateName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) {
    throw new AuthValidationError("Name must be between 2 and 60 characters.", "name");
  }
  return name;
}

export function validatePassword(value) {
  const password = String(value || "");
  if (password.length < 8) {
    throw new AuthValidationError("Password must be at least 8 characters.", "password");
  }
  if (password.length > 128) {
    throw new AuthValidationError("Password must be 128 characters or fewer.", "password");
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new AuthValidationError("Password must include a letter and a number.", "password");
  }
  return password;
}

export function accountPathname(email) {
  const digest = createHash("sha256").update(normalizeEmail(email)).digest("hex");
  return `dexter-auth/accounts/v1/${digest}.json`;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return {
    algorithm: "scrypt",
    salt: salt.toString("base64url"),
    hash: Buffer.from(derived).toString("base64url")
  };
}

export async function verifyPassword(password, stored) {
  if (!stored || stored.algorithm !== "scrypt" || !stored.salt || !stored.hash) return false;
  const expected = Buffer.from(stored.hash, "base64url");
  const actual = Buffer.from(
    await scrypt(password, Buffer.from(stored.salt, "base64url"), expected.length)
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken(user, secret, now = Date.now()) {
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters.");
  }

  const issuedAt = Math.floor(now / 1000);
  const payload = encode({
    sub: user.id,
    name: user.name,
    email: user.email,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS
  });
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token, secret, now = Date.now()) {
  if (!token || !secret || secret.length < 32) return null;
  const [payload, signature, extra] = String(token).split(".");
  if (!payload || !signature || extra) return null;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.sub || !session.email || session.exp <= Math.floor(now / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function safeNextPath(value, fallback = "/translate") {
  const path = String(value || "");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  return path;
}

export const sessionMaxAge = SESSION_TTL_SECONDS;
