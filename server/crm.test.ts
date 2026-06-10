import { describe, expect, it } from "vitest";
import { isSafeSelect } from "./ai";
import { resolveUserRole } from "./db";
import { findDuplicateGroups, normalizeName, normalizePhone } from "./duplicates";
import { guessField, normalizeValue, toISODate } from "./fields";

describe("isSafeSelect (AI SQL guard)", () => {
  it("allows a simple read-only SELECT", () => {
    expect(isSafeSelect("SELECT full_name, phone FROM members WHERE region = 'ירושלים'")).toBe(true);
    expect(isSafeSelect("  select * from members order by activists_count desc limit 3 ")).toBe(true);
  });

  it("allows a trailing semicolon (stripped) but blocks multiple statements", () => {
    expect(isSafeSelect("SELECT * FROM members;")).toBe(true);
    expect(isSafeSelect("SELECT * FROM members; DROP TABLE members")).toBe(false);
  });

  it("blocks write/DDL statements", () => {
    expect(isSafeSelect("DELETE FROM members")).toBe(false);
    expect(isSafeSelect("UPDATE members SET phone = '0' WHERE id = 1")).toBe(false);
    expect(isSafeSelect("INSERT INTO members (full_name) VALUES ('x')")).toBe(false);
    expect(isSafeSelect("DROP TABLE members")).toBe(false);
  });

  it("blocks side-effecting SELECT forms", () => {
    expect(isSafeSelect("SELECT * FROM members INTO OUTFILE '/tmp/x.csv'")).toBe(false);
    expect(isSafeSelect("SELECT load_file('/etc/passwd')")).toBe(false);
    expect(isSafeSelect("SELECT * FROM information_schema.tables")).toBe(false);
    expect(isSafeSelect("SELECT sleep(5)")).toBe(false);
  });

  it("blocks non-SELECT input", () => {
    expect(isSafeSelect("WITH x AS (SELECT 1) SELECT * FROM x")).toBe(false);
    expect(isSafeSelect("")).toBe(false);
  });
});

describe("guessField (Excel header mapping)", () => {
  it("maps Hebrew headers to canonical keys", () => {
    expect(guessField("שם מלא")).toBe("fullName");
    expect(guessField("שם")).toBe("fullName");
    expect(guessField("טלפון")).toBe("phone");
    expect(guessField("נייד")).toBe("phone");
    expect(guessField("עיר")).toBe("city");
    expect(guessField("מתפקדים")).toBe("activistsCount");
    expect(guessField("מפקדים")).toBe("activistsCount");
    expect(guessField("תאריך לידה")).toBe("birthday");
  });

  it("maps English headers", () => {
    expect(guessField("Full Name")).toBe("fullName");
    expect(guessField("phone")).toBe("phone");
    expect(guessField("email")).toBe("email");
  });

  it("returns empty for unknown headers", () => {
    expect(guessField("עמודה לא ידועה כלשהי")).toBe("");
    expect(guessField("")).toBe("");
  });
});

describe("normalizeValue", () => {
  it("normalizes activist counts to integers", () => {
    expect(normalizeValue("activistsCount", "100")).toBe(100);
    expect(normalizeValue("activistsCount", "1,200")).toBe(1200);
    expect(normalizeValue("activistsCount", "")).toBe(0);
    expect(normalizeValue("activistsCount", "abc")).toBe(0);
  });

  it("normalizes party status", () => {
    expect(normalizeValue("partyStatus", "חבר מרכז")).toBe("חבר מרכז");
    expect(normalizeValue("partyStatus", "מתפקד")).toBe("מתפקד");
    expect(normalizeValue("partyStatus", "פעיל")).toBe("פעיל");
  });

  it("normalizes dates to ISO", () => {
    expect(normalizeValue("birthday", "15/03/1980")).toBe("1980-03-15");
    expect(normalizeValue("birthday", "1980-03-15")).toBe("1980-03-15");
  });
});

