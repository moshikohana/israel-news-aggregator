import "dotenv/config";
import fs from "fs";
import mysql from "mysql2/promise";

const FILE_NAME = "v2כל_הרשומות_2026-05-07.xlsx (גיליון מתפקדים)";
const SOURCE_FILE = "v2כל_הרשומות_2026-05-07.xlsx";
const BATCH = 1000;

function parseUrl(u) {
  // mysql://user:pass@host:port/db?ssl={...}
  const m = u.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!m) throw new Error("Cannot parse DATABASE_URL");
  const [, user, password, host, port, database] = m;
  return {
    host,
    port: Number(port),
    user,
    password: decodeURIComponent(password),
    database,
    ssl: { rejectUnauthorized: true },
    multipleStatements: false,
  };
}

async function main() {
  const records = JSON.parse(fs.readFileSync("/home/ubuntu/import_ready.json", "utf-8"));
  console.log("Loaded prepared records:", records.length);

  const conn = await mysql.createConnection(parseUrl(process.env.DATABASE_URL));

  // Pre-check existing phones to skip duplicates against DB
  const [existingRows] = await conn.query("SELECT phone FROM members WHERE phone IS NOT NULL");
  const existing = new Set(existingRows.map((r) => String(r.phone)));
  console.log("Existing phones in DB:", existing.size);

  // Create the import batch row first (we'll update counts at the end)
  const [batchRes] = await conn.execute(
    "INSERT INTO import_batches (file_name, row_count, inserted_count, skipped_count, imported_by) VALUES (?, ?, ?, ?, ?)",
    [FILE_NAME, records.length, 0, 0, null],
  );
  const batchId = batchRes.insertId;
  console.log("Created import batch id:", batchId);

  const now = new Date();
  let inserted = 0;
  let skipped = 0;
  const seenThisRun = new Set();

  // Filter out DB duplicates and in-run duplicates
  const toInsert = [];
  for (const r of records) {
    if (existing.has(r.phone) || seenThisRun.has(r.phone)) {
      skipped++;
      continue;
    }
    seenThisRun.add(r.phone);
    toInsert.push(r);
  }
  console.log("After DB-dedup -> toInsert:", toInsert.length, "skipped:", skipped);

  const cols =
    "(full_name, phone, city, region, address, notes, party_status, source_type, source_file, import_batch_id, imported_at)";
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH);
    const placeholders = chunk.map(() => "(?,?,?,?,?,?,?,?,?,?,?)").join(",");
    const params = [];
    for (const r of chunk) {
      params.push(
        r.full_name,
        r.phone,
        r.city || null,
        r.region || null,
        r.address || null,
        r.notes || null,
        "מתפקד",
        "import",
        SOURCE_FILE,
        batchId,
        now,
      );
    }
    await conn.execute(`INSERT INTO members ${cols} VALUES ${placeholders}`, params);
    inserted += chunk.length;
    if (i % (BATCH * 10) === 0 || i + BATCH >= toInsert.length) {
      console.log(`  inserted ${inserted}/${toInsert.length}`);
    }
  }

  await conn.execute(
    "UPDATE import_batches SET inserted_count = ?, skipped_count = ? WHERE id = ?",
    [inserted, skipped, batchId],
  );

  const [[cnt]] = await conn.query("SELECT COUNT(*) AS c FROM members");
  console.log("DONE. Inserted:", inserted, "Skipped:", skipped, "Total members now:", cnt.c);

  await conn.end();
}

main().catch((e) => {
  console.error("LOAD FAILED:", e);
  process.exit(1);
});
