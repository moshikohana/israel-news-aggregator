// Duplicate-member detection for AI chat results.
//
// Two result rows are treated as the SAME PERSON (a duplicate) only when both
// the normalized full name AND the normalized phone number match. Members
// that share a name but have a different (or missing) phone number are
// distinct people and must never be grouped or suggested for merging.

export function normalizeName(name: unknown): string {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizePhone(phone: unknown): string {
  return String(phone ?? "").replace(/\D/g, "");
}

export type DuplicateGroup = {
  fullName: string;
  phone: string;
  ids: number[];
};

// Scan chat result rows (raw SQL rows keyed by snake_case column names) and
// group rows that represent the same member (same normalized name + phone).
// Only groups with more than one row are returned.
export function findDuplicateGroups(rows: any[]): DuplicateGroup[] {
  if (!Array.isArray(rows)) return [];
  const groups = new Map<string, DuplicateGroup>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const id = Number(row.id);
    const fullName = row.full_name;
    if (!Number.isInteger(id) || !fullName) continue;
    const normName = normalizeName(fullName);
    const normPhone = normalizePhone(row.phone);
    if (!normName || !normPhone) continue;
    const key = `${normName}|${normPhone}`;
    let group = groups.get(key);
    if (!group) {
      group = { fullName: String(fullName).trim(), phone: String(row.phone).trim(), ids: [] };
      groups.set(key, group);
    }
    if (!group.ids.includes(id)) group.ids.push(id);
  }
  return Array.from(groups.values()).filter((g) => g.ids.length > 1);
}
