export type FamilyEvent = { type: string; date: string; description: string };

export type Member = {
  id: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  region: string | null;
  address: string | null;
  birthday: string | Date | null;
  familyEvents: FamilyEvent[];
  partyStatus: string | null;
  activistsCount: number;
  supportLevel?: string | null;
  voteStatus?: string | null;
  assignedActivist?: string | null;
  notes: string | null;
  tags: string | null;
  lastContactDate: string | Date | null;
  sourceType?: "manual" | "import" | null;
  sourceFile?: string | null;
  importBatchId?: number | null;
  importedAt?: string | Date | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export const STATUS_OPTIONS = ["חבר מרכז", "מתפקד", "פעיל"];
export const SUPPORT_OPTIONS = ["תומך", "נוטה", "מתלבט", "מתנגד", "לא ידוע"];
export const VOTE_OPTIONS = ["טרם הצביע", "הצביע"];
export const CHANNEL_OPTIONS = ["טלפון", "וואטסאפ", "פגישה", "אימייל"];
export const EVENT_TYPE_OPTIONS = ["בר מצווה", "בת מצווה", "חתונה", "ברית", "אזכרה", "אירוע"];

export function toISO(d: string | Date | null | undefined): string {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export function formatHebDate(d: string | Date | null | undefined): string {
  const iso = toISO(d);
  if (!iso) return "—";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

export function formatShortDate(d: string | Date | null | undefined): string {
  const iso = toISO(d);
  if (!iso) return "—";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function statusColor(status: string | null | undefined): string {
  switch (status) {
    case "חבר מרכז":
      return "bg-primary/10 text-primary";
    case "מתפקד":
      return "bg-emerald-100 text-emerald-700";
    case "פעיל":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function supportColor(level: string | null | undefined): string {
  switch (level) {
    case "תומך":
      return "bg-emerald-100 text-emerald-700";
    case "נוטה":
      return "bg-teal-100 text-teal-700";
    case "מתלבט":
      return "bg-amber-100 text-amber-700";
    case "מתנגד":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function voteColor(status: string | null | undefined): string {
  return status === "הצביע"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-slate-100 text-slate-600";
}

export function daysSince(d: string | Date | null | undefined): number | null {
  const iso = toISO(d);
  if (!iso) return null;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

// Human label + color for a member's data source (file import vs manual entry).
export function sourceLabel(t: string | null | undefined): string {
  return t === "import" ? "מיובא מקובץ" : "הוזן ידנית";
}

export function sourceColor(t: string | null | undefined): string {
  return t === "import"
    ? "bg-sky-100 text-sky-700"
    : "bg-violet-100 text-violet-700";
}

// Build a wa.me / tel link for the contact button.
export function contactHref(phone: string | null | undefined): string {
  if (!phone) return "#";
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return "#";
  // Israeli numbers: convert leading 0 to +972
  const intl = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
  return `https://wa.me/${intl}`;
}
