# Agent Task Board (Ticket-Sized Execution)

This board turns ROADMAP phases into strict, ticket-sized tasks so work can be delegated safely.

Use with:
- `CANON.md` (product constitution)
- `ROADMAP.md` (phase gates)
- `AGENT_PROMPTS.md` (copy/paste task prompts)

---


## Session Status Notes

- 2026-09-03: Drawing importer/workflow release DEPLOYED TO `.72`. Removed erroneous drawing-number override; label-only `REVISION` is rejected, missing/none finish becomes `NA`. Released accumulated quote/order decomposition plus mixed ZIP/PDF page intake, one request per canonical page, page-only Reprocess and no newer-reader OCR. Local 408 pass / 3 opt-in skip and production 411 pass / 3 skip; 66-page builds; 86 hashes; loopback/IP/hostname health 200; task Running; monitor result 0; empty error log; authenticated Chrome quote/order/import/edit checks with no save or inference. Rollback `drawing-import-release-d3131df-20260903-134939`. GitHub public push remains blocked pending explicit public-disclosure acknowledgement; commit `d3131df` is local and access runbook excluded.

- 2026-09-03: Selected-page Reprocess / OCR removal COMPLETE LOCALLY. Durable scoped retry bypasses full packet analysis and finalization; one fresh canonical-page request, no sibling DB/attempt changes, preserved confirmations/assembly quantities, safe failure and in-flight edit handling. Local OCR disabled/removed from newer service; V3 supplemental local hints omitted. Root/staged importer suites 77/74 pass, UI 25/22 pass, three opt-in importer skips each, type/lint/diff PASS. Chrome availability/upload readiness verified; actual reprocess covered with real SQLite plus mocked AI, not a live UI inference. No production deployment.

- 2026-09-03: New importer local ZIP/page intake READY FOR OWNER TRIAL. Fixed shared-parent PDF font lookup and missing staged worker; enforced one extraction per canonical page without automatic refinement/retry/escalation. Original PDFs/page lineage and newer UI preserved. Root/staged document 24 pass each, AI 18/19, config 2/2, type/lint pass; Chrome upload readiness verified. No fresh inference/timing or production deployment. Two broader staged legacy checks lack unrelated ops-script fixtures; importer and previous settings-helper tests pass. Supersedes the unfinished legacy prompt/schema migration, not its previously completed settings parity.

- 2026-09-03: Current importer AI profile parity IMPLEMENTED / VERIFICATION BLOCKED. Root and server-derived request now share local gpt-5.4-mini low/medium/concise/standard/10k settings; legacy UI/prompt/input/result contract preserved. TypeScript/lint pass in both trees; 16 tests authored per tree, execution blocked by spawn EPERM and approval-service404; Chrome also blocked. No production deployment or measured fresh AI run. Resume remaining gates when approvals recover.

- 2026-09-03: Owner-approved Playground profile active locally at 127.0.0.1:3100: gpt-5.4-mini, standard/low reasoning, medium verbosity, concise summary, 10k output. Root/staged focused tests (18/19), type/lint, health/availability and Chrome upload-readiness checks pass. Production/defaults unchanged; real drawing timing awaits owner testing.

- 2026-09-03: Playground export complete (read-only diagnosis/artifact task). Recovered last local import's stored v4.0.1 instructions, exact user input, and strict schema under `artifacts/drawing-import-playground`. Corrected root v4.0.0 mismatch. JSON/identity/settings checks passed; no inference, image export, runtime changes, or deployment. Await owner tuning instructions.

- 2026-09-01: Deployed intake/repeat/stock stability release to `.72`: retryable customer-safe repeat launch, part WAITING_ON_STOCK events, multi-photo partial retry/concurrency, customer historical-part reuse, quote/order autosave, drawing-note suggestions, Shop Floor Summary and admin Server Monitor. Local full suite 423 pass/4 opt-in skip; server focused 78 pass, clean 66-page build, authenticated live browser gates, HTTP 200, Running task, monitor result 0, empty error log. Rollback overnight-stability-20260901-064131.

- 2026-08-31: Spurious sign-in prompts fixed locally and production (403 vs session401; optional locked-kiosk probe). Local phone same-origin fix confirmed by actual create/photo/finish/claim HTTP200. 23 focused tests + server five-test gate/build pass. Rollback auth-prompts-20260831-150433. Repeat-list-only client crash remains unconfirmed; requested hard refresh/console evidence, no speculative fix.

