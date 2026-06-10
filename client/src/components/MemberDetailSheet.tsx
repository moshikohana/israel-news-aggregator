import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  CHANNEL_OPTIONS,
  EVENT_TYPE_OPTIONS,
  FamilyEvent,
  contactHref,
  formatHebDate,
  formatShortDate,
  parseTags,
  statusColor,
  supportColor,
  voteColor,
} from "@/lib/crm";
import {
  CalendarHeart,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function MemberDetailSheet({
  memberId,
  seed,
  open,
  onOpenChange,
  onEdit,
}: {
  memberId: number | null;
  seed?: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit?: (member: any) => void;
}) {
  const utils = trpc.useUtils();
  // Use the member object already loaded in the list as initial data so the
  // sheet opens INSTANTLY (no spinner). The full record (incl. contactLog)
  // refreshes in the background. We only seed when the seed matches the
  // currently requested id to avoid showing stale data.
  const seedData =
    seed && memberId && seed.id === memberId ? { ...seed, contactLog: seed.contactLog ?? [] } : undefined;
  const { data: member, isLoading } = trpc.members.getById.useQuery(
    { id: memberId ?? 0 },
    { enabled: open && !!memberId, initialData: seedData as any },
  );

  const [logChannel, setLogChannel] = useState("טלפון");
  const [logNotes, setLogNotes] = useState("");

  const addLog = trpc.members.addContactLog.useMutation({
    onSuccess: () => {
      setLogNotes("");
      utils.members.getById.invalidate({ id: memberId ?? 0 });
      utils.members.list.invalidate();
      utils.events.needsContact.invalidate();
      toast.success("נרשם קשר חדש");
    },
    onError: (e) => toast.error(e.message),
  });

  const refresh = () => {
    utils.members.getById.invalidate({ id: memberId ?? 0 });
    utils.members.list.invalidate();
    utils.events.upcoming.invalidate();
  };

  const setVote = trpc.members.setVote.useMutation({
    onSuccess: (res) => {
      utils.members.getById.invalidate({ id: memberId ?? 0 });
      utils.members.list.invalidate();
      utils.stats.dashboard.invalidate();
      toast.success("סומן: " + res.voteStatus);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto" dir="rtl">
        {isLoading || !member ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <SheetHeader className="text-right">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg font-bold">
                  {member.fullName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-xl">{member.fullName}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(member.partyStatus)}`}>
                      {member.partyStatus || "ללא סטטוס"}
                    </span>
                    {member.activistsCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {member.activistsCount} מתפקדים
                      </span>
                    )}
                  </SheetDescription>
                </div>
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 bg-background"
                    onClick={() => onEdit(member)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> עריכה
                  </Button>
                )}
              </div>
            </SheetHeader>

            <div className="px-4 pb-8 space-y-5">
              {/* Quick actions */}
              <div className="flex gap-2">
                {member.phone && (
                  <>
                    <a href={`tel:${member.phone}`} className="flex-1">
                      <Button variant="outline" className="w-full bg-background gap-2">
                        <Phone className="h-4 w-4" /> חיוג
                      </Button>
                    </a>
                    <a href={contactHref(member.phone)} target="_blank" rel="noreferrer" className="flex-1">
                      <Button variant="outline" className="w-full bg-background gap-2">
                        <MessageCircle className="h-4 w-4" /> וואטסאפ
                      </Button>
                    </a>
                  </>
                )}
              </div>

              {/* Contact info */}
              <div className="rounded-xl border bg-card p-4 space-y-2 text-sm">
                {member.phone && (
                  <Row label="טלפון" value={<span dir="ltr">{member.phone}</span>} />
                )}
                {member.email && <Row label="אימייל" value={<span dir="ltr">{member.email}</span>} />}
                {(member.city || member.region) && (
                  <Row
                    label="מיקום"
                    value={
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {[member.city, member.region].filter(Boolean).join(", ")}
                      </span>
                    }
                  />
                )}
                {(member as any).supportLevel && (
                  <Row
                    label="עמדת תמיכה"
                    value={
                      <span className={`text-xs px-2 py-0.5 rounded-full ${supportColor((member as any).supportLevel)}`}>
                        {(member as any).supportLevel}
                      </span>
                    }
                  />
                )}
                {(member as any).assignedActivist && (
                  <Row label="ממריץ אחראי" value={(member as any).assignedActivist} />
                )}
                <Row
                  label="סטטוס הצבעה"
                  value={
                    <span className={`text-xs px-2 py-0.5 rounded-full ${voteColor((member as any).voteStatus)}`}>
                      {(member as any).voteStatus || "טרם הצביע"}
                    </span>
                  }
                />
                {member.address && <Row label="כתובת" value={member.address} />}
                {member.birthday && <Row label="יום הולדת" value={formatHebDate(member.birthday)} />}
                <Row label="קשר אחרון" value={formatShortDate(member.lastContactDate)} />
                <Row
                  label="מקור"
                  value={
                    (member as any).sourceType === "import"
                      ? `מיובא מקובץ${(member as any).sourceFile ? ` · ${(member as any).sourceFile}` : ""}`
                      : "הוזן ידנית"
                  }
                />
                {(member as any).sourceType === "import" && (member as any).importedAt && (
                  <Row label="נטען בתאריך" value={formatShortDate((member as any).importedAt)} />
                )}
              </div>

              {/* Vote toggle */}
              <Button
                variant={(member as any).voteStatus === "הצביע" ? "outline" : "default"}
                className="w-full gap-2"
                disabled={setVote.isPending}
                onClick={() =>
                  setVote.mutate({
                    id: member.id,
                    voted: (member as any).voteStatus !== "הצביע",
                  })
                }
              >
                {setVote.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {(member as any).voteStatus === "הצביע" ? "בטל סימון הצבעה" : "סמן כמי שהצביע"}
              </Button>

              {/* Tags */}
              {parseTags(member.tags).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {parseTags(member.tags).map((t) => (
                    <span key={t} className="text-xs rounded-full bg-accent text-accent-foreground px-2.5 py-1">
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {/* Notes */}
              {member.notes && (
                <div className="rounded-xl border bg-amber-50 border-amber-200 p-4">
                  <p className="text-xs font-semibold text-amber-800 mb-1">הערות אישיות</p>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                    {member.notes}
                  </p>
                </div>
              )}

              {/* Family events */}
              <FamilyEventsEditor
                memberId={member.id}
                events={member.familyEvents || []}
                onSaved={refresh}
              />

              {/* Add contact log */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <p className="text-sm font-semibold">רישום קשר חדש</p>
                <Select value={logChannel} onValueChange={setLogChannel}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder="סיכום השיחה / פגישה..."
                  className="bg-background min-h-[70px]"
                />
                <Button
                  onClick={() =>
                    addLog.mutate({ memberId: member.id, channel: logChannel, notes: logNotes })
                  }
                  disabled={addLog.isPending}
                  className="w-full gap-2"
                >
                  {addLog.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  רישום קשר (מעדכן תאריך קשר אחרון)
                </Button>
              </div>

              {/* Contact log history */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">היסטוריית קשר</p>
                {(member.contactLog || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">אין רישומי קשר עדיין.</p>
                ) : (
                  <div className="space-y-2">
                    {member.contactLog.map((log: any) => (
                      <div key={log.id} className="rounded-lg border bg-card p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{log.channel}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatShortDate(log.date)}
                          </span>
                        </div>
                        {log.notes && <p className="text-muted-foreground mt-1">{log.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-left">{value}</span>
    </div>
  );
}

function FamilyEventsEditor({
  memberId,
  events,
  onSaved,
}: {
  memberId: number;
  events: FamilyEvent[];
  onSaved: () => void;
}) {
  const utils = trpc.useUtils();
  const [list, setList] = useState<FamilyEvent[]>(events);
  const [dirty, setDirty] = useState(false);

  // Sync local editor state when fetched member events change.
  useEffect(() => {
    setList(events);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, JSON.stringify(events)]);

  const save = trpc.members.updateFamilyEvents.useMutation({
    onSuccess: () => {
      setDirty(false);
      utils.members.getById.invalidate({ id: memberId });
      onSaved();
      toast.success("אירועים משפחתיים נשמרו");
    },
    onError: (e) => toast.error(e.message),
  });

  const update = (i: number, patch: Partial<FamilyEvent>) => {
    setList((l) => l.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
    setDirty(true);
  };
  const add = () => {
    setList((l) => [...l, { type: "בר מצווה", date: "", description: "" }]);
    setDirty(true);
  };
  const remove = (i: number) => {
    setList((l) => l.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <CalendarHeart className="h-4 w-4 text-primary" /> אירועים משפחתיים
        </p>
        <Button variant="ghost" size="sm" onClick={add} className="h-7 gap-1 text-primary">
          <Plus className="h-3.5 w-3.5" /> הוסף
        </Button>
      </div>

      {list.length === 0 && <p className="text-sm text-muted-foreground">אין אירועים משפחתיים.</p>}

      {list.map((ev, i) => (
        <div key={i} className="rounded-lg border bg-background p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Select value={ev.type} onValueChange={(v) => update(i, { type: v })}>
              <SelectTrigger className="bg-card h-9 flex-1">
                <SelectValue placeholder="סוג" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={ev.date}
              onChange={(e) => update(i, { date: e.target.value })}
              className="bg-card h-9 w-40"
              dir="ltr"
            />
            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Input
            value={ev.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="תיאור (אופציונלי)"
            className="bg-card h-9"
          />
        </div>
      ))}

      {dirty && (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => save.mutate({ id: memberId, events: list })}
            disabled={save.isPending}
            className="gap-1"
          >
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            שמור שינויים
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setList(events);
              setDirty(false);
            }}
          >
            <X className="h-3.5 w-3.5 ml-1" /> בטל
          </Button>
        </div>
      )}
    </div>
  );
}
