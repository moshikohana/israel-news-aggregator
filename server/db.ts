import { and, desc, eq, inArray, like, or, sql as drizzleSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  contactLog,
  InsertContactLog,
  InsertMember,
  members,
  importBatches,
  InsertImportBatch,
  InsertUser,
  users,
  auditLog,
  InsertAuditLog,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ---------------------------------------------------------------------------
// User helpers (auth)
// ---------------------------------------------------------------------------
// Pure decision: which role a user should get on upsert.
// - Explicit role wins (e.g. manual promotion).
// - Otherwise the configured owner (OWNER_OPEN_ID) is auto-assigned admin.
// - Everyone else stays undefined here (DB default 'user' applies on insert).
export function resolveUserRole(
  openId: string,
  explicitRole: string | undefined,
  ownerOpenId: string,
): "admin" | "user" | undefined {
  if (explicitRole === "admin" || explicitRole === "user") return explicitRole;
  if (ownerOpenId && openId === ownerOpenId) return "admin";
  return undefined;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    const resolvedRole = resolveUserRole(user.openId, user.role, ENV.ownerOpenId);
    if (resolvedRole !== undefined) {
      values.role = resolvedRole;
      updateSet.role = resolvedRole;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ---------------------------------------------------------------------------
// Member types & helpers
// ---------------------------------------------------------------------------
export type FamilyEvent = { type: string; date: string; description: string };

export type ParsedMember = Omit<typeof members.$inferSelect, "familyEvents"> & {
  familyEvents: FamilyEvent[];
};

function parseFamilyEvents(raw: string | null | undefined): FamilyEvent[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((e: any) => ({
        type: String(e?.type ?? "").trim(),
        date: String(e?.date ?? "").trim(),
        description: String(e?.description ?? "").trim(),
      }))
      .filter((e) => e.type || e.date || e.description);
  } catch {
    return [];
  }
}

export function parseMember(row: typeof members.$inferSelect): ParsedMember {
  return { ...row, familyEvents: parseFamilyEvents(row.familyEvents) };
}

export type MemberFilters = {
  q?: string;
  region?: string;
  city?: string;
  status?: string;
  tag?: string;
  contacted?: "recent7" | "recent30" | "over30" | "never" | "";
  upcoming?: number; // days window; 0/undefined = no filter
  source?: "manual" | "import" | "";
  support?: string; // support_level value
  vote?: "הצביע" | "טרם הצביע" | "";
  activist?: string; // assignedActivist
  sort?: "name" | "recent" | "activists";
  limit?: number;
  offset?: number;
};

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Compute member ids that have a birthday or family event within `days`.
function hasUpcomingEvent(member: typeof members.$inferSelect, days: number): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + days);

  const nextOcc = (d: Date) => {
    const o = new Date(now.getFullYear(), d.getMonth(), d.getDate());
    if (o < today) o.setFullYear(now.getFullYear() + 1);
    return o;
  };

  if (member.birthday) {
    const b = new Date(member.birthday as unknown as string);
    if (!isNaN(b.getTime())) {
      const o = nextOcc(b);
      if (o >= today && o <= horizon) return true;
    }
  }
  for (const ev of parseFamilyEvents(member.familyEvents)) {
    if (!ev.date) continue;
    const d = new Date(ev.date);
    if (!isNaN(d.getTime()) && d >= today && d <= horizon) return true;
  }
  return false;
}

