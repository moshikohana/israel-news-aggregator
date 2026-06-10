import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { contactHref, statusColor, supportColor } from "@/lib/crm";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ExternalLink, Loader2, MapPin, MessageCircle, Phone, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type DuplicateGroup = {
  fullName: string;
  phone: string;
  ids: number[];
};

// A single member returned from a chat query, rendered as a rich card with
// quick actions (call, WhatsApp, open the member's page).
export function MemberResultCard({
  row,
  onOpen,
}: {
  row: Record<string, any>;
  onOpen: (name: string) => void;
}) {
  const fullName = String(row.full_name ?? "").trim();
  const phone = row.phone ? String(row.phone).trim() : "";
  const partyStatus = row.party_status as string | null | undefined;
  const supportLevel = row.support_level as string | null | undefined;
  const city = row.city as string | null | undefined;
  const region = row.region as string | null | undefined;
  const notes = row.notes as string | null | undefined;

  return (
    <div className="rounded-xl border bg-background p-3 text-sm flex flex-col gap-2" dir="rtl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-semibold">{fullName}</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {partyStatus && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(partyStatus)}`}>
              {partyStatus}
            </span>
          )}
          {supportLevel && supportLevel !== "לא ידוע" && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${supportColor(supportLevel)}`}>
              {supportLevel}
            </span>
          )}
        </div>
      </div>

      {(city || region) && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3 shrink-0" />
          {[city, region].filter(Boolean).join(" · ")}
        </div>
      )}

      {notes && <p className="text-xs text-muted-foreground line-clamp-2">{notes}</p>}

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {phone && (
          <>
            <a href={`tel:${phone}`} className="flex-1 min-w-[88px]">
              <Button variant="outline" size="sm" className="w-full gap-1.5">
                <Phone className="h-3.5 w-3.5" /> חיוג
              </Button>
            </a>
            <a href={contactHref(phone)} target="_blank" rel="noreferrer" className="flex-1 min-w-[88px]">
              <Button variant="outline" size="sm" className="w-full gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" /> וואטסאפ
              </Button>
            </a>
          </>
        )}
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onOpen(fullName)}>
          <ExternalLink className="h-3.5 w-3.5" /> פתח כרטיס
        </Button>
      </div>
    </div>
  );
}

// A block highlighting a likely duplicate (same normalized name AND phone),
// letting the user pick which record to keep and delete the rest.
export function DuplicateGroupCard({
  group,
  rows,
  onOpen,
}: {
  group: DuplicateGroup;
  rows: Record<string, any>[];
  onOpen: (name: string) => void;
}) {
  const groupRows = group.ids
    .map((id) => rows.find((r) => Number(r.id) === id))
    .filter(Boolean) as Record<string, any>[];
  const [keepId, setKeepId] = useState<number>(group.ids[0]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resolved, setResolved] = useState(false);

  const utils = trpc.useUtils();
  const removeMany = trpc.members.removeMany.useMutation({
    onSuccess: (res) => {
      toast.success(`נמחקו ${res.deleted} כפילויות`);
      utils.members.list.invalidate();
      utils.members.filterOptions.invalidate();
      utils.stats.dashboard.invalidate();
      setConfirmOpen(false);
      setResolved(true);
    },
    onError: (e) => toast.error(e.message),
  });

  if (resolved) return null;

  const toDelete = group.ids.filter((id) => id !== keepId);

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm flex flex-col gap-2" dir="rtl">
      <div className="flex items-center gap-2 text-amber-800 font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        כפילות אפשרית: {group.fullName} ({group.phone})
      </div>
      <p className="text-xs text-amber-700">
        נמצאו {group.ids.length} רשומות עם אותו שם ומספר טלפון. בחר איזו רשומה להשאיר:
      </p>
      <div className="flex flex-col gap-1.5">
        {groupRows.map((row) => (
          <label
            key={row.id}
            className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 cursor-pointer text-xs"
          >
            <input
              type="radio"
              name={`dup-${group.fullName}-${group.phone}`}
              checked={keepId === row.id}
              onChange={() => setKeepId(row.id)}
            />
            <span className="flex-1">
              #{row.id} · {row.city || "—"} · {row.party_status || "—"}
              {row.notes ? ` · ${String(row.notes).slice(0, 40)}` : ""}
            </span>
          </label>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onOpen(group.fullName)}>
          <ExternalLink className="h-3.5 w-3.5" /> פתח כרטיס
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="gap-1.5"
          disabled={toDelete.length === 0}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" /> השאר רשומה אחת ומחק {toDelete.length} כפילויות
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת כפילויות</AlertDialogTitle>
            <AlertDialogDescription>
              האם למחוק {toDelete.length} רשומות כפולות עבור {group.fullName} ({group.phone})? תישאר רק
              רשומה #{keepId}. פעולה זו תמחק גם את היסטוריית הקשר ואינה הפיכה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
              onClick={() => removeMany.mutate({ ids: toDelete })}
              disabled={removeMany.isPending}
            >
              {removeMany.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
