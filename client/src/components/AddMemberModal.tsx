import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { STATUS_OPTIONS, SUPPORT_OPTIONS, VOTE_OPTIONS } from "@/lib/crm";
import { Loader2 } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

/**
 * Performance-first member form.
 *
 * Previous versions kept the whole form in a single `useState` object, so every
 * keystroke re-rendered the entire dialog (including three Radix Selects),
 * making typing feel laggy. This version uses fully *uncontrolled* inputs: the
 * DOM holds the values, React never re-renders on input, and we read everything
 * once on submit. Native <select> elements replace Radix Selects to avoid
 * portal/focus-trap mount costs entirely.
 */

type MemberLike = {
  id?: number;
  fullName?: string;
  phone?: string;
  email?: string;
  city?: string;
  region?: string;
  address?: string;
  birthday?: string | number | Date | null;
  partyStatus?: string;
  activistsCount?: number | string;
  supportLevel?: string;
  voteStatus?: string;
  assignedActivist?: string;
  notes?: string;
  tags?: string;
};

function birthdayValue(v: MemberLike["birthday"]): string {
  if (!v) return "";
  return String(v).slice(0, 10);
}

export default function AddMemberModal({
  open,
  onOpenChange,
  editMember,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editMember?: MemberLike | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        {open && (
          <MemberForm
            key={editMember?.id ?? "new"}
            editMember={editMember}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MemberForm({
  editMember,
  onOpenChange,
}: {
  editMember?: MemberLike | null;
  onOpenChange: (v: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const isEdit = !!editMember;

  // Uncontrolled form — values live in the DOM, no re-render on keystroke.
  const formRef = useRef<HTMLFormElement>(null);

  const onDone = () => {
    utils.members.list.invalidate();
    utils.members.filterOptions.invalidate();
    utils.stats.dashboard.invalidate();
    onOpenChange(false);
  };

  const create = trpc.members.create.useMutation({
    onSuccess: () => {
      toast.success("החבר נוסף בהצלחה");
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.members.update.useMutation({
    onSuccess: () => {
      toast.success("הפרטים עודכנו");
      if (editMember?.id) utils.members.getById.invalidate({ id: editMember.id });
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const pending = create.isPending || update.isPending;

  const submit = () => {
    const el = formRef.current;
    if (!el) return;
    const get = (name: string) =>
      (el.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)
        ?.value ?? "";

    const fullName = get("fullName").trim();
    if (!fullName) {
      toast.error("יש להזין שם מלא");
      return;
    }
    const activistsRaw = get("activistsCount").trim();
    const payload = {
      fullName,
      phone: get("phone").trim() || null,
      email: get("email").trim() || null,
      city: get("city").trim() || null,
      region: get("region").trim() || null,
      address: get("address").trim() || null,
      birthday: get("birthday") || null,
      partyStatus: get("partyStatus") || "מתפקד",
      activistsCount: activistsRaw ? parseInt(activistsRaw, 10) || 0 : 0,
      supportLevel: (get("supportLevel") || "לא ידוע") as any,
      voteStatus: (get("voteStatus") || "טרם הצביע") as any,
      assignedActivist: get("assignedActivist").trim() || null,
      notes: get("notes").trim() || null,
      tags: get("tags").trim() || null,
    };
    if (isEdit && editMember?.id) update.mutate({ id: editMember.id, data: payload });
    else create.mutate(payload);
  };

  return (
    <>
      <DialogHeader className="text-right">
        <DialogTitle>{isEdit ? "עריכת חבר" : "הוספת חבר חדש"}</DialogTitle>
        <DialogDescription>מלא את פרטי החבר. רק שם מלא הוא שדה חובה.</DialogDescription>
      </DialogHeader>

      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="שם מלא *" className="sm:col-span-2">
            <Input name="fullName" defaultValue={editMember?.fullName || ""} autoFocus />
          </Field>
          <Field label="טלפון">
            <Input name="phone" defaultValue={editMember?.phone || ""} dir="ltr" />
          </Field>
          <Field label="אימייל">
            <Input name="email" defaultValue={editMember?.email || ""} dir="ltr" />
          </Field>
          <Field label="עיר">
            <Input name="city" defaultValue={editMember?.city || ""} />
          </Field>
          <Field label="אזור">
            <Input name="region" defaultValue={editMember?.region || ""} />
          </Field>
          <Field label="כתובת" className="sm:col-span-2">
            <Input name="address" defaultValue={editMember?.address || ""} />
          </Field>
          <Field label="תאריך לידה">
            <Input
              type="date"
              name="birthday"
              defaultValue={birthdayValue(editMember?.birthday)}
              dir="ltr"
            />
          </Field>
          <Field label="מספר מתפקדים">
            <Input
              type="number"
              min={0}
              name="activistsCount"
              defaultValue={
                editMember?.activistsCount ? String(editMember.activistsCount) : ""
              }
              dir="ltr"
            />
          </Field>
          <Field label="סטטוס">
            <NativeSelect name="partyStatus" defaultValue={editMember?.partyStatus || "מתפקד"} options={STATUS_OPTIONS} />
          </Field>
          <Field label="עמדת תמיכה">
            <NativeSelect name="supportLevel" defaultValue={editMember?.supportLevel || "לא ידוע"} options={SUPPORT_OPTIONS} />
          </Field>
          <Field label="סטטוס הצבעה">
            <NativeSelect name="voteStatus" defaultValue={editMember?.voteStatus || "טרם הצביע"} options={VOTE_OPTIONS} />
          </Field>
          <Field label="ממריץ אחראי">
            <Input
              name="assignedActivist"
              defaultValue={editMember?.assignedActivist || ""}
              placeholder="שם הממריץ / ראש הקבוצה"
            />
          </Field>
          <Field label="תגיות (מופרדות בפסיק)">
            <Input name="tags" defaultValue={editMember?.tags || ""} placeholder="תורם, מתנדב" />
          </Field>
          <Field label="הערות אישיות" className="sm:col-span-2">
            <Textarea
              name="notes"
              defaultValue={editMember?.notes || ""}
              placeholder="היכן גר, קשרי משפחה, נושאים רגישים..."
              className="min-h-[80px]"
            />
          </Field>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button type="submit" disabled={pending} className="gap-2">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "שמירת שינויים" : "הוספת חבר"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

// Native select — no Radix portal/focus-trap, renders instantly and is fully
// accessible. Styled to match the input controls.
function NativeSelect({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: readonly string[];
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {options.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