// Build the WHERE conditions shared by getMembers and countMembers.
// Note: the "upcoming" filter is intentionally excluded here (handled in JS).
function buildMemberConditions(filters: MemberFilters = {}) {
  const conditions = [];
  if (filters.q && filters.q.trim()) {
    const likeVal = `%${filters.q.trim()}%`;
    conditions.push(
      or(
        like(members.fullName, likeVal),
        like(members.city, likeVal),
        like(members.region, likeVal),
        like(members.tags, likeVal),
        like(members.partyStatus, likeVal),
        like(members.notes, likeVal),
      ),
    );
  }
  if (filters.region && filters.region.trim()) {
    conditions.push(eq(members.region, filters.region.trim()));
  }
  if (filters.city && filters.city.trim()) {
    conditions.push(eq(members.city, filters.city.trim()));
  }
  if (filters.status && filters.status.trim()) {
    conditions.push(eq(members.partyStatus, filters.status.trim()));
  }
  if (filters.tag && filters.tag.trim()) {
    conditions.push(like(members.tags, `%${filters.tag.trim()}%`));
  }
  if (filters.source === "manual" || filters.source === "import") {
    conditions.push(eq(members.sourceType, filters.source));
  }
  if (filters.support && filters.support.trim()) {
    conditions.push(eq(members.supportLevel, filters.support.trim() as any));
  }
  if (filters.vote === "הצביע" || filters.vote === "טרם הצביע") {
    conditions.push(eq(members.voteStatus, filters.vote as any));
  }
  if (filters.activist && filters.activist.trim()) {
    conditions.push(eq(members.assignedActivist, filters.activist.trim()));
  }

  if (filters.contacted === "recent7") {
    conditions.push(drizzleSql`${members.lastContactDate} >= ${isoDaysAgo(7)}`);
  } else if (filters.contacted === "recent30") {
    conditions.push(drizzleSql`${members.lastContactDate} >= ${isoDaysAgo(30)}`);
  } else if (filters.contacted === "over30") {
    conditions.push(
      drizzleSql`(${members.lastContactDate} IS NULL OR ${members.lastContactDate} < ${isoDaysAgo(30)})`,
    );
  } else if (filters.contacted === "never") {
    conditions.push(drizzleSql`${members.lastContactDate} IS NULL`);
  }
  return conditions;
}

export async function getMembers(filters: MemberFilters = {}): Promise<ParsedMember[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = buildMemberConditions(filters);

  let orderBy;
  if (filters.sort === "recent") orderBy = desc(members.lastContactDate);
  else if (filters.sort === "activists") orderBy = desc(members.activistsCount);
  else orderBy = members.fullName;

  const where = conditions.length ? and(...conditions) : undefined;

  // The "upcoming events" filter is computed in JS (birthday/family-event
  // recurrence math can't be expressed in SQL here), so when it is active we
  // must scan, filter, then page in memory. In every other case we page in
  // SQL with LIMIT/OFFSET so large tables (tens of thousands of rows) stay
  // fast and the response small.
  if (filters.upcoming && filters.upcoming > 0) {
    const rows = await db.select().from(members).where(where).orderBy(orderBy);
    let parsed = rows
      .map(parseMember)
      .filter((m) => hasUpcomingEvent(m as unknown as typeof members.$inferSelect, filters.upcoming!));
    if (typeof filters.offset === "number" || typeof filters.limit === "number") {
      const off = filters.offset ?? 0;
      const lim = filters.limit ?? parsed.length;
      parsed = parsed.slice(off, off + lim);
    }
    return parsed;
  }

  let query = db.select().from(members).where(where).orderBy(orderBy).$dynamic();
  if (typeof filters.limit === "number") {
    query = query.limit(filters.limit).offset(filters.offset ?? 0);
  }
  const rows = await query;
  return rows.map(parseMember);
}

// Count members matching the same filters (excluding the in-memory "upcoming"
// filter, which the caller handles separately). Used for pagination totals.
export async function countMembers(filters: MemberFilters = {}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const conditions = buildMemberConditions(filters);
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select({ c: drizzleSql<number>`COUNT(*)` })
    .from(members)
    .where(where);
  return Number(rows[0]?.c ?? 0);
}

export async function getMemberById(id: number): Promise<ParsedMember | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(members).where(eq(members.id, id)).limit(1);
  return rows.length ? parseMember(rows[0]) : undefined;
}

