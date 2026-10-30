import {
  getSessionCookieName,
  getSessionCookieOptions,
} from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { keygenRouter } from "./routers/keygen";
import { clearLicenseSessionCookie, revokeLicenseSession } from "./_core/license-session";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  keygen: keygenRouter,
  auth: router({
    me: publicProcedure.query((opts) => {
      if (opts.ctx.user) return opts.ctx.user;
      const session = opts.ctx.licenseSession;
      if (!session) return null;
      return {
        id: 0,
        openId: `license:${session.licenseId}`,
        name: session.username,
        email: null,
        loginMethod: "keygen-license",
        role: "user" as const,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.createdAt),
        lastSignedIn: new Date(session.createdAt),
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      revokeLicenseSession(ctx.req);
      clearLicenseSessionCookie(ctx.res);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(getSessionCookieName(ctx.req), {
        ...cookieOptions,
        maxAge: -1,
      });
      return {
        success: true,
      } as const;
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
