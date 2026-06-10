import DashboardLayout from "@/components/DashboardLayout";
import MemberDetailSheet from "@/components/MemberDetailSheet";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { contactHref, formatShortDate, statusColor } from "@/lib/crm";
import {
  Award,
  Cake,
  CalendarHeart,
  Gift,
  Loader2,
  MessageCircle,
  Phone,
  PhoneCall,
  PieChart,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";

const RANGES = [
  { label: "7 ימים", value: 7 },
  { label: "30 יום", value: 30 },
  { label: "90 יום", value: 90 },
];

export default function Events() {
  return (
    <DashboardLayout>
      <EventsView />
    </DashboardLayout>
  );
}

function eventIcon(type: string) {
  if (type.includes("הולדת")) return Cake;
  if (type.includes("בר") || type.includes("בת") || type.includes("חתונה")) return Gift;
  return CalendarHeart;
}

function dayBucket(dateStr: string): "today" | "week" | "later" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff <= 0) return "today";
  if (diff <= 7) return "week";
  return "later";
}

function EventsView() {
  const [days, setDays] = useState(30);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: stats } = trpc.stats.dashboard.useQuery();
  const { data: events, isLoading: eventsLoading } = trpc.events.upcoming.useQuery({ days });
  const { data: needsContact, isLoading: ncLoading } = trpc.events.needsContact.useQuery({ days: 30 });

  const open = (id: number) => {
    setSelectedId(id);
    setSheetOpen(true);
  };

  const buckets = {
    today: (events || []).filter((e) => dayBucket(e.date) === "today"),
    week: (events || []).filter((e) => dayBucket(e.date) === "week"),
    later: (events || []).filter((e) => dayBucket(e.date) === "later"),
  };

  return (
    <div className="max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <CalendarHeart className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">אירועים ומשימות</h1>
          <p className="text-sm text-muted-foreground">ימי הולדת, אירועים משפחתיים ומי שצריך יצירת קשר</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Users} label="סה״כ חברים" value={stats?.total ?? "—"} />
        <StatCard icon={Users} label="סה״כ מתפקדים" value={stats?.totalActivists ?? "—"} />
        <StatCard icon={CalendarHeart} label={`אירועים ב-${days} ימים`} value={events?.length ?? "—"} />
        <StatCard icon={PhoneCall} label="ממתינים ליצירת קשר" value={needsContact?.length ?? "—"} highlight />
      </div>

      {/* Insights */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-8">
          {/* Status breakdown */}
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <PieChart className="h-4 w-4 text-primary" /> פילוח לפי סטטוס
            </p>
            <div className="space-y-2">
              {(stats.byStatus || [])
                .filter((s) => s.status)
                .map((s) => {
                  const pct = stats.total ? Math.round((s.count / stats.total) * 100) : 0;
                  return (
                    <div key={s.status}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{s.status}</span>
                        <span className="text-muted-foreground">
                          {s.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              {(stats.byStatus || []).filter((s) => s.status).length === 0 && (
                <p className="text-xs text-muted-foreground">אין נתונים.</p>
              )}
            </div>
          </div>

          {/* Top activists */}
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <Award className="h-4 w-4 text-amber-500" /> מובילי מתפקדים
            </p>
            <div className="space-y-1.5">
              {(stats.topActivists || []).slice(0, 5).map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => open(m.id)}
                  className="w-full flex items-center gap-2 text-right rounded-lg px-2 py-1 hover:bg-accent/50 transition-colors"
                >
                  <span className="h-5 w-5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium truncate flex-1">{m.fullName}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {m.activistsCount.toLocaleString()}
                  </span>
                </button>
              ))}
              {(stats.topActivists || []).length === 0 && (
                <p className="text-xs text-muted-foreground">אין נתונים.</p>
              )}
            </div>
          </div>

          {/* Contact coverage */}
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> כיסוי קשר (30 יום)
            </p>
            {(() => {
              const pct = stats.total
                ? Math.round((stats.contactedRecent / stats.total) * 100)
                : 0;
              return (
                <div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-bold text-emerald-600">{pct}%</span>
                    <span className="text-xs text-muted-foreground mb-1">
                      {stats.contactedRecent} מתוך {stats.total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">לא דובר מעולם</span>
                    <span className="font-medium text-destructive">{stats.neverContacted}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Range selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">טווח אירועים:</span>
        {RANGES.map((r) => (
          <Button
            key={r.value}
            variant={days === r.value ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(r.value)}
            className={days === r.value ? "" : "bg-background"}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {/* Events grouped */}
      {eventsLoading ? (
        <Loader className="" />
      ) : (events || []).length === 0 ? (
        <Empty text={`אין אירועים ב-${days} הימים הקרובים.`} icon={CalendarHeart} />
      ) : (
        <div className="space-y-6">
          <EventGroup title="היום" events={buckets.today} onOpen={open} accent="bg-destructive" />
          <EventGroup title="השבוע הקרוב" events={buckets.week} onOpen={open} accent="bg-primary" />
          <EventGroup title="בהמשך" events={buckets.later} onOpen={open} accent="bg-muted-foreground" />
        </div>
      )}

      {/* Needs contact */}
      <div className="mt-8">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <PhoneCall className="h-5 w-5 text-primary" />
          לא דובר מעל 30 יום
        </h2>
        {ncLoading ? (
          <Loader className="" />
        ) : (needsContact || []).length === 0 ? (
          <Empty text="כל החברים בקשר עדכני. כל הכבוד!" icon={PhoneCall} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {needsContact!.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border bg-card p-3 flex items-center gap-3 hover:border-primary/40 transition-colors"
              >
                <button onClick={() => open(m.id)} className="flex items-center gap-3 flex-1 min-w-0 text-right">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                    {m.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.lastContactDate ? `קשר אחרון: ${formatShortDate(m.lastContactDate)}` : "לא דובר מעולם"}
                    </p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${statusColor(m.partyStatus)}`}>
                    {m.partyStatus || "ללא סטטוס"}
                  </span>
                </button>
                {m.phone && (
                  <div className="flex gap-1 shrink-0">
                    <a href={`tel:${m.phone}`}>
                      <Button variant="outline" size="icon" className="h-9 w-9 bg-background">
                        <Phone className="h-4 w-4" />
                      </Button>
                    </a>
                    <a href={contactHref(m.phone)} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="icon" className="h-9 w-9 bg-background">
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <MemberDetailSheet memberId={selectedId} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}

function EventGroup({
  title,
  events,
  onOpen,
  accent,
}: {
  title: string;
  events: any[];
  onOpen: (id: number) => void;
  accent: string;
}) {
  if (events.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-2 w-2 rounded-full ${accent}`} />
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">({events.length})</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {events.map((e, i) => {
          const Icon = eventIcon(e.type);
          return (
            <button
              key={`${e.memberId}-${i}`}
              onClick={() => onOpen(e.memberId)}
              className="rounded-xl border bg-card p-3 flex items-center gap-3 hover:border-primary/40 transition-colors text-right"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {e.type} — {e.fullName}
                </p>
                <p className="text-xs text-muted-foreground truncate">{e.description}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{formatShortDate(e.date)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <div className="flex items-center justify-between">
        <Icon className={`h-5 w-5 ${highlight ? "text-primary-foreground/80" : "text-primary"}`} />
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
      <p className={`text-xs mt-0.5 ${highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
        {label}
      </p>
    </div>
  );
}

function Loader({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center h-32 ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function Empty({ text, icon: Icon }: { text: string; icon: any }) {
  return (
    <div className="text-center py-10 text-muted-foreground rounded-xl border bg-card">
      <Icon className="h-9 w-9 mx-auto mb-2 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
