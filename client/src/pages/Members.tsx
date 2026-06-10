import DashboardLayout from "@/components/DashboardLayout";
import MemberDetailSheet from "@/components/MemberDetailSheet";
import AddMemberModal from "@/components/AddMemberModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  contactHref,
  daysSince,
  formatShortDate,
  parseTags,
  statusColor,
  supportColor,
  voteColor,
  SUPPORT_OPTIONS,
  VOTE_OPTIONS,
} from "@/lib/crm";
import {
  Loader2,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const ALL = "__all__";

export default function Members() {
  return (
    <DashboardLayout>
      <MembersView />
    </DashboardLayout>
  );
}

function useQueryParam(name: string): string {
  const [val] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get(name) ?? "";
  });
  return val;
}

function MembersView() {
  const initialQ = useQueryParam("q");
  const [q, setQ] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  const [region, setRegion] = useState(ALL);
  const [city, setCity] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [contacted, setContacted] = useState<"" | "recent7" | "recent30" | "over30" | "never">("");
  const [support, setSupport] = useState(ALL);
  const [vote, setVote] = useState<"" | "הצביע" | "טרם הצביע">("");
  const [activist, setActivist] = useState(ALL);
  const [sort, setSort] = useState<"name" | "recent" | "activists">("name");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<any | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const filters = useMemo(
    () => ({
      q: debouncedQ || undefined,
      region: region === ALL ? undefined : region,
      city: city === ALL ? undefined : city,
      status: status === ALL ? undefined : status,
      contacted: contacted || undefined,
      support: support === ALL ? undefined : support,
      vote: vote || undefined,
      activist: activist === ALL ? undefined : activist,
      sort,
    }),
    [debouncedQ, region, city, status, contacted, support, vote, activist, sort],
  );

  const PAGE_SIZE = 48;
  const [page, setPage] = useState(1);
  // Reset to first page whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const { data: pageData, isLoading } = trpc.members.list.useQuery({ ...filters, page, pageSize: PAGE_SIZE });
  const { data: options } = trpc.members.filterOptions.useQuery();
  const { data: activistList } = trpc.members.activistOptions.useQuery();

  // Accumulate pages so "load more" appends instead of replacing. We key the
  // accumulator by a stable signature of the active filters.
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  const [acc, setAcc] = useState<any[]>([]);
  const [accKey, setAccKey] = useState<string>(filterKey);
  useEffect(() => {
    if (!pageData) return;
    if (accKey !== filterKey || pageData.page === 1) {
      setAcc(pageData.items);
      setAccKey(filterKey);
    } else {
      setAcc((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const next = pageData.items.filter((m) => !seen.has(m.id));
        return [...prev, ...next];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageData, filterKey]);

  const members = acc;
  const total = pageData?.total ?? 0;
  const hasMore = pageData?.hasMore ?? false;

  const [selectedSeed, setSelectedSeed] = useState<any | null>(null);

  const openMember = (m: any) => {
    setSelectedSeed(m);
    setSelectedId(m.id);
    setSheetOpen(true);
  };

  const openEdit = (m: any) => {
    setEditMember(m);
    setAddOpen(true);
  };

  // When arriving from a chat search link (/members?q=NAME) with exactly one
  // matching contact, auto-open that contact's detail sheet for quick editing.
  useEffect(() => {
    if (autoOpened) return;
    if (!initialQ) return;
    if (!members) return;
    if (members.length === 1 && total === 1) {
      setSelectedId(members[0].id);
      setSheetOpen(true);
      setAutoOpened(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, initialQ, autoOpened]);

  const hasActiveFilters =
    region !== ALL ||
    city !== ALL ||
    status !== ALL ||
    contacted !== "" ||
    support !== ALL ||
    vote !== "" ||
    activist !== ALL ||
    !!debouncedQ;

  const resetFilters = () => {
    setQ("");
    setRegion(ALL);
    setCity(ALL);
    setStatus(ALL);
    setContacted("");
    setSupport(ALL);
    setVote("");
    setActivist(ALL);
    setSort("name");
  };

  return (
    <div className="max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">חברים ומתפקדים</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading && members.length === 0
                ? "טוען..."
                : `${total.toLocaleString("he-IL")} רשומות${
                    members.length < total ? ` · מוצגות ${members.length.toLocaleString("he-IL")}` : ""
                  }`}
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditMember(null);
            setAddOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> הוסף חבר
        </Button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-card p-4 mb-5 space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש לפי שם, עיר, תגית, הערות..."
            className="pr-10 bg-background"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <FilterSelect
            value={region}
            onChange={setRegion}
            placeholder="אזור"
            options={options?.regions || []}
          />
          <FilterSelect
            value={city}
            onChange={setCity}
            placeholder="עיר"
            options={options?.cities || []}
          />
          <FilterSelect
            value={status}
            onChange={setStatus}
            placeholder="סטטוס"
            options={options?.statuses || []}
          />
          <Select value={contacted || ALL} onValueChange={(v) => setContacted(v === ALL ? "" : (v as any))}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="קשר אחרון" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>כל הקשרים</SelectItem>
              <SelectItem value="recent7">דובר ב-7 ימים</SelectItem>
              <SelectItem value="recent30">דובר ב-30 יום</SelectItem>
              <SelectItem value="over30">לא דובר מעל חודש</SelectItem>
              <SelectItem value="never">לא דובר מעולם</SelectItem>
            </SelectContent>
          </Select>
          <Select value={support} onValueChange={setSupport}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="עמדת תמיכה" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>תמיכה: הכל</SelectItem>
              {SUPPORT_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={vote || ALL} onValueChange={(v) => setVote(v === ALL ? "" : (v as any))}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="הצבעה" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>הצבעה: הכל</SelectItem>
              {VOTE_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FilterSelect
            value={activist}
            onChange={setActivist}
            placeholder="ממריץ"
            options={activistList || []}
          />
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="מיון" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">מיון: שם</SelectItem>
              <SelectItem value="recent">מיון: קשר אחרון</SelectItem>
              <SelectItem value="activists">מיון: מספר מתפקדים</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> נקה סינון
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading && members.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          {hasActiveFilters ? (
            <>
              <p>לא נמצאו חברים התואמים את הסינון.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={resetFilters}>
                איפוס סינון
              </Button>
            </>
          ) : (
            <>
              <p>עדיין אין חברים במערכת.</p>
              <p className="text-sm mt-1">הוסיפו חבר ידנית או ייבאו קובץ אקסל ממסך הניהול.</p>
              <Button size="sm" className="mt-3 gap-1.5" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> הוספת חבר
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {members.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                onClick={() => openMember(m)}
                onEdit={() => openEdit(m)}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                className="bg-background gap-2"
                disabled={isLoading}
                onClick={() => setPage((p) => p + 1)}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                טען עוד ({(total - members.length).toLocaleString("he-IL")} נותרו)
              </Button>
            </div>
          )}
        </>
      )}

      <MemberDetailSheet
        memberId={selectedId}
        seed={selectedSeed}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEdit={(m) => {
          setSheetOpen(false);
          // Defer opening the edit dialog until after the sheet has closed so
          // two overlay focus-traps don't reconcile in the same tick (caused a stall).
          setTimeout(() => openEdit(m), 150);
        }}
      />
      <AddMemberModal
        open={addOpen}
        onOpenChange={(v) => {
          setAddOpen(v);
          if (!v) setEditMember(null);
        }}
        editMember={editMember}
      />
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-background">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}: הכל</SelectItem>
        {options.filter(Boolean).map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MemberCard({
  member,
  onClick,
  onEdit,
}: {
  member: any;
  onClick: () => void;
  onEdit: () => void;
}) {
  const since = daysSince(member.lastContactDate);
  const overdue = since === null || since > 30;
  const tags = parseTags(member.tags);

  return (
    <div
      onClick={onClick}
      className="rounded-xl border bg-card p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-base font-bold shrink-0">
          {member.fullName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate flex-1">{member.fullName}</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              aria-label="עריכת חבר"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(member.partyStatus)}`}>
              {member.partyStatus || "ללא סטטוס"}
            </span>
            {member.activistsCount > 0 && (
              <span className="text-xs text-muted-foreground">{member.activistsCount} מתפקדים</span>
            )}
            {member.supportLevel && member.supportLevel !== "לא ידוע" && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${supportColor(member.supportLevel)}`}>
                {member.supportLevel}
              </span>
            )}
            {member.voteStatus === "הצביע" && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${voteColor(member.voteStatus)}`}>
                הצביע
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        {(member.city || member.region) && (
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {[member.city, member.region].filter(Boolean).join(", ")}
          </p>
        )}
        <p className={overdue ? "text-destructive" : ""}>
          קשר אחרון: {formatShortDate(member.lastContactDate)}
          {since !== null && ` (לפני ${since} ימים)`}
        </p>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[11px] rounded-full bg-accent text-accent-foreground px-2 py-0.5">
              #{t}
            </span>
          ))}
        </div>
      )}

      {member.phone && (
        <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
          <a href={`tel:${member.phone}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full bg-background gap-1.5 h-8">
              <Phone className="h-3.5 w-3.5" /> חיוג
            </Button>
          </a>
          <a href={contactHref(member.phone)} target="_blank" rel="noreferrer" className="flex-1">
            <Button variant="outline" size="sm" className="w-full bg-background gap-1.5 h-8">
              <MessageCircle className="h-3.5 w-3.5" /> וואטסאפ
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}
