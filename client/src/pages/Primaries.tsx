import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  contactHref,
  supportColor,
  type Member,
} from "@/lib/crm";
import {
  CheckCircle2,
  Phone,
  MessageCircle,
  Search,
  Vote,
  Users,
  Trophy,
  Target,
} from "lucide-react";

const SUPPORT_ORDER: string[] = ["תומך", "נוטה", "מתלבט", "מתנגד", "לא ידוע"];

export default function Primaries() {
  const utils = trpc.useUtils();
  const statsQuery = trpc.stats.dashboard.useQuery();
  // Focus list: supporters/leaning who have NOT voted yet (GOTV targets).
  const [q, setQ] = useState("");
  const notVotedQuery = trpc.members.list.useQuery({ vote: "טרם הצביע", sort: "name", page: 1, pageSize: 200 });

  const setVote = trpc.members.setVote.useMutation({
    onMutate: async ({ id, voted }) => {
      await utils.members.list.cancel({ vote: "טרם הצביע", sort: "name", page: 1, pageSize: 200 });
      const prev = utils.members.list.getData({ vote: "טרם הצביע", sort: "name", page: 1, pageSize: 200 });
      if (voted && prev) {
        utils.members.list.setData(
          { vote: "טרם הצביע", sort: "name", page: 1, pageSize: 200 },
          { ...prev, items: prev.items.filter((m) => m.id !== id) },
        );
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) utils.members.list.setData({ vote: "טרם הצביע", sort: "name" }, ctx.prev);
      toast.error(err.message || "שגיאה בעדכון");
    },
    onSuccess: (res) => {
      if (res.alreadyMarked) toast.info("החבר כבר היה מסומן");
      else toast.success("סומן: " + res.voteStatus);
    },
    onSettled: () => {
      utils.members.list.invalidate();
      utils.stats.dashboard.invalidate();
    },
  });

  const members = (notVotedQuery.data?.items ?? []) as Member[];
  const priorityTargets = useMemo(() => {
    const filtered = members.filter((m) =>
      q.trim() ? m.fullName.includes(q.trim()) || (m.city ?? "").includes(q.trim()) : true,
    );
    // Supporters & leaning first — these are the votes worth chasing.
    const rank = (l: string | null | undefined) =>
      l === "תומך" ? 0 : l === "נוטה" ? 1 : l === "מתלבט" ? 2 : 3;
    return filtered.sort((a, b) => rank(a.supportLevel) - rank(b.supportLevel));
  }, [members, q]);

  const stats = statsQuery.data;
  const total = stats?.total ?? 0;
  const voted = stats?.voted ?? 0;
  const turnout = total > 0 ? Math.round((voted / total) * 1000) / 10 : 0;
  const bySupport = stats?.bySupport ?? [];
  const supportMap = new Map<string, number>(
    bySupport.map((s) => [String(s.support ?? "לא ידוע"), s.count] as [string, number]),
  );
  const byActivist = (stats?.byActivist ?? []).slice();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Vote className="size-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">פריימריז ויום בחירות</h1>
          <p className="text-sm text-muted-foreground">
            מעקב הצבעה בזמן אמת והמרצת תומכים שטרם הצביעו
          </p>
        </div>
      </div>

      {!statsQuery.isLoading && total === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Vote className="size-6 text-primary" />
            </div>
            <p className="font-medium">אין עדיין נתוני חברים</p>
            <p className="max-w-md text-sm text-muted-foreground">
              ייבאו קובץ אקסל של מתפקדים/בעלי זכות הצבעה דרך מסך הניהול כדי לראות כאן
              אחוזי הצבעה בזמן אמת, פירמידת תמיכה ורשימת המרצה.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Live turnout */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-4 text-primary" /> אחוז הצבעה חי
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-primary">{turnout}%</span>
                  <span className="pb-1 text-sm text-muted-foreground">
                    {voted.toLocaleString()} מתוך {total.toLocaleString()}
                  </span>
                </div>
                <Progress value={turnout} className="mt-3 h-2.5" />
              </>
            )}
          </CardContent>
        </Card>

        {/* Support pyramid */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" /> פירמידת תמיכה
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="space-y-2">
                {SUPPORT_ORDER.map((level) => {
                  const count = supportMap.get(level) ?? 0;
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={level} className="flex items-center gap-3">
                      <Badge className={`${supportColor(level)} w-20 justify-center`}>{level}</Badge>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/70 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-10 text-left text-sm tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </div>
                  );
                })}
                <p className="pt-1 text-[11px] leading-snug text-muted-foreground">
                  “לא ידוע” = טרם דווחה עמדת תמיכה לחבר. עדכנו עמדה דרך כרטיס החבר
                  כדי שישתקף כאן.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activist leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="size-4 text-amber-500" /> לוח מובילי ממריצים
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : byActivist.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">אין ממריצים משויכים עדיין</p>
          ) : (
            <div className="space-y-2">
              {byActivist.map((a, i) => {
                const pct = a.total > 0 ? Math.round((a.voted / a.total) * 100) : 0;
                return (
                  <div
                    key={a.activist ?? i}
                    className="flex items-center gap-3 rounded-lg border bg-card/50 px-3 py-2"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="flex-1 font-medium">{a.activist}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.supporters} תומכים · {a.total} משויכים
                    </span>
                    <Badge variant="secondary" className="tabular-nums">
                      {pct}% הצביעו
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* GOTV: not-voted target list */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-primary" /> רשימת המרצה — טרם הצביעו
              <Badge variant="secondary">{priorityTargets.length}</Badge>
            </CardTitle>
            <div className="relative w-full max-w-xs">
              <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="חיפוש שם או עיר…"
                className="pr-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {notVotedQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : priorityTargets.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              כל החברים סומנו כמי שהצביעו — כל הכבוד!
            </p>
          ) : (
            <div className="divide-y">
              {priorityTargets.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{m.fullName}</span>
                      {m.supportLevel && (
                        <Badge className={`${supportColor(m.supportLevel)} text-xs`}>
                          {m.supportLevel}
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {[m.city, m.region, m.assignedActivist ? `ממריץ: ${m.assignedActivist}` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {m.phone && (
                      <>
                        <Button asChild size="icon" variant="outline" className="size-9">
                          <a href={`tel:${m.phone}`} aria-label="חיוג">
                            <Phone className="size-4" />
                          </a>
                        </Button>
                        <Button asChild size="icon" variant="outline" className="size-9">
                          <a
                            href={contactHref(m.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="וואטסאפ"
                          >
                            <MessageCircle className="size-4" />
                          </a>
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={setVote.isPending}
                      onClick={() => setVote.mutate({ id: m.id, voted: true })}
                    >
                      <CheckCircle2 className="size-4" /> סמן הצביע
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
