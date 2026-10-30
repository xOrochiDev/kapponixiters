import crypto from "node:crypto";
import type { Request, Response } from "express";

export type LicenseSession = {
  token: string;
  username: string;
  licenseId: string;
  licenseName: string;
  createdAt: number;
  expiresAt: number;
};

const COOKIE_NAME = "alkapone_license_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const sessions = new Map<string, LicenseSession>();

function prune() {
  const now = Date.now();
  for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
}

export function issueLicenseSession(input: { username: string; licenseId: string; licenseName: string }): LicenseSession {
  prune();
  const now = Date.now();
  const session: LicenseSession = {
    token: crypto.randomBytes(32).toString("base64url"),
    username: input.username,
    licenseId: input.licenseId,
    licenseName: input.licenseName,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  sessions.set(session.token, session);
  return session;
}

function cookieValue(header: string | undefined, name: string) {
  const item = (header ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : undefined;
}

export function getLicenseSession(req: Request): LicenseSession | null {
  prune();
  const bearer = req.headers.authorization?.match(/^License\s+(.+)$/i)?.[1];
  const token = bearer || cookieValue(req.headers.cookie, COOKIE_NAME);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) sessions.delete(token);
    return null;
  }
  return session;
}

export function setLicenseSessionCookie(res: Response, session: LicenseSession) {
  const publicHttps = process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(session.token)}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; Path=/; HttpOnly; SameSite=${publicHttps ? "None" : "Lax"}${publicHttps ? "; Secure" : ""}`);
}

export function clearLicenseSessionCookie(res: Response) {
  const publicHttps = process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=${publicHttps ? "None" : "Lax"}${publicHttps ? "; Secure" : ""}`);
}

export function revokeLicenseSession(req: Request) {
  const session = getLicenseSession(req);
  if (session) sessions.delete(session.token);
}

export const licenseSessionCookieName = COOKIE_NAME;