export type MemberInput = {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  region?: string | null;
  address?: string | null;
  birthday?: string | null;
  familyEvents?: FamilyEvent[] | string | null;
  partyStatus?: string | null;
  activistsCount?: number | null;
  supportLevel?: string | null;
  voteStatus?: string | null;
  assignedActivist?: string | null;
  notes?: string | null;
  tags?: string | null;
  lastContactDate?: string | null;
  // Provenance (optional; defaults to manual entry)
  sourceType?: "manual" | "import";
  sourceFile?: string | null;
  importBatchId?: number | null;
  importedAt?: Date | null;
};

function normalizeFamilyEvents(input: FamilyEvent[] | string | null | undefined): string {
  if (typeof input === "string") return input;
  if (Array.isArray(input)) return JSON.stringify(input);
  return JSON.stringify([]);
}

export async function createMember(input: MemberInput): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!input.fullName || !String(input.fullName).trim()) {
    throw new Error("חסר שם מלא");
  }
  const values: InsertMember = {
    fullName: input.fullName.trim(),
    phone: input.phone ?? null,
    email: input.email ?? null,
    city: input.city ?? null,
    region: input.region ?? null,
    address: input.address ?? null,
    birthday: (input.birthday as any) || null,
    familyEvents: normalizeFamilyEvents(input.familyEvents),
    partyStatus:
      input.partyStatus && String(input.partyStatus).trim()
        ? String(input.partyStatus).trim()
        : "מתפקד",
    activistsCount: Number.isFinite(Number(input.activistsCount)) ? Number(input.activistsCount) : 0,
    supportLevel: (input.supportLevel && String(input.supportLevel).trim() ? String(input.supportLevel).trim() : "לא ידוע") as any,
    voteStatus: (input.voteStatus === "הצביע" ? "הצביע" : "טרם הצביע") as any,
    assignedActivist: input.assignedActivist ?? null,
    notes: input.notes ?? null,
    tags: input.tags ?? null,
    lastContactDate: (input.lastContactDate as any) || null,
    sourceType: input.sourceType === "import" ? "import" : "manual",
    sourceFile: input.sourceFile ?? null,
    importBatchId: input.importBatchId ?? null,
    importedAt: input.sourceType === "import" ? (input.importedAt ?? new Date()) : null,
  };
  const result: any = await db.insert(members).values(values);
  return result?.[0]?.insertId ?? result?.insertId ?? 0;
}

// ---------------------------------------------------------------------------
// Import batches
// ---------------------------------------------------------------------------
export async function createImportBatch(input: {
  fileName: string;
  rowCount: number;
  insertedCount: number;
  skippedCount: number;
  importedBy?: string | null;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const values: InsertImportBatch = {
    fileName: input.fileName,
    rowCount: input.rowCount,
    insertedCount: input.insertedCount,
    skippedCount: input.skippedCount,
    importedBy: input.importedBy ?? null,
  };
  const result: any = await db.insert(importBatches).values(values);
  return result?.[0]?.insertId ?? result?.insertId ?? 0;
}

export async function updateImportBatch(
  id: number,
  patch: { insertedCount: number; skippedCount: number },
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(importBatches)
    .set({ insertedCount: patch.insertedCount, skippedCount: patch.skippedCount })
    .where(eq(importBatches.id, id));
}

export async function getImportBatches() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(importBatches).orderBy(desc(importBatches.createdAt));
}

// All phone numbers currently in the DB (for duplicate detection on import).
export async function getExistingPhones(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ phone: members.phone }).from(members);
  return rows.map((r) => (r.phone || "").replace(/\D/g, "")).filter(Boolean);
}

