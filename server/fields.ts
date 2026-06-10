// Canonical member fields used for manual add + Excel import mapping.

export type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
  type: "text" | "date" | "number" | "select";
  options?: string[];
  aliases: string[];
};

export const FIELDS: FieldDef[] = [
  {
    key: "fullName",
    label: "שם מלא",
    required: true,
    type: "text",
    aliases: ["שם", "שם מלא", "שם החבר", "שם מתפקד", "name", "full name", "fullname"],
  },
  {
    key: "phone",
    label: "טלפון",
    type: "text",
    aliases: ["טלפון", "נייד", "פלאפון", "מספר טלפון", "phone", "mobile", "tel"],
  },
  {
    key: "email",
    label: "אימייל",
    type: "text",
    aliases: ["אימייל", "מייל", 'דוא"ל', "email", "e-mail", "mail"],
  },
  { key: "city", label: "עיר", type: "text", aliases: ["עיר", "יישוב", "ישוב", "city", "town"] },
  {
    key: "region",
    label: "אזור",
    type: "text",
    aliases: ["אזור", "מחוז", "region", "area", "district"],
  },
  { key: "address", label: "כתובת", type: "text", aliases: ["כתובת", "address", "street"] },
  {
    key: "birthday",
    label: "תאריך לידה",
    type: "date",
    aliases: ["תאריך לידה", "יום הולדת", "לידה", "birthday", "birth date", "dob", "date of birth"],
  },
  {
    key: "partyStatus",
    label: "סטטוס",
    type: "select",
    options: ["חבר מרכז", "מתפקד", "פעיל"],
    aliases: ["סטטוס", "תפקיד", "מעמד", "status", "role", "party status"],
  },
  {
    key: "activistsCount",
    label: "מספר מתפקדים",
    type: "number",
    aliases: ["מתפקדים", "מספר מתפקדים", "כמות מתפקדים", "מפקדים", "מספר מפקדים", "כמות מפקדים", "פעילים", "activists", "activists count"],
  },
  {
    key: "notes",
    label: "הערות",
    type: "text",
    aliases: ["הערות", "הערה", "notes", "comment", "comments"],
  },
  {
    key: "tags",
    label: "תגיות",
    type: "text",
    aliases: ["תגיות", "תגית", "tags", "tag", "labels"],
  },
];

const norm = (s: unknown) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/["'`׳״]/g, "")
    .replace(/\s+/g, " ");

export function guessField(header: string): string {
  const h = norm(header);
  if (!h) return "";
  for (const f of FIELDS) {
    if (norm(f.label) === h) return f.key;
    if (f.aliases.some((a) => norm(a) === h)) return f.key;
  }
  for (const f of FIELDS) {
    if (f.aliases.some((a) => h.includes(norm(a)) || norm(a).includes(h))) return f.key;
  }
  return "";
}

function pad(n: string | number) {
  return String(n).padStart(2, "0");
}

export function toISODate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "number" && value > 0 && value < 100000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + value * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const s = String(value).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let year = m[3];
    if (year.length === 2) year = (parseInt(year, 10) > 30 ? "19" : "20") + year;
    return `${year}-${pad(m[2])}-${pad(m[1])}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}

export function normalizeValue(key: string, value: unknown): string | number {
  if (value === null || value === undefined) return "";
  const v = typeof value === "string" ? value.trim() : value;

  if (key === "activistsCount") {
    const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
    return isNaN(n) ? 0 : n;
  }
  if (key === "birthday") {
    return toISODate(v);
  }
  if (key === "partyStatus") {
    const s = String(v);
    if (/מרכז/.test(s)) return "חבר מרכז";
    if (/מתפקד/.test(s)) return "מתפקד";
    if (/פעיל/.test(s)) return "פעיל";
    return s || "מתפקד";
  }
  return String(v);
}
