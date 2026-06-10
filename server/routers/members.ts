import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { normalizePage, computePageMeta } from "../pagination";
import {
  addContactLog,
  createMember,
  deleteMember,
  getActivistOptions,
  getContactLog,
  getFilterOptions,
  getMemberById,
  getMembers,
  countMembers,
  recordAudit,
  setSupportLevel,
  setVoteStatus,
  updateFamilyEvents,
  updateMember,
} from "../db";

const familyEventSchema = z.object({
  type: z.string().default(""),
  date: z.string().default(""),
  description: z.string().default(""),
});

const SUPPORT_LEVELS = ["תומך", "נוטה", "מתלבט", "מתנגד", "לא ידוע"] as const;
const VOTE_STATUSES = ["טרם הצביע", "הצביע"] as const;

const memberInputSchema = z.object({
  fullName: z.string().min(1, "חסר שם מלא"),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  birthday: z.string().nullable().optional(),
  familyEvents: z.array(familyEventSchema).optional(),
  partyStatus: z.string().nullable().optional(),
  activistsCount: z.number().int().nonnegative().nullable().optional(),
  supportLevel: z.enum(SUPPORT_LEVELS).nullable().optional(),
  voteStatus: z.enum(VOTE_STATUSES).nullable().optional(),
  assignedActivist: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.string().nullable().optional(),
  lastContactDate: z.string().nullable().optional(),
});

export const membersRouter = router({
  // Paginated members list. Returns a single page of results plus the total
  // count so the UI can show "X of N" and load more. Essential now that the
  // table can hold tens of thousands of rows — returning everything at once
  // produced a huge response that failed on the live gateway.
  list: protectedProcedure
    .input(
      z
        .object({
          q: z.string().optional(),
          region: z.string().optional(),
          city: z.string().optional(),
          status: z.string().optional(),
          tag: z.string().optional(),
          contacted: z.enum(["recent7", "recent30", "over30", "never", ""]).optional(),
          upcoming: z.number().int().optional(),
          source: z.enum(["manual", "import", ""]).optional(),
          support: z.string().optional(),
          vote: z.enum(["הצביע", "טרם הצביע", ""]).optional(),
          activist: z.string().optional(),
          sort: z.enum(["name", "recent", "activists"]).optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const f = input ?? ({} as NonNullable<typeof input>);
      const { page, pageSize, offset } = normalizePage(f.page, f.pageSize);
      const inMemoryFilter = !!(f.upcoming && f.upcoming > 0);
      const [items, total] = await Promise.all([
        getMembers({ ...f, limit: pageSize, offset }),
        inMemoryFilter ? Promise.resolve(0) : countMembers(f),
      ]);
      const meta = computePageMeta({
        page,
        pageSize,
        itemsLength: items.length,
        total,
        inMemoryFilter,
      });
      return { items, ...meta };
    }),

  filterOptions: protectedProcedure.query(() => getFilterOptions()),

  activistOptions: protectedProcedure.query(() => getActivistOptions()),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const member = await getMemberById(input.id);
      if (!member) return null;
      const log = await getContactLog(input.id);
      // Audit: viewing a sensitive personal record. Fire-and-forget so the
      // audit INSERT never blocks returning the member card (perf).
      void recordAudit({
        actorOpenId: ctx.user.openId,
        actorName: ctx.user.name,
        action: "view",
        entity: "member",
        entityId: input.id,
        detail: `צפייה בכרטיס ${member.fullName}`,
      }).catch(() => {});
      return { ...member, contactLog: log };
    }),

  create: protectedProcedure.input(memberInputSchema).mutation(async ({ input, ctx }) => {
    const id = await createMember(input);
    await recordAudit({
      actorOpenId: ctx.user.openId,
      actorName: ctx.user.name,
      action: "create",
      entity: "member",
      entityId: id,
      detail: `יצירת חבר: ${input.fullName}`,
    });
    return { id, ok: true };
  }),

  update: protectedProcedure
    .input(z.object({ id: z.number().int(), data: memberInputSchema.partial() }))
    .mutation(async ({ input, ctx }) => {
      const member = await updateMember(input.id, input.data);
      await recordAudit({
        actorOpenId: ctx.user.openId,
        actorName: ctx.user.name,
        action: "update",
        entity: "member",
        entityId: input.id,
        detail: `עדכון שדות: ${Object.keys(input.data).join(", ")}`,
      });
      return member ?? null;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await getMemberById(input.id);
      await deleteMember(input.id);
      await recordAudit({
        actorOpenId: ctx.user.openId,
        actorName: ctx.user.name,
        action: "delete",
        entity: "member",
        entityId: input.id,
        detail: `מחיקת חבר: ${existing?.fullName ?? input.id}`,
      });
      return { ok: true };
    }),

  setSupport: protectedProcedure
    .input(z.object({ id: z.number().int(), level: z.enum(SUPPORT_LEVELS) }))
    .mutation(async ({ input, ctx }) => {
      const result = await setSupportLevel(input.id, input.level);
      await recordAudit({
        actorOpenId: ctx.user.openId,
        actorName: ctx.user.name,
        action: "update",
        entity: "member",
        entityId: input.id,
        detail: `עמדת תמיכה: ${result.supportLevel}`,
      });
      return result;
    }),

  setVote: protectedProcedure
    .input(z.object({ id: z.number().int(), voted: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const result = await setVoteStatus(input.id, input.voted);
      await recordAudit({
        actorOpenId: ctx.user.openId,
        actorName: ctx.user.name,
        action: "vote",
        entity: "member",
        entityId: input.id,
        detail: `סימון: ${result.voteStatus}`,
      });
      return result;
    }),

  updateFamilyEvents: protectedProcedure
    .input(z.object({ id: z.number().int(), events: z.array(familyEventSchema) }))
    .mutation(async ({ input }) => {
      const events = await updateFamilyEvents(input.id, input.events);
      return { ok: true, familyEvents: events };
    }),

  addContactLog: protectedProcedure
    .input(
      z.object({
        memberId: z.number().int(),
        date: z.string().optional(),
        channel: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const id = await addContactLog(input);
      return { id, ok: true };
    }),

  contactLog: protectedProcedure
    .input(z.object({ memberId: z.number().int() }))
    .query(({ input }) => getContactLog(input.memberId)),
});