- 2026-08-31: Repeat-template/Create again production repair deployed (one repo runtime file, no schema/data changes). Real SQLite/API regressions, type/lint and production build pass. Previous build/source retained at repeat-template-20260831-145454. Local preview restored at localhost:3001; phone/search/direct-order reader changes still not deployed. Department behavior unchanged.

- 2026-08-31: LOCAL REVIEW: phone QR drawing upload + current-reader parity for direct orders implemented. 254 regressions passed/7 opt-in skips, type/lint/build pass, local health200. Authenticated isolated test app on localhost:3000, phone LAN192.168.254.132:3000. No production changes. Browser login blocked; owner interactive/physical-phone validation pending. See PHONE_UPLOAD_LOCAL_REVIEW.md.

- 2026-08-31: Global business search implemented and verified locally (26 tests, type/lint/build, synthetic browser grouping/paging). Seven runtime files; no migration/dependencies. Live baseline compared; production unchanged pending explicit deployment approval. File contents limited to existing extracted drawing/BOM text, with permission-aware counts/snippets and no credentials/configuration.

- 2026-08-31: Optional revision and compact quote-review in/mm toggle deployed to `.72`. 21 current-source regression tests, TypeScript/lint, synthetic browser edit/save checks, exact-hash deployment, 63-page production build and healthy task/monitor/log gates passed. Private quote browser access was denied; synthetic UI testing used without customer-data access. Rollback: drawing-review-simple-20260831-012116.