export async function updateMember(id: number, input: Partial<MemberInput>): Promise<ParsedMember | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getMemberById(id);
  if (!existing) throw new Error("חבר לא נמצא");

  const updateSet: Record<string, unknown> = {};
  const map: Record<string, string> = {
    fullName: "fullName",
    phone: "phone",
    email: "email",
    city: "city",
    region: "region",
    address: "address",
    birthday: "birthday",
    partyStatus: "partyStatus",
    supportLevel: "supportLevel",
    voteStatus: "voteStatus",
    assignedActivist: "assignedActivist",
    notes: "notes",
    tags: "tags",
    lastContactDate: "lastContactDate",
  };
  for (const key of Object.keys(map)) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      updateSet[key] = (input as any)[key] ?? null;
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, "activistsCount")) {
    updateSet.activistsCount = Number.isFinite(Number(input.activistsCount))
      ? Number(input.activistsCount)
      : 0;
  }
  if (Object.prototype.hasOwnProperty.call(input, "familyEvents")) {
    updateSet.familyEvents = normalizeFamilyEvents(input.familyEvents);
  }
  if (Object.keys(updateSet).length === 0) {
    throw new Error("אין שדות לעדכון");
  }
  await db.update(members).set(updateSet).where(eq(members.id, id));
  return getMemberById(id);
}

export async function deleteMember(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getMemberById(id);
  if (!existing) throw new Error("חבר לא נמצא");
  await db.delete(contactLog).where(eq(contactLog.memberId, id));
  await db.delete(members).where(eq(members.id, id));
}

// Count how many member rows belong to a given import batch.
export async function countMembersByBatch(batchId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.importBatchId, batchId));
  return rows.length;
}

// Delete all members that were imported in a given batch (and their contact
// logs), then remove the batch record itself. Returns the number of members
// that were deleted.
export async function deleteMembersByBatch(batchId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.importBatchId, batchId));
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    await db.delete(contactLog).where(inArray(contactLog.memberId, ids));
    await db.delete(members).where(eq(members.importBatchId, batchId));
  }
  await db.delete(importBatches).where(eq(importBatches.id, batchId));
  return ids.length;
}

