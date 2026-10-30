import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createCorsMiddleware } from "./cors";
import { clearLegacySessionCookie } from "./cookies";
import { checkOutKeygenMachine, heartbeatKeygenMachine, validateKeygenLicenseKey } from "../keygen";
import { issueLicenseSession, setLicenseSessionCookie } from "./license-session";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(createCorsMiddleware());
  app.use(clearLegacySessionCookie());

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });
  const KAPPONI_APP_SLUG = "kapponi-v10";
  app.get("/api/android/config/stirlax-modz-lg-v49", (_req, res) => {
    res.json({ ok: true, apiVersion: 2, panel: "AlkaponeDollar", licensing: "keygen", requiresUsername: true, requiresLicense: true });
  });
  app.get("/api/android/config/kapponi-v10", (_req, res) => {
    res.json({ ok: true, apiVersion: 2, appSlug: KAPPONI_APP_SLUG, appName: "Kapponi V.10", licensing: "keygen", requiresUsername: true, requiresLicense: true, monitoring: true });
  });
  app.post("/api/android/validate", async (req, res) => {
    const appSlug = String(req.body?.appSlug ?? "").trim().toLowerCase();
    if (appSlug !== KAPPONI_APP_SLUG) return res.status(400).json({ valid: false, success: false, ok: false, code: "UNKNOWN_APP", message: "Aplicación no registrada en este panel." });
    const requestedUsername = String(req.body?.username ?? req.body?.user ?? req.body?.name ?? "").trim();
    const key = String(req.body?.key ?? req.body?.license ?? req.body?.licenseKey ?? "").trim();
    if (!key) return res.status(400).json({ valid: false, success: false, ok: false, code: "INVALID", message: "La licencia es obligatoria." });
    try {
      const result = await validateKeygenLicenseKey({ username: requestedUsername || undefined, key });
      if (!result.valid || !result.license) return res.status(401).json({ valid: false, success: false, ok: false, code: "INVALID", reason: result.reason, message: "El username o la licencia no son válidos." });
      const username = requestedUsername || result.license.name;
      const session = issueLicenseSession({ username, licenseId: result.license.id, licenseName: result.license.name });
      setLicenseSessionCookie(res, session);
      let machine: { id: string; name: string } | null = null;
      let monitoring = true;
      const fingerprint = String(req.body?.fingerprint ?? req.body?.deviceId ?? "").trim();
      if (fingerprint) {
        try {
          machine = await checkOutKeygenMachine({ licenseId: result.license.id, fingerprint, name: String(req.body?.deviceName ?? "Kapponi V.10"), platform: String(req.body?.platform ?? "Android") });
        } catch {
          monitoring = false;
        }
      }
      return res.json({ valid: true, success: true, ok: true, code: "VALID", authenticated: true, username, license: result.license, sessionToken: session.token, machine, monitoring });
    } catch (error) {
      return res.status(502).json({ valid: false, success: false, ok: false, code: "KEYGEN_UNAVAILABLE", message: error instanceof Error ? error.message : "No fue posible verificar la licencia." });
    }
  });
  app.post("/api/android/heartbeat", async (req, res) => {
    const machineId = String(req.body?.machineId ?? req.body?.machine_id ?? "").trim();
    if (!machineId) return res.status(400).json({ ok: false, message: "machineId es obligatorio." });
    try {
      return res.json(await heartbeatKeygenMachine(machineId));
    } catch (error) {
      return res.status(502).json({ ok: false, message: error instanceof Error ? error.message : "No fue posible registrar el heartbeat." });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const port = parseInt(process.env.PORT || "3000");
  server.listen(port, () => {
    console.log("[api] server listening");
  });
}

startServer().catch(() => {
  console.error("[api] server failed to start");
});
