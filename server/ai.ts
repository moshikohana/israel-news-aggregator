import { invokeLLM } from "./_core/llm";

const SQL_MODEL = "gemini-2.5-flash";
const ANSWER_MODEL = "gemini-2.5-flash";

const SCHEMA = `
TABLE members (
  id INT PRIMARY KEY,
  full_name VARCHAR,         -- שם מלא
  phone VARCHAR,             -- טלפון
  email VARCHAR,
  city VARCHAR,              -- עיר מגורים
  region VARCHAR,            -- אזור: ירושלים / מרכז / צפון / דרום
  address VARCHAR,
  birthday DATE,             -- תאריך לידה בפורמט YYYY-MM-DD
  family_events TEXT,        -- JSON: [{type,date,description}] אירועים משפחתיים (בר מצווה/חתונה/ברית וכו')
  party_status VARCHAR,      -- סטטוס: 'חבר מרכז' / 'מתפקד' / 'פעיל'
  activists_count INT,       -- כמה מתפקדים/פעילים מתחתיו
  support_level ENUM,        -- עמדת תמיכה: 'תומך' / 'נוטה' / 'מתלבט' / 'מתנגד' / 'לא ידוע'
  vote_status ENUM,          -- סטטוס הצבעה בפריימריז: 'הצביע' / 'טרם הצביע'
  assigned_activist VARCHAR, -- שם הממריץ/ראש הקבוצה האחראי על החבר
  notes TEXT,
  tags VARCHAR,
  last_contact_date DATE,    -- תאריך קשר אחרון YYYY-MM-DD
  source_type VARCHAR        -- 'manual' (הוזן ידנית) / 'import' (יובא מקובץ)
);

TABLE contact_log (
  id INT PRIMARY KEY,
  member_id INT,             -- מפתח זר אל members.id
  date DATE,                 -- YYYY-MM-DD
  channel VARCHAR,           -- 'טלפון' / 'וואטסאפ' / 'פגישה'
  notes TEXT
);
`;

// Only allow a single read-only SELECT statement.
export function isSafeSelect(sqlRaw: string): boolean {
  const s = sqlRaw.trim().replace(/;+\s*$/, "");
  if (!/^select\s/i.test(s)) return false;
  // Block dangerous keywords and side-effecting SELECT forms.
  if (
    /\b(insert|update|delete|drop|alter|create|attach|pragma|replace|truncate|grant|revoke|call|set|use|load_file|sleep|benchmark|information_schema|mysql\.|performance_schema)\b/i.test(
      s,
    )
  )
    return false;
  // Block INTO OUTFILE / DUMPFILE / INTO @var
  if (/\binto\b/i.test(s)) return false;
  // Disallow multiple statements
  if (s.includes(";")) return false;
  return true;
}

