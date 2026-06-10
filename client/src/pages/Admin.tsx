import DashboardLayout from "@/components/DashboardLayout";
import AddMemberModal from "@/components/AddMemberModal";
import ImportModal from "@/components/ImportModal";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  formatShortDate,
  sourceColor,
  sourceLabel,
  statusColor,
} from "@/lib/crm";
import {
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Admin() {
  return (
    <DashboardLayout>
      <AdminView />
    </DashboardLayout>
  );
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

function AdminView() {
  const utils = trpc.useUtils();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [source, setSource] = useState<"all" | "manual" | "import">("all");
  const [editMember, setEditMember] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [batchesOpen, setBatchesOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const [adminPage, setAdminPage] = useState(1);
  const ADMIN_PAGE_SIZE = 100;
  useEffect(() => {
    setAdminPage(1);
  }, [debouncedQ, source]);
  const { data: pageData, isLoading } = trpc.members.list.useQuery({
    q: debouncedQ || undefined,
    source: source === "all" ? undefined : source,
    sort: "name",
    page: adminPage,
    pageSize: ADMIN_PAGE_SIZE,
  });
  const members = pageData?.items;
  const membersTotal = pageData?.total ?? 0;
  const membersHasMore = pageData?.hasMore ?? false;

  const remove = trpc.members.remove.useMutation({
    onSuccess: () => {
      utils.members.list.invalidate();
      utils.stats.dashboard.invalidate();
      toast.success("החבר נמחק");
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const exportMut = trpc.import.exportMembers.useMutation({
    onSuccess: (res) => {
      const blob = base64ToBlob(
        res.fileBase64,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `חברים-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`יוצאו ${res.count} חברים לקובץ Excel`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">ניהול נתונים</h1>
            <p className="text-sm text-muted-foreground">הוספה, עריכה, מחיקה, ייבוא וייצוא חברים</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setBatchesOpen(true)}
            className="gap-2 bg-background"
          >
            <History className="h-4 w-4" /> אצוות ייבוא
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              exportMut.mutate({
                q: debouncedQ || undefined,
                source: source === "all" ? undefined : source,
              })
            }
            disabled={exportMut.isPending}
            className="gap-2 bg-background"
          >
            {exportMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            ייצוא ל-Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="gap-2 bg-background"
          >
            <FileSpreadsheet className="h-4 w-4" /> ייבוא מ-Excel
          </Button>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> הוסף חבר
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש חבר..."
            className="pr-10 bg-card"
          />
        </div>
        <Select value={source} onValueChange={(v) => setSource(v as any)}>
          <SelectTrigger className="w-44 bg-card">
            <SelectValue placeholder="מקור" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המקורות</SelectItem>
            <SelectItem value="import">מיובא מקובץ</SelectItem>
            <SelectItem value="manual">הוזן ידנית</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {members ? `${membersTotal.toLocaleString("he-IL")} חברים` : ""}
        </span>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">עיר / אזור</TableHead>
                  <TableHead className="text-right">מתפקדים</TableHead>
                  <TableHead className="text-right">מקור</TableHead>
                  <TableHead className="text-right">קשר אחרון</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(members || []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.fullName}</TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${statusColor(m.partyStatus)}`}
                      >
                        {m.partyStatus || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {[m.city, m.region].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell>{m.activistsCount || 0}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full w-fit ${sourceColor(m.sourceType)}`}
                        >
                          {sourceLabel(m.sourceType)}
                        </span>
                        {m.sourceType === "import" && (
                          <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                            {m.sourceFile || "קובץ"} · {formatShortDate(m.importedAt)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatShortDate(m.lastContactDate)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditMember(m);
                            setEditOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteTarget(m)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(members || []).length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      לא נמצאו חברים.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {membersHasMore && (
          <div className="flex justify-center border-t bg-card py-3">
            <Button
              variant="outline"
              size="sm"
              className="bg-background gap-2"
              disabled={isLoading}
              onClick={() => setAdminPage((p) => p + 1)}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              טען עוד ({(membersTotal - (members?.length ?? 0)).toLocaleString("he-IL")} נותרו)
            </Button>
          </div>
        )}
      </div>

      <AddMemberModal open={addOpen} onOpenChange={setAddOpen} />
      <AddMemberModal
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setEditMember(null);
        }}
        editMember={editMember}
      />
      <ImportModal open={importOpen} onOpenChange={setImportOpen} />
      <BatchesDialog open={batchesOpen} onOpenChange={setBatchesOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת חבר</AlertDialogTitle>
            <AlertDialogDescription>
              האם למחוק את {deleteTarget?.fullName}? פעולה זו תמחק גם את היסטוריית הקשר ואינה הפיכה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && remove.mutate({ id: deleteTarget.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BatchesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const { data: batches, isLoading } = trpc.import.batches.useQuery(undefined, {
    enabled: open,
  });
  const [deleteBatchTarget, setDeleteBatchTarget] = useState<any | null>(null);

  const deleteBatch = trpc.import.deleteBatch.useMutation({
    onSuccess: (res) => {
      utils.import.batches.invalidate();
      utils.members.list.invalidate();
      utils.members.filterOptions.invalidate();
      utils.stats.dashboard.invalidate();
      toast.success(`נמחקו ${res.deleted} רשומות מהקובץ`);
      setDeleteBatchTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl" className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> אצוות ייבוא
          </AlertDialogTitle>
          <AlertDialogDescription>
            רשימת כל קבצי ה-Excel שיובאו, כולל מועד הטעינה ומספר הרשומות.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[55vh] overflow-y-auto rounded-lg border">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (batches || []).length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">
              עדיין לא בוצעו ייבואים.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">קובץ</TableHead>
                  <TableHead className="text-right">נטענו</TableHead>
                  <TableHead className="text-right">דולגו</TableHead>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(batches || []).map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="truncate max-w-[220px]">{b.fileName}</span>
                    </TableCell>
                    <TableCell className="text-emerald-700">{b.insertedCount}</TableCell>
                    <TableCell className="text-muted-foreground">{b.skippedCount}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatShortDate(b.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        title="מחק את כל הרשומות מקובץ זה"
                        onClick={() => setDeleteBatchTarget(b)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>סגור</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>

      {/* Nested confirmation for deleting an entire import batch */}
      <AlertDialog
        open={!!deleteBatchTarget}
        onOpenChange={(v) => !v && setDeleteBatchTarget(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת רשומות מקובץ</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את כל {deleteBatchTarget?.insertedCount ?? 0} הרשומות שיובאו מהקובץ{" "}
              <span className="font-medium">״{deleteBatchTarget?.fileName}״</span>{" "}
              ואת היסטוריית הקשר שלהן. הפעולה אינה הפיכה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBatch.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteBatchTarget)
                  deleteBatch.mutate({
                    batchId: deleteBatchTarget.id,
                    fileName: deleteBatchTarget.fileName,
                  });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deleteBatch.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              מחק רשומות
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AlertDialog>
  );
}
