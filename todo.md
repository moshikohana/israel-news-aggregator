# CRM פוליטי חכם — TODO

## Database
- [x] Define `members` table in drizzle/schema.ts (full_name, phone, email, city, region, address, birthday, family_events JSON, party_status, activists_count, notes, tags, last_contact_date)
- [x] Define `contactLog` table (member_id, date, channel, notes)
- [x] Generate migration and apply via webdev_execute_sql
- [x] Seed 20 realistic Israeli members incl. Moti Ohayon (Tiberias-born, מתפקד, 100 activists, Jerusalem, birthday, bar mitzvah)
- [x] db.ts query helpers

## Backend (tRPC, all protected)
- [x] members.list with filters (region, city, status, tag, contact recency, upcoming event, search, sort)
- [x] members.get / create / update / delete
- [x] members.filterOptions (distinct regions/cities/tags)
- [x] members.updateFamilyEvents
- [x] contactLog.add / list
- [x] events.upcoming (range days) + events.needsContact
- [x] stats.overview
- [x] chat.ask (invokeLLM -> SQL -> execute -> invokeLLM summarize Hebrew + task suggestions; return SQL)
- [x] import.preview (parse xlsx headers + sample) / import.commit (with mapping)

## Frontend (RTL, dark-blue/white, DashboardLayout sidebar + mobile bottom nav)
- [x] index.css theme: dark-blue/white, RTL, Hebrew fonts
- [x] DashboardLayout with nav: צ'אט / חברים / אירועים / ניהול
- [x] Mobile bottom navigation
- [x] Chat page: bubbles, loading indicator, SQL transparency toggle, member deep-link chips
- [x] Members page: card list, search, advanced filters, detail sheet (contact log, notes, tags, family-events editor)
- [x] Events page: stat cards, time-range selector (7/30/90), grouped events (today/week/later) with icons, overdue list, "צור קשר" buttons
- [x] Admin page: member table, edit/delete, family-events mgmt, birthday edit
- [x] AddMember modal (all fields incl. notes, tags)
- [x] Import modal: upload xlsx, comparison mapping table, commit

## Auth
- [x] All data routes protected via Manus OAuth (protectedProcedure)
- [x] Owner auto-assigned admin role (resolveUserRole in db.ts + Vitest)
- [x] Login gate UI (Hebrew RTL login screen verified)

## Testing
- [x] Vitest for import mapping + chat SQL guard + normalization + owner-admin role
- [x] End-to-end chat flow verified against live DB (question -> SQL -> rows -> Hebrew answer; Avi Cohen 6120 returned correctly)

## Bug fixes (Excel import status)
- [x] Default party_status to "מתפקד" on import when no status column mapped/empty
- [x] Repair already-imported members that have NULL/empty party_status (0 remain)
- [x] Harden UI/queries against null party_status (no crash, show fallback label)
- [x] Vitest covering import status default

## Import provenance + improvements (iteration 3)
- [x] Schema: members.sourceType ('manual'|'import'), sourceFile, importedAt; import_batches table
- [x] Migration generated + applied via webdev_execute_sql
- [x] importRouter.commit records batch + per-member source (file name, timestamp)
- [x] createMember accepts source metadata (default manual)
- [x] getMembers returns source fields; add source filter
- [x] Admin: show source column (קובץ/ידני), file name, imported date + detail sheet source row
- [x] Admin: import batches summary panel (file, count, date)
- [x] Import preview: duplicate-by-phone warning (backend)
- [x] Export current filtered members to Excel (backend exportMembers)
- [x] Enriched stats (bySource, topActivists, contact coverage) in getStats
- [x] Vitest for Excel round-trip + status default + duplicate detection + export mapping (27 pass)
- [x] Verify (TypeScript clean) + checkpoint

## Elector-inspired upgrades (primaries, sensitive data, AI)

### Support tagging + primaries / election-day (GOTV)
- [x] Schema: members.support_level (תומך/נוטה/מתלבט/מתנגד/לא ידוע), vote_status (טרם/הצביע), assigned_activist
- [x] Migration generated + applied
- [x] db/getMembers: filters for supportLevel, voteStatus, assignedActivist; stats for support pyramid + turnout
- [x] members router: setVoteStatus mutation (+ support set via update); activistOptions
- [x] Primaries page: support pyramid, live turnout %, "not yet voted" list with WhatsApp/phone, activist leaderboard
- [x] Member detail + Add modal: support level + vote + assigned activist fields; Members filters/badges

