import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getAuditLog, getNeedsContact, getStats, getUpcomingEvents } from "../db";

export const eventsRouter = router({
  upcoming: protectedProcedure
    .input(z.object({ days: z.number().int().positive().default(30) }).optional())
    .query(({ input }) => getUpcomingEvents(input?.days ?? 30)),

  needsContact: protectedProcedure
    .input(z.object({ days: z.number().int().positive().default(30) }).optional())
    .query(({ input }) => getNeedsContact(input?.days ?? 30)),
});

export const statsRouter = router({
  dashboard: protectedProcedure.query(() => getStats()),

  // Sensitive: only admins may inspect the audit trail.
  auditLog: protectedProcedure
    .input(z.object({ limit: z.number().int().positive().max(500).default(200) }).optional())
    .query(({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "גישה למנהלים בלבד" });
      }
      return getAuditLog(input?.limit ?? 200);
    }),
});