// Delete a specific set of members (and their contact logs) by id. Used to
// clean up duplicate records found via the AI chat. Returns the number of
// members that actually existed and were deleted.
export async function deleteMembersByIds(ids: number[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const validIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
  if (validIds.length === 0) return 0;
  const rows = await db.select({ id: members.id }).from(members).where(inArray(members.id, validIds));
  const existingIds = rows.map((r) => r.id);
  if (existingIds.length === 0) return 0;
  await db.delete(contactLog).where(inArray(contactLog.memberId, existingIds));
  await db.delete(members).where(inArray(members.id, existingIds));
  return existingIds.length;
}

export async function updateFamilyEvents(id: number, events: FamilyEvent[]): Promise<FamilyEvent[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getMemberById(id);
  if (!existing) throw new Error("חבר לא נמצא");
  const clean = (events || [])
    .map((e) => ({
      type: String(e.type || "").trim(),
      date: String(e.date || "").trim(),
      description: String(e.description || "").trim(),
    }))
    .filter((e) => e.type || e.date || e.description);
  await db.update(members).set({ familyEvents: JSON.stringify(clean) }).where(eq(members.id, id));
  return clean;
}

// ---------------------------------------------------------------------------
// Contact log
// ---------------------------------------------------------------------------
export async function getContactLog(memberId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(contactLog)
    .where(eq(contactLog.memberId, memberId))
    .orderBy(desc(contactLog.date));
}

export async function addContactLog(input: {
  memberId: number;
  date?: string;
  channel?: string;
  notes?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getMemberById(input.memberId);
  if (!existing) throw new Error("חבר לא נמצא");
  const d = input.date || new Date().toISOString().slice(0, 10);
  const values: InsertContactLog = {
    memberId: input.memberId,
    date: d as any,
    channel: input.channel || "טלפון",
    notes: input.notes || null,
  };
  const result: any = await db.insert(contactLog).values(values);
  await db.update(members).set({ lastContactDate: d as any }).where(eq(members.id, input.memberId));
  return result?.[0]?.insertId ?? result?.insertId ?? 0;
}

// ---------------------------------------------------------------------------
// Events & needs-contact
// ---------------------------------------------------------------------------
export type CrmEvent = {
  memberId: number;
  fullName: string;
  region: string | null;
  type: string;
  date: string;
  description: string;
};

export async function getUpcomingEvents(days: number): Promise<CrmEvent[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + days);

  // Only rows that could possibly produce an event need to be scanned. With
  // tens of thousands of members, pulling the whole table into memory is slow
  // and can overflow the gateway response budget. Filter in SQL to members
  // that have a birthday or some family-events payload, and select only the
  // columns the loop below actually reads.
  const rows = await db
    .select({
      id: members.id,
      fullName: members.fullName,
      region: members.region,
      birthday: members.birthday,
      familyEvents: members.familyEvents,
    })
    .from(members)
    .where(
      drizzleSql`(${members.birthday} IS NOT NULL AND ${members.birthday} <> '') OR (${members.familyEvents} IS NOT NULL AND ${members.familyEvents} <> '' AND ${members.familyEvents} <> '[]')`,
    );
  const events: CrmEvent[] = [];

  const nextOcc = (d: Date) => {
    const o = new Date(now.getFullYear(), d.getMonth(), d.getDate());
    if (o < today) o.setFullYear(now.getFullYear() + 1);
    return o;
  };

  for (const m of rows) {
    if (m.birthday) {
      const b = new Date(m.birthday as unknown as string);
      if (!isNaN(b.getTime())) {
        const occ = nextOcc(b);
        if (occ >= today && occ <= horizon) {
          events.push({
            memberId: m.id,
            fullName: m.fullName,
            region: m.region,
            type: "יום הולדת",
            date: occ.toISOString().slice(0, 10),
            description: `יום הולדת ל${m.fullName}`,
          });
        }
      }
    }
    for (const ev of parseFamilyEvents(m.familyEvents)) {
      if (!ev.date) continue;
      const d = new Date(ev.date);
      if (isNaN(d.getTime())) continue;
      if (d >= today && d <= horizon) {
        events.push({
          memberId: m.id,
          fullName: m.fullName,
          region: m.region,
          type: ev.type || "אירוע",
          date: ev.date,
          description: ev.description || ev.type || "אירוע",
        });
      }
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

export async function getNeedsContact(days: number) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = isoDaysAgo(days);
  const rows = await db
    .select({
      id: members.id,
      fullName: members.fullName,
      phone: members.phone,
      region: members.region,
      partyStatus: members.partyStatus,
      activistsCount: members.activistsCount,
      lastContactDate: members.lastContactDate,
    })
    .from(members)
    .where(drizzleSql`${members.lastContactDate} IS NULL OR ${members.lastContactDate} < ${cutoff}`)
    .orderBy(drizzleSql`(${members.lastContactDate} IS NULL) DESC, ${members.lastContactDate} ASC`)
    // This powers a "who to contact next" action list, not a full export. Cap
    // it so a table with tens of thousands of un-contacted members can't
    // produce an enormous response.
    .limit(200);
  return rows;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
export async function getStats() {
  const db = await getDb();
  if (!db)
    return {
      total: 0,
      totalActivists: 0,
      byStatus: [],
      byRegion: [],
      bySource: [],
      topActivists: [],
      contactedRecent: 0,
      neverContacted: 0,
    };
  const totalRows = await db.select({ c: drizzleSql<number>`COUNT(*)` }).from(members);
  const activistsRows = await db
    .select({ s: drizzleSql<number>`COALESCE(SUM(${members.activistsCount}),0)` })
    .from(members);
  const byStatus = await db
    .select({ status: members.partyStatus, c: drizzleSql<number>`COUNT(*)` })
    .from(members)
    .groupBy(members.partyStatus);
  const byRegion = await db
    .select({ region: members.region, c: drizzleSql<number>`COUNT(*)` })
    .from(members)
    .groupBy(members.region);
  const bySource = await db
    .select({ source: members.sourceType, c: drizzleSql<number>`COUNT(*)` })
    .from(members)
    .groupBy(members.sourceType);
  const bySupport = await db
    .select({ support: members.supportLevel, c: drizzleSql<number>`COUNT(*)` })
    .from(members)
    .groupBy(members.supportLevel);
  const votedRows = await db
    .select({ c: drizzleSql<number>`COUNT(*)` })
    .from(members)
    .where(eq(members.voteStatus, "הצביע" as any));
  // Activist leaderboard: how many assigned members & how many of them voted
  const byActivist = await db
    .select({
      activist: members.assignedActivist,
      total: drizzleSql<number>`COUNT(*)`,
      voted: drizzleSql<number>`SUM(CASE WHEN ${members.voteStatus} = 'הצביע' THEN 1 ELSE 0 END)`,
      supporters: drizzleSql<number>`SUM(CASE WHEN ${members.supportLevel} IN ('תומך','נוטה') THEN 1 ELSE 0 END)`,
    })
    .from(members)
    .where(drizzleSql`${members.assignedActivist} IS NOT NULL AND ${members.assignedActivist} <> ''`)
    .groupBy(members.assignedActivist)
    .orderBy(desc(drizzleSql`COUNT(*)`))
    .limit(8);
  const topActivists = await db
    .select({
      id: members.id,
      fullName: members.fullName,
      region: members.region,
      activistsCount: members.activistsCount,
    })
    .from(members)
    .orderBy(desc(members.activistsCount))
    .limit(5);
  const recentRows = await db
    .select({ c: drizzleSql<number>`COUNT(*)` })
    .from(members)
    .where(drizzleSql`${members.lastContactDate} >= ${isoDaysAgo(30)}`);
  const neverRows = await db
    .select({ c: drizzleSql<number>`COUNT(*)` })
    .from(members)
    .where(drizzleSql`${members.lastContactDate} IS NULL`);
  return {
    total: Number(totalRows[0]?.c ?? 0),
    totalActivists: Number(activistsRows[0]?.s ?? 0),
    byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.c) })),
    byRegion: byRegion.map((r) => ({ region: r.region, count: Number(r.c) })),
    bySource: bySource.map((r) => ({ source: r.source, count: Number(r.c) })),
    topActivists: topActivists.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      region: r.region,
      activistsCount: Number(r.activistsCount ?? 0),
    })),
    contactedRecent: Number(recentRows[0]?.c ?? 0),
    neverContacted: Number(neverRows[0]?.c ?? 0),
    bySupport: bySupport.map((r) => ({ support: r.support, count: Number(r.c) })),
    voted: Number(votedRows[0]?.c ?? 0),
    byActivist: byActivist.map((r) => ({
      activist: r.activist,
      total: Number(r.total),
      voted: Number(r.voted ?? 0),
      supporters: Number(r.supporters ?? 0),
    })),
  };
}