### Sensitive data: audit log
- [x] Schema: audit_log table (actorOpenId, actorName, action, entity, entityId, detail, createdAt)
- [x] recordAudit helper + wired into view/create/update/delete/vote mutations
- [x] Admin Audit page (admin only) + nav gating

### AI efficiency
- [x] chat: region/support strategic insights (AI guidance + strategic sample questions)
- [x] chat: smarter suggested follow-up actions (📌 משימות מוצעות + strategic insight line)

### Wrap up
- [x] Vitest for primaries summary + turnout + double-vote guard (32 pass)
- [x] setSupport mutation + import/export audit (gap fixes); Verify (TS clean, 32 tests) + checkpoint + report

## Chat fix + demo-data cleanup + home explainer
- [x] Diagnose why chat stopped responding (logs, LLM call, SSE/timeout, error surface)
- [x] Fix chat so it responds reliably; switched to gemini-2.5-flash (~5s) with clear error surface
- [x] Remove auto-seeded demo data (support_level, vote_status, assigned_activist) so only user data shows — DB cleared, seed-db.mjs removed
- [x] Primaries page: show only real uploaded data, empty states when none — empty banner added
- [x] Home page: short explainer about the app
- [x] Comprehensive QA across all pages — import verified e2e, all empty states audited
- [x] Tests pass + checkpoint + report — 32 tests pass, checkpoint 5848a6d0

## Terminology fix
- [x] Replace "מפקדים" with "מתפקדים" across UI labels (Events, Members, Admin, MemberDetailSheet, AddMemberModal, Home)
- [x] Update AI prompt + export header + fields label to "מתפקדים" (keep import aliases backward-compatible)
- [x] Tests/typecheck pass + checkpoint

## Mobile responsiveness fix
- [x] Fix mobile chat: input/send button hidden behind bottom nav (cannot send on mobile) — fixed container height with dvh
- [x] Ensure chat composer stays visible above bottom nav on mobile — container height fits available area
- [x] Audit all pages for mobile layout (Members, Primaries, Events, Admin, AuditLog) — grid layouts already responsive (grid-cols-1 base)
- [x] Tests/typecheck pass + checkpoint — TS clean, 32 tests pass

## Edit contact enhancements
- [x] Add edit button on each Members card to open AddMemberModal in edit mode
- [x] Edit button also added in MemberDetailSheet header
- [x] When arriving at /members?q=NAME from chat, auto-open the matching contact's detail sheet (with Edit button) if exactly one match

## Mobile chat composer still hidden (bug report w/ screenshot)
- [x] On mobile, when the empty-state question list is long, the input/send box scrolls out of view and is unreachable — replaced Radix ScrollArea with native flex min-h-0 scroll region
- [x] Make the composer always visible above the bottom nav, with the messages area scrolling independently — composer is shrink-0 at the flex bottom

## Mobile chat top cut-off (bug report w/ screenshot)
- [x] Chat header "צ'אט חכם" + app explainer get cut off at the top on mobile — header is now shrink-0 fixed; empty-state starts from top on mobile (justify-start)
- [x] Make the chat title/subtitle a fixed header (shrink-0, not scrollable); keep explainer + quick guide inside scrollable messages area
- [x] Adjust container height so nothing is clipped top or bottom on mobile — height reduced to dvh-8.5rem on mobile

## Dedicated home + chat tab + safe-area
- [x] Create a dedicated landing/home page with large navigation cards (chat, members, primaries, events, admin) + app explainer + quick guide
- [x] Move the AI chat into its own route/tab (/chat); reachable from bottom nav and home cards
- [x] Add a "שיחה חדשה" button at the top of chat that clears history and restores the quick guide
- [x] Add safe-area-inset-bottom to the mobile bottom nav and adjust chat height accordingly
- [x] Tests/typecheck pass + checkpoint — TS clean, 32 tests pass

## Performance + member notes
- [x] Diagnose slow tab navigation (Members/Admin) — caused by staleTime:0 refetching all queries every navigation
- [x] Optimize: set QueryClient staleTime 60s, gcTime 10min, disable refetchOnWindowFocus/refetchOnMount
- [x] Add `notes` column to members schema — already existed in schema + DB
- [x] Notes textarea in AddMemberModal (edit mode) + shown in MemberDetailSheet — already present
- [x] Include notes in AI chat context — strengthened SQL+answer prompts to always read/reason over notes; search includes notes
- [x] Tests/typecheck pass + checkpoint — TS clean, 32 tests pass

