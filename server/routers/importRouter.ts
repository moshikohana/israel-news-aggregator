import { z } from "zod";
import * as XLSX from "xlsx";
import { protectedProcedure, router } from "../_core/trpc";
import { FIELDS, guessField, normalizeValue } from "../fields";
import {
  createMember,
  createImportBatch,
  updateImportBatch,
  getImportBatches,
  getExistingPhones,
  getMembers,
  recordAudit,
  deleteMembersByBatch,
  countMembersByBatch,
  type MemberFilters,
} from "../db";

const ALL_SHEETS = "__ALL__";

// Convert one worksheet into a 2D array of non-empty rows.
function worksheetToRows(ws: XLSX.WorkSheet): any[][] {
  const arr = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", raw: true });
  return arr.filter((r) => r.some((c) => String(c).trim() !== ""));
}

// Read a workbook and return its sheet names.
function readWorkbook(buffer: Buffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: "buffer", cellDates: false });
}

// Resolve which sheet to read for the preview. Defaults to the first sheet.
function rowsForSheet(wb: XLSX.WorkBook, sheetName?: string): any[][] {
  const name =
    sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return worksheetToRows(ws);
}

function digits(s: unknown): string {
  return String(s ?? "").replace(/\D/g, "");
}

export const importRouter = router({
  fields: protectedProcedure.query(() =>
    FIELDS.map(({ aliases, ...f }) => f),
  ),

  preview: protectedProcedure
    .input(
      z.object({
        fileBase64: z.string().min(1),
        fileName: z.string().optional(),
        sheetName: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const wb = readWorkbook(buffer);
      const sheetNames = wb.SheetNames.slice();
      if (sheetNames.length === 0) {
        throw new Error("הקובץ ריק");
      }

      const activeSheet =
        input.sheetName && sheetNames.includes(input.sheetName)
          ? input.sheetName
          : sheetNames[0];

      const rows = rowsForSheet(wb, activeSheet);
      if (rows.length === 0) {
        throw new Error("הגליון שנבחר ריק");
      }
      const headers = rows[0].map((h) => String(h).trim());
      const sample = rows.slice(1, 6);
      const suggested = headers.map((h) => guessField(h));
      const allRows = rows.slice(1);

      // Duplicate detection by phone against existing DB + within the file.
      const existing = new Set(await getExistingPhones());
      const phoneCol = suggested.findIndex((s) => s === "phone");
      let dupExisting = 0;
      let dupInFile = 0;
      if (phoneCol >= 0) {
        const seen = new Set<string>();
        for (const r of allRows) {
          const p = digits(r[phoneCol]);
          if (!p) continue;
          if (existing.has(p)) dupExisting++;
          if (seen.has(p)) dupInFile++;
          seen.add(p);
        }
      }

      return {
        headers,
        sample,
        suggested,
        rows: allRows,
        totalRows: allRows.length,
        fileName: input.fileName ?? "",
        sheetNames,
        activeSheet,
        duplicates: { existing: dupExisting, inFile: dupInFile, hasPhoneColumn: phoneCol >= 0 },
      };
    }),

  commit: protectedProcedure
    .input(
      z.object({
        // When importing a single sheet, the client sends the already-parsed
        // rows. When importing ALL sheets, it sends the raw file instead.
        rows: z.array(z.array(z.any())).optional(),
        fileBase64: z.string().optional(),
        sheetName: z.string().optional(),
        // mapping: columnIndex -> fieldKey
        mapping: z.record(z.string(), z.string()),
        fileName: z.string().optional(),
        skipDuplicates: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const pairs = Object.entries(input.mapping)
        .filter(([, key]) => key)
        .map(([col, key]) => [parseInt(col, 10), key] as [number, string]);

      if (!pairs.some(([, key]) => key === "fullName")) {
        throw new Error('חובה למפות עמודה לשדה ״שם מלא״');
      }

      // Build the list of row arrays to import. For a single sheet we use the
      // rows sent from the client; for ALL sheets we re-parse the workbook and
      // concatenate every sheet's data rows (assuming a shared column layout).
      let importRows: any[][] = [];
      if (input.sheetName === ALL_SHEETS) {
        if (!input.fileBase64) {
          throw new Error("חסר קובץ לייבוא כל הגליונות");
        }
        const wb = readWorkbook(Buffer.from(input.fileBase64, "base64"));
        for (const name of wb.SheetNames) {
          const sheetRows = worksheetToRows(wb.Sheets[name]);
          if (sheetRows.length > 1) {
            // skip header row of each sheet
            importRows = importRows.concat(sheetRows.slice(1));
          }
        }
      } else {
        importRows = input.rows ?? [];
      }

      const fileName = (input.fileName && input.fileName.trim()) || "ייבוא ללא שם";
      const DEFAULT_STATUS = "מתפקד";
      const importedAt = new Date();

      // Create the batch up front so each member can reference it.
      const batchId = await createImportBatch({
        fileName,
        rowCount: importRows.length,
        insertedCount: 0,
        skippedCount: 0,
        importedBy: ctx.user?.openId ?? null,
      });

      const existingPhones = input.skipDuplicates ? new Set(await getExistingPhones()) : null;
      const seenPhones = new Set<string>();

      let inserted = 0;
      let skippedDup = 0;
      const errors: { row: number; error: string }[] = [];

      for (let ri = 0; ri < importRows.length; ri++) {
        const r = importRows[ri];
        const obj: Record<string, unknown> = {};
        for (const [col, key] of pairs) {
          obj[key] = normalizeValue(key, r[col]);
        }
        if (!obj.fullName || !String(obj.fullName).trim()) continue;

        // Default status when no status column mapped / empty cell.
        if (!obj.partyStatus || !String(obj.partyStatus).trim()) {
          obj.partyStatus = DEFAULT_STATUS;
        }

        // Optional duplicate skipping by phone.
        const p = digits(obj.phone);
        if (input.skipDuplicates && p) {
          if (existingPhones!.has(p) || seenPhones.has(p)) {
            skippedDup++;
            continue;
          }
        }
        if (p) seenPhones.add(p);

        try {
          await createMember({
            ...(obj as any),
            sourceType: "import",
            sourceFile: fileName,
            importBatchId: batchId,
            importedAt,
          });
          inserted++;
        } catch (e: any) {
          errors.push({ row: ri + 1, error: String(e?.message || e) });
        }
      }

      const skipped = importRows.length - inserted - errors.length;
      await updateImportBatch(batchId, { insertedCount: inserted, skippedCount: skipped });

      const sheetNote =
        input.sheetName === ALL_SHEETS
          ? " (כל הגליונות)"
          : input.sheetName
            ? ` (גליון "${input.sheetName}")`
            : "";

      await recordAudit({
        actorOpenId: ctx.user?.openId ?? null,
        actorName: ctx.user?.name ?? null,
        action: "import",
        entity: "import_batch",
        entityId: batchId,
        detail: `ייבוא מקובץ "${fileName}"${sheetNote}: נוספו ${inserted}, דולגו ${skippedDup}`,
      });

      return {
        batchId,
        fileName,
        inserted,
        skippedDuplicates: skippedDup,
        skipped,
        errors,
      };
    }),

  batches: protectedProcedure.query(() => getImportBatches()),

  // Delete every member that was imported in a given batch, plus the batch
  // record itself. Returns the number of members that were removed.
  deleteBatch: protectedProcedure
    .input(z.object({ batchId: z.number().int().positive(), fileName: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const count = await countMembersByBatch(input.batchId);
      const deleted = await deleteMembersByBatch(input.batchId);
      await recordAudit({
        actorOpenId: ctx.user?.openId ?? null,
        actorName: ctx.user?.name ?? null,
        action: "delete",
        entity: "import_batch",
        entityId: input.batchId,
        detail: `מחיקת אצוות ייבוא "${input.fileName ?? input.batchId}": נמחקו ${deleted} רשומות`,
      });
      return { deleted, expected: count, fileName: input.fileName ?? "" };
    }),

  // Export the current (optionally filtered) members list to an .xlsx file,
  // returned as base64 for the client to download.
  exportMembers: protectedProcedure
    .input(
      z
        .object({
          q: z.string().optional(),
          region: z.string().optional(),
          city: z.string().optional(),
          status: z.string().optional(),
          tag: z.string().optional(),
          source: z.enum(["manual", "import", ""]).optional(),
        })
        .optional(),
    )
    .mutation(async ({ input, ctx }) => {
      const filters = (input ?? {}) as MemberFilters;
      const members = await getMembers(filters);
      const rows = members.map((m) => ({
        "שם מלא": m.fullName,
        טלפון: m.phone ?? "",
        אימייל: m.email ?? "",
        עיר: m.city ?? "",
        אזור: m.region ?? "",
        כתובת: m.address ?? "",
        סטטוס: m.partyStatus ?? "",
        "מספר מתפקדים": m.activistsCount ?? 0,
        תגיות: m.tags ?? "",
        "קשר אחרון": m.lastContactDate ?? "",
        מקור: m.sourceType === "import" ? "מיובא מקובץ" : "הוזן ידנית",
        "קובץ מקור": m.sourceFile ?? "",
        הערות: m.notes ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "חברים");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
      await recordAudit({
        actorOpenId: ctx.user?.openId ?? null,
        actorName: ctx.user?.name ?? null,
        action: "export",
        entity: "member",
        entityId: null,
        detail: `ייצוא לאקסל של ${rows.length} רשומות`,
      });
      return {
        fileBase64: Buffer.from(buf).toString("base64"),
        count: rows.length,
      };
    }),
});
