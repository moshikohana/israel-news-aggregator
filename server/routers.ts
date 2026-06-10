import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { membersRouter } from "./routers/members";
import { eventsRouter, statsRouter } from "./routers/events";
import { chatRouter } from "./routers/chat";
import { importRouter } from "./routers/importRouter";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  members: membersRouter,
  events: eventsRouter,
  stats: statsRouter,
  chat: chatRouter,
  import: importRouter,
});

export type AppRouter = typeof appRouter;