## Slow member open (bug)
- [x] Opening a member detail sheet stalls a few seconds — caused by blocking audit INSERT on every getById + no cached data (edit modal already used list data, no server fetch on open)
- [x] Made audit log fire-and-forget (non-blocking) so getById returns immediately
- [x] Pass the list member object as initialData (seed) so the sheet opens instantly and refreshes in background
- [x] Tests/typecheck pass + checkpoint — TS clean, 32 tests pass

## Edit modal stall (bug, round 2)
- [x] Decouple sheet->modal transition (open modal 220ms after sheet closes)
- [x] Initialize edit form synchronously via keyed MemberForm remount (no EMPTY->prefill double render)
- [x] Lazy-mount heavy Radix Selects one frame after dialog opens (placeholder shown first)
- [x] Tests/typecheck pass + checkpoint — TS clean, 32 tests pass

## Edit lag (round 3 - new approach)
- [x] Root cause: single `form` object state re-rendered the entire dialog (all Selects) on every keystroke
- [x] Switched edit form to uncontrolled inputs (defaultValue, read via formRef on submit) — zero re-renders while typing
- [x] Replaced Radix Select with native html select (no portal/focus-trap mount cost)
- [x] Reduced sheet->modal delay to 150ms
- [x] Tests/typecheck pass + checkpoint — TS clean, 32 tests pass

## Delete records by import file/batch
- [x] Inspect import batch schema + how members link to a batch (importBatchId/source)
- [x] Backend: deleteMembersByBatch db helper + admin procedure (returns deleted count)
- [x] Record an audit entry for the bulk delete
- [x] Admin UI: delete button per import batch with confirmation dialog showing count
- [x] Invalidate members/stats/batches after delete
- [x] Tests/typecheck pass + checkpoint

## Import: choose specific sheet or all sheets
- [x] preview: return list of sheet names; accept optional sheetName (default first)
- [x] commit: accept sheetName ("__ALL__" = all sheets) and import accordingly
- [x] Import UI: sheet picker dropdown (specific sheet / all sheets) shown when >1 sheet
- [x] Tests/typecheck pass + checkpoint

## Large Excel import fails on published domain ("Unexpected token '<'" = HTML error page)
- [x] Diagnose: gateway/proxy body-size limit or timeout on big base64 JSON tRPC body (confirmed)
- [~] Binary upload endpoint — CANCELLED per user request ("תעשה את זה ידנית"); 87,114 members loaded manually instead
- [~] preview/commit off stored fileKey — CANCELLED (manual load chosen)
- [~] ImportModal multipart upload — CANCELLED (manual load chosen)
- [x] Friendly error surface (no raw HTML/JSON parse error) + lowered client limit to 20MB
- [x] Tests/typecheck pass + checkpoint


## Members list cannot load with 87K rows (live shows no data; huge unbounded response)
- [x] getMembers: add limit/offset + return total count (server-side pagination)
- [x] members.list procedure: accept page/pageSize, return { items, total }
- [x] getFilterOptions: compute distinct regions/cities via SQL DISTINCT (not full scan in JS)
- [x] Bound getUpcomingEvents (SQL filter to birthday/family-events rows only) + getNeedsContact LIMIT 200 + tags scan cap
- [x] Members page: paginated/infinite list + total count + search/filter still work
- [x] Admin + Primaries pages adapted to paged response
- [x] Tests/typecheck pass + checkpoint


## Smart chat: duplicate handling + more intuitive results
- [ ] Backend: detect duplicate groups in chat results (same normalized name AND phone) vs same-name/diff-phone (not dup)
- [ ] Backend: deleteMembersByIds db helper + admin/protected procedure (returns deleted count, audit log)
- [ ] chat.ask returns structured rows + duplicateGroups metadata
- [ ] Frontend: render results as rich member cards (name, phone, city, status, notes snippet)
- [ ] Frontend: quick actions per card (call tel:, WhatsApp wa.me, open member page)
- [ ] Frontend: duplicate-group block with "keep one / delete others" action and confirm dialog
- [ ] Frontend: same-name different-phone shown as separate cards (no merge suggested)
- [ ] Tests/typecheck pass + checkpoint
