# Research: Comparable Political CRMs (Qomon, NGP VAN, NationBuilder, Pipedrive, Ecanvasser, CiviCRM)

## Common feature pillars
1. **Unified supporter database** — single source of truth; dedup; dynamic profiles updated on every interaction.
2. **Segmentation & tagging** — tags, lists, support levels; filter by district/region, status, engagement.
3. **Analytics & dashboards** — real-time stats, trends, "high-priority zones", visual dashboards.
4. **Mapping / geolocation** — see where supporters are concentrated (we have Map component available).
5. **Outreach & multi-channel** — email/SMS/calls, follow-ups, reminders. (Out of scope for now — no sending infra.)
6. **Tasks & follow-ups** — assign tasks, reminders at key moments, "needs contact" lists. (We have needsContact + AI task suggestions.)
7. **Import voter/contact file (CSV/XLSX)** — with mapping + **provenance** (source tracking). We are adding this now.
8. **Audit trail / data accuracy** — who/when records changed; import batches.
9. **Donations/memberships** — out of scope for this app (members/activists, not donors).

## What our app already has
- Members DB (CRUD), filters (region/city/status/tag/recency/upcoming event/search/sort)
- Contact log + history, family-events, tags, notes
- Events page (stats, time-range, grouped, needs-contact)
- AI chat (text-to-SQL, read-only, Hebrew answers + task suggestions)
- Excel import (mapping table), now with status default
- Stats overview

## Gaps / improvement opportunities (prioritized for this iteration)
- **[HIGH] Import provenance** (user-requested): track source file name + import timestamp + batch; show in Admin data view; allow filter "imported vs manual"; ability to view/rollback a batch.
- **[HIGH] Dashboard/Stats richness** on Events/Home: distribution by status, by region, top activists, contact coverage %.
- **[MED] Segmentation polish**: filter by source (file vs manual), bulk tagging.
- **[MED] Duplicate detection** on import (phone/name) — warn before commit.
- **[MED] Export to Excel/CSV** of filtered members (round-trip).
- **[LOW] Map view** of members by city/region (Map component exists).
- **[LOW] Activity/audit log** for edits.

## Decisions for this iteration
1. Implement import provenance (schema: import_batches table + members.source_type, source_file, imported_at, import_batch_id). Show in Admin.
2. Add a "מקור" (source) column + filter in Admin, and a batches summary panel.
3. Add duplicate-by-phone warning on import preview.
4. Add export-to-Excel of current filtered members list.
5. Enrich stats (by-status, by-region, top activists) on a dashboard area.
