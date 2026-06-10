import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ChevronDown,
  Code2,
  Loader2,
  Plus,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { useLocation } from "wouter";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sql?: string;
  results?: any[];
};

const SAMPLE_QUESTIONS = [
  "מי בעל הכי הרבה מתפקדים?",
  "מי לא דיברנו איתו מעל חודש?",
  "אילו אירועים משפחתיים יש בשבועיים הקרובים?",
  "מי חברי המרכז מירושלים?",
];

const STRATEGIC_QUESTIONS = [
  "מה אחוז ההצבעה לפי אזור?",
  "מי התומכים שטרם הצביעו?",
  "איזה ממריץ אחראי על הכי הרבה תומכים?",
  "באיזה אזור יש ריכוז מתלבטים שכדאי לטרגט?",
];

function extractNames(results: any[] | undefined): string[] {
  if (!Array.isArray(results)) return [];
  const names = new Set<string>();
  for (const r of results) {
    if (r && typeof r === "object" && r.full_name) names.add(String(r.full_name));
  }
  return Array.from(names).slice(0, 8);
}

export default function Chat() {
  return (
    <DashboardLayout>
      <ChatView />
    </DashboardLayout>
  );
}

function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const ask = trpc.chat.ask.useMutation();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, ask.isPending]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || ask.isPending) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    ask.mutate(
      { question: q },
      {
        onSuccess: (data) => {
          setMessages((m) => [
            ...m,
            { role: "assistant", content: data.answer, sql: data.sql, results: data.results },
          ]);
        },
        onError: (err) => {
          setMessages((m) => [...m, { role: "assistant", content: `אירעה שגיאה: ${err.message}` }]);
        },
      },
    );
  };

  const newConversation = () => {
    setMessages([]);
    setInput("");
  };

  const goToMember = (name: string) => {
    setLocation(`/members?q=${encodeURIComponent(name)}`);
  };

  return (
    <div
      className="max-w-3xl mx-auto flex flex-col min-h-0 h-[calc(100dvh-9.5rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-2rem)]"
      dir="rtl"
    >
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">צ'אט חכם</h1>
          <p className="text-sm text-muted-foreground truncate">
            שאל שאלות בשפה חופשית על חברי המרכז והמתפקדים
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={newConversation}
            className="shrink-0 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">שיחה חדשה</span>
          </Button>
        )}
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto rounded-xl border bg-card p-4"
        ref={scrollRef as any}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-start md:justify-center text-center gap-6 py-6 md:py-10 md:h-full">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <p className="font-semibold mb-1">איך אפשר לעזור?</p>
              <p className="text-sm text-muted-foreground">נסה אחת מהשאלות הבאות:</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-sm rounded-full border bg-background px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="w-full max-w-lg">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                שאלות אסטרטגיות (פריימריז ותמיכה):
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {STRATEGIC_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-sm rounded-full border border-primary/30 bg-primary/5 text-primary px-4 py-2 hover:bg-primary/10 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} onMemberClick={goToMember} />
            ))}
            {ask.isPending && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>מנתח את הנתונים...</span>
              </div>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-end gap-2 shrink-0"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="כתוב שאלה... (למשל: מי בעל הכי הרבה מתפקדים?)"
          className="min-h-[48px] max-h-32 resize-none bg-card"
          rows={1}
        />
        <Button
          type="submit"
          size="icon"
          className="h-12 w-12 shrink-0"
          disabled={ask.isPending || !input.trim()}
        >
          {ask.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </form>
    </div>
  );
}

function MessageBubble({
  message,
  onMemberClick,
}: {
  message: ChatMessage;
  onMemberClick: (name: string) => void;
}) {
  const [showSql, setShowSql] = useState(false);
  const isUser = message.role === "user";
  const names = !isUser ? extractNames(message.results) : [];

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
          }`}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <div className="prose prose-sm max-w-none prose-headings:my-2 prose-p:my-1">
              <Streamdown>{message.content}</Streamdown>
            </div>
          )}
        </div>

        {!isUser && names.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {names.map((n) => (
              <button
                key={n}
                onClick={() => onMemberClick(n)}
                className="text-xs rounded-full border bg-background px-3 py-1 hover:bg-accent transition-colors"
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {!isUser && message.sql && (
          <div className="w-full">
            <button
              onClick={() => setShowSql((s) => !s)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Code2 className="h-3.5 w-3.5" />
              שאילתת SQL
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showSql ? "rotate-180" : ""}`}
              />
            </button>
            {showSql && (
              <pre
                dir="ltr"
                className="mt-1.5 text-[11px] bg-foreground/90 text-background rounded-lg p-3 overflow-x-auto whitespace-pre-wrap"
              >
                {message.sql}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
