import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  Layers,
  Loader2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const SKIP = "__skip__";
const ALL_SHEETS = "__ALL__";

type PreviewData = {
  headers: string[];
  sample: any[][];
  suggested: string[];
  rows: any[][];
  totalRows: number;
  fileName: string;
  sheetNames: string[];
  activeSheet: string;
  duplicates: { existing: number; inFile: number; hasPhoneColumn: boolean };
};

export default function ImportModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  // Keep the raw file so we can re-preview other sheets and import all sheets.
  const [fileBase64, setFileBase64] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [result, setResult] = useState<{
    inserted: number;
    skippedDuplicates: number;
    errors: any[];
  } | null>(null);

  const { data: fields } = trpc.import.fields.useQuery();

  // The public gateway returns an HTML error page (not JSON) when a request
  // body is too large or times out. tRPC then fails to parse it and throws a
  // confusing "Unexpected token '<'" message. Translate that into actionable
  // Hebrew guidance instead of leaking the raw parser error.
  const friendlyError = (e: { message?: string }) => {
    const msg = e?.message || "";
    if (msg.includes("Unexpected token") || msg.includes("<html") || msg.includes("not valid JSON")) {
      return "הקובץ גדול מדי להעלאה דרך הדפדפן. נסו להעלות גליון בודד או קובץ קטן יותר (מומלץ עד כ-20MB). לקבצים גדולים — פנו למנהל לטעינה ידנית.";
    }
    return msg || "אירעה שגיאה בתהליך הייבוא.";
  };

  const previewMut = trpc.import.preview.useMutation({
    onSuccess: (data) => {
      setPreview(data as PreviewData);
      setSelectedSheet((prev) => prev || (data as PreviewData).activeSheet);
      const initial: Record<number, string> = {};
      data.suggested.forEach((s, i) => {
        if (s) initial[i] = s;
      });
      setMapping(initial);
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const commitMut = trpc.import.commit.useMutation({
    onSuccess: (data) => {
      setResult(data);
      utils.members.list.invalidate();
      utils.members.filterOptions.invalidate();
      utils.stats.dashboard.invalidate();
      utils.import.batches.invalidate();
      toast.success(`יובאו ${data.inserted} חברים`);
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const reset = () => {
    setPreview(null);
    setMapping({});
    setResult(null);
    setFileName("");
    setFileBase64("");
    setSelectedSheet("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // The public gateway rejects very large request bodies, so the practical
  // browser-upload ceiling is well below the raw express limit. Keep this
  // conservative; larger files are loaded manually by an admin.
  const MAX_FILE_MB = 20;
  const onFile = (file: File) => {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`הקובץ גדול מדי (מקסימום ${MAX_FILE_MB}MB)`);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1];
      if (base64) {
        setFileBase64(base64);
        setSelectedSheet("");
        previewMut.mutate({ fileBase64: base64, fileName: file.name });
      }
    };
    reader.readAsDataURL(file);
  };

  // Re-run the preview for a different sheet. For "all sheets" we just preview
  // the first sheet (for column mapping) but commit will read every sheet.
  const onSheetChange = (sheet: string) => {
    setSelectedSheet(sheet);
    if (!fileBase64) return;
    const target = sheet === ALL_SHEETS ? undefined : sheet;
    previewMut.mutate({ fileBase64, fileName, sheetName: target });
  };

  const statusMapped = Object.values(mapping).includes("partyStatus");
  const multiSheet = (preview?.sheetNames?.length ?? 0) > 1;
  const importingAll = selectedSheet === ALL_SHEETS;

  const commit = () => {
    if (!preview) return;
    const hasName = Object.values(mapping).includes("fullName");
    if (!hasName) {
      toast.error('יש למפות עמודה אחת לפחות לשדה "שם מלא"');
      return;
    }
    const strMapping: Record<string, string> = {};
    Object.entries(mapping).forEach(([k, v]) => {
      if (v && v !== SKIP) strMapping[k] = v;
    });

    if (importingAll) {
      commitMut.mutate({
        fileBase64,
        sheetName: ALL_SHEETS,
        mapping: strMapping,
        fileName: preview.fileName || fileName,
        skipDuplicates,
      });
    } else {
      commitMut.mutate({
        rows: preview.rows,
        sheetName: selectedSheet || preview.activeSheet,
        mapping: strMapping,
        fileName: preview.fileName || fileName,
        skipDuplicates,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> ייבוא מ-Excel
          </DialogTitle>
          <DialogDescription>
            העלה קובץ Excel/CSV. נזהה אוטומטית את העמודות ותוכל להתאים את המיפוי לפני הייבוא.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-lg font-semibold">הייבוא הושלם</p>
            <p className="text-muted-foreground mt-1">נוספו {result.inserted} חברים חדשים.</p>
            {result.skippedDuplicates > 0 && (
              <p className="text-sm text-amber-600 mt-1">
                {result.skippedDuplicates} כפילויות (לפי טלפון) דולגו.
              </p>
            )}
            {result.errors.length > 0 && (
              <p className="text-sm text-destructive mt-2">{result.errors.length} שורות נכשלו.</p>
            )}
            <Button onClick={() => handleClose(false)} className="mt-4">
              סגור
            </Button>
          </div>
        ) : !preview ? (
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
          >
            {previewMut.isPending ? (
              <Loader2 className="h-10 w-10 mx-auto animate-spin text-muted-foreground" />
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">לחץ לבחירת קובץ</p>
                <p className="text-sm text-muted-foreground mt-1">תומך ב-.xlsx, .xls, .csv · עד {MAX_FILE_MB}MB</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm bg-accent/40 rounded-lg px-3 py-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-medium truncate">{preview.fileName || fileName}</span>
              <span className="text-muted-foreground">
                · {importingAll ? "כל הגליונות" : `${preview.totalRows} שורות`}
              </span>
            </div>

            {/* Sheet picker — only when the workbook has more than one sheet */}
            {multiSheet && (
              <div className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2.5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-violet-900">
                  <Layers className="h-4 w-4" /> הקובץ מכיל {preview.sheetNames.length} גליונות —
                  בחר מה לייבא
                </div>
                <Select
                  value={selectedSheet || preview.activeSheet}
                  onValueChange={onSheetChange}
                  disabled={previewMut.isPending}
                >
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="בחר גליון" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_SHEETS}>כל הגליונות (איחוד)</SelectItem>
                    {preview.sheetNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {importingAll && (
                  <p className="text-xs text-violet-800">
                    כל הגליונות ייובאו יחד לפי מיפוי העמודות שמוצג למטה (מבוסס על הגליון הראשון).
                    ודא שלכל הגליונות מבנה עמודות זהה.
                  </p>
                )}
              </div>
            )}

            {/* Duplicate warning */}
            {preview.duplicates.hasPhoneColumn &&
              (preview.duplicates.existing > 0 || preview.duplicates.inFile > 0) && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    זוהו כפילויות לפי מספר טלפון:
                    {preview.duplicates.existing > 0 && (
                      <> {preview.duplicates.existing} כבר קיימים במערכת.</>
                    )}
                    {preview.duplicates.inFile > 0 && (
                      <> {preview.duplicates.inFile} כפולים בתוך הקובץ.</>
                    )}
                  </div>
                </div>
              )}

            {/* Status default notice */}
            {!statusMapped && (
              <div className="flex items-start gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <div>לא מופתה עמודת סטטוס — לכל החברים המיובאים ייקבע הסטטוס "מתפקד".</div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">התאם כל עמודה בקובץ לשדה במערכת:</p>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-right p-2 font-medium">עמודה בקובץ</th>
                    <th className="text-right p-2 font-medium">דוגמה</th>
                    <th className="text-right p-2 font-medium">שדה במערכת</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.headers.map((h, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-medium">{h || `עמודה ${i + 1}`}</td>
                      <td className="p-2 text-muted-foreground truncate max-w-[140px]">
                        {String(preview.sample[0]?.[i] ?? "—")}
                      </td>
                      <td className="p-2">
                        <Select
                          value={mapping[i] || SKIP}
                          onValueChange={(v) =>
                            setMapping((m) => ({ ...m, [i]: v === SKIP ? "" : v }))
                          }
                        >
                          <SelectTrigger className="h-9 bg-background">
                            <SelectValue placeholder="התעלם" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SKIP}>— התעלם —</SelectItem>
                            {(fields || []).map((f: any) => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label}
                                {f.required ? " *" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={skipDuplicates}
                onCheckedChange={(v) => setSkipDuplicates(!!v)}
              />
              דלג על כפילויות לפי מספר טלפון
            </label>
          </div>
        )}

        {preview && !result && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={reset}>
              בחר קובץ אחר
            </Button>
            <Button
              onClick={commit}
              disabled={commitMut.isPending || previewMut.isPending}
              className="gap-2"
            >
              {commitMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {importingAll ? "ייבוא כל הגליונות" : `ייבוא ${preview.totalRows} שורות`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
