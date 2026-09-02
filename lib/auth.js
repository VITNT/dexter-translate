import "server-only";

import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import {
  accountPathname,
  createSessionToken,
  hashPassword,
  normalizeEmail,
  sessionMaxAge,
  validateEmail,
  validateName,
  validatePassword,
  verifyPassword,
  verifySessionToken
} from "./auth-core";

export const sessionCookieName = "dexter_session";

export class AccountExistsError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "AccountExistsError";
  }
}

function authSecret() {
  return process.env.AUTH_SECRET || "";
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge
  };
}

async function streamJson(stream) {
  return new Response(stream).json();
}

export async function readAccount(email) {
  const record = await readAccountRecord(email);
  return record?.account || null;
}

export async function readAccountRecord(email) {
  const result = await get(accountPathname(email), {
    access: "private",
    useCache: false
  });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return {
    account: await streamJson(result.stream),
    etag: result.blob.etag
  };
}

export async function createAccount({ name: rawName, email: rawEmail, password: rawPassword }) {
  const name = validateName(rawName);
  const email = validateEmail(rawEmail);
  const password = validatePassword(rawPassword);
  const pathname = accountPathname(email);

  if (await readAccount(email)) throw new AccountExistsError();

  const account = {
    version: 1,
    id: randomUUID(),
    name,
    email,
    password: await hashPassword(password),
    billing: {
      plan: "free",
      status: "active",
      seats: 1,
      updatedAt: new Date().toISOString()
    },
    createdAt: new Date().toISOString()
  };

  try {
    await put(pathname, JSON.stringify(account), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json",
      cacheControlMaxAge: 60
    });
  } catch (error) {
    if (await readAccount(email)) throw new AccountExistsError();
    throw error;
  }

  return publicAccount(account);
}

export async function authenticateAccount(rawEmail, rawPassword) {
  const email = normalizeEmail(rawEmail);
  const password = String(rawPassword || "");
  if (!email || !password) return null;
  const account = await readAccount(email);
  if (!account || !(await verifyPassword(password, account.password))) return null;
  return publicAccount(account);
}

export function publicAccount(account) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    createdAt: account.createdAt,
    billing: publicBilling(account.billing)
  };
}

export function publicBilling(billing) {
  return {
    plan: billing?.plan || "free",
    status: billing?.status || "active",
    seats: Number(billing?.seats) || 1,
    currentPeriodEnd: billing?.currentPeriodEnd || null
  };
}

export async function updateAccount(email, update) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const record = await readAccountRecord(email);
    if (!record) return null;
    const nextAccount = await update(structuredClone(record.account));

    try {
      await put(accountPathname(email), JSON.stringify(nextAccount), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        ifMatch: record.etag,
        contentType: "application/json",
        cacheControlMaxAge: 60
      });
      return nextAccount;
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError) || attempt === 2) throw error;
    }
  }
  return null;
}

export async function getSessionAccount() {
  const session = await getSession();
  if (!session) return null;
  const account = await readAccount(session.email);
  if (!account || account.id !== session.sub) return null;
  return account;
}

export function issueSession(account) {
  return createSessionToken(account, authSecret());
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  return verifySessionToken(token, authSecret());
}

export function sameOriginRequest(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