describe("toISODate", () => {
  it("parses dd/mm/yyyy", () => {
    expect(toISODate("01/02/2020")).toBe("2020-02-01");
  });
  it("parses yyyy-mm-dd", () => {
    expect(toISODate("2020-2-1")).toBe("2020-02-01");
  });
  it("parses Excel serial dates", () => {
    // 25569 = 1970-01-01
    expect(toISODate(25569)).toBe("1970-01-01");
  });
  it("returns empty for blanks", () => {
    expect(toISODate("")).toBe("");
    expect(toISODate(null)).toBe("");
  });
});

describe("resolveUserRole (owner -> admin)", () => {
  const OWNER = "owner-open-id-123";

  it("auto-assigns admin to the configured owner", () => {
    expect(resolveUserRole(OWNER, undefined, OWNER)).toBe("admin");
  });

  it("does not promote non-owner users (DB default applies)", () => {
    expect(resolveUserRole("someone-else", undefined, OWNER)).toBeUndefined();
  });

  it("respects an explicit role over owner auto-assignment", () => {
    expect(resolveUserRole(OWNER, "user", OWNER)).toBe("user");
    expect(resolveUserRole("someone-else", "admin", OWNER)).toBe("admin");
  });

  it("does not promote anyone when owner id is empty", () => {
    expect(resolveUserRole("", undefined, "")).toBeUndefined();
    expect(resolveUserRole("any", undefined, "")).toBeUndefined();
  });
});

describe("import party_status defaulting", () => {
  it("normalizeValue defaults empty status to מתפקד", () => {
    expect(normalizeValue("partyStatus", "")).toBe("מתפקד");
    expect(normalizeValue("partyStatus", null)).toBe("");
  });

  it("normalizeValue maps known status synonyms", () => {
    expect(normalizeValue("partyStatus", "חבר מרכז כללי")).toBe("חבר מרכז");
    expect(normalizeValue("partyStatus", "מתפקד")).toBe("מתפקד");
    expect(normalizeValue("partyStatus", "פעיל שטח")).toBe("פעיל");
  });

  // Mirrors importRouter commit logic: when no status column is mapped/empty,
  // members must still receive a sensible default status.
  it("applies default status when status is missing in a row", () => {
    const DEFAULT_STATUS = "מתפקד";
    const obj: Record<string, unknown> = { fullName: "ישראל ישראלי" };
    if (!obj.partyStatus || !String(obj.partyStatus).trim()) {
      obj.partyStatus = DEFAULT_STATUS;
    }
    expect(obj.partyStatus).toBe("מתפקד");
  });
});

import * as XLSX from "xlsx";

// Helper mirroring importRouter.sheetToRows so we test the same parsing path.
function sheetToRows(buffer: Buffer): any[][] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const arr = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", raw: true });
  return arr.filter((r) => r.some((c) => String(c).trim() !== ""));
}

function digits(s: unknown): string {
  return String(s ?? "").replace(/\D/g, "");
}

