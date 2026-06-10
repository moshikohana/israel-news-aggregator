import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Eye, Pencil, Plus, Trash2, Vote, Lock } from "lucide-react";

const ACTION_META: Record<
  string,
  { label: string; icon: React.ElementType; cls: string }
> = {
  view: { label: "צפייה", icon: Eye, cls: "bg-slate-100 text-slate-600" },
  create: { label: "יצירה", icon: Plus, cls: "bg-emerald-100 text-emerald-700" },
  update: { label: "עדכון", icon: Pencil, cls: "bg-amber-100 text-amber-700" },
  delete: { label: "מחיקה", icon: Trash2, cls: "bg-rose-100 text-rose-700" },
  vote: { label: "הצבעה", icon: Vote, cls: "bg-primary/10 text-primary" },
};

export default function AuditLog() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading, error } = trpc.stats.auditLog.useQuery(
    { limit: 200 },
    { enabled: isAdmin, retry: false },
  );

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <Lock className="size-10 text-muted-foreground" />
        <h1 className="text-xl font-bold">גישה למנהלים בלבד</h1>
        <p className="text-sm text-muted-foreground">
          יומן הביקורת חושף מידע רגיש וזמין רק לבעלי הרשאת ניהול.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <ShieldCheck className="size-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">יומן ביקורת</h1>
          <p className="text-sm text-muted-foreground">
            תיעוד מלא של כל גישה ושינוי במידע רגיש — מי, מה ומתי
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">פעולות אחרונות</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <p className="py-6 text-center text-sm text-destructive">
              שגיאה בטעינת היומן: {error.message}
            </p>
          ) : !data || data.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              אין רישומים ביומן עדיין.
            </p>
          ) : (
            <div className="divide-y">
              {data.map((entry: any) => {
                const meta = ACTION_META[entry.action] ?? {
                  label: entry.action,
                  icon: Eye,
                  cls: "bg-muted text-muted-foreground",
                };
                const Icon = meta.icon;
                return (
                  <div key={entry.id} className="flex items-center gap-3 py-2.5">
                    <div className={`rounded-lg p-1.5 ${meta.cls}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        <span className="font-medium">{entry.actorName || "משתמש"}</span>{" "}
                        <Badge variant="secondary" className="mx-1 text-xs">
                          {meta.label}
                        </Badge>
                        <span className="text-muted-foreground">{entry.detail}</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString("he-IL")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