// ---------------------------------------------------------------------------
// Vote status (primaries / election-day GOTV)
// ---------------------------------------------------------------------------
export async function setVoteStatus(
  id: number,
  voted: boolean,
): Promise<{ id: number; voteStatus: string; alreadyMarked: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getMemberById(id);
  if (!existing) throw new Error("חבר לא נמצא");
  const target = voted ? "הצביע" : "טרם הצביע";
  const alreadyMarked = (existing as any).voteStatus === target;
  await db.update(members).set({ voteStatus: target as any }).where(eq(members.id, id));
  return { id, voteStatus: target, alreadyMarked };
}

// Dedicated support-level setter (primaries field mapping).
export async function setSupportLevel(
  id: number,
  level: string,
): Promise<{ id: number; supportLevel: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getMemberById(id);
  if (!existing) throw new Error("חבר לא נמצא");
  await db.update(members).set({ supportLevel: level as any }).where(eq(members.id, id));
  return { id, supportLevel: level };
}

export async function getActivistOptions(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ a: members.assignedActivist })
    .from(members)
    .where(drizzleSql`${members.assignedActivist} IS NOT NULL AND ${members.assignedActivist} <> ''`)
    .groupBy(members.assignedActivist);
  return rows.map((r) => r.a as string).filter(Boolean).sort();
}