- 2026-08-28: Deployed Quote Drawing Import V3 admin beta to `.72`: direct canonical one-page PDFs to Terra, manufacturing-aware length/width-or-diameter/thickness-or-wall schema, focused Terra-only refinement, safe uncertain fallback, and reviewed-dimension quote mapping. Evidence: TypeScript/lint, 116/116 non-live drawing tests, 63-route local/server builds, isolated server HTTP upload with 9/9 canonical pages, 9 Terra routes, dimensions on 6/6 classified detail pages, 3 manual-review pages, 48.626 seconds / USD 0.372434, HTTP 200, Running task, Ready monitor, empty error log, and rollback `drawing-import-v3-20260828-095926`.
- 2026-08-27: Deployed mixed-ZIP native-runtime hardening without rolling back finished width/thickness. PDF preprocessing is serialized, unrelated ZIP members are not eagerly inflated for CRC checking, model extraction remains four-way, import begin/finish events are durable, and the launcher now provides a 12 GB heap plus fatal/uncaught/exit diagnostics. Corrected monitor recovery so it cannot leave an orphaned Node child: controlled dead-runtime recovery restored a managed Running task, then a healthy cycle preserved the same PID. Evidence: local/server 32/32 tests, local/server 62-route builds, 5/5 hashes, launcher command-line verification, three HTTP 200 health endpoints, Running task, Ready monitor/result 0, empty error log, and three rollback snapshots. Final gate is the owner's real mixed-ZIP retry.
- 2026-08-27: Deployed long mixed-ZIP import protection: per-request activity markers, exact-process-aware monitor deferral, stale-marker expiry, and 100 supported drawings independent of unrelated ZIP files. Evidence: local/server 30/30 tests, type-check/lint, local/server 62-route builds, forced `busy-import` simulation preserving PID, 4/4 hashes, three HTTP 200 health endpoints, Running task, Ready monitor/result 0, empty error log, and dual rollback snapshots.
- 2026-08-27: Deployed drawing-derived finished thickness/width and total stock dimensions across intake, quote/order persistence, quote conversion, repeat templates, Material Check, printable shop walkdown, order editing, and travelers. Evidence: local full 238/238; local/server focused 57/57; local/server configured-model synthetic accuracy 1/1; migration 41; local/server 62-route builds; 34/34 hashes; loopback/LAN/hostname HTTP 200; Running task; Ready monitor/result 0; empty error log; timestamped source/database rollback.
- 2026-08-26: Restored and deployed exact Shop Floor visual treatment to Customer Tiles: canonical glass surface, cyan title, open two-column facts, border/depth, and hover lift. Desktop/mobile QA passed with no overflow, plus lint/type-check/diff, local/server 62-page builds, matched hash, HTTP 200 health through loopback/IP/hostname, Running task, Ready monitor, empty error log, and timestamped rollback.
- 2026-08-26: Deployed the customer relationship dashboard with customer/contact/location search, Business and Activity filters, seven metric sorts, ascending/descending direction, Tiles/Desktop List/Mobile List views, and interval-derived labor. Evidence: 15/15 tests, lint/type-check/diff checks, local/server 62-page builds, desktop QA, `390x844` QA with 380px document width and no overflow, six matched hashes, HTTP 200 through loopback/IP/hostname, Running task, Ready monitor, empty error log, and timestamped rollback.
- 2026-08-26: Imported the three Sterling/C&R/PKP QuickBooks customer workbooks into `.72` with conservative alias merging, multiple contacts, structured addresses, fax storage, and per-business memberships. Evidence: 234 rows audited, 188 creates plus 6 existing matches, 162 contacts, 229 memberships, idempotent zero-write rerun, unchanged 2 orders/1 quote/2 parts, 5/5 tests, lint/type-check, local/server 62-page builds, healthy service, and timestamped DB/source rollback.
- 2026-08-25: Rebuilt and deployed the work-order detail phone layout with horizontal Parts selection, balanced touch actions, stacked status controls, tighter panels, and reachable tabs while preserving the 360px desktop rail. Evidence: live/local `390x844` QA with zero horizontal overflow, desktop QA, 2/2 focused tests, lint/type-check, local/server 62-page builds, matched hash, HTTP 200 health/sign-in, running task, ready monitor, empty error log, and rollback backup.
- 2026-08-25: Added and deployed a Business quick filter between Department and Priority for the shared Tiles/List order set. Evidence: exact local counts in both views (All 16, Sterling 9, C and R Machining 6, Powder Coating 1), 15/15 focused tests, lint/type-check, 62-page production build, matched hashes, HTTP 200 health by IP/hostname, and rollback backup.
- 2026-08-25: Confirmed private offsite phone access through Tailscale direct tailnet routing to SHOPAPP; no Funnel, public router forwarding, Tailscale SSH, or public RDP exposure was enabled, and optional Tailscale Serve remains unconfigured.
- 2026-08-25: Deployed the print/header and order-detail polish correction: print CSS now hides only app chrome, Parts/customer titles align at the same size/baseline, left-rail text edges align, and part-card hover no longer translates. Evidence: 10/10 focused tests, lint/type-check, exact browser geometry/hover measurements, 62-page live build, matched hashes, HTTP 200 through IP/hostname/sign-in, running task, healthy monitor, empty error log, and rollback backup.
- 2026-08-25: Deployed the held customer/contact, multi-worker, traveler, document-header/disclaimer, quote-number, newest-first, and order-detail visual batch to `.72`; preserved exact records `CRM-1007`, `CRM-1008`, and `250826-001` while removing 16 older orders/17 older quotes after a verified backup and disposable-copy dry run. Evidence: migration/build pass, zero FK issues, unchanged base counts, matched hashes, HTTP 200 through IP and `shopapp.local`, running task, healthy monitor, and empty error log.
- 2026-08-25: Matched order-detail part cards to the defined Shop Floor navy/royal-blue tile hierarchy, including clear selected/unselected states and stronger text contrast. Evidence: 23/23 tests, lint/type-check, local/server builds, local/live interaction QA, HTTP 200, matched hash, rollback, empty error log, and preserved DB/storage.
- 2026-08-25: Removed redundant order-detail background cards and fixed the unassigned-part department dead end with an adaptive audited Assign/Move action. Evidence: 23/23 tests, lint/type-check, local/server builds, local/live QA, HTTP 200, matched hash, rollback, empty error log, and preserved DB/storage.
- 2026-08-25: Promoted Timers to an independent top-level Shop Floor control and added Department between Status/Priority for Tiles and List; More now contains customization only. Evidence: 14/14 tests, lint/type-check, local/server builds, local/authenticated live QA, HTTP 200, matched hash, rollback, empty error log, and preserved DB/storage.
- 2026-08-25: Added and deployed admin order-header Priority/audited Status controls, HOT flames in Tiles/List, and an admin-only tile three-dot editor for priority/status/machinist. Evidence: 35/35 focused tests, lint/type-check, local/server builds, authenticated live QA, HTTP 200, matched hashes, rollback, empty error log, and unchanged DB/storage.
- 2026-08-25: Refined and deployed List mode for the 80-inch TV: four equal-height summary cards now precede the table, Completed jobs became compact top-three machinist workload, and all duplicated lower dashboard blocks were removed. Evidence: 14/14 tests, lint/type-check, local/server builds, authenticated live QA, rollback, HTTP 200, and unchanged DB/storage.
- 2026-08-25: Deployed the compact Shop Floor Tiles/List/More hierarchy to `.72`: Tiles is the fresh-load default, List is the dense shared-filter table, and More reveals timers/customization. Evidence: 14/14 focused tests, lint, type-check, local/server builds, authenticated live QA, HTTP 200 health/sign-in, rollback backup, and unchanged DB/storage.
- 2026-08-25: Completed and deployed audited manual department movement, backend-aligned completion blockers/previews, stable snapshotted quote origins, and a one-Letter-sheet-per-part Order Traveler. Evidence: 28/28 tests, lint, type-check, local/server builds, live LAN QA, rollback backups, and unchanged production DB/storage.
- 2026-08-25: Operationalized a non-deleting five-minute customer-file mirror into `projects/ShopApp Customer Files`, local and independent two-minute ShopApp health monitors, and corrected `.72` Codex access to `C:\ShopApp\app`; hashes, incremental sync, scheduled cycles, and HTTP health passed.
- 2026-08-24: Completed a read-only department/default/layout audit. Confirmed missing manual-move UI plus divergent submit preview/backend routing, verified first-active department defaults with 19 passing tests, and documented production-layout cleanup/backup follow-ups; no product or production data changed.
- 2026-08-24: Windows LAN production deployment is operational at reserved `192.168.254.72` and `http://desktop-bkbakpm.local`; code/data/storage are separated under `C:\ShopApp`, the standalone build and live-data checks passed, SYSTEM startup plus profile-independent address-scoped SSH/ShopApp/RDP recovery are installed, and the corrected supervisor awaits one final onsite reboot test.
- 2026-08-24: Added and verified a temporary hidden `/setup` page for bootstrapping/recovering the new Windows ShopApp server; removed the page and downloadable recovery file after SSH access and the permanent boot supervisor were restored.
- 2026-08-24: Completed the Shop Floor open-canvas visual correction: removed the full-page/results navy shells, placed the heading and production content directly on the gradient, reduced bubble-like radii, and passed live QA, 10/10 focused tests, lint, type-check, and a clean 62-page build.
- 2026-08-24: Completed daily sequential quote numbers in `DDMMYY-###` format with first-of-day `001`, next-highest sequencing, legacy edit preservation, 3/3 focused tests, lint, type-check, and a clean 62-page production build.
- 2026-08-24: Completed customer-part repeat-order launch from old orders and a new Repeat Orders page, plus explicit quote/order required-reading authoring and per-user acknowledged/not-acknowledged roster; focused tests 31/31, type-check, lint, build, migrations, and live QA passed.
- 2026-07-20: Rebuilt the quote-to-order tutorial as a genuine 3:10 live-action walkthrough with natural narration, captions, visible pointer/click/typing/upload activity, saved workflow transitions, quote editing, conversion, and order editing; verified 1080p H.264/AAC output is in `artifacts/quote-tutorial/`.
- 2026-07-17: Retired the separate PIN-kiosk user flow: the existing TV dashboard is now labeled Shop Floor, `/kiosk` redirects there, Kiosk navigation and employee PIN setup are removed, and trusted-console audit/Read Me First behavior is preserved.
- 2026-07-17: Completed authoritative Read Me First enforcement: dispatch starts require a persisted versioned receipt, the trusted console shows the full brief and records worker/operator separately without repeated worker PIN entry, and the kiosk resolves the same gate for its PIN-unlocked worker. Evidence is recorded in `tasks/todo.md`, `PROGRESS_LOG.md`, and `docs/AGENT_HANDOFF.md`.
- 2026-07-17: Completed unplanned production feeds-and-speeds correction for the owner's Haas VF-2SS: explicit 12,000 RPM / 833 IPM caps, operation-specific FSWizard geometry, honest validation/unavailable states, and branch-complete regression coverage. Evidence is recorded in `tasks/todo.md`, `PROGRESS_LOG.md`, and `docs/AGENT_HANDOFF.md`.
- 2026-07-16: Completed unplanned Quote workflow simplification + pricing-integrity slice (task-first admin home, shared admin guard, unified Work Steps UI, frozen quote work snapshots, explicit calculated/manual final prices, duplicate prevention, one approval-gated conversion path). Focused admin/quote suite passes 22/22; repo-wide build remains blocked only by logged pre-existing vendor/kiosk/type baselines.
- 2026-07-16: Completed unplanned Drawing-to-order import v1 (dedicated part name, reviewed PDF/ZIP extraction, per-part drawing attachment, and automatic BOM analysis). Evidence is recorded in `tasks/todo.md`, `PROGRESS_LOG.md`, and `docs/AGENT_HANDOFF.md`.
- 2026-04-07: Completed unplanned department-bound timer enhancement (required department selection on timer start, one-active-per-department enforcement, Shipping timer exclusion, and selected-part department history totals/detail in order detail). Evidence recorded in `PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`.
- 2026-03-23: Completed unplanned isolated `sterling-site/` marketing-site scaffold (premium one-page manufacturing landing page with standalone tooling/docs). Evidence recorded in `PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`.
- 2026-02-26: Completed unplanned Part BOM analyzer attachment-ingestion bugfix (non-image MIME guard + image MIME resolution hardening) and documented quote→order conversion audit evidence.
- 2026-02-25: Completed unplanned Order→Part BOM tab integration using existing print-analyzer API, including deterministic unit/thread/tight-tolerance helpers and continuity evidence updates.
- 2026-02-25: Completed dashboard follow-up fix for department-touch visibility (added checklist/part department IDs to dashboard payload + UI union count) after Fab/Shipping feedback. Evidence recorded in `PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`.
- 2026-02-25: Completed unplanned dashboard cleanup (removed Ready for fab layout option, added per-order department-touch count on grid digest). Evidence recorded in `PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`.
- 2026-02-24: Completed unplanned timer reliability patch for start/resume paths (default `operation` compatibility + resume FK handling). Evidence recorded in `PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`.
- 2026-02-24: Completed unplanned timer resume workflow update (order-detail start vs resume behavior + `/api/timer/resume` endpoint + coverage). Evidence recorded in `PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`.
- 2026-02-23: Completed unplanned maintenance scope (outside numbered roadmap ticket) for local install/readme, timer start FK failure handling, and order-detail timer control layout overlap. Verification evidence recorded in `PROGRESS_LOG.md` and `docs/AGENT_HANDOFF.md`.