export async function questionToSql(userQuestion: string): Promise<string> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const resp = await invokeLLM({
    model: SQL_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are an expert MySQL analyst for a Hebrew political CRM. " +
          "Given the schema and a Hebrew question, return ONLY a single valid read-only MySQL SELECT query and nothing else. " +
          "No markdown, no code fences, no explanation. " +
          `Today's date is '${todayStr}'. ` +
          "Use MySQL date functions: MONTH(birthday) and DAY(birthday) for month/day; CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), DATE_SUB(CURDATE(), INTERVAL 30 DAY) for windows. " +
          "Note birthday year may differ; for upcoming birthday/event windows, compare MONTH and DAY, not the year. " +
          "The family_events column is JSON text; use LIKE on it when filtering by event type if needed (e.g. family_events LIKE '%בר מצווה%'). " +
          "Always include the members.id column (selected as `id`) as the first column whenever the query returns member rows, so the application can link to and manage individual records. " +
          "Always include relevant columns: at minimum id and full_name, and also include phone, notes, tags, city, region, activists_count, birthday, last_contact_date, family_events when they could be relevant to the question or to suggesting follow-up actions. " +
          "IMPORTANT about party_status: the words 'מתפקד', 'מתפקדים', 'חבר', 'חברים', 'אנשים', 'אנשי קשר', 'אנשי הקשר' in everyday Hebrew usually mean ALL people in the database, NOT a filter on the party_status column. " +
          "Do NOT add a WHERE party_status = '...' filter UNLESS the user explicitly names a specific status category and clearly wants only that category (e.g. 'רק חברי מרכז', 'אך ורק פעילים'). When in doubt, do not filter by party_status. " +
          "For superlatives like 'הכי הרבה מתפקדים' / 'הכי הרבה מפקדים' / 'בעל הכי הרבה' use ORDER BY CAST(COALESCE(activists_count,0) AS UNSIGNED) DESC. Only add LIMIT when the user asks for a specific number (e.g. 'שלושת' => LIMIT 3); otherwise do not add LIMIT. " +
          "When the user asks 'מי' (who) about a person by name, or asks what is known / details about a specific person (e.g. 'מה אתה יודע על X', 'ספר לי על X', 'פרטים על X'), match with full_name LIKE '%name%' and SELECT all relevant columns INCLUDING notes, tags, family_events, support_level, vote_status, assigned_activist, last_contact_date so the answer can reason over the free-text notes. " +
          "Support/primaries vocabulary: 'תומכים' => support_level IN ('תומך','נוטה'); 'מתנגדים' => support_level='מתנגד'; 'מתלבטים' => support_level='מתלבט'. " +
          "'מי שטרם הצביע' / 'לא הצביעו' => vote_status='טרם הצביע'; 'מי שהצביע' => vote_status='הצביע'. " +
          "'אחוז הצבעה' => ROUND(100*SUM(vote_status='הצביע')/COUNT(*),1). " +
          "'ממריץ' / 'ראש קבוצה' / 'אחראי' refers to assigned_activist; e.g. 'המתפקדים של מוטי' => assigned_activist LIKE '%מוטי%'. " +
          "Include support_level, vote_status, assigned_activist columns whenever they are relevant to the question.\n\n" +
          "SCHEMA:\n" +
          SCHEMA,
      },
      { role: "user", content: `שאלה: ${userQuestion}` },
    ],
  });
  let sqlText = "";
  const content = resp.choices?.[0]?.message?.content;
  if (typeof content === "string") sqlText = content;
  else if (Array.isArray(content)) {
    sqlText = content
      .map((c: any) => (c?.type === "text" ? c.text : ""))
      .join("")
      .trim();
  }
  sqlText = sqlText
    .trim()
    .replace(/^```sql\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return sqlText;
}

export async function formatAnswer(
  userQuestion: string,
  sqlText: string,
  results: any[],
): Promise<string> {
  const resp = await invokeLLM({
    model: ANSWER_MODEL,
    max_tokens: 900,
    messages: [
      {
        role: "system",
        content:
          "אתה עוזר פוליטי דובר עברית עבור מערכת CRM לניהול חברי מרכז ומתפקדים. " +
          "ענה בעברית בצורה ברורה, תמציתית ומקצועית, על בסיס הנתונים בלבד. " +
          "התייחס תמיד לשדה ההערות (notes) כאשר הוא קיים — זהו מידע אישי חופשי וחשוב (למשל היכן גר, קשרי משפחה, נושאים רגישים, העדפות) — קרא אותו, הסק ממנו מסקנות מעשיות, ושלב אותו בתשובה. כששואלים על חבר ספציפי, סכם את מה שידוע עליו כולל תובנות מההערות. " +
          "אם יש רשימה של אנשים, סכם אותם בצורה קריאה (אפשר נקודות או טבלה קצרה). " +
          "בסוף התשובה, כאשר הדבר רלוונטי, הוסף שורה קצרה בכותרת '📌 משימות מוצעות:' עם 1–3 פעולות מעשיות וקונקרטיות (למשל: להתקשר למי שלא דובר זמן רב, לברך לרגל יום הולדת/אירוע משפחתי קרוב, לתאם פגישה). אם אין משימה רלוונטית, אל תוסיף את השורה. " +
          "כאשר השאלה אסטרטגית (תמיכה, פריימריז, הצבעה, ממריצים), הוסף תובנה קצרה ומעשית — למשל מי הממריץ עם הכי הרבה תומכים שטרם הצביעו, או באיזה אזור יש ריכוז מתלבטים שכדאי לטרגט. " +
          "אם אין תוצאות, אמור זאת בנימוס והצע ניסוח חלופי. אל תמציא נתונים.",
      },
      {
        role: "user",
        content:
          `שאלה: ${userQuestion}\n` +
          `שאילתת SQL שהורצה: ${sqlText}\n` +
          `תוצאות (JSON): ${JSON.stringify(results)}`,
      },
    ],
  });
  const content = resp.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((c: any) => (c?.type === "text" ? c.text : ""))
      .join("")
      .trim();
  }
  return "";
}
