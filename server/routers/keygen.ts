import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  changeKeygenLicensePolicy,
  checkOutKeygenMachine,
  checkKeygenConnection,
  createKeygenPolicy,
  createKeygenProductToken,
  createKeygenLicense,
  createKeygenProduct,
  deactivateKeygenMachine,
  getKeygenLicenseDetails,
  heartbeatKeygenMachine,
  KeygenFailure,
  listKeygenEventLogs,
  listKeygenLicenses,
  listKeygenMachines,
  listKeygenPolicies,
  listKeygenProductTokens,
  listKeygenProducts,
  revokeKeygenToken,
  setKeygenLicenseSuspended,
  setKeygenLicenseUsage,
  updateKeygenLicense,
  updateKeygenProduct,
  validateKeygenLicenseKey,
  type KeygenLicenseEditableAttributes,
} from "../keygen";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { issueLicenseSession, setLicenseSessionCookie } from "../_core/license-session";

function mapKeygenError(error: unknown): never {
  if (error instanceof KeygenFailure) {
    const code = error.kind === "not_configured" ? "PRECONDITION_FAILED"
      : error.kind === "forbidden" ? "FORBIDDEN"
        : error.kind === "invalid_request" ? "BAD_REQUEST"
          : "BAD_GATEWAY";
    throw new TRPCError({ code, message: error.message });
  }
  throw new TRPCError({ code: "BAD_GATEWAY", message: "No fue posible completar la operación con Keygen." });
}

const licenseId = z.string().trim().min(1).max(128);
const productId = z.string().trim().min(1).max(128);
const boundedLimit = z.number().int().min(0).max(2_147_483_647).nullable();
const byteLimit = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable();
const productTokenPermission = z.enum([
  "license.validate",
  "license.read",
  "license.create",
  "machine.create",
  "machine.read",
  "machine.delete",
  "machine.check-out",
]);

const keygenLoginAttempts = new Map<string, { count: number; resetAt: number }>();
function enforceLoginAttemptLimit(ip: string) {
  const now = Date.now();
  if (keygenLoginAttempts.size > 1_000) {
    for (const [address, attempt] of keygenLoginAttempts) if (attempt.resetAt <= now) keygenLoginAttempts.delete(address);
  }
  const attempt = keygenLoginAttempts.get(ip);
  if (!attempt || attempt.resetAt <= now) {
    keygenLoginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60_000 });
    return;
  }
  if (attempt.count >= 8) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." });
  attempt.count += 1;
}

const editableLicenseSchema = z.object({
  id: licenseId,
  name: z.string().trim().min(1).max(100),
  expiry: z.string().datetime().nullable(),
  protected: z.boolean(),
  maxMachines: boundedLimit,
  maxProcesses: boundedLimit,
  maxUsers: boundedLimit,
  maxCores: boundedLimit,
  maxMemory: byteLimit,
  maxDisk: byteLimit,
  maxUses: boundedLimit,
  permissions: z.array(z.string().trim().min(1).max(128)).max(100),
  metadata: z.record(z.string(), z.unknown()),
});

