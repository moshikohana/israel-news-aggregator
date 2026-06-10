import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowLeft,
  Calendar,
  MessageSquare,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  UserPlus,
  Users,
  Vote,
} from "lucide-react";
import { Link } from "wouter";

type NavCard = {
  title: string;
  desc: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
};

const NAV_CARDS: NavCard[] = [
  {
    title: "צ'אט חכם",
    desc: "שאל שאלות בשפה חופשית וקבל תשובות מנותחות מהנתונים שלך",
    href: "/chat",
    icon: MessageSquare,
  },
  {
    title: "חברים ומתפקדים",
    desc: "רשימת אנשי הקשר, חיפוש, סינון, עריכה והוספת חברים חדשים",
    href: "/members",
    icon: Users,
  },
  {
    title: "פריימריז ותמיכה",
    desc: "מעקב אחוז הצבעה, פירמידת תמיכה וטרגוט מתלבטים",
    href: "/primaries",
    icon: Vote,
  },
  {
    title: "אירועים משפחתיים",
    desc: "אירועים קרובים ואנשי קשר שדורשים מעקב",
    href: "/events",
    icon: Calendar,
  },
  {
    title: "ניהול וייבוא",
    desc: "ייבוא נתונים מאקסל, ניהול חברים וצפייה בייבואים",
    href: "/admin",
    icon: Settings,
  },
];

export default function Home() {
  return (
    <DashboardLayout>
      <HomeView />
    </DashboardLayout>
  );
}

function HomeView() {
  const { user } = useAuth();
  const { data: stats } = trpc.stats.dashboard.useQuery();

  const cards = NAV_CARDS;
  const firstName = user?.name?.split(" ")[0] || "";

  return (
    <div className="max-w-5xl mx-auto" dir="rtl">
      {/* Hero / explainer */}
      <div className="rounded-2xl border bg-gradient-to-bl from-primary/10 via-card to-card p-6 md:p-8 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
            CRM
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold leading-tight">
              {firstName ? `שלום ${firstName}, ` : ""}ברוך הבא למערכת CRM פוליטי חכם
            </h1>
            <p className="text-sm text-muted-foreground">
              ניהול חברי מרכז, מתפקדים ופעילים במקום אחד
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          המערכת מרכזת את כל אנשי הקשר שלך: חברים, מתפקדים ופעילים, יחד עם מעקב קשר,
          אירועים משפחתיים, ניהול תמיכה והצבעה לקראת פריימריז, וצ'אט חכם שמנתח את
          הנתונים ועונה בשפה חופשית.
        </p>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <StatBox label="חברים ומתפקדים" value={stats?.total ?? 0} />
          <StatBox label="סך מתפקדים" value={stats?.totalActivists ?? 0} />
          <StatBox label="הצביעו" value={stats?.voted ?? 0} />
          <StatBox label="טרם נוצר קשר" value={stats?.neverContacted ?? 0} />
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-4">
          <ShieldCheck className="h-3.5 w-3.5" />
          הנתונים פרטיים ומאובטחים, וכל פעולה רגישה נרשמת ביומן ביקורת.
        </p>
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group rounded-2xl border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <c.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold">{c.title}</h2>
                  <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:-translate-x-0.5 transition-all" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">{c.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick guide */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-bold">מדריך מהיר להתחלה</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickStep
            n={1}
            href="/admin"
            icon={Upload}
            title="ייבוא מאקסל"
            desc="העלה קובץ אנשי קשר. אם אין עמודת סטטוס, כל רשומה תקבל 'מתפקד' כברירת מחדל."
          />
          <QuickStep
            n={2}
            href="/members"
            icon={UserPlus}
            title="הוספה ועריכה"
            desc="הוסף חברים ידנית או ערוך פרטים קיימים ישירות מכרטיס איש הקשר."
          />
          <QuickStep
            n={3}
            href="/chat"
            icon={MessageSquare}
            title="שאל את הצ'אט"
            desc="שאל בשפה חופשית, למשל 'מי בעל הכי הרבה מתפקדים?' וקבל תשובה מנותחת."
          />
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-background/60 px-4 py-3">
      <div className="text-2xl font-bold tabular-nums">{value.toLocaleString("he-IL")}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function QuickStep({
  n,
  href,
  icon: Icon,
  title,
  desc,
}: {
  n: number;
  href: string;
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border bg-background/60 p-4 hover:bg-accent transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
          {n}
        </span>
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </Link>
  );
}
