**Non-authoritative operational history. CANON.md and ROADMAP.md are authoritative.**

# Agent Context — ShopApp1 (Single Source of Truth)

Shared brain for multiple agents.
If you are working on this repo, follow it and update the Decision Log when needed.

## Product Intent

ShopApp1 is a shop operations app focused on:
- Orders / jobs
- Customers
- Labor / addons / charges
- Time tracking that supports real shop interruptions and job switching
- Admin settings that allow customization without code edits

Goal: a scalable foundation that can grow.

## Architecture Invariants (Do Not Break)

1) Module ownership is explicit
   - Each domain lives in src/modules/<domain>/
   - Domain logic does not live in src/lib/

2) Layer separation
   - *.repo.ts talks to Prisma. Nothing else does.
   - *.service.ts contains business rules.
   - UI components do not import Prisma.
   - Services do not import React.

3) Validation lives with the domain
   - Zod schemas in src/modules/<domain>/*.schema.ts
   - Cross-domain schemas should be rare and justified

4) No new dependencies without Decision Log entry

5) Changes must be discoverable
   - Update PROGRESS_LOG.md and docs/AGENT_HANDOFF.md each session

## Current Priorities

### Production access
- Before any `.72` inspection or deployment, read `docs/PRODUCTION_ACCESS.md`. It contains the authorized non-secret SSH settings, production layout, and required rollback/verification sequence.

### P0 — Platform Stability
- Ensure auth/session handling is consistent (single approach)
- Ensure app shell is stable and mobile navigation is usable

### P1 — UX improvements
- Orders page: cleaner hierarchy, less clutter
- Time tracking: accurate totals with stop/switch/resume

### P2 — Modularization
- Move orders/quotes/customers logic into modules
- Establish stable patterns and repeat them

### P3 — Feature expansion
- Reporting/export, attachments, and other add-ons as needed

## Domain Truths (so agents don’t hallucinate requirements)

- All charge kinds are per-part: `partId` is required for every charge kind.

## Decision Log (append newest at top)

### 2026-09-03 — Manual retry has durable page scope; newer importer has no local OCR
Decision: Store reprocessPageId in existing job configJson atomically with selected-page pending state. The ordinary claimed-job/recovery entry point branches to a selected-page path before inventory; never replay siblings or packet quantity/BOM finalization for this action. Explicit retry bypasses local classification/duplicate and completed-model cache shortcuts, preserves saved confirmations and assembly quantities, and retains prior review on failure. Deduplicate same-page clicks and reject competing retries while busy. No schema/package addition. Remove the newer service's local OCR calls and ignore its former OCR flag; leave unrelated OCR consumers/dependencies alone. Direct-PDF V3 context contains no supplemental local text/candidate/BOM hints; locally copying PDF pages needs no OCR. PDF-native text/image content remains intact. Local only; models, schema, production and prompt instructions otherwise unchanged.

### 2026-09-03 — New importer uses local PDF splitting and one-pass page extraction
Decision: Preserve the existing safe ZIP inventory and lossless canonical PDF page copying; never send a multi-page packet or all packet images to the model. In V3 disable automatic extraction retries, fallback-model escalation and dimension refinement, even when older env/DB settings enable them. Leave unresolved values for human review; retain explicit manual retry and zero-call reuse/reference skips. Process separate one-page requests with bounded concurrency (two in the local trial). Resolve PDF.js fonts through ancestor node_modules for server-derived child checkouts without require.resolve webpack rewriting or new packages. Legacy prompt/schema migration was superseded and reverted. Local only; no production deployment or new measured AI speed claim.

### 2026-09-03 — Current importer shares AI knobs, not the V3 response contract
Decision: The existing Use current importer backend consumes getDrawingImportAiSettings through a small domain request helper, so the local Playground profile applies to both readers. Preserve legacy prompt, JSON field contract, PDF preparation, UI and downstream review behavior. Explicitly reject incomplete/empty Responses results before JSON parsing and keep manual review with a safe warning. Do not describe settings parity as identical extraction or a measured speedup. No new dependencies or production deployment; browser/test execution still requires completion after the approval-service outage.

### 2026-09-03 — Playground settings are a local trial profile, not production defaults
Decision: Add optional validated `DRAWING_IMPORT_V2_REASONING_SUMMARY` and `DRAWING_IMPORT_V2_REASONING_MODE`; omit both from the API request when unset. The owner-approved local trial runs gpt-5.4-mini, standard/low reasoning (including refinement), medium verbosity, concise summary, and 10,000 maximum output tokens via `.tmp/local-browser-regression-20260903/playground.env` and its `start-local.cjs` launcher. Keep the default medium reasoning/low verbosity and existing model defaults unchanged outside this trial. Preserve the server-derived v4.0.1 prompt/schema, isolated database/storage, and complete V2/V3 availability profile. No production deployment is authorized by this local test request.

### 2026-09-03 — Drawing AI verbosity is explicit and independent from reasoning effort
Decision: Configure Drawing Import response verbosity through validated `DRAWING_IMPORT_V2_VERBOSITY` (`low`, `medium`, or `high`), defaulting to `low`. Keep normal Terra extraction and focused Terra dimension refinement at `medium` reasoning unless a measured evaluation justifies another value.
Reason: Responses API verbosity controls visible structured-output detail independently from reasoning effort. The drawing schema needs concise output, while medium reasoning remains the selected quality/latency baseline.

### 2026-09-03 — Order decomposition uses compatibility exports and facade-preserving repo families
- Large order/quote coordinators are decomposed one controlled leaf or command family at a time. Pages retain request, navigation, confirmation, and refresh orchestration until those contracts have dedicated typed controllers; step shells are not replaced with prop-heavy monoliths.
- `orders.service.ts` and `orders.repo.ts` remain temporary compatibility surfaces while header, file, event, charge, part, create, query, and status-workflow service/repository families move into owned modules. Workflow/department callbacks are injected into extracted command families to avoid service cycles, and services continue importing persistence through `@/repos/orders` so TEST_MODE real/mock selection is never bypassed.
- Checklist completion, department transitions, and time adjustment form one transaction-ordered lifecycle boundary. Do not split them through root-service callbacks or duplicate their rules; first define a typed lifecycle contract with transaction-order tests, then extract checklist commands and department transitions before reassessing a separate time family. Quote work-plan persistence and final-price derivation likewise stay in the coordinator until a typed pricing controller can own both without putting business rules in presentation components.
- Production-derived and local trees may retain intentional pre-existing behavior differences during reconciliation; the pristine production download remains unchanged until deployment.

### 2026-09-01 — Durable intake drafts, customer-part reuse and stock waits stay separate concerns
- Unsaved fresh quote/direct-order intake uses a versioned, debounced browser draft keyed by workflow identity. Persisted quotes, quote conversions and frozen repeat templates remain the durable source and do not restore an unrelated browser draft. Successful creation clears only its matching draft.
- Historical part reuse is a customer-scoped read model. It copies static drawing/manufacturing definitions and drawing attachments with visible source/version, while quantity, pricing, procurement and worker assignments start fresh. Manufacturing-note extraction creates evidence-backed suggestions only; a person must explicitly add one.
- `WAITING_ON_STOCK` is an OrderPart material status, not a new Order workflow status. State changes are event-audited only when the persisted value actually changes. Shop Floor Summary reads these events plus department movements; no summary counters are persisted.
- Phone throughput improvements preserve drawing fidelity and the existing Terra route: aggregate preflight, two-file client concurrency, idempotent partial retry, session-lock waiting, stage-specific AI limits, heartbeat and startup recovery. Model/image quality changes require representative benchmark evidence.
- No dependency or schema migration was required for this release.

### 2026-08-31 — Repeat-template attachment ownership
- RepeatOrderTemplateAttachment requires both templateId and (for part drawings) templatePartId. A nested part create supplies only the latter. Generate a UUID for the template before its atomic nested create and explicitly include templateId on part attachments. Restrict top-level template attachment reads to templatePartId=null to avoid duplicating part drawings in Create again. No schema/dependency change. Verify with real disposable SQLite and snapshot/prefill route tests, not mocked persistence alone.

### 2026-08-31 — Local phone drawing handoff
Decision: Add a phone-upload domain with private filesystem-backed expiring sessions, SHA-256 capability hashes, admin-owned immutable quote context, bounded image staging and idempotent handoff into the current quote drawing importer. The phone can upload but cannot view quote records or trigger AI independently. Store staging outside public attachments; expire/revoke capabilities and clean stale staging opportunistically. Generate QR codes in-process with new qrcode dependency and @types/qrcode rather than a third-party QR URL service. Reuse installed sharp/JSZip. No database migration or production rollout in this task.
Reason: Camera/gallery uploads must reach the exact draft without email, login sharing, duplicate import creation or a separate interpretation workflow. Normal session auth remains required on desktop. Local testing must not enable TEST_MODE on a LAN-accessible listener.

### 2026-08-31 — Permission-aware business-wide search
Decision: Add a search domain with a static, explicit SQL field/source registry, parameterized user values, pre-query authorization, complete category counts and bounded 40-result pages. Search live business records plus already-stored drawing/BOM extraction; do not scan credentials, configuration, raw model requests or external shares. Preserve drawing-only employee attachment rules before counts/snippets. No dependency or migration required.
Reason: The old global-looking search only covered a few order fields and stopped at 60 results. Extensible allowlists prevent secrets from entering search while grouped results and contextual links make broad results useful. Full-text ingestion of previously unread files is a separate future indexing task; current query-time scanning should be benchmarked before very large datasets.


### 2026-08-31 — Quote review dimension units are a presentation/entry preference
- The compact per-page in/mm toggle covers final length, width/outside diameter, thickness/wall, and derived cut/stock displays. Canonical persisted values remain inches; unit switches perform no writes. Edited metric values convert using 25.4 mm/in before existing correction/save paths.
- Missing revision is optional in field/page attention and review filters, matching the existing save contract. Actual conflicting revision evidence remains visible. No dependency, schema, model, or historical-data changes.

### 2026-08-28 — V3 uses direct canonical PDFs with Terra-only dimensional refinement
- Quote Drawing Import V3 reuses V2's durable upload/page/evidence/review/save architecture and changes only interpretation: each eligible authoritative single-page PDF goes directly to `gpt-5.6-terra` at high detail.
- A second Terra request at high reasoning is permitted only when finished length, width/outside diameter, or thickness/wall is unresolved. It may replace only those unresolved fields. Sol, Luna, OCR, and local auto-accept remain disabled in the production admin beta.
- A model failure or incomplete response changes the page to uncertain/manual review; weak local label reads cannot silently become parts. Missing physical dimensions remain nullable rather than guessed.
- V3 release verification must include a packaged HTTP upload against an isolated database/storage copy on the deployment host, not just source tests or a local model call.
Reason: The approved private benchmark showed direct PDF Terra materially improved manufacturing dimensions at acceptable time/cost, while the prior crop/local merge increased calls and allowed weak label artifacts to survive.

### 2026-08-28 — Quote Drawing Import V2 is a durable evidence-backed admin beta
- Drawing Import V2 applies only to admin quote creation/edit. Direct-order drawing intake remains on the proven legacy reader, and quote-to-order conversion copies reviewed values and page lineage without rerunning extraction or multiplying quantities again.
- The authoritative page for a PDF source is a lossless vector single-page PDF linked to its original packet/page; previews and crops are derived. Local coordinate evidence, classification, BOM parsing, validators, OCR, and duplicate checks run before one-page Terra requests, with Sol reserved for explicit hard/conflicting cases.
- Import state, attempts, evidence, usage/cost, and corrections are durable in additive records so review can resume after refresh/restart. Accepted fields remain nullable/evidence-backed; unresolved pages stay in review rather than being guessed.
- Production is currently an admin beta with local auto-accept and customer-profile matching disabled, Luna disabled, a USD 8 hard cap, and an explicit legacy fallback. Final default rollout requires an approved representative golden set and measured real-layout accuracy/latency/cost gates; synthetic evaluation cannot certify it.
- Added `pdf-lib` for lossless page copying, `tesseract.js` plus `@tesseract.js-data/eng` for local bounded OCR, and upgraded `openai` to the compatible Responses/Structured Outputs SDK. Native document packages are externalized through Next `serverExternalPackages` and copied into standalone output for Windows production.
Reason: Quote packets need recoverable, page-traceable interpretation with deterministic local work first, narrowly routed model cost, explicit uncertainty, and rollback-safe production operation rather than all-page opaque AI extraction.

### 2026-08-27 — Drawing PDFs use the proven text-to-model reader
- PDF drawing intake extracts bounded native PDF text and sends that text directly to the configured AI model, one drawing at a time. It does not rasterize/split PDFs or invoke packet/image workers in the active import path.
- The only extraction-contract extension is confidence/evidence-backed finished length, width, and thickness; unclear dimensions remain null for human review.
- The existing 100-supported-drawing mixed-ZIP boundary, attachment storage, progress events, autosave review, and downstream stock-dimension persistence remain intact.

### 2026-08-27 — Finished stock dimensions are explicit part data
- Finished width and thickness are stored independently on quote parts, order parts, and repeat-order template parts; `stockSize` remains the backward-compatible display/storage field for the complete stock requirement.
- Drawing intake derives the displayed total stock dimensions in the fixed order `thickness × width × (cut length × quantity)`, with cut length remaining `finished length + 0.125`.
- Extraction must return null and require human review when width or thickness is unclear. The current full-page plus high-detail title-block pipeline remains in place, and its synthetic accuracy evaluation now covers both dimensions.
- No new dependency was introduced.

### 2026-08-26 — Customer dashboard metrics are computed, not persisted
- Customer relationship metrics are derived on read from orders, part quantities, contacts, businesses, and canonical time intervals; no summary counters or labor totals are stored.
- Order frequency means total orders per active order-history month, using a one-month minimum denominator. Most recent work includes order creation/receipt and time-entry activity.
- Search/filter/sort behavior is shared by Tiles and List so both views always represent the same customer set and ordering.

### 2026-08-26 — Customers retain multi-business membership and imported fax data
- A customer is one organization with zero or more `CustomerBusiness` memberships; a high-confidence alias match merges the organization while retaining every Sterling, C&R, and Powder Coating source membership.
- Customer and contact fax values are first-class optional fields. Imported values fill blanks and never replace non-empty customer/contact data with lower-confidence workbook values.
- The workbook importer is idempotent, preserves the source filename on memberships, keeps the full legacy/billing address fallback, and populates structured address fields only when parsing is reliable.


### 2026-08-25 — Work-order detail uses a phone-first stacked flow below desktop
- Below `lg`, Parts is a compact horizontal selector followed immediately by the selected order; action controls use touch-friendly wrapping and detail tabs remain horizontally reachable without widening the document.
- At `lg` and above, retain the approved sticky 360px Parts rail and full detail workspace. Responsive changes must not alter workflow permissions or business behavior.

### 2026-08-25 — Business is an everyday Shop Floor quick filter
- Business appears between Department and Priority and offers All plus the three canonical shop businesses.
- It participates in the shared filter pipeline so Tiles and List cannot diverge, and All remains the fresh-load default.

### 2026-08-25 — Offsite owner access stays private through Tailscale
- SHOPAPP participates in the owner's private Tailscale network for direct phone access outside the shop LAN.
- Do not add public Funnel, router forwarding, Tailscale SSH, or public RDP as part of app access. Optional Tailscale Serve/HTTPS is not currently enabled.

### 2026-08-25 — Production fresh-start cleanup preserves exact reviewed work IDs
- Historical production orders/quotes may be purged only after a timestamped application/database rollback snapshot and a disposable-copy dry run.
- The cleanup must preserve an explicit reviewed ID set, validate expected before/delete/after counts, keep customer/user/configuration/template data intact, leave physical attachment files untouched, and finish with SQLite foreign-key verification.
- The 2026-08-25 reset retained `CRM-1007`, `CRM-1008`, and `250826-001`; it removed 16 older orders and 17 older quotes.

### 2026-08-25 — Order part cards share the Shop Floor tile color hierarchy
- Individual part cards inside an order use a defined deep-navy unselected surface and a brighter royal-blue selected surface with stronger borders and text contrast.
- This is a visual hierarchy only; part selection and all department, timer, and order behavior remain unchanged.

### 2026-08-25 — Order detail uses an open canvas and department actions cover unassigned parts
- The Parts rail and selected-order workspace sit directly on the page canvas; only individual part cards and task-specific inner panels retain card surfaces.
- Department management is one adaptive audited action: unassigned parts show Assign department with every active destination, while assigned parts show Move department excluding their current department.
- Both paths require an audit note and block while the selected part has an active timer.

### 2026-08-25 — Timers and department selection are everyday Shop Floor controls
- Timers is an independent top-level control beside Tiles/List/More and reveals Working Now without opening customization.
- More owns only advanced Shop Floor customization.
- Department is a quick filter between Status and Priority; it filters the shared Tiles/List set by effective current part department and includes All and Unassigned choices.
- This supersedes the earlier portion of the Tiles/List/More decision that placed the timer strip behind More.

### 2026-08-25 — Focused admin order controls and audited Shop Floor tile actions
- Priority is administered through a focused order-header control rather than the broad order-details form, preventing stale form state from reverting a priority update.
- Manual order-status changes remain admin-only, require a reason, and flow through the existing history-backed status service; normal workflow statuses continue to derive from part activity.
- Shop Floor HOT work uses a flame indicator in Tiles and List. Admin-only three-dot actions exist in Tiles for priority, status, and assigned machinist; permission visibility remains server-derived.
- No dependency or schema changes were introduced.

### 2026-08-25 - Shop Floor separates everyday views from optional production controls
Decision: Open Shop Floor directly in a compact three-column Tiles view, place Tiles, List, and More beside the four everyday filters, and keep the timer strip plus advanced customization hidden behind More. List is a flat order table driven by the same filtered and sorted order set, preceded by one four-card summary row whose fourth card is a compact top-three machinist workload. Remove the legacy dashboard blocks below the selected view; every fresh page load returns to Tiles while saved filter/color configuration remains intact.
Reason: The shared production screen needs the order cards immediately without a large introduction or configuration panels consuming the TV. List needs high-level shop context before its rows, but duplicated overview/workload/status sections below the table waste vertical space and create conflicting hierarchy on the 80-inch display.

### 2026-08-25 - Customer files remain local-canonical and are pulled into a non-deleting Unraid mirror
Decision: Keep `C:\ShopApp\storage` as ShopApp's canonical attachment root so a NAS outage cannot stop the application. Expose it through a hidden, encrypted, read-only SMB share limited to `.10`; Unraid pulls new/changed files every five minutes into `/mnt/user/projects/ShopApp Customer Files` while preserving the existing `business/customer/order` hierarchy and intentionally never deleting mirror files. Keep monitoring/recovery artifacts separate under `projects/Backups/ShopApp/monitoring`.
Reason: Management needs a normal searchable Windows Explorer hierarchy, while production availability and ransomware resistance require that the Windows server not depend on or hold broad write credentials for the NAS.

### 2026-08-25 - ShopApp health is checked locally and independently from Unraid
Decision: Run a SYSTEM Windows health task every two minutes, retry the local health endpoint three times, and restart only the `ShopApp` scheduled task if confirmed unhealthy. Independently check the LAN health endpoint from Unraid every two minutes and record/notify only outage and recovery transitions.
Reason: Local self-healing handles process failure quickly, while an external check proves that a second machine can actually reach the webserver and avoids treating Windows' own opinion as sufficient monitoring.

### 2026-08-25 - Department movement is separate from completion, quote origins are snapshotted, and travelers are per part
Decision: Keep governed department completion and manual department movement as separate order-detail actions. Manual moves require an explicit destination and audit note, block while a timer is active, and flag backward movement as rework; completion previews must use the same open-checklist routing helper as the service. New quotes snapshot the actual first active department when saved. The Order Traveler reuses the authenticated order print route and prints one US Letter sheet per part with order context, required reading, production checkpoints, notes/files, and physical signoff fields.
Reason: Operators need to correct routing without falsely declaring a department complete, saved quotes must not change origin when department ordering later changes, and physical work needs a readable traveler attached to each actual part rather than a crowded order-wide summary.

### 2026-08-24 - Windows production separates persistent state and uses address-scoped recovery paths
Decision: Run the Windows LAN deployment from `C:\ShopApp`, separating `app`, protected `config`, SQLite `data`, attachment `storage`, `logs`, `backups`, and `maintenance`. Start the standalone app as SYSTEM through Task Scheduler, verify it with a boot supervisor, and scope ShopApp to the shop subnet while limiting SSH/RDP to the admin workstation independent of Windows network-profile classification. Keep the router DHCP reservation authoritative for `192.168.254.72` rather than duplicating a static address in Windows.
Reason: Application releases must be replaceable without endangering shop data, the server must recover without storing an administrator password, and a Windows Public/Private profile change must not strand every remote-management path after reboot.

### 2026-08-24 - Shop Floor glass uses an open canvas and restrained geometry
Decision: Keep the black/navy atmospheric gradient as the Shop Floor canvas, but remove both the full-page dark backing sheet and the large glass wrapper around production results. Place the Live Production heading directly on the gradient and use modest `rounded-lg`/`rounded-md` geometry for functional panels, tiles, controls, and nested rows; reserve pills/circles for semantic badges and live indicators.
Reason: The stacked dark shells and large radii made the dashboard feel bubbly and consumer-oriented. An open canvas with tighter geometry keeps useful depth while reading as a sleeker professional production system.

### 2026-08-24 - Quote numbers are daily shop-wide sequences
Decision: Automatically assign quote numbers as `DDMMYY-###`, using the server's local calendar date and the next sequence across all businesses for that day. Preserve already assigned numbers, including legacy formats, when editing existing quotes.
Reason: The owner identifies quotes by the date they were created and their order within that workday; business-prefixed random identifiers were backwards for that workflow, while renumbering historical quotes would break existing references.

### 2026-08-24 - Shop Floor Quick View controls live with the governed results
Decision: Replace the chosen tile view's former department-pill row with the persistent, compact status, priority, sort-field, and direction selects, without a separate Quick View panel. Keep layout, department selection, completed-item inclusion, advanced filters, conditional colors, and shared saving inside the independent Live Production configuration collapse. Apply filters before sorting in every layout, and let Working now collapse independently with device-local persistence.
Reason: Everyday view manipulation must remain available in the exact pre-tile control slot when configuration is collapsed, while department choice changes the configured work-queue view and belongs with the other structural settings. The independent timer collapse preserves big-screen space without hiding sorting.

### 2026-08-24 - Live Production glass atmosphere is black and navy
Decision: Use black, near-black navy, and restrained royal-blue light for the Shop Floor's ambient glass layers, with enough backing opacity to mask the application's global cyan glow. Keep cyan limited to existing brand/action accents and keep green/red localized to operational state and alert surfaces.
Reason: The owner liked the dimensional glass material but strongly disliked the overall cyan cast. Treating material, ambient palette, and semantic status colors as separate concerns preserves the glass depth without tinting the entire production screen cyan.

### 2026-08-24 - Live Production owns a scoped three-depth glass surface system
Decision: Style only the Shop Floor dashboard with a layered glassmorphism system: atmospheric brand-color light behind the page, strong glass for the dispatch/control shell, regular glass for primary cards, and soft glass for nested rows. Conditional order-color rules retain inline priority over the glass surface. Promote only the untouched legacy seven-day overdue red to the deeper oxblood default; preserve user-customized rule colors.
Reason: The owner supplied a glass-interface reference and wants the shared TV dashboard to feel dimensional and modern without changing the visual contract of quote, order, or admin screens or weakening urgent status colors.

### 2026-08-24 - Repeat orders are customer-part definitions and required reading has explicit authoring/status surfaces
Decision: A newly saved repeat-order template represents one selected source part for one customer, carries stable source-part identity, and is reused by both the old-order `Create again` action and the dedicated Repeat Orders page. Required reading is authored explicitly per part during quote/direct/repeat order creation, persists through quote conversion, blocks timer start for the selected worker until that worker has a current receipt, and displays the active-user roster split into acknowledged/not acknowledged for the current part, department, and instruction version.
Reason: The owner is repeating a proven customer/part manufacturing package, not selecting a generic order-document layout. The enforcement gate also needs a conspicuous input for the boss and a visible accountability roster or required notes can be omitted or their status cannot be managed confidently.

### 2026-07-17 - The TV dashboard is the Shop Floor station; the separate PIN kiosk is retired
Decision: Treat the signed-in production dashboard at `/` as the single trusted Shop Floor station. It may select employees and control their timers using the existing actor/worker audit split, with Read Me First receipts as the safety gate and no employee PIN. Remove the Kiosk navigation entry and employee kiosk/PIN setup; redirect the legacy `/kiosk` URL to Shop Floor.
Reason: The owner intended “kiosk” to mean the shared 80-inch TV computer, not a second employee-unlock application. Two floor-control surfaces and repeated PIN entry created redundant concepts and unnecessary friction for the actual small-shop deployment.

### 2026-07-17 - Read Me First is a persisted receipt gate; trusted-console acknowledgement is PIN-free and audited
Decision: A dispatch timer may start only when the selected worker has a current persisted instruction receipt for the part, department, and instruction version. The trusted shop console must show the complete mission brief before saving that receipt, record the selected worker as acknowledger and the signed-in operator as actor, and require no per-action worker PIN. The standalone kiosk uses its already PIN-unlocked worker identity and likewise shows the full brief before acknowledging. A checkbox or timer-request boolean cannot create or substitute for a receipt.
Reason: The prior supervisor checkbox did not prove the employee saw the note and let the dispatch service silently create an acknowledgement. Persisted, versioned receipts make the boss's note an enforceable gate while keeping the shared TV-console workflow fast enough for the shop floor.

### 2026-07-17 - Part procurement belongs to QuotePart and final-price reasoning stays compact
Decision: Persist procurement cost and markup on the QuotePart alongside its selected vendor; include that purchase in the owning part's calculated price (not a separate quote-level total); and show a compact expandable work-step/material explanation on each part price.
Reason: Quote-level purchased-item rows detached material decisions from the part that triggered them and made vendor/cost context easy to lose during estimating.

### 2026-07-17 - Feeds and speeds uses explicit machine limits and operation-specific source geometry
Decision: Make the owner's Haas VF-2SS the explicit calculator machine profile; hard-cap programmed output at 12,000 RPM and 833 IPM while retaining uncapped targets for warnings; load tool-family setup defaults deliberately; require geometry inputs needed by each operation; use the uploaded FSWizard geometry/deflection helpers for milling, thread milling, drilling/reaming, tapping, turning, and grooving; and replace invented ramp/plunge/torque indicators with supported MRR, horsepower, torque, or unavailable states.
Reason: A generic formula with retained inputs produced unsafe-looking six-digit RPM recommendations and incorrect specialized-tool geometry. Explicit machine ceilings, branch-specific inputs, and source-derived calculations make the page auditable and prevent unsupported secondary values from appearing authoritative.

### 2026-07-16 - Quote pricing uses frozen Work Step snapshots, explicit final-price intent, and one conversion gate
Decision: Present the legacy Addon/checklist capabilities as one operator-facing `Work Step` concept with one usage choice; snapshot each selected step's name, department, rate, and price/shop behavior on the quote; enforce one selection per quote part and Work Step; store per-part pricing with stable quote-part identity plus explicit `CALCULATED` or `MANUAL` source; treat final per-part sell prices as replacing their underlying work estimate; and permit conversion only after approval through the single quote-detail conversion review.
Reason: The prior UI exposed implementation flags as competing concepts, mutable setup rows could silently change saved quotes, non-zero inference made a deliberate $0 price impossible, work and final-price displays invited double counting, and multiple conversion entry points required material/vendor re-entry. Frozen inputs and an explicit price source make saved estimates auditable while a single approval/conversion path preserves the manufacturing package without repeated decisions.

### 2026-07-16 - Admin access is enforced at the route-tree layout and admin home is task-first
Decision: Guard the entire `/admin` route tree in its server layout, route signed-out visitors to sign-in and non-admin users to `/403`, and make the admin landing page prioritize New Quote and Resume Quotes while grouping infrequent shop/system setup and labeling direct order creation as emergency/internal work.
Reason: Per-page access checks are easy to omit and had allowed server-rendered admin data to appear without a shared boundary. The previous control-room-style landing page also made daily estimating work compete visually with rarely used configuration tools.

### 2026-07-16 - Drawing-assisted order intake uses a dedicated import module, reviewed title-block contract, and JSZip
Decision: Add nullable `partName` fields to live and repeat-template parts; keep drawing identity extraction in `src/modules/drawing-import/` rather than expanding the machining-feature BOM contract; use `jszip` for bounded ZIP expansion; create imported drawings as per-part attachments and start the existing BOM analysis against returned created-part IDs after order creation.
Reason: Title-block/order fields and machining-feature analysis have different validation and review needs, while reliable ZIP traversal/CRC/decompression handling should not be hand-written. Returning created part IDs preserves deterministic file-to-part mapping, and non-blocking BOM startup keeps an analyzer failure from destroying an otherwise valid order intake.

### 2026-04-20 - Feeds-and-speeds parity now uses branch-specific helix/IPR behavior and treats threadLead as the tap pitch proxy
Decision: For the current parity pass, keep the existing calculator UI contract but tighten the FSWizard-backed math by using branch-specific helix behavior, exact Carbide-only `ipt_carbide` selection, pitch-driven tap feed from the existing `threadLead` input, and a closer endmill DOC/WOC ideal-geometry solver when one engagement dimension is left at the default-off path.
Reason: The provided `this.go` shows that the previous single-helix-factor / generic-IPR path was still flattening real drill/tap/endmill behavior away from FSWizard, but exact tap thread-table parity, turn/groove deflection parity, and corner-rounding/threadmill geometry parity would require new inputs/helpers beyond this session's safe scope.

### 2026-04-16 - Feeds-and-speeds parity defaults now follow FSWizard's default-off chip-thinning path and use a repo-backed parity checklist
Decision: For the current feeds-and-speeds parity pass, keep chip thinning disabled unless the FSWizard tool dataset explicitly enables it, stop auto-forcing slotting mode from `WOC ~= diameter`, fold the FSWizard material/flute DOC-load adjustment back into the load-factor budget, and keep both automated and manual parity cases in-repo.
Reason: The prior local port was still applying chip thinning and slotting behavior more aggressively than the provided `this.go` default path, which pushed feed recommendations away from what the owner is checking in FSWizard. A small repo-backed parity checklist makes future logic changes auditable instead of relying on memory or ad hoc spot checks.

### 2026-04-16 - Feeds-and-speeds calculator is a logged-in app tool backed by an app-owned FSWizard data module
Decision: Add the new feeds-and-speeds utility as a normal logged-in route (`/tools/feeds-speeds`) surfaced in the shared app navigation, and keep its calculation data in an app-owned `src/modules/feeds-speeds/` module that imports the provided FSWizard embedded dataset directly.
Reason: The owner wants this calculator accessible to all logged-in users as a first-class shop tool, not hidden under admin or private-only routes, and the provided FSWizard bundle is the source of truth for materials/tool factors in v1 so it must live in-repo instead of remaining an external local file dependency.

### 2026-04-14 - Quote origin department/custom amounts live in quote metadata; add-on rate types now include per-foot
Decision: Extend quote workflow persistence by storing `originDepartmentId` and titled `customAmounts` in quote metadata, keep add-on/quote selection rate types string-based while adding `PER_FOOT`, and have quote conversion map custom amounts into non-checklist `CUSTOM` order charges using the quote origin department (or first active department fallback) while seeding converted parts to that same starting department.
Reason: The owner needs quote-specific routing/pricing behavior without widening the Prisma quote schema unnecessarily, and the existing metadata + string snapshot contracts already provide a stable extension point. Mapping conversion through the saved origin department lets Paint-origin quotes start in Paint instead of defaulting to Machining, while custom amounts still satisfy the all-charges-are-per-part order model.

### 2026-04-13 - Completed parts keep their final department for queue visibility; department queue prioritizes active timers
Decision: When a part reaches `COMPLETE`, preserve its final `currentDepartmentId` instead of clearing it to null, and have the department work queue sort orders with active timers ahead of the rest while showing order-level active timer chips on the card.
Reason: Nulling the department makes completed/shipped work look unassigned and prevents the existing `Show completed items` filter from surfacing finished parts in the queue operators expect. Active timers are the hottest work on the floor, so they should rise to the top of department cards without changing the rest of the queue model.

### 2026-04-13 - Mission-brief acknowledgement follows the selected timer worker; quote-derived instructions are sectioned bullet notes
Decision: Keep checklist/submit acknowledgement browser-user based, but when the order-detail timer flow is starting work for a selected worker, require mission-brief acknowledgement against that selected worker and verify it with that worker's PIN; seed quote-derived `workInstructions` as headed bullet sections covering all original quote note-style fields.
Reason: Shared floor stations can have one browser login while a different worker is actually starting the timer, so the acknowledgement receipt must belong to the worker who will own the timer. Structuring quote-derived instructions makes the required-reading popup scan like a real shop bulletin instead of a flat text wall.

### 2026-04-10 - Order detail is now the primary kiosk-timing entry for floor users
Decision: Keep the kiosk session/PIN/timer APIs and `/kiosk` route, but move the primary worker-facing kiosk timing flow back into `/orders/[id]` by opening an in-page PIN + part-picker dialog from the order-detail timer area for kiosk-enabled machinists.
Reason: Floor users already live in order detail while reviewing notes/files/checklists, so sending them to a separate kiosk page for the same timer action adds friction without changing the timer enforcement model.

### 2026-04-10 - Floor timing uses a dedicated kiosk with user-owned timers; `/orders/[id]` stays review-first
Decision: Add PIN-based kiosk identity on `User` (`kioskEnabled`, `kioskPinHash`, `primaryDepartmentId`), move floor timing into a dedicated `/kiosk` flow with its own signed kiosk session, enforce one active timer total per worker, and keep `/orders/[id]` readable for floor workers while hiding timer controls there for kiosk-enabled machinists.
Reason: The shop has shared-floor computers and workers who still need order notes/files/checklists but get confused by timer controls in the full order view. User-owned kiosk timing preserves worker accountability and bottleneck reporting without forcing five persistent browser logins or multiple incognito-tab identities.

### 2026-04-10 - Repeat-order backend snapshots manufacturing definition only and validates template-instantiation inputs strictly
Decision: Repeat-order template snapshotting must not carry the source order PO into template defaults, template-based order creation must reject unknown or duplicate `templatePartId` overrides, provided order numbers must obey the same business-prefix rule as standard order creation, and template instantiation must fail fast when a template has no parts.
Reason: Repeat orders should preserve reusable manufacturing intent without leaking stale execution/chatter fields, and the backend must keep template instantiation deterministic so the UI cannot silently create malformed orders from bad override payloads.


### 2026-04-10 — Repeat orders use frozen order-based templates; floor accountability is part-level
Decision: Add a dedicated repeat-order template domain built from existing orders (not live-order flags and not quote reuse), preserve `Order.assignedMachinistId` as coordinator-only, add part-level worker assignments, explicit part work instructions with versioned acknowledgement receipts, and separate checklist actor vs performer attribution.
Reason: The shop needs fast repeat-order creation from existing manufacturing definitions plus auditable proof of who read instructions, who did the work, and who recorded it, without mixing reusable template state with live execution history.

### 2026-04-10 — Vendor directory expands with searchable `contact` and `materials`; rollback imported rows before reimport
Decision: Extend `Vendor` with first-class `contact` and `materials` text fields, include both in Vendors search/import CRUD paths, and clear the unreferenced partial spreadsheet import before the next import run.
Reason: The supplier workbook already exposes contact/material columns, and the owner wants vendor lookup by material without forcing a larger normalized many-to-many materials model yet.

### 2026-04-10 — Vendors spreadsheet import uses stateless preview/mapping with `xlsx` and preserves the current Vendor schema
Decision: Add the `xlsx` dependency and implement a stateless Vendors import flow that reparses the uploaded spreadsheet for both preview and confirm-import, letting admins choose sheet, header row, column mapping, and duplicate behavior while still importing only into the existing `Vendor` fields (`name`, `url`, `phone`, `notes`).
Reason: The provided supplier list is a legacy `.xls` workbook rather than a flat CSV, and the current Vendor model is intentionally small; a preview-and-map flow reduces import risk without forcing an immediate vendor-schema expansion.

### 2026-04-09 — BOM analyzer PDF support uses pdf.js page-1 rasterization before vision
Decision: Add `pdfjs-dist` and `@napi-rs/canvas` and rasterize the first page of uploaded/stored PDFs to PNG server-side before sending the result through the existing print-analyzer vision flow.
Reason: The BOM analyzer is image-based and the existing `sharp` build in this environment cannot rasterize PDFs, so PDF support requires a dedicated renderer without introducing external system-binary dependencies.

### 2026-04-09 — Missing part department ownership must default to first department, never inferred next-step routing
Decision: When an order part has no persisted `currentDepartmentId`, read models and initialization/backfill paths must assign the first active department in ordering (currently Machining) instead of inferring ownership from whichever checklist department still has open items.
Reason: Inferring department from checklist state makes last-item completion look like an automatic department move, which conflicts with the manual-submit workflow and obscures true ownership after quote conversion or other uninitialized-part paths.


### 2026-04-08 — Dashboard/work-queue department ownership follows current department, not checklist presence
Decision: Dashboard department displays and work-queue ownership should be driven by `OrderPart.currentDepartmentId`; department feed visibility must not depend on whether that same department still has open checklist rows.
Reason: The floor needs one clear “who owns this part right now” signal, and checklist-driven visibility hides legitimately assigned work from the display when the part lacks department-scoped checklist items.

### 2026-04-08 — Order-detail department controls use ordered department list with first-department fallback
Decision: Order detail should receive the ordered active department list from Orders service and use that list for timer selection and manual department moves instead of inferring options from checklist rows; when a part has no explicit/current routed department yet, fall back to the first active department in ordering.
Reason: Checklist-derived department options can be empty or incomplete for newly converted/manual parts, which breaks timer selection and forces operators into raw ID entry; using the canonical ordered department list keeps UI choices stable and makes Machining the default first-stop under current configuration.

### 2026-04-07 — Part-pricing basis model: coexist line item + quote persistence, order review transient
Decision: Introduce per-part `pricingMode` (`PER_UNIT` | `LOT_TOTAL`) with explicit part-price entry in Quote Review, persist it in quote metadata (`partPricing` entries include `pricingMode`), and compute lot totals as mode-driven. Keep existing `basePriceCents` semantics intact; `partPricingTotal` is a separate estimate line item (coexists, does not overwrite base fabrication). For `/orders/new`, apply the same per-part basis controls and instant estimate behavior in review UI, but keep it transient (not persisted on order create payload) until an explicit Orders-domain persistence contract is approved.
Reason: Admins need explicit, per-part pricing interpretation without hidden math; preserving base pricing avoids silent contract breaks while coexistence keeps calculations transparent. Quote persistence is required for edit/reopen fidelity; order-side persistence remains intentionally deferred to avoid schema drift without a dedicated contract.

### 2026-04-07 — Shared work-item pricing contract for quote/order builders
Decision: Introduce a shared pricing helper module (`src/modules/pricing/work-item-pricing.ts`) used by both Quote Editor and Order Create flows for checklist-vs-priced semantics and assignment/subtotal projection.
Reason: Pricing and labeling drift occurred when quote and order builders duplicated rules independently; a shared contract keeps assignment labels and totals consistent across flows.

### 2026-04-07 — Canonical order-number storage normalization for order-owned files
Decision: Add an Orders-domain post-create/post-conversion normalization step (`ensureOrderFilesInCanonicalStorage`) that ensures order-owned file records point to storage paths under `business/customer/orderNumber/` while preserving conversion behavior as copy semantics.
Reason: Operators require file continuity across quote→order lifecycle with a stable backend folder convention keyed by order number.

### 2026-04-07 — Department-bound timer model (Shipping blocked for timers)
Decision: Require department selection when starting timers, persist `departmentId` on `TimeEntry`, allow concurrent active timers across different departments, enforce one active timer per `(user, department)`, and block Shipping from timer start flows.
Reason: Shop-floor time tracking must reflect real department usage (Machining/Fab/Paint) with department-level totals/history while keeping Shipping configured for checklist/workflow but out of timer operations.

### 2026-04-07 — Explicit department submit workflow + part time adjustments
Decision: Shift order-detail checklist behavior from checkbox-driven auto-advance to explicit per-part department submission, and record optional user-added part time via a dedicated `PartTimeAdjustment` model with required note when extra time is entered.
Reason: Operators reported unreliable/incorrect “last checklist item” auto-advance behavior; explicit submit gating plus auditable manual time notes improves trust, control, and traceability of part progression and total-time reporting.

### 2026-03-23 — Isolated marketing site lives as its own Vite subproject
Decision: Build the new manufacturing marketing website in a dedicated `sterling-site/` folder with its own Vite/React/TypeScript toolchain, package manifest, styling, and content files rather than coupling it to the existing Next.js app.
Reason: The requested site must stay deployable by direct URL and remain isolated from the main shop app's navigation, components, styles, logic, config, and dependency graph while the marketing experience evolves independently.

### 2026-03-23 — Simplify order status to workflow rollup with admin override
Decision: Standardize manager-facing order statuses to `RECEIVED`, `IN_PROGRESS`, `COMPLETE`, and `CLOSED`; auto-sync them from part activity/checklist completion while keeping admin-only manual status edits with required reasons.
Reason: The shop-floor workflow is already part/department-driven, so the order status should act as a simple searchable dashboard rollup instead of a second operational workflow that drifts from parts.

### 2026-03-19 — LAN-aware auth base URL fallback
Decision: Add shared `src/lib/base-url.ts` and use it for auth redirect/sign-out base URL resolution; when configured env URLs still point at loopback (`localhost`/`127.0.0.1`) but the request/base URL is a LAN origin, prefer the request origin.
Reason: Local-network dev access was bouncing auth flows back to loopback URLs, so auth needed one shared rule that still preserves explicit non-loopback env config.

### 2026-02-26 — Dual seed profiles + one-script installer workflow
Decision: Introduce `seed:basic` (functionality baseline) and `seed:demo` (pre-populated showcase dataset) plus `scripts/install.sh` to orchestrate local/Docker installation with explicit `--seed` selection.
Reason: Operators need a predictable quick-start path for either lightweight functional validation or full demo walkthroughs without manual command choreography.

### 2026-02-25 — Add OpenAI SDK dependency for isolated Print Analyzer vision route
Decision: Add `openai` npm dependency and implement OpenAI Responses API usage only inside `src/app/api/print-analyzer/analyze/route.ts` for server-side vision extraction.
Reason: The new sealed Print Analyzer feature requires a server-side vision-capable LLM call without exposing API keys to the client.

### 2026-02-23 — Closed-interval admin edit path must be API-gated and audited
Decision: Add an admin-only `PATCH /api/time/entries/[entryId]` path that permits closed-interval edits only when a reason is supplied; emit a part event audit record (`TIME_ENTRY_EDITED`) for part-linked edits.
Reason: P3-T1/P3-T2 require explicit admin-audited edit policy enforcement on the server side and deterministic rule handling independent of UI behavior.

### 2026-02-23 — Customers module boundary pattern aligned with Orders/Quotes
Decision: Add `src/modules/customers/{customers.repo.ts, customers.service.ts, customers.schema.ts, customers.types.ts}` and route active Customers call paths through service/repo layering; keep `src/lib/zod-customers.ts` as a compatibility shim.
Reason: P2-T3 requires Customers to stop being a boundary exception while avoiding broad drive-by refactors.

### 2026-02-23 — Orchestration standards + business-logic canon alignment
Decision: Formalize plan-first orchestration artifacts (`tasks/todo.md`, `tasks/lessons.md`), require prior-task validation before new task execution, require build/test verification per session, and align canon with part-level charges + Orders-as-container enforcement + switch-context dialog + admin-audited closed-interval edit policy.
Reason: Owner clarified governance and business-logic standards that must be uniform across all future task execution and architecture work.

### 2026-02-18 — Centralize sign-in callback URL normalization
Decision: Add `src/lib/auth-redirect.ts` and route all sign-in redirects + callback parsing through shared helpers (`buildSignInRedirectPath`, `normalizeCallbackUrl`).
Reason: P1-T1 requires one auth/session truth path; shared redirect normalization removes split callback handling and prevents unsafe external callback targets.

### 2026-02-18 — Treat continuity freshness as explicit recurring task work
Decision: When executing `P0-C1`, record explicit DoD evidence in `PROGRESS_LOG.md` and refresh `docs/AGENT_HANDOFF.md` even when no product code changes occur.
Reason: Continuity drift is a tracked risk; explicit audit artifacts make freshness verifiable across agent sessions.

### 2026-02-18 — Add ticket-sized agent task board + prompt pack
Decision: Add `docs/AGENT_TASK_BOARD.md` and `AGENT_PROMPTS.md` as execution companions to ROADMAP for one-task-per-session delegation.
Reason: Reduce agent drift by making phase order, dependencies, scope, and DoD explicit and copy/paste assignable.

### 2026-02-03 — Add dotenv load for postinstall DB setup
Decision: Add dotenv as a dev dependency and load it in scripts/setup-db.cjs so postinstall can see DATABASE_URL from .env.
Reason: Local dev should honor .env during setup-db without requiring manual exports.

### 2026-02-09 — Add CustomField.uiSection for quote step staging
Decision: Introduce CustomField.uiSection (INTAKE/PART_BUILD/REVIEW) to control when custom fields appear in the quote editor.
Reason: Move Finish Required out of intake without breaking existing custom field behavior.

### 2026-02-08 — Add TEST_MODE harness + repo factory
Decision: Introduce TEST_MODE switch with centralized auth bypass and repo factory that can swap Prisma repos for in-memory mocks (orders/users/time).
Reason: Allow safe testing in restricted environments without DB/auth, while keeping production behavior unchanged.

### 2026-02-05 — Add PartEvent logging + part status for order detail workflow
Decision: Introduce PartEvent records (with OrderPart.status) to capture part-level activity (timers, notes, files, checklist).
Reason: The two-card order workspace needs a dedicated part log and a completion marker for finish events.

### 2026-01-30 — Add roadmap and mechanical agent prompts
Decision: Add ROADMAP.md and AGENT_PROMPTS.md to enforce gate-based planning and strict, rule-based agent execution.
Reason: Keep work sequenced and prevent agents from taking initiative or expanding scope.

### 2026-01-30 — Add CANON.md as project constitution
Decision: Introduce CANON.md as the single source of truth for product intent, mental model, and UX principles.
Reason: Prevent context drift across chats/agents and make project direction explicit.

### 2026-01-28 — Clarify charge model
Decision: Document that LABOR/ADDON are already per-part; other charge kinds can be order-level.
Reason: Prevent agents from redoing already-solved work.

### 2026-01-28 — Adopt explicit module pattern
Decision: Move toward src/modules/<domain>/{repo,service,schema,types,ui} structure.
Reason: Avoid scattered domain logic and enable multi-agent work without drift.

### 2026-01-28 — Establish continuity docs
Decision: Add AGENTS.md, PROGRESS_LOG.md, and docs/AGENT_HANDOFF.md.
Reason: Multi-agent continuity must be enforced by repo artifacts, not memory.

### 2026-07-16 — Quote-first pre-production workflow with lossless operational conversion
Decision: Keep Quote and Order as separate lifecycle records, make Quote the admin-only resumable starting point, persist a five-checkpoint workflow, store per-part drawing/material/procurement data on quote parts, and copy the non-pricing manufacturing package into an Order with unique `sourceQuoteId` provenance. Customer quote prices and custom price-only rows remain on Quote; converted operational work definitions use zero order price.
Reason: Draft estimates must not leak into production dashboards/timers, but operators should never re-enter customer, part, drawing, material, location, vendor, finish, note, or work-definition data after approval. A unique source-quote link also prevents duplicate conversion races.

### 2026-07-16 — Adaptive authenticated BOM analysis
Decision: Require authentication before starting BOM analysis and replace four unconditional corner-analysis calls with a single lower-right fallback only when the full-image pass lacks confident general tolerances.
Reason: The prior route exposed API spend to unauthenticated requests and used five model calls per part. The adaptive path keeps human-review safety while reducing normal BOM analysis to one request and difficult prints to two.

### 2026-07-17 — Trusted shop-floor dispatch console and one-active-timer model
Decision: Treat the large-TV computer as a trusted shop-floor dispatch console. The signed-in console operator may start, pause, resume, or finish time on behalf of any active employee without changing browser login or requiring the target worker's PIN for every action. Persist the console actor separately from the employee whose labor interval is recorded. Enforce one active timer total per employee across all departments; starting different work must atomically pause the employee's current interval before starting the new one. Multiple employees may work on the same part simultaneously. Keep part assignment, timer state, and department completion independent. Make Order detail the primary interactive floor surface, with a TV-optimized dashboard as the queue/status display and an optional self-service kiosk as a secondary future surface.
Reason: The shop has five to seven employees per department, an 80-inch shared production display, and older machinists who will not repeatedly navigate or change logins. A dispatcher must be able to manage interruptions in seconds while the system still records both who performed the labor and who operated the console. One active timer per worker prevents overlap; preserving assignment while paused lets urgent interruptions occur without falsely moving or completing the original part.

### 2026-07-17 — Part labor history is interval-derived and employee-grouped
Decision: Derive part labor from immutable timer intervals and show it under the part's History/Log grouped by employee, with employee subtotals, an all-employee part total, running time, interval detail, and the console actor for each action. Administrative corrections require a reason and immutable before/after audit. Do not use unaudited stored-seconds adjustments in canonical totals.
Reason: Management needs actual employee time per part for estimating and pricing, while employees are frequently interrupted and may create several separate intervals on the same part. Grouped interval totals preserve that reality without double counting or forcing the shop to remember interruptions manually.

### 2026-07-17 — Cross-platform standalone packaging
Decision: Run standalone asset packaging through dependency-free Node filesystem APIs instead of invoking a Bash-only copy script from `npm run build`.
Reason: The application is developed and verified on Windows but deployed through standalone/Docker output. The packaging step must behave identically on both platforms so a successful Next.js compile is also a successful production build.

### 2026-08-24 — Shop Floor display profiles are shared, rules-based configuration
Decision: Persist one validated Shop Floor display profile in application settings. The profile owns the default layout, broad order sort field/direction, and an ordered list of conditional translucent tile-color rules; the first enabled matching rule wins. All signed-in floor users may preview changes in place, while only administrators may save the shared profile. Collapse state remains device-local because it describes the individual TV/browser, not shop-wide business policy.
Reason: The large Live Production screen must be adaptable without code changes, including attention rules such as “7 or more days overdue = red,” while preventing an accidental worker edit from silently changing every display.

### 2026-08-25 — Customer contacts are selectable records and order staffing separates coordination from labor
Decision: Model customer contacts as a one-to-many customer-owned record, require quote/order entry to select the intended contact explicitly, and snapshot that contact onto operational records. Keep the legacy customer contact/address scalars readable during migration. Treat `Order.assignedMachinistId` as an optional coordinator, while the employees performing work are explicit part assignments seeded from multi-select creation controls.
Reason: A company such as Toyota can have many requestors, historical travelers must not change when a customer contact is edited later, and selecting multiple workers must not cause one of them to be mislabeled as the job coordinator.

### 2026-08-25 — Shop Floor defaults to creation recency and order detail shares one tile language
Decision: Persist a real order creation timestamp and use newest-created-first as the fresh Shop Floor default, narrowly upgrading only the previous saved default. Use shared order-detail tile/inset tokens across every order-detail tab while preserving semantic status colors.
Reason: Newly entered work must appear immediately at the front of the production queue, and the complete order workspace—not only the part selector—must match the approved high-contrast TV tile hierarchy.
### 2026-08-25 — Document headers are business letterheads and disclaimers are movable template blocks
Decision: Keep business letterhead data inside each template Header block, with presets resolved from the selected/actual business and editable fields for name, address, phone, and email. Keep recipient Customer Info independent. Add Disclaimer as a first-class draggable quote block with editable heading/body. Defer logos until a later explicit scope.
Reason: The same quote layout may print for three businesses, each needs correct sender identity, and terms/validity language must be positionable without code changes or being conflated with customer data.

### 2026-08-26 — Drawing intake is resumable, assembly-aware, and deterministic where shop math is known
Decision: Persist reviewed drawing-import metadata in a device-local draft keyed by destination/business/customer, clear it only after the parent quote/order saves (or explicit user clear), ask One-off versus Assembly before upload, and apply an assembly multiplier to extracted component quantities. Keep known saw-cut arithmetic outside the model: cut length is final length plus 0.125 inch and total stock length is cut length times quantity. Extract PDFs with bounded concurrency, retain bounded BOM text, and send BOM context only to drawings that reference BOM/parts-list material.
Reason: Long drawing reviews must survive an accidental refresh, assembly quantities must be correct before review begins, deterministic arithmetic must not depend on model interpretation, and bounded parallel work improves throughput without flooding the model/API.

### 2026-08-26 — Attachment visibility is enforced at the download boundary
Decision: Non-admin users may see and download only part-scoped drawing files with approved drawing kinds; quote/order documents and labels indicating purchase orders, quotes, invoices, or other administrative records remain admin-only. Apply the same centralized policy to API payload filtering and the authenticated attachment download route.
Reason: Hiding a file only in React is not authorization. Purchase orders and commercial documents must remain inaccessible even if a non-admin guesses or retains an attachment URL.

### 2026-08-26 — Manual part pricing always carries an explicit basis
Decision: Persist manual part prices with `PER_UNIT` or `LOT_TOTAL` semantics and show the basis in quote entry, detail, totals, and print. Automatic pricing remains per-unit.
Reason: The same entered dollar value produces materially different totals depending on whether it applies to each part or the entire quantity; the basis must survive reload and be visible anywhere the total is interpreted.

### 2026-08-27 — Multi-page PDFs are drawing packets, not single parts
Decision: Split uploaded multi-page PDFs into page images for independent title-block extraction, classify each page as `PART_DRAWING`, `BOM`, `COVER`, or `OTHER`, omit BOM/cover pages from part creation, retain ambiguous pages for human review, and preserve the original PDF as an order/quote-level supporting file. Keep one-page PDFs and ZIP imports unchanged, and trace every generated part to its original packet page.
Reason: Customers often combine many drawings, indexes, and BOMs into one PDF. File-count semantics otherwise collapse the entire packet into one false part, while dropping uncertain pages could silently lose real work.

### 2026-08-27 — Drawing extraction uses direct high-detail inputs and field-preserving validation
Decision: Send rendered packet pages directly as high-detail data-URL images with native page text, a full-page view, and a bottom-right title-block crop. Retry one transient response failure, log model/input and validation failures without document contents, and normalize reasonable document-role variants instead of rejecting the complete extraction. Keep `gpt-4.1-mini` until a representative owner-approved eval set supports a measured model change.
Reason: Temporary vision-file readiness and strict whole-object validation can turn correctly read title-block fields into silent filename fallbacks. Accuracy failures must preserve usable fields, remain observable, and be measured rather than inferred from structural tests.

### 2026-08-27 — Production rollback preserves operational data by default
Decision: A timestamped source rollback restores only the source files captured in that snapshot unless the owner explicitly asks to restore database data too. Verify with an exact deployed-file hash and live health. Any temporary build compatibility setting must be removed before completion.
Reason: Production orders and uploads continue independently of code releases, but owners need to test a known code point without losing current shop data.