export const keygenRouter = router({
  validateLicenseKey: publicProcedure
    .input(z.object({ username: z.string().trim().min(1).max(100), key: z.string().trim().min(8).max(512) }))
    .mutation(async ({ ctx, input }) => {
      const remoteAddress = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
      enforceLoginAttemptLimit(remoteAddress);
      try {
        const result = await validateKeygenLicenseKey(input);
        if (result.valid && result.license) {
          const session = issueLicenseSession({ username: input.username, licenseId: result.license.id, licenseName: result.license.name });
          setLicenseSessionCookie(ctx.res, session);
          return { ...result, sessionToken: session.token };
        }
        return result;
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  checkOutMachine: publicProcedure
    .input(z.object({ username: z.string().trim().min(1).max(100), key: z.string().trim().min(8).max(512), fingerprint: z.string().trim().min(8).max(512), name: z.string().trim().min(1).max(120), platform: z.string().trim().min(1).max(80) }))
    .mutation(async ({ input }) => {
      try {
        const checked = await validateKeygenLicenseKey(input);
        if (!checked.valid || !checked.license) return { valid: false, reason: checked.reason };
        const machine = await checkOutKeygenMachine({ licenseId: checked.license.id, fingerprint: input.fingerprint, name: input.name, platform: input.platform });
        return { valid: true, machine };
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  heartbeat: publicProcedure
    .input(z.object({ machineId: licenseId }))
    .mutation(async ({ input }) => {
      try {
        return await heartbeatKeygenMachine(input.machineId);
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  status: protectedProcedure.query(async () => checkKeygenConnection()),
  products: protectedProcedure.query(async () => {
    try {
      return await listKeygenProducts();
    } catch (error) {
      return mapKeygenError(error);
    }
  }),
  policies: protectedProcedure
    .input(z.object({ productId: z.string().trim().min(1).max(128).optional() }))
    .query(async ({ input }) => {
      try {
        return await listKeygenPolicies(input.productId);
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  licenses: protectedProcedure.query(async () => {
    try {
      return await listKeygenLicenses();
    } catch (error) {
      return mapKeygenError(error);
    }
  }),
  licenseDetails: protectedProcedure
    .input(z.object({ id: licenseId }))
    .query(async ({ input }) => {
      try {
        return await getKeygenLicenseDetails(input.id);
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  machines: protectedProcedure.query(async () => {
    try {
      return await listKeygenMachines();
    } catch (error) {
      return mapKeygenError(error);
    }
  }),
  events: protectedProcedure.query(async () => {
    try {
      return { available: true, events: await listKeygenEventLogs() };
    } catch (error) {
      if (error instanceof KeygenFailure && (error.kind === "forbidden" || error.kind === "unavailable")) {
        return { available: false, events: [], message: "No pudimos consultar Event Logs de Keygen. La función es Beta y requiere permiso event-log.read; verifica si está habilitada en tu cuenta y vuelve a intentar." };
      }
      return mapKeygenError(error);
    }
  }),
  deactivateMachine: protectedProcedure
    .input(z.object({ id: licenseId }))
    .mutation(async ({ input }) => {
      try {
        await deactivateKeygenMachine(input.id);
        return { success: true };
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  createProduct: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        code: z.string().trim().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        url: z.string().trim().url().max(300).optional().or(z.literal("")),
        platforms: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
        distributionStrategy: z.enum(["LICENSED", "OPEN", "CLOSED"]).default("LICENSED"),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await createKeygenProduct(input);
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  updateProduct: protectedProcedure
    .input(z.object({
      id: productId,
      name: z.string().trim().min(1).max(100),
      code: z.string().trim().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      url: z.string().trim().url().max(300).optional().or(z.literal("")),
      platforms: z.array(z.string().trim().min(1).max(50)).max(20),
      distributionStrategy: z.enum(["LICENSED", "OPEN", "CLOSED"]),
    }))
    .mutation(async ({ input }) => {
      try {
        return await updateKeygenProduct(input);
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  createPolicy: protectedProcedure
    .input(z.object({
      name: z.string().trim().min(1).max(100),
      productId,
      durationSeconds: z.number().int().positive().max(3_153_600_000).nullable(),
      maxMachines: boundedLimit,
      maxUses: boundedLimit,
      floating: z.boolean(),
      strict: z.boolean(),
      requireHeartbeat: z.boolean(),
      requireCheckIn: z.boolean(),
      checkInInterval: z.enum(["day", "week", "month", "year"]),
      checkInIntervalCount: z.number().int().min(1).max(365),
      authenticationStrategy: z.enum(["TOKEN", "LICENSE", "MIXED", "NONE"]),
      expirationBasis: z.enum(["FROM_CREATION", "FROM_FIRST_VALIDATION", "FROM_FIRST_ACTIVATION"]),
      scheme: z.enum(["ED25519_SIGN"]).nullable(),
    }))
    .mutation(async ({ input }) => {
      try {
        return await createKeygenPolicy(input);
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  productTokens: protectedProcedure
    .input(z.object({ productId }))
    .query(async ({ input }) => {
      try {
        return await listKeygenProductTokens(input.productId);
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  createProductToken: protectedProcedure
    .input(z.object({
      productId,
      name: z.string().trim().min(1).max(100),
      permissions: z.array(productTokenPermission).min(1).max(7),
      expiry: z.string().datetime().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        return await createKeygenProductToken(input);
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  revokeToken: protectedProcedure
    .input(z.object({ id: licenseId }))
    .mutation(async ({ input }) => {
      try {
        await revokeKeygenToken(input.id);
        return { success: true };
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  createLicense: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        policyId: z.string().trim().min(1).max(128),
        maxMachines: z.number().int().positive().max(100_000).optional(),
        maxUses: z.number().int().nonnegative().max(2_147_483_647).optional(),
        expiry: z.string().datetime().nullable().optional(),
        reference: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await createKeygenLicense(input);
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  updateLicense: protectedProcedure
    .input(editableLicenseSchema)
    .mutation(async ({ input }) => {
      try {
        const { id, ...attributes } = input;
        return await updateKeygenLicense(id, attributes as KeygenLicenseEditableAttributes);
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  changeLicensePolicy: protectedProcedure
    .input(z.object({ id: licenseId, policyId: licenseId }))
    .mutation(async ({ input }) => {
      try {
        return await changeKeygenLicensePolicy(input.id, input.policyId);
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  setLicenseUsage: protectedProcedure
    .input(z.object({
      id: licenseId,
      action: z.enum(["increment", "decrement", "reset"]),
      amount: z.number().int().positive().max(1_000_000).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        await setKeygenLicenseUsage(input.id, input.action, input.amount ?? 1);
        return { success: true };
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
  setLicenseSuspended: protectedProcedure
    .input(z.object({ id: licenseId, suspended: z.boolean() }))
    .mutation(async ({ input }) => {
      try {
        return await setKeygenLicenseSuspended(input.id, input.suspended);
      } catch (error) {
        return mapKeygenError(error);
      }
    }),
});