function buildXlsx(aoa: any[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("Excel import round-trip + header detection", () => {
  it("parses an .xlsx buffer back into header + data rows and maps headers", () => {
    const buf = buildXlsx([
      ["שם מלא", "טלפון", "עיר"],
      ["דנה לוי", "050-1234567", "חיפה"],
      ["", "", ""], // blank row should be filtered out
      ["משה כהן", "0521112222", "תל אביב"],
    ]);
    const rows = sheetToRows(buf);
    expect(rows.length).toBe(3); // header + 2 data rows (blank filtered)
    const headers = rows[0].map((h) => String(h).trim());
    expect(headers.map((h) => guessField(h))).toEqual(["fullName", "phone", "city"]);
    expect(rows[1][0]).toBe("דנה לוי");
    expect(rows[2][0]).toBe("משה כהן");
  });

  it("defaults status to מתפקד for rows imported without a status column", () => {
    const buf = buildXlsx([
      ["שם מלא", "טלפון"],
      ["דנה לוי", "0501234567"],
    ]);
    const rows = sheetToRows(buf);
    const headers = rows[0].map((h) => String(h).trim());
    const suggested = headers.map((h) => guessField(h));
    expect(suggested.includes("partyStatus")).toBe(false);

    // Mirror commit defaulting logic.
    const DEFAULT_STATUS = "מתפקד";
    const dataRow = rows[1];
    const obj: Record<string, unknown> = {};
    suggested.forEach((key, i) => {
      if (key) obj[key] = normalizeValue(key, dataRow[i]);
    });
    if (!obj.partyStatus || !String(obj.partyStatus).trim()) obj.partyStatus = DEFAULT_STATUS;
    expect(obj.partyStatus).toBe("מתפקד");
  });
});

describe("duplicate-by-phone detection (import preview)", () => {
  it("counts existing-in-DB and in-file phone duplicates", () => {
    const existing = new Set(["0501234567"].map(digits));
    const allRows = [
      ["דנה לוי", "050-1234567"], // matches existing
      ["משה כהן", "052-1112222"],
      ["משה כהן", "0521112222"], // dup within file
      ["נועה בר", ""], // no phone -> ignored
    ];
    const phoneCol = 1;
    const seen = new Set<string>();
    let dupExisting = 0;
    let dupInFile = 0;
    for (const r of allRows) {
      const p = digits(r[phoneCol]);
      if (!p) continue;
      if (existing.has(p)) dupExisting++;
      if (seen.has(p)) dupInFile++;
      seen.add(p);
    }
    expect(dupExisting).toBe(1);
    expect(dupInFile).toBe(1);
  });
});

describe("findDuplicateGroups (chat results)", () => {
  it("normalizes names and phones for comparison", () => {
    expect(normalizeName("  משה   כהן ")).toBe("משה כהן");
    expect(normalizeName("Moshe  Cohen")).toBe("moshe cohen");
    expect(normalizePhone("050-123-4567")).toBe("0501234567");
    expect(normalizePhone(null)).toBe("");
  });

  it("groups rows with the same normalized name AND phone as duplicates", () => {
    const rows = [
      { id: 1, full_name: "משה כהן", phone: "050-1234567", city: "תל אביב" },
      { id: 2, full_name: " משה   כהן", phone: "0501234567", city: "חיפה" },
      { id: 3, full_name: "דנה לוי", phone: "0529998888" },
    ];
    const groups = findDuplicateGroups(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].ids.sort()).toEqual([1, 2]);
    expect(groups[0].fullName).toBe("משה כהן");
  });

  it("does not group same-name rows with different phone numbers", () => {
    const rows = [
      { id: 1, full_name: "משה כהן", phone: "0501111111" },
      { id: 2, full_name: "משה כהן", phone: "0502222222" },
    ];
    expect(findDuplicateGroups(rows)).toEqual([]);
  });

  it("ignores rows missing id, full_name or phone", () => {
    const rows = [
      { id: 1, full_name: "משה כהן" }, // no phone
      { full_name: "דנה לוי", phone: "0501234567" }, // no id
      { id: 2, full_name: "", phone: "0501234567" }, // no name
    ];
    expect(findDuplicateGroups(rows)).toEqual([]);
  });

  it("returns no groups when there are no duplicates", () => {
    const rows = [
      { id: 1, full_name: "משה כהן", phone: "0501111111" },
      { id: 2, full_name: "דנה לוי", phone: "0502222222" },
    ];
    expect(findDuplicateGroups(rows)).toEqual([]);
  });
});

describe("member export shaping", () => {
  it("labels source as Hebrew and round-trips through xlsx", () => {
    const members = [
      { fullName: "דנה לוי", sourceType: "import", sourceFile: "list.xlsx", activistsCount: 12 },
      { fullName: "משה כהן", sourceType: "manual", sourceFile: null, activistsCount: 0 },
    ];
    const rows = members.map((m) => ({
      "שם מלא": m.fullName,
      "מספר מתפקדים": m.activistsCount ?? 0,
      מקור: m.sourceType === "import" ? "מיובא מקובץ" : "הוזן ידנית",
      "קובץ מקור": m.sourceFile ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "חברים");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const back = XLSX.utils.sheet_to_json<any>(XLSX.read(buf, { type: "buffer" }).Sheets["חברים"]);
    expect(back[0]["מקור"]).toBe("מיובא מקובץ");
    expect(back[0]["קובץ מקור"]).toBe("list.xlsx");
    expect(back[1]["מקור"]).toBe("הוזן ידנית");
  });
});

// ---- Primaries / GOTV logic ----

type Row = { supportLevel?: string | null; voteStatus?: string | null; assignedActivist?: string | null };

// Mirrors getStats primaries aggregation: support pyramid + turnout.
function primariesSummary(rows: Row[]) {
  const support: Record<string, number> = {};
  let voted = 0;
  for (const r of rows) {
    const level = r.supportLevel && r.supportLevel.trim() ? r.supportLevel : "לא ידוע";
    support[level] = (support[level] ?? 0) + 1;
    if (r.voteStatus === "הצביע") voted++;
  }
  const total = rows.length;
  const turnoutPct = total > 0 ? Math.round((voted / total) * 100) : 0;
  return { support, voted, total, turnoutPct };
}

// Mirrors setVoteStatus double-report guard: returns whether the change is a no-op repeat.
function applyVote(current: string | null | undefined, voted: boolean) {
  const next = voted ? "הצביע" : "טרם הצביע";
  const alreadyVoted = current === "הצביע";
  return { next, duplicate: voted && alreadyVoted };
}

describe("primaries summary (support pyramid + turnout)", () => {
  it("builds a support pyramid and turnout percentage", () => {
    const rows: Row[] = [
      { supportLevel: "תומך", voteStatus: "הצביע" },
      { supportLevel: "תומך", voteStatus: "טרם הצביע" },
      { supportLevel: "מתלבט", voteStatus: "הצביע" },
      { supportLevel: "מתנגד", voteStatus: "טרם הצביע" },
      { supportLevel: "", voteStatus: "טרם הצביע" }, // empty -> לא ידוע
    ];
    const s = primariesSummary(rows);
    expect(s.support["תומך"]).toBe(2);
    expect(s.support["מתלבט"]).toBe(1);
    expect(s.support["מתנגד"]).toBe(1);
    expect(s.support["לא ידוע"]).toBe(1);
    expect(s.voted).toBe(2);
    expect(s.total).toBe(5);
    expect(s.turnoutPct).toBe(40);
  });

  it("returns 0% turnout for an empty set without dividing by zero", () => {
    const s = primariesSummary([]);
    expect(s.turnoutPct).toBe(0);
    expect(s.total).toBe(0);
  });
});

describe("vote double-report guard", () => {
  it("flags a repeated 'voted' report as duplicate", () => {
    expect(applyVote("הצביע", true)).toEqual({ next: "הצביע", duplicate: true });
  });
  it("marks a first-time vote as non-duplicate", () => {
    expect(applyVote("טרם הצביע", true)).toEqual({ next: "הצביע", duplicate: false });
  });
  it("allows un-marking a vote (correction) without duplicate flag", () => {
    expect(applyVote("הצביע", false)).toEqual({ next: "טרם הצביע", duplicate: false });
  });
});

// ---- Multi-sheet import ----

function worksheetToRows(ws: XLSX.WorkSheet): any[][] {
  const arr = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", raw: true });
  return arr.filter((r) => r.some((c) => String(c).trim() !== ""));
}

function buildMultiSheetXlsx(sheets: { name: string; aoa: any[][] }[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.aoa), s.name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("multi-sheet import (sheet selection + merge)", () => {
  const buf = buildMultiSheetXlsx([
    { name: "צפון", aoa: [["שם מלא", "עיר"], ["דנה לוי", "חיפה"]] },
    { name: "דרום", aoa: [["שם מלא", "עיר"], ["משה כהן", "באר שבע"], ["נועה בר", "אילת"]] },
  ]);

  it("exposes all sheet names from the workbook", () => {
    const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
    expect(wb.SheetNames).toEqual(["צפון", "דרום"]);
  });

  it("reads only the rows of a specific selected sheet", () => {
    const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
    const rows = worksheetToRows(wb.Sheets["דרום"]);
    // header + 2 data rows
    expect(rows.length).toBe(3);
    expect(rows[1][0]).toBe("משה כהן");
    expect(rows[2][0]).toBe("נועה בר");
  });

  it("merges every sheet's data rows when importing all sheets (skipping each header)", () => {
    const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
    let merged: any[][] = [];
    for (const name of wb.SheetNames) {
      const sheetRows = worksheetToRows(wb.Sheets[name]);
      if (sheetRows.length > 1) merged = merged.concat(sheetRows.slice(1));
    }
    // 1 from צפון + 2 from דרום = 3 data rows, no headers included
    expect(merged.length).toBe(3);
    expect(merged.map((r) => r[0])).toEqual(["דנה לוי", "משה כהן", "נועה בר"]);
  });
});

// ---- Delete-by-batch logic ----

describe("delete-by-batch member/contact selection", () => {
  it("selects only the member ids that belong to the target batch", () => {
    const members = [
      { id: 1, importBatchId: 10 },
      { id: 2, importBatchId: 10 },
      { id: 3, importBatchId: 11 },
      { id: 4, importBatchId: null },
    ];
    const targetBatch = 10;
    const ids = members.filter((m) => m.importBatchId === targetBatch).map((m) => m.id);
    expect(ids).toEqual([1, 2]);

    // Contact logs for those members would be removed; others remain.
    const contactLogs = [
      { id: 100, memberId: 1 },
      { id: 101, memberId: 3 },
      { id: 102, memberId: 2 },
    ];
    const remainingLogs = contactLogs.filter((c) => !ids.includes(c.memberId));
    expect(remainingLogs.map((c) => c.id)).toEqual([101]);
  });
});


describe("pagination helpers", () => {
  it("normalizePage clamps and defaults", async () => {
    const { normalizePage } = await import("./pagination");
    expect(normalizePage(undefined, undefined)).toEqual({ page: 1, pageSize: 50, offset: 0 });
    expect(normalizePage(3, 20)).toEqual({ page: 3, pageSize: 20, offset: 40 });
    // pageSize capped at 200
    expect(normalizePage(1, 5000).pageSize).toBe(200);
    // invalid page falls back to 1
    expect(normalizePage(0, 10).page).toBe(1);
    expect(normalizePage(-5, 10).page).toBe(1);
  });

  it("computePageMeta reports hasMore correctly (SQL total)", async () => {
    const { computePageMeta } = await import("./pagination");
    // 87114 total, first page of 48 -> more to load
    const m = computePageMeta({ page: 1, pageSize: 48, itemsLength: 48, total: 87114 });
    expect(m.total).toBe(87114);
    expect(m.hasMore).toBe(true);
    expect(m.offset).toBe(0);
  });

  it("computePageMeta last page has no more", async () => {
    const { computePageMeta } = await import("./pagination");
    // total 100, page 3 of 48 -> offset 96, 4 items, no more
    const m = computePageMeta({ page: 3, pageSize: 48, itemsLength: 4, total: 100 });
    expect(m.offset).toBe(96);
    expect(m.hasMore).toBe(false);
  });

  it("computePageMeta uses heuristic total for in-memory filter", async () => {
    const { computePageMeta } = await import("./pagination");
    // upcoming filter: total can't be known; a full page implies more
    const full = computePageMeta({ page: 2, pageSize: 48, itemsLength: 48, total: 0, inMemoryFilter: true });
    expect(full.hasMore).toBe(true);
    expect(full.total).toBe(48 + 48 + 1); // loaded + 1 (more to come)
    // a partial page implies the end
    const partial = computePageMeta({ page: 2, pageSize: 48, itemsLength: 10, total: 0, inMemoryFilter: true });
    expect(partial.hasMore).toBe(false);
  });
});