---

## Operating rules

1. **One task ID per agent session.**
2. **Do tasks in dependency order.**
3. **No phase skipping** unless an explicit owner note marks a task as intentionally deferred.
4. **Every task must end with DoD evidence** in `PROGRESS_LOG.md` + `docs/AGENT_HANDOFF.md`.
5. **Plan first for non-trivial tasks** in `tasks/todo.md` (3+ steps, cross-file impact, architectural decisions).
6. **Validate prior dependency task quality before starting**; report unresolved gaps first.
7. **Run build/test checks relevant to changed paths** before completion.
8. **After correction/failure, append prevention rule** in `tasks/lessons.md`.

---

## Phase 0 — Continuity & Guardrails (always on)

### P0-C1 — Continuity docs freshness check
- **Why:** Prevent context drift.
- **Scope:** `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `docs/AGENT_CONTEXT.md` consistency.
- **DoD:**
  - Latest session appears at top of `PROGRESS_LOG.md`.
  - `docs/AGENT_HANDOFF.md` date/goal/commands reflect latest completed work.
  - Any new pattern/decision captured in `docs/AGENT_CONTEXT.md` Decision Log.
- **Dependencies:** none.

---

## Phase 1 — Platform Stability (P0)

### P1-T1 — Auth/session single-source convergence
- **Why:** Remove split auth behavior and runtime uncertainty.
- **Scope:** auth/session entry points, route guards, middleware/session utilities.
- **DoD:**
  - One clear session truth path is used.
  - No conflicting guard logic paths remain.
  - Refresh flow validated for logged-in and logged-out cases.
- **Dependencies:** P0-C1.

### P1-T2 — Shell/provider stability + mobile nav reachability
- **Why:** Keep UI reliable and navigable on shop floor devices.
- **Scope:** layout/providers and mobile nav only.
- **DoD:**
  - Refresh does not lose layout/styling on core routes.
  - Mobile nav reaches core pages without dead ends.
  - Any instability findings are fixed or explicitly logged as blockers.
- **Dependencies:** P1-T1.

### P1-T3 — Phase 1 gate closeout report
- **Why:** Make exit criteria auditable.
- **Scope:** evidence-only pass/fail report mapped to ROADMAP Phase 1.
- **DoD:**
  - Explicit pass/fail for each Phase 1 exit criterion with command/runtime evidence.
  - If fail, remaining gap is logged as next task with owner note.
- **Dependencies:** P1-T2.

---

## Phase 2 — Modularization (P2)

### P2-T1 — Orders layering + mental model enforcement
- **Why:** Establish canonical module ownership and canonical work model.
- **Scope:** Orders domain only.
- **DoD:**
  - No Orders Prisma access outside `src/modules/orders/*.repo.ts`.
  - Orders routes are thin and call services.
  - Orders services contain business logic and call repos.
  - Server-side contracts enforce: Orders are containers; Parts are work units.
  - Any order-centric work-unit logic is removed or explicitly deprecated.
- **Dependencies:** P1-T3.

### P2-T2 — Quotes layering enforcement
- **Why:** Mirror Orders boundaries for consistency.
- **Scope:** Quotes domain only.
- **DoD:**
  - No Quotes Prisma access outside `src/modules/quotes/*.repo.ts`.
  - Quotes routes are thin and call services.
  - Quotes services contain business logic and call repos.
  - Domain quote logic in `src/lib/*` is migrated/deprecated in favor of module-owned services.
- **Dependencies:** P2-T1.

### P2-T3 — Customers boundary alignment
- **Why:** Avoid Customers becoming a boundary exception.
- **Scope:** Customers paths touched by active flows.
- **DoD:**
  - Customers call paths align with repo/service ownership.
  - Any deferred customer refactor is logged with explicit rationale.
- **Dependencies:** P2-T2.

### P2-T4 — Phase 2 boundary audit + closeout
- **Why:** Prove phase completion with objective checks.
- **Scope:** boundary audit + evidence summary.
- **DoD:**
  - Prisma usage audit confirms no out-of-repo access for Orders/Quotes.
  - Exit criteria in ROADMAP Phase 2 explicitly marked pass/fail.
- **Dependencies:** P2-T3.

---

## Phase 3 — Time Tracking Core (P1)

### P3-T1 — Invariant enforcement (single-active, admin-audited edits, computed totals)
- **Why:** Time trust is a core product promise.
- **Scope:** time model/service/repo + validation paths.
- **DoD:**
  - One active operation per user enforced.
  - Non-admin users cannot edit closed intervals.
  - Admin closed-interval edits are explicit, audited, and policy-gated.
  - Totals computed from intervals, not stored snapshots.
- **Dependencies:** P2-T4.

### P3-T2 — Time API enforcement audit
- **Why:** Rules must be server-side, not UI-dependent.
- **Scope:** timer/time API handlers and service integration.
- **DoD:**
  - API routes enforce invariants server-side.
  - Conflicts and invalid transitions return deterministic errors.
- **Dependencies:** P3-T1.

### P3-T3 — Phase 3 gate closeout report
- **Why:** Confirm canon-aligned core behavior before UX polish.
- **Scope:** evidence-only pass/fail report for ROADMAP Phase 3.
- **DoD:**
  - Phase 3 exit criteria explicitly pass/fail with evidence.
  - Any remaining gap logged as next ticket with scoped blast radius.
- **Dependencies:** P3-T2.

### P3-T4 — Switch-dialog + user context safety
- **Why:** Preserve trust when switching operations/parts.
- **Scope:** time start/switch UX + API response payloads.
- **DoD:**
  - Starting a new part/operation shows context dialog about the previous active timer.
  - Dialog clearly identifies which part/operation was active and what action will occur.
  - No time inflation occurs during switch confirmation path.
- **Dependencies:** P3-T3.

---

## Phase 4 — UX Flow Alignment (P1)

### P4-T1 — Control clarity pass (start/pause/resume)
- **Why:** Reduce operator hesitation and errors.
- **Scope:** time-tracking controls and adjacent state display.
- **DoD:**
  - Start/pause/resume controls are obvious and unambiguous.
  - Active state is clearly visible without extra navigation.
- **Dependencies:** P3-T4.

### P4-T2 — Switching flow safety + last-action visibility
- **Why:** Prevent inflation and preserve operator context.
- **Scope:** switch flow UX + supporting state display.
- **DoD:**
  - Switching operations does not inflate time.
  - Last operation/action context is visible and understandable.
- **Dependencies:** P4-T1.

### P4-T3 — Phase 4 gate closeout report
- **Why:** Validate operator and manager outcomes.
- **Scope:** evidence-only pass/fail report for ROADMAP Phase 4.
- **DoD:**
  - Operators can start/stop/switch without inflation.
  - Managers can trust totals without manual reconciliation.
- **Dependencies:** P4-T2.

---

## Phase 5 — UI Polish (P1/P3)

### P5-T1 — Visual hierarchy and declutter pass
- **Why:** Improve readability under fatigue.
- **Scope:** visual organization only; no business rule changes.
- **DoD:**
  - Core screens show clearer hierarchy.
  - Unnecessary controls/noise reduced.
- **Dependencies:** P4-T3.

### P5-T2 — Regression check + phase closeout
- **Why:** Ensure polish did not break workflows.
- **Scope:** regression evidence and final pass/fail report.
- **DoD:**
  - No UX regressions in core daily workflows.
  - ROADMAP Phase 5 exit criteria marked pass/fail with evidence.
- **Dependencies:** P5-T1.

---

## Assignment quick guide

When assigning work to an agent, send:
1. Task ID (for example `P2-T2`)
2. Prompt wrapper from `AGENT_PROMPTS.md`
3. Any repo-specific constraints unique to that run

Example assignment:
- "Execute `P2-T2` using `AGENT_PROMPTS.md` wrapper. Do not touch Orders domain."

---

## Audit follow-up queue — 2026-07-17

### FLOOR-I1 — Identity and active-timer integrity (P0)
- **Why:** Disabled kiosk users remain PIN-authenticatable, normal sessions retain stale access, and one active timer is not database-enforced.
- **Scope:** auth/session refresh, kiosk eligibility/revocation, time schema/service transaction boundary, admin stale-timer recovery.
- **DoD:**
  - `active`, current role, and `kioskEnabled` are enforced at the correct session boundary.
  - Disabling kiosk access revokes existing kiosk authority.
  - A database constraint prevents two open intervals for one worker.
  - Switch is atomic and deterministic under conflict.
  - Admin can close a stale employee timer with a required reason and before/after audit.
  - Concurrency, disabled-user, stale-session, switch-failure, and recovery tests pass.

### FLOOR-I2 — Canonical department transition (P0)
- **Why:** The visible move flow bypasses canonical completion, final submission persists the wrong status, and active timers can survive moves.
- **Dependencies:** FLOOR-I1.
- **Scope:** department submit/reassignment contracts, status derivation, active-timer guard, legacy completion endpoint retirement.
- **DoD:**
  - Normal floor completion checks required work and follows the configured route.
  - Administrative reassignment is visually separate, permissioned, and reasoned.
  - Move/complete cannot strand an active timer.
  - Final completion is persisted and returned consistently.
  - Order completion is derived only from persisted part completion.
  - Legacy auto-advance routes cannot bypass the contract.

### FLOOR-I3 — Shared-station and timer surface consolidation (P1)
- **Why:** Timer, acknowledgement, checklist, and submit can currently record different people for one physical work sequence.
- **Dependencies:** FLOOR-I2.
- **Scope:** acting-worker context, order-detail timer extraction, worker directory, duplicate route/UI retirement.
- **DoD:**
  - One short-lived, expected-worker identity is bound to every floor mutation.
  - Cross-tab worker replacement cannot silently affect another worker.
  - Order detail is the primary floor work surface; any standalone kiosk has a narrow documented role.
  - Duplicate/dead timer handlers and API families are removed or redirected.

### BUILD-B1 — Existing TypeScript baseline cleanup (P1)
- **Why:** Small unrelated contract errors prevent a clean production build and hide future regressions.
- **Scope:** vendor tuple inference, kiosk result typing/obsolete route, Orders test signatures, mock Orders parity, root `sterling-site` exclusion/project boundary.
- **DoD:**
  - Root type-check and production build pass without changing workflow behavior.
  - Focused vendor/kiosk/orders/mock tests remain green.

### FLOOR-I1/FLOOR-I3 owner clarification — dispatch-console target
- The TV computer is a trusted interactive dispatch console. Do not model its signed-in account as the employee performing the labor.
- Every timer command must store both the authorized console actor and explicit labor owner.
- The console may control an active employee without login switching or target-worker PIN entry on each action.
- Enforce one active timer total per employee across departments; atomic switch pauses the previous interval and starts the requested part.
- Multiple employees may run on the same part, while assignment remains independent of pause/resume state.
- Order detail is the primary interactive floor surface. The dashboard receives a TV-optimized, pricing-free status mode.
- Part History/Log groups intervals by employee, shows employee subtotals and an all-worker total, and exposes the console actor in interval detail.

### Trusted dispatch completion evidence — 2026-07-17
- `FLOOR-I1`: complete for the approved trusted-console scope. Current session role/active state is refreshed, kiosk eligibility is enforced, one-open-timer-per-worker is database-enforced, switch is atomic, and stale/admin closes are audited.
- `FLOOR-I2`: complete for the normal order-detail flow. Active timers block department completion/reassignment, final completion persists correctly, and the bypassing auto-advance route is retired.
- `FLOOR-I3`: complete for timer identity/surface consolidation. Order detail uses explicit labor owner plus authenticated console actor; the TV dashboard is the primary status surface and the optional PIN kiosk delegates to the same timer invariants.
- `BUILD-B1`: complete. Root type-check, full lint, 127 tests, and production build pass.
- Browser evidence: 1920x1080 TV dashboard, live running-worker card, direct part navigation, employee timer dialog, Pause/Finish dialog, employee-grouped labor history, assignment labels, part-switch URL state, and Shipping/complete timer guard all verified.

### Shop Floor display customization completion evidence — 2026-08-24
- Live Production now owns a persisted, admin-editable display profile for layout, broad sorting, and ordered translucent color rules.
- The requested default `days past due >= 7` red rule is validated and applied across every order-centric Shop Floor layout.
- Focused tests passed (9/9), targeted lint and TypeScript passed, the production build passed with 62 pages, and live browser QA covered saving, sorting, collapse persistence, and both queue/grid tile styling.

### Shop Floor glass visual completion evidence — 2026-08-24
- The dashboard now uses a route-scoped atmospheric glass system across controls, tiles, metrics, and lower summaries; other routes are unchanged.
- The overdue default is the deeper `#7f1d1d` oxblood, with a guarded compatibility promotion that does not overwrite custom colors.
- Focused tests passed (10/10), targeted lint and TypeScript passed, the production build passed with 62 pages, and live visual QA covered expanded/collapsed controls and deep-red overdue tiles.

### Shop Floor black/navy palette correction evidence — 2026-08-24
- Replaced the page-wide cyan/green/amber cast with black, navy, royal-blue, and restrained indigo ambient layers while preserving the existing glass surface hierarchy.
- Added an opaque-enough dark dashboard backing to prevent the global cyan body glow from bleeding through; semantic green and oxblood red remain localized.
- Targeted lint and TypeScript passed, the production build passed with 62 pages, and live QA covered expanded/collapsed dashboard states plus the deep-red overdue style.

### Shop Floor Quick View and Working now collapse evidence — 2026-08-24
- The compact select-only Quick View strip is outside the configuration collapse and directly precedes the chosen results view; layout/advanced filters/rules/save remain inside configuration.
- Department queue filtering now occurs before sorting, live timer counts participate in order sorting, Working now collapses independently, and the duplicate Unassigned filter option is removed.
- Targeted lint and TypeScript passed, focused tests passed (10/10), the clean production build passed with 62 pages, and live QA covered sort reversal, filtered queue membership, both remembered collapses, and the final clean hierarchy.

### Shop Floor exact control-row placement evidence — 2026-08-24
- Status, Priority, Sort, and Direction now replace the old department-pill row directly before every chosen results view; there is no separate Quick View surface.
- Department selection and Show completed items live inside the collapsible configuration area and disappear when Customize is collapsed.
- Targeted lint and TypeScript passed, focused tests passed (10/10), the clean production build passed with 62 pages, and live QA confirmed exact placement, department switching, collapse behavior, and descending order-number results.
- 2026-08-25: Completed the local-only demo follow-up batch: all order-detail tiles now share the approved Shop Floor hierarchy; coordinator and multi-worker assignments are separate through creation/traveler output; Shop Floor defaults newest-created first; customers support selectable multiple contacts and structured shipping addresses. Evidence: migration validation, 51/51 focused tests, lint/type-check/build, local browser QA, and read-only data counts. Deployment to `.72` is explicitly held.
- 2026-08-25: Prepared business-specific document letterheads and a draggable editable Disclaimer block locally, and reconfirmed the single `DDMMYY-###` new-quote path. Evidence: 13/13 tests, lint/type-check/build, local editor/print browser QA. `.72` deployment remains held for owner review.
- 2026-08-27: Restored the proven serial PDF-text-to-model drawing reader and retained only the finished length/width/thickness extraction extension. Evidence: 34/34 focused tests locally and on `.72`, TypeScript/lint, two 62-route builds, exact deployed hash, three healthy endpoints, Running task, Ready monitor, empty error log. Rollback `C:\ShopApp\backups\pre-update\order-intake-reliability-20260827-155741`.
- 2026-08-28: Closed the first real Quote Drawing Import V2 production failure. Next had bundled the PDF.js package resolver as numeric ID `15754`; the runtime now uses verified copied filesystem locations and the build rejects that unsafe resolver. Exact private ZIP gates passed through durable integration plus local and `.72` packaged HTTP uploads: `READY_FOR_REVIEW`, 9/9 canonical PDFs, 11 retained files. V2 tests 57 passed / 3 opt-in skipped; TypeScript/lint/63-route builds passed. Live rollback `C:\ShopApp\backups\pre-update\v2-import-path-fix-20260828-070024`; ShopApp healthy/Running, monitor Ready, error log empty.
