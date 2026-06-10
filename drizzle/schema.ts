import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, date } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Political CRM members (party center members / activists).
 */
export const members = mysqlTable("members", {
  id: int("id").autoincrement().primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 320 }),
  city: varchar("city", { length: 128 }),
  region: varchar("region", { length: 128 }),
  address: varchar("address", { length: 512 }),
  birthday: date("birthday"),
  // JSON array: [{type, date, description}]
  familyEvents: text("family_events"),
  partyStatus: varchar("party_status", { length: 64 }),
  activistsCount: int("activists_count").default(0).notNull(),
  // Support / primaries (Elector/LogiVote-inspired)
  supportLevel: mysqlEnum("support_level", ["תומך", "נוטה", "מתלבט", "מתנגד", "לא ידוע"]).default("לא ידוע").notNull(),
  voteStatus: mysqlEnum("vote_status", ["טרם הצביע", "הצביע"]).default("טרם הצביע").notNull(),
  assignedActivist: varchar("assigned_activist", { length: 255 }),
  notes: text("notes"),
  tags: varchar("tags", { length: 512 }),
  lastContactDate: date("last_contact_date"),
  // Provenance: where this member record came from.
  sourceType: mysqlEnum("source_type", ["manual", "import"]).default("manual").notNull(),
  sourceFile: varchar("source_file", { length: 512 }),
  importBatchId: int("import_batch_id"),
  importedAt: timestamp("imported_at"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Member = typeof members.$inferSelect;
export type InsertMember = typeof members.$inferInsert;

/**
 * Import batches: one row per Excel import, for provenance & summaries.
 */
export const importBatches = mysqlTable("import_batches", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("file_name", { length: 512 }).notNull(),
  rowCount: int("row_count").default(0).notNull(),
  insertedCount: int("inserted_count").default(0).notNull(),
  skippedCount: int("skipped_count").default(0).notNull(),
  importedBy: varchar("imported_by", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ImportBatch = typeof importBatches.$inferSelect;
export type InsertImportBatch = typeof importBatches.$inferInsert;

/**
 * Audit log: immutable trail of sensitive actions (privacy-law compliance).
 */
export const auditLog = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  actorOpenId: varchar("actor_open_id", { length: 64 }),
  actorName: varchar("actor_name", { length: 255 }),
  action: varchar("action", { length: 64 }).notNull(),
  entity: varchar("entity", { length: 64 }).notNull(),
  entityId: varchar("entity_id", { length: 64 }),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

/**
 * Contact log entries per member.
 */
export const contactLog = mysqlTable("contact_log", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("member_id").notNull(),
  date: date("date").notNull(),
  channel: varchar("channel", { length: 32 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContactLog = typeof contactLog.$inferSelect;
export type InsertContactLog = typeof contactLog.$inferInsert;