// ---------------------------------------------------------------------------
// Audit log (sensitive-data trail)
// ---------------------------------------------------------------------------
export async function recordAudit(entry: {
  actorOpenId?: string | null;
  actorName?: string | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  detail?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertAuditLog = {
      actorOpenId: entry.actorOpenId ?? null,
      actorName: entry.actorName ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId != null ? String(entry.entityId) : null,
      detail: entry.detail ?? null,
    };
    await db.insert(auditLog).values(values);
  } catch (error) {
    // Audit must never break the main flow.
    console.warn("[Audit] Failed to record entry:", error);
  }
}

export async function getAuditLog(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
}

// ---------------------------------------------------------------------------
// Filter options (distinct regions, cities, tags)
// ---------------------------------------------------------------------------
export async function getFilterOptions() {
  const db = await getDb();
  if (!db) return { regions: [], cities: [], tags: [], statuses: ["חבר מרכז", "מתפקד", "פעיל"] };
  // Use SQL DISTINCT so we do not pull every row into memory (the table can
  // hold tens of thousands of members). Tags still need a small scan because
  // they are stored as a comma-separated string, but we only select the tags
  // column and only for rows that actually have tags.
  const regionRows = await db
    .selectDistinct({ region: members.region })
    .from(members)
    .where(drizzleSql`${members.region} IS NOT NULL AND ${members.region} <> ''`);
  const cityRows = await db
    .selectDistinct({ city: members.city })
    .from(members)
    .where(drizzleSql`${members.city} IS NOT NULL AND ${members.city} <> ''`);
  const tagRows = await db
    .select({ tags: members.tags })
    .from(members)
    .where(drizzleSql`${members.tags} IS NOT NULL AND ${members.tags} <> ''`)
    // Tags are a free-form comma string with no SQL-side distinct; cap the scan
    // so this can't balloon on a very large table. The distinct set of tags in
    // practice is tiny, so a generous cap is plenty.
    .limit(5000);
  const regions = new Set<string>();
  const cities = new Set<string>();
  const tags = new Set<string>();
  for (const r of regionRows) {
    if (r.region && r.region.trim()) regions.add(r.region.trim());
  }
  for (const r of cityRows) {
    if (r.city && r.city.trim()) cities.add(r.city.trim());
  }
  for (const r of tagRows) {
    if (r.tags && r.tags.trim()) {
      r.tags
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((t) => tags.add(t));
    }
  }
  return {
    regions: Array.from(regions).sort(),
    cities: Array.from(cities).sort(),
    tags: Array.from(tags).sort(),
    statuses: ["חבר מרכז", "מתפקד", "פעיל"],
  };
}

// ---------------------------------------------------------------------------
// Raw read-only SELECT execution for AI chat (text-to-SQL)
// ---------------------------------------------------------------------------
export async function runReadonlyQuery(sqlText: string): Promise<any[]> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Database not available");
  // Disable multi-statement execution so a single string can never run
  // more than one query, even if the upstream guard is bypassed.
  const conn = await mysql.createConnection({ uri: url, multipleStatements: false });
  try {
    // Enforce read-only at the session level as a defense-in-depth layer:
    // any INSERT/UPDATE/DELETE/DDL will be rejected by the engine itself.
    try {
      await conn.query("SET SESSION TRANSACTION READ ONLY");
    } catch {
      // Some managed engines may not permit this; the SELECT-only guard
      // in ai.ts still applies, so we continue.
    }
    const [rows] = await conn.query(sqlText);
    return Array.isArray(rows) ? (rows as any[]) : [];
  } finally {
    await conn.end();
  }
}
