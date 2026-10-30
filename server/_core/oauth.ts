import { ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import { getUserByOpenId, upsertUser } from "../db";
import {
  getSessionCookieName,
  getSessionCookieOptions,
} from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { getLicenseSession } from "./license-session";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function expectedWebCallback(): string {
  const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!apiBase) throw new Error("OAuth API origin is not configured");
  return `${new URL(apiBase).origin}/api/oauth/callback`;
}

function decodeState(state: string): { redirectUri: string; nonce: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf8")) as {
      redirectUri?: unknown;
      nonce?: unknown;
    };
    if (typeof decoded.redirectUri === "string" && typeof decoded.nonce === "string") {
      return { redirectUri: decoded.redirectUri, nonce: decoded.nonce };
    }
  } catch {
    return null;
  }
  return null;
}

function validNonce(expected: string, supplied: string | undefined): boolean {
  if (!supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

async function syncUser(userInfo: {
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  platform?: string | null;
}) {
  if (!userInfo.openId) throw new Error("openId missing from user info");

  const lastSignedIn = new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn,
  });
  const saved = await getUserByOpenId(userInfo.openId);
  return (
    saved ?? {
      openId: userInfo.openId,
      name: userInfo.name,
      email: userInfo.email,
      loginMethod: userInfo.loginMethod ?? null,
      lastSignedIn,
    }
  );
}

function buildUserResponse(
  user:
    | Awaited<ReturnType<typeof getUserByOpenId>>
    | {
        openId: string;
        name?: string | null;
        email?: string | null;
        loginMethod?: string | null;
        lastSignedIn?: Date | null;
      },
) {
  return {
    id: (user as any)?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
  };
}

function panelOwnerCheck(userInfo: { openId?: string | null; email?: string | null }) {
  const ownerOpenId = ENV.ownerOpenId.trim();
  const ownerEmail = ENV.panelOwnerEmail.trim().toLowerCase();
  if (!ownerOpenId && !ownerEmail) return "not_configured" as const;
  if (ownerOpenId && userInfo.openId !== ownerOpenId) return "forbidden" as const;
  if (ownerEmail && userInfo.email?.trim().toLowerCase() !== ownerEmail) return "forbidden" as const;
  return "allowed" as const;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/start", (_req: Request, res: Response) => {
    try {
      const portal =
        process.env.MANUS_OAUTH_PORTAL_URL ||
        process.env.VITE_OAUTH_PORTAL_URL ||
        process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL;
      const appId =
        process.env.MANUS_PROJECT_ID || process.env.VITE_APP_ID || process.env.EXPO_PUBLIC_APP_ID;
      const redirectUri = expectedWebCallback();
      if (!portal || !appId) {
        res.status(503).json({ error: "Manus login is not configured" });
        return;
      }

      const nonce = randomBytes(32).toString("base64url");
      const state = Buffer.from(JSON.stringify({ redirectUri, nonce }), "utf8").toString("base64");
      res.cookie("webdev_oauth_state", nonce, {
        httpOnly: true,
        path: "/api/oauth",
        sameSite: "none",
        secure: true,
        maxAge: 5 * 60 * 1000,
      });
      const loginUrl = new URL(`${portal.replace(/\/$/, "")}/app-auth`);
      loginUrl.searchParams.set("appId", appId);
      loginUrl.searchParams.set("redirectUri", redirectUri);
      loginUrl.searchParams.set("state", state);
      loginUrl.searchParams.set("type", "signIn");
      res.redirect(302, loginUrl.toString());
    } catch {
      res.status(503).json({ error: "Manus login could not be started" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    const statePayload = decodeState(state);
    const stateCookie = parseCookieHeader(req.headers.cookie ?? "")["webdev_oauth_state"];
    let configuredCallback = "";
    try {
      configuredCallback = expectedWebCallback();
    } catch {
      res.status(503).json({ error: "OAuth callback is not configured" });
      return;
    }
    if (
      !statePayload ||
      statePayload.redirectUri !== configuredCallback ||
      !validNonce(statePayload.nonce, stateCookie)
    ) {
      res.clearCookie("webdev_oauth_state", {
        httpOnly: true,
        path: "/api/oauth",
        sameSite: "none",
        secure: true,
      });
      res.status(403).json({ error: "OAuth state validation failed" });
      return;
    }
    res.clearCookie("webdev_oauth_state", {
      httpOnly: true,
      path: "/api/oauth",
      sameSite: "none",
      secure: true,
    });

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const ownerCheck = panelOwnerCheck(userInfo);
      if (ownerCheck === "not_configured") {
        res.status(503).json({ error: "Panel owner access is not configured" });
        return;
      }
      if (ownerCheck === "forbidden") {
        res.status(403).json({ error: "This personal panel is restricted to its owner" });
        return;
      }
      await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(getSessionCookieName(req), sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      const frontendUrl =
        process.env.EXPO_WEB_PREVIEW_URL ||
        process.env.EXPO_PACKAGER_PROXY_URL ||
        "http://localhost:8081";
      res.redirect(302, frontendUrl);
    } catch {
      console.error("[OAuth] Callback failed");
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  app.get("/api/oauth/mobile", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const ownerCheck = panelOwnerCheck(userInfo);
      if (ownerCheck === "not_configured") {
        res.status(503).json({ error: "Panel owner access is not configured" });
        return;
      }
      if (ownerCheck === "forbidden") {
        res.status(403).json({ error: "This personal panel is restricted to its owner" });
        return;
      }
      const user = await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(getSessionCookieName(req), sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });
      res.json({ app_session_id: sessionToken, user: buildUserResponse(user) });
    } catch {
      console.error("[OAuth] Mobile exchange failed");
      res.status(500).json({ error: "OAuth mobile exchange failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(getSessionCookieName(req), {
      ...cookieOptions,
      maxAge: -1,
    });
    res.json({ success: true });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch {
      const license = getLicenseSession(req);
      if (license) {
        res.json({
          user: buildUserResponse({
            openId: `license:${license.licenseId}`,
            name: license.username,
            email: null,
            loginMethod: "keygen-license",
            lastSignedIn: new Date(license.createdAt),
          }),
        });
        return;
      }
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(getSessionCookieName(req), token, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });
      res.json({ success: true, user: buildUserResponse(user) });
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  });
}
