## 2026-09-03 — Page retry must not restart packet finalization
- Trigger: Reprocess reset one selected page but invoked the full coordinator, which rewrote all page results/quantities. The UI also ignored retry progress when completed-page count fell after a terminal snapshot.
- Preventive rule: Persist the exact retry page ID atomically with queue state, branch before inventory, bypass cached/duplicate/reference short-circuits for the selected AI reread, and never run packet-wide finalization. Assert unchanged sibling DB rows and attempt history, preserved confirmations (including in-flight saves), and terminal-to-pending polling.
- Runtime lesson: server-derived snapshots can lack schema/test scaffolding and differ in service signatures. Isolated DB tests use the installed generated Prisma schema and initialize the empty temporary SQLite file before db push on Windows. Never target the user's runtime database for tests.

## 2026-09-03 — Enforce page-call policy throughout the coordinator
- Trigger: Owner clarified that PDF packets must be split locally and each page must get its own AI extraction call.
- Preventive rule: Verify canonical request attachments and all follow-up paths, including dimension refinement, retries and DB-enabled fallback. An adapter accepting one page alone does not enforce one-pass orchestration. Preserve uncertainty for review rather than silently creating extra model calls.
- Root and server-derived defaults/assets differ: test both real runtimes after conditional edits; recover missing staged files from a read-only server source, not an assumed newer local copy. When the owner redirects unfinished work, revert only that work before proceeding.

## 2026-09-03 — Export prompts from the recorded runtime, not the root checkout
- Trigger: A prompt-only response quoted root v4.0.0 while the last measured import records v4.0.1 from the server-derived local runtime.
- Preventive rule: Match the persisted attempt's prompt/model/route to its actual runtime tree before supplying a reproducible request. Prefer stored Responses input and schema; include the image, dynamic context, and settings, and disclose reconstruction uncertainty.

## 2026-08-31 — Login prompts must distinguish session, role and capability failures
- Do not classify every 401/403 as a missing desktop login. Optional locked-kiosk probes and phone capabilities handle their own states; 403 means forbidden, not sign in again. Verify browser-facing origin against Host behind Next bind/proxy addresses, and test hostile origins as well as localhost/LAN/HTTPS proxy cases.

## 2026-08-31 — Ambiguous screenshots need exact action identification
- Owner clarified an unannotated second screenshot meant Create again, not its visible department warning. Verify the failing action before changing workflow policy. Reverted tentative department edits before any deployment; both requested actions share repeat-template persistence.

## 2026-08-31 — Drawing reader parity across intake paths
- Trigger: Owner found direct orders still used the legacy reader while quotes used V3.
- Preventive rule: When a shared intake capability is requested for both workflows, explicitly test quote and direct-order entry points, destination tagging, reviewed-field mapping and attachment preservation; never assume a new component replaced every legacy caller.
- Applied: This session expands the shared reader to direct-order creation while preserving its existing save adapter and quote behavior.

## 2026-08-31 — Global search needs an explicit coverage and permission contract
- Trigger: Owner expected the navigation search to search everything, but it only queried several order fields and capped results at 60.
- Preventive rule: Inventory searchable entities and fields, distinguish filenames from extracted content, disclose indexing limits, remove silent result ceilings through pagination, and test authorization on counts/snippets as well as links. Never interpret everything as credentials or server internals.
- Applied: Static search-source registry, protected attachment filtering, 75-result pagination test, secret-marker tests and visible index-boundary note.

## 2026-08-28 — Windows Tailscale servers require unattended-mode restart proof
- Trigger: SHOPAPP's Tailscale Windows service and tunnel adapter were running, but the user-bound profile was inactive after the interactive session ended, leaving the backend in `NoState` with no private IP or MagicDNS record.
- Mistake pattern: Treating a Running/Automatic Windows service as proof that the node will remain joined after logoff or reboot.
- Preventive rule: For a Windows server, enable Tailscale unattended mode, record the intended DNS name/private IP, then perform a controlled service restart and require BackendState `Running`, Self Online, zero health warnings, and application health through the Tailscale IP before declaring remote access durable.
- Applied in next session where: Same-session SHOPAPP recovery preserved `shopapp.tail2e8197.ts.net` / `100.69.89.39` and passed the post-restart application-health check.

## 2026-08-26 — Stop SQLite writers before backup hashing
- Trigger: The guarded customer-import deployment tried to hash the live SQLite database while ShopApp still held it open, and Windows rejected the read.
- Mistake pattern: Treating a database file like an ordinary static asset during preflight instead of sequencing application quiescence before copy/hash operations.
- Preventive rule: On Windows ShopApp deployments, stop the ShopApp task/process before copying or hashing SQLite, keep restart in a `finally` path, and validate the hash from the completed backup copy.
- Applied in next session where: The same customer-import deployment script was corrected before retrying; the failed preflight made no production source, schema, or data changes.

## 2026-08-25 — Verify the resolved executable before remote deployment
- Trigger: Initial `ssh`/`scp` deployment checks resolved to the workspace sandbox deny stubs and returned harmless placeholder output instead of reaching `.72`.
- Mistake pattern: Treating a zero exit from a command name as proof of remote execution without checking the resolved executable or receiving an authoritative remote hash/build signal.
- Preventive rule: Before every server deployment, resolve the SSH/SCP executable, use the explicit Windows OpenSSH paths when sandbox stubs are present, and require a remote staged hash plus server build output before reporting deployment.
- Applied in next session where: Same-session mobile work-order deployment used explicit `C:\Windows\System32\OpenSSH\ssh.exe` / `scp.exe`, verified the staged hash, and captured the complete server build and rollback output.

## 2026-04-09 — UI action labels must follow active selection state
- Trigger: User caught the move dialog showing `Submit to Fab` while the selected destination was `Shipping`.
- Mistake pattern: I left the confirm-button label bound to a derived default/next-step value instead of the dialog's actual selected destination state.
- Preventive rule: For dialogs and forms with mutable selections, audit every visible action label against the live controlled value before closing the task; never leave confirm copy tied to an initialization default.
- Applied in next session where: 2026-04-09 order-detail submit dialog label fix.

## 2026-04-10 — Large `data:` URLs should not be parsed with regex in route handlers
- Trigger: BOM analyzer returned `Maximum call stack size exceeded` for a ~`4 MB` to `6 MB` image upload.
- Mistake pattern: I used a regex-based `data:` URL parser in a Next route path that had to process multi-megabyte base64 strings.
- Preventive rule: For large upload payloads in route handlers, avoid regex parsing on entire base64 `data:` URLs; use delimiter-based parsing and prefer raw buffers or file uploads over repeated base64 roundtrips.
- Applied in next session where: 2026-04-10 BOM analyzer oversized-image normalization fix.

## 2026-03-19 — SQLite migration default-value trap
- Trigger: Prisma migrate failed while adding timestamp columns with `DEFAULT CURRENT_TIMESTAMP` via `ALTER TABLE` on SQLite.
- Mistake pattern: I assumed SQLite could add non-null timestamp columns with non-constant defaults directly.
- Preventive rule: For SQLite schema changes that introduce non-null timestamp defaults, use a table-redefinition migration pattern up front instead of `ALTER TABLE ... ADD COLUMN ... DEFAULT CURRENT_TIMESTAMP`.
- Applied in next session where: OrderPart timestamp migration (`20260319120000_add_order_part_timestamps`).

## 2026-02-26 — Repeat tooling warning: patch workflow via shell
- Trigger: User warning repeated that patch edits were invoked through shell command execution.
- Mistake pattern: I slipped back to shell-mediated patch operations during iterative edits.
- Preventive rule: In this environment, default to direct file-write edits (cat/python) and avoid any patch command wrappers entirely.
- Applied in next session where: Admin IA + installer/seed tooling session (remaining edits executed via direct file writes).

## 2026-02-26 — User correction: use dedicated patch tool (not shell wrapper)
- Trigger: User warning that `apply_patch` was executed through `exec_command`.
- Mistake pattern: I used shell-invoked patching instead of the environment’s preferred dedicated patch workflow.
- Preventive rule: Use the dedicated patch tool/workflow directly when available; avoid wrapping patch commands inside generic shell execution.
- Applied in next session where: BOM part-attachment retrieval fix session.

## 2026-02-25 — Verify full wrapper surface requests (border + background)
- When user asks to remove a wrapper border, explicitly verify whether they also expect background removal/transparency before closing the task.
- For UI wrapper tweaks, audit the full class list (`border`, `bg-*`, shadow) so visual intent is fully satisfied in one pass.

# tasks/lessons.md — Anti-Repeat Rules

Record lessons after user corrections or process failures.

## Entry Template
- Date:
- Trigger (correction/failure):
- Mistake pattern:
- Preventive rule:
- Applied in next session where:

## Entries
- 2026-08-26
  - Trigger: The quote customer selector appeared unable to scroll beyond L after the customer import.
  - Mistake pattern: A fixed 100-record request was mistaken for a dropdown overflow problem because the alphabetical cutoff looked visual.
  - Preventive rule: For list cutoffs, compare rendered item count with API pagination/limits before changing scroll CSS.
  - Applied in next session where: Same-session `.72` quote customer-limit hotfix.
- 2026-08-26
  - Trigger: Owner reported that Customers only resembled Shop Floor cosmetically while a nested canvas/overflow wrapper created backing corners, its own scrollbar, and layer-crossing scroll behavior.
  - Mistake pattern: Reusing Shop Floor visual classes inside a child dashboard without matching the Shop Floor page-level ownership and scroll mechanics.
  - Preventive rule: When asked for page parity, compare wrapper ownership, overflow, stacking, and scroll behavior—not only tile colors/classes—and measure document overflow before deployment.
  - Applied in next session where: Same-session direct `.72` Customers page-level canvas correction.
- 2026-07-16
  - Trigger: User said the add-on versus checklist model was confusing and asked for a simpler workflow suitable for someone who currently estimates in his head.
  - Mistake pattern: Two implementation flags were presented as two user concepts even though the operator only needs to choose a task and where it is used.
  - Preventive rule: Keep capability flags internal; present one plain-language object with one mutually exclusive usage choice (`estimate + shop`, `shop only`, or `estimate only`).
  - Applied in next session where: Same-session Work Steps terminology, single usage dropdown, quote work-plan UI, and admin cleanup.
- 2026-07-16
  - Trigger: Pricing audit found that unrelated quote saves could silently reprice old work, manual $0 was indistinguishable from calculated pricing, and final part prices could be displayed alongside additive work subtotals.
  - Mistake pattern: Pricing intent and historical rate context were inferred from mutable catalog rows and non-zero values instead of stored explicitly.
  - Preventive rule: Persist price source and immutable estimate snapshots, use stable part identity, make the final sell-price path canonical, and regression-test $0 overrides, duplicates, and quantity rounding.
  - Applied in next session where: Same-session quote price-source contract, work-step snapshots/uniqueness migration, canonical totals, and focused pricing tests.
- 2026-07-16
  - Trigger: Admin audit found server-rendered admin pages that relied on scattered page checks and could expose data when a page omitted its guard.
  - Mistake pattern: Access control was implemented per page instead of at the shared route-tree boundary.
  - Preventive rule: Protect sensitive route groups in their shared server layout and test signed-out plus non-admin redirects independently of development test-mode sessions.
  - Applied in next session where: Same-session `/admin` layout guard and three-case access-control tests.
- 2026-07-16
  - Trigger: User clarified that the useful drawing intake needs to begin with Quotes and remain resumable through shop material checking and eventual conversion.
  - Mistake pattern: The first drawing-assisted workflow began directly on Order, forcing estimating and production lifecycles to compete and leaving no saved pre-production checkpoints.
  - Preventive rule: Model pre-production and production as separate lifecycles, but define one explicit manufacturing-package carryover contract so approved work never requires re-entry.
  - Applied in next session where: Same-session quote-first workflow, structured material walkdown, and lossless non-pricing conversion.
- 2026-07-16
  - Trigger: A diagnostic command used during API-cost research exposed a configured API key in local tool output.
  - Mistake pattern: Secret-bearing environment configuration was inspected too broadly instead of checking only whether a key was configured.
  - Preventive rule: Never print `.env`, secret values, or broad environment dumps during diagnostics; test only presence/length through redacted application behavior, and immediately recommend rotation if exposure occurs.
  - Applied in next session where: Same-session security notice; no secret value was copied into code, docs, logs, or responses.
- 2026-07-16
  - Trigger: User disliked the brown/yellow review palette and reported that confirming the default quantity required pressing the number input arrow.
  - Mistake pattern: The warning palette leaned on generic amber utility colors, and the only field-level resolution signal for quantity was editing the numeric value.
  - Preventive rule: Use the product's chosen high-contrast palette for attention states, and provide a direct confirmation control whenever an extracted default can be accepted unchanged.
  - Applied in next session where: Same-session neon-orange palette and quantity checkbox follow-up.
- 2026-07-16
  - Trigger: User reported that the drawing-review confirmation count/highlight did not identify the uncertain fields and stayed highlighted after corrections.
  - Mistake pattern: The tile color depended on a one-time `needsReview` boolean captured at import rather than live field values plus explicit user confirmations.
  - Preventive rule: Review warnings must be derived from current editable state, identify the exact fields/reasons, and include a visible resolution action for uncertain-but-prefilled values.
  - Applied in next session where: Same-session live drawing confirmation highlight fix.
- 2026-07-16
  - Trigger: User clarified that finish belongs in part notes, assembly drawings should remain uploaded without becoming parts, and common material shorthand was not matching reliably.
  - Mistake pattern: The first importer discarded a separately detected finish, treated every retained drawing as a part, and relied mostly on literal material-name token overlap.
  - Preventive rule: Drawing intake must map every extracted field to its intended destination, separate document retention from part creation, and test shop-floor aliases/grades against the actual configured material catalog while preserving source wording for review.
  - Applied in next session where: Same-session finish/assembly/material matching follow-up.
- 2026-07-16
  - Trigger: User reported that Open drawing returned File not found during drawing-import review.
  - Mistake pattern: The review UI reused the persisted attachment URL even though draft uploads do not have an attachment database row until order creation.
  - Preventive rule: Test file actions at every lifecycle stage they appear; draft-file previews need an authenticated draft-aware route, while persisted attachments should continue using the normal attachment route.
  - Applied in next session where: Same-session drawing review preview fix.
- 2026-07-16
  - Trigger: User reported that the drawing-import spinner looked potentially stuck and assembly detections could not be removed.
  - Mistake pattern: Long-running extraction exposed only indefinite activity, and review cards assumed every extracted proposal would be retained.
  - Preventive rule: Long imports must show advancing progress plus elapsed/status feedback, and every generated proposal must have an obvious removal path before commit.
  - Applied in next session where: Same-session drawing import progress/removal follow-up.
- 2026-07-16
  - Trigger: Drawing-import live smoke test sent a malformed upload request and the route allowed `req.formData()` to throw a 500.
  - Mistake pattern: Multipart parsing was performed outside the route's validation/error boundary.
  - Preventive rule: Wrap `Request.formData()` parsing for every upload route and return a deterministic 400 for missing/invalid multipart content before reading fields.
  - Applied in next session where: Same-session drawing-import route hardening.
- 2026-02-23
  - Trigger: Governance gap (missing formal plan/lesson artifacts).
  - Mistake pattern: Process expectations existed informally but were not enforced in local workflow files.
  - Preventive rule: For non-trivial tasks, require plan and verification evidence in `tasks/todo.md`; record correction-derived rules in `tasks/lessons.md`.
  - Applied in next session where: Agent documentation standards update.
- 2026-02-23
  - Trigger: User correction (tool usage warning).
  - Mistake pattern: I used `apply_patch` through shell commands instead of preferring direct file-edit methods available in this environment.
  - Preventive rule: Avoid shell-invoked `apply_patch`; use direct scripted file edits/other approved editing workflows in this repo context.
  - Applied in next session where: P2-T1 Orders boundary enforcement.

## 2026-02-23 — Tooling correction: patch workflow
- When editing files, use the dedicated patch workflow/tool instead of invoking `apply_patch` through a generic shell execution command.
- Before running patch operations, sanity-check that command/tool usage follows the repository interaction rules for this environment.
## 2026-04-13 - Queue ownership and completion visibility must stay operator-visible
- Trigger: User called out that active work should float to the top of department sorts, completed/shipped parts should not fall into an unassigned department state, and Vendors needed real pagination instead of endless load-more.
- Mistake pattern: I left dashboard queue ordering too passive, let completion clear visible department ownership, and accepted a one-way list browsing pattern in admin where page navigation was expected.
- Preventive rule: For floor queues, prioritize active work visually and preserve final ownership context for completed items; for admin tables that can grow, default to explicit pagination controls rather than assuming `Load more` is good enough.
- Applied in next session where: 2026-04-13 queue priority + timer chips + Vendors pagination + completed department ownership.

## 2026-04-13 - Timer/read-gate ownership must follow the selected worker, not the browser login
- Trigger: User clarified that the required-reading popup was still effectively tied to the logged-in browser identity, which breaks shared-station timing when Bill starts work while Matt is logged in.
- Mistake pattern: I reused the browser-session acknowledgement path for a worker-owned timer flow and only seeded a narrow subset of quote notes into the required-reading text.
- Preventive rule: For shared-station timer flows, audit every read/acknowledgement step against the actual worker who will own the timer, and when quote content feeds required-reading text, include all original quote note-style fields in a structured, scannable format.
- Applied in next session where: 2026-04-13 mission-brief worker PIN follow-up + quote-note bulletin formatting.

## 2026-07-17 - Replacement workflow paths must retire or delegate old paths
- Trigger: Kiosk/time/department audit found three timer API families, two floor timing surfaces, and both canonical and bypassing department-completion routes with different validation.
- Mistake pattern: New safer flows were added alongside older callable routes and handlers without making one service contract authoritative or removing the previous entry points.
- Preventive rule: When replacing a workflow, inventory every caller and route, move business invariants into one command layer, redirect or remove superseded entry points in the same bounded migration, and add contract tests proving old paths cannot bypass the new rules.
- Applied in next session where: Required acceptance rule for FLOOR-I1/FLOOR-I2 on the task board.

## 2026-07-17 - Do not share a Next build cache between production-build and live-dev verification
- Trigger: Running a production build while the development server's generated cache was present left the live page referencing a missing development stylesheet.
- Mistake pattern: The browser QA reused `.next` state across incompatible build modes and initially made a correct page look unstyled.
- Preventive rule: After a production build, stop the development server, verify and remove only the workspace `.next` cache, then start a fresh development server before live-browser acceptance testing.
- Applied in next session where: Production feeds-and-speeds correction live QA.
## 2026-07-17 - Inspect the exact user-highlighted region before diagnosing adjacent layout
- Trigger: The owner asked about a visible quote-editor layout defect and then corrected the diagnosis by pointing specifically to the parts list.
- Mistake pattern: I focused on missing page-level admin navigation instead of closely inspecting the overflowing row text in the supplied viewport.
- Preventive rule: When a user reports a visual layout problem, inspect the screenshot at component level for clipping, overlap, overflow, and wrapping before inferring a broader navigation or workflow issue.
- Applied in next session where: Quote part-list overflow correction.
## 2026-07-17 - A valid state still needs an unmistakable resolved signal
- Trigger: The material-order workflow stored the selected vendor and reduced validation errors, but its orange selected panel looked identical to an unresolved warning state.
- Mistake pattern: I treated a selected action color as sufficient feedback even though the same color was used for attention-required states.
- Preventive rule: For every confirmation workflow, verify both the data/validation state and the visual state after resolution; selected and unresolved styling must not be ambiguous.
- Applied in next session where: Quote material-order resolution feedback.

## 2026-07-17 - Part-associated purchases must remain attached through pricing
- Trigger: The pricing step showed purchased items separately from the part that required ordering, losing the selected vendor context.
- Mistake pattern: A quote-level purchase list made it easy for material decisions to become detached from the originating part.
- Preventive rule: Persist vendor, cost, and markup on the owning QuotePart, render that context beside the part price, and verify it survives save/reload before treating pricing QA as complete.
- Applied in next session where: Part-specific purchased-material pricing.
## 2026-07-17 - A displayed pricing component must affect the displayed part price
- Trigger: The purchased-material card correctly calculated a marked-up amount, but the part tile still showed only the work-step price and the card remained visually warning-colored after a cost was entered.
- Mistake pattern: Procurement was added beside the part-price flow instead of becoming an input to the single calculated-price rule used by both the UI and server.
- Preventive rule: When adding a price component, verify one representative amount through input, status feedback, unit price, part total, quote total, save/reload, and the expanded explanation; keep the calculation in a shared helper so the visible and saved values cannot diverge.
- Applied in next session where: Part-price purchase inclusion and expandable breakdown.
# 2026-08-24 — Never reboot a newly provisioned remote host before proving a fallback path
- Trigger: The new Windows production server passed SSH and ShopApp LAN checks before reboot, but its post-reboot network/firewall state blocked SSH, ShopApp, RDP, and WinRM after the operator had left the site.
- Mistake pattern: Treating automatic services and an AtStartup task as sufficient boot persistence without first proving network-profile persistence, adding delayed network-aware health recovery, and retaining an independent authorized recovery channel.
- Preventive rule: Before rebooting a newly provisioned remote host, verify two independent management paths or keep the operator onsite; install a delayed boot supervisor that validates network category, firewall scope, required services, application health, and logs; then test stop/start behavior before the first full reboot.
- Applied in next session where: Resume this Windows deployment by restoring onsite access, installing the network-aware supervisor, and repeating reboot verification while an operator remains available.

## 2026-07-17 — Confirm what a physical “kiosk” means before creating a second workflow
- Trigger: The owner clarified that “kiosk” meant the existing shared TV/shop computer, not a separate employee PIN-unlock application.
- Mistake pattern: Treating a device label as a request for an additional software surface and duplicating controls already available on the trusted console.
- Preventive rule: Before adding a kiosk-specific flow, map the physical device, signed-in operator, audience, and existing screen; prefer one trusted Shop Floor surface when those are the same.
- Applied in next session where: 2026-07-17 separate PIN-kiosk retirement and Shop Floor naming.

## 2026-07-17 — A confirmation checkbox is not an instruction acknowledgement gate
- Trigger: The trusted-console timer dialog let a supervisor check a box and the dispatch service then created the selected employee's Read Me First receipt without showing the note.
- Mistake pattern: Treating a request-time boolean as equivalent to a durable, attributable acknowledgement.
- Preventive rule: Any work-blocking instruction must be shown in full and acknowledged into a versioned receipt before the protected service action; protected services must verify the receipt and never manufacture it from a confirmation flag.
- Applied in next session where: 2026-07-17 authoritative Read Me First timer gate.
## 2026-07-20 — A tutorial video must demonstrate continuous interaction
- Trigger: The owner correctly rejected the first tutorial because it was a narrated slideshow of held screenshots rather than a video showing ShopApp being used.
- Mistake pattern: I treated an MP4 container plus narration as satisfying “show on screen what you are doing,” even though there was no cursor movement, clicking, typing, uploading, or visible workflow progression.
- Preventive rule: For software tutorials, define acceptance in observable actions before production: continuous application footage, visible pointer/click feedback, visible field entry, real page transitions, and at least one completed end-to-end workflow. Static screenshots may be used only for brief titles or emphasis, never as the primary demonstration.
- Applied in next session where: Same-session live-action quote tutorial rebuild.
## 2026-08-24 — Enforced floor gates need an obvious authoring field
- Trigger: The owner clarified that quote/order creators need a clearly indicated place to enter notes that workers must acknowledge.
- Mistake pattern: Treating backend persistence and floor enforcement as complete while leaving the authoring surface labeled generically as work instructions or deriving required reading from unrelated notes.
- Preventive rule: Every enforced floor gate must have an explicit, visually distinct authoring field at each creation entry point, with concise text explaining who must acknowledge it and what action it blocks.
- Applied in next session where: Same-session quote, direct-order, and repeat-order required-reading authoring pass.

## 2026-08-24 — Validate glass material and color cast separately
- Trigger: The owner liked the glass direction but strongly disliked the cyan cast produced by the ambient lights and transparent backing.
- Mistake pattern: Matching blur, translucency, and edge depth from a reference without separately confirming the dominant palette that results after the page background shines through.
- Preventive rule: For glassmorphism work, validate two independent acceptance points in the live screenshot: surface material (blur/edge/depth) and overall color cast. Keep operational status colors local to their components instead of using them as page-wide ambient light.
- Applied in next session where: Same-session black/navy Live Production palette correction.

## 2026-08-24 — Separate view controls from configuration controls
- Trigger: The first quick-sort pass placed everyday view controls inside the collapsible Live Production configuration shell and styled direction/reset/save as prominent buttons.
- Mistake pattern: Treating frequently used view manipulation as another settings surface instead of placing it next to the content it directly affects.
- Preventive rule: Keep compact, reversible view controls adjacent to the governed results; reserve collapsible settings panels and action buttons for structural configuration and persistence. For big-screen dashboards, validate hierarchy and density after controls are collapsed.
- Applied in next session where: Same-session select-only Quick View strip above the chosen Shop Floor tile view.

## 2026-08-24 — “Above the tiles” means the tile view's existing control row
- Trigger: The corrected Quick View strip was outside configuration but still introduced its own glass surface above the department-view header, while the owner meant the existing department-selector row itself.
- Mistake pattern: Satisfying relative ordering in the DOM without preserving the precise visual slot, size, and density named by the owner.
- Preventive rule: When a user identifies an existing control's location as the target, replace that exact visual slot and compare its bounding row/density in live QA; do not add a nearby wrapper or interpret “above” loosely.
- Applied in next session where: Same-session replacement of department pills with compact Status/Priority/Sort/Direction selects and relocation of department selection into configuration.
## 2026-08-25 — Production implementation includes live deployment verification
- Trigger: The owner reminded the session that completed application changes must also appear on the new `.72` production server.
- Mistake pattern: The implementation plan initially ended at local build/live QA even though the current operating context has an authoritative LAN production host.
- Preventive rule: When ShopApp has an active production target in the current context, include targeted deployment, rollback backup, service restart, LAN health, live feature QA, and data/storage preservation evidence in the initial Definition of Done unless the owner explicitly requests local-only work.
- Applied in next session where: Same-session department, quote-origin, and Order Traveler deployment to `.72`.

## 2026-08-25 — Do not pass a trailing-backslash batch directory as a quoted PowerShell argument
- Trigger: The first SHOPAPP autostart installer passed `%~dp0` directly as a quoted `-SourceDirectory`; its trailing backslash escaped/malformed the closing quote and `Copy-Item` rejected the resulting path as containing illegal characters.
- Mistake pattern: Assuming a batch-expanded directory token is safe as a native PowerShell argument without normalizing its trailing separator.
- Preventive rule: When a batch wrapper passes its own directory to PowerShell, use `%~dp0.` (or remove the trailing separator explicitly), and verify the resolved argument in a path containing normal Windows separators before delivery.
- Applied in next session where: Same-session corrected SHOPAPP autostart installer.

## 2026-08-25 — When a legacy dashboard surface moves into a new view, remove its old render path
- Trigger: After the first Tiles/List/More deployment, the owner pointed out that List duplicated the summary/overview content still rendered below the new view.
- Mistake pattern: Building the replacement List surface correctly but leaving the legacy page-level dashboard mounted after it, which created repeated information and unnecessary scrolling.
- Preventive rule: When promoting legacy content into a selectable view, trace the full page below the insertion point and assert that each promoted heading appears exactly once in the final DOM before deployment.
- Applied in next session where: Same-session List summary relocation and removal of Orders overview, duplicate workload, and Status pulse.
# 2026-08-25 — Global print rules must target application chrome, not semantic document elements
- Trigger: The quote page showed the configured business header on screen, but the browser print preview removed it.
- Mistake pattern: A global `@media print` rule hid every semantic `header` and `footer` in order to suppress the application navigation/footer, unintentionally hiding printable document content.
- Preventive rule: Mark application chrome explicitly and scope print hiding to that marker; regression-test that global print CSS never blanket-hides semantic document elements.
- Applied in next session where: Same-session quote print-header correction and customer-print latent fix.

# 2026-08-25 — A prerequisite warning must expose the action that satisfies it
- Trigger: The selected-part controls said “Assign a department first” while disabling the only department action when the part was unassigned.
- Mistake pattern: The move workflow handled null current departments in its backend service, but the UI eligibility condition assumed a current department and made the recoverable state a dead end.
- Preventive rule: For every prerequisite/blocker message, test the exact missing-value state and confirm the same screen exposes an enabled path to satisfy it; adaptive labels should distinguish initial assignment from subsequent movement.
- Applied in next session where: Same-session unassigned-part Assign department control and audited dialog wording.

# 2026-08-26 — Numeric defaults must not trap controlled inputs
- Trigger: Quantity displayed `1`, but typing another number appended to or was overwritten by the controlled default unless the spinner arrow was used.
- Mistake pattern: Normalizing an temporarily empty numeric field back to its minimum inside every change event.
- Preventive rule: Keep a string editing draft for numeric controls, allow the empty intermediate state, and normalize/validate only on blur or submit; browser-test replacing the complete default value with a multi-digit number.
- Applied in next session where: Direct order entry and drawing-confirmation quantities now support erase-and-retype behavior.

# 2026-08-26 — File visibility must be identical in payloads and direct downloads
- Trigger: Employees should see drawings but not purchase orders or other administrative documents.
- Mistake pattern: Treating filtered attachment lists as sufficient while direct attachment URLs remained a separate access path.
- Preventive rule: Centralize attachment classification and enforce it both when shaping UI/API data and again in the authenticated file-serving route, including duplicate storage-path cases.
- Applied in next session where: Part-drawing-only employee visibility and server-side attachment authorization.
# 2026-08-25 — Visual scope must include every peer tile, not only the pictured subsection
- Trigger: The owner clarified that the approved Shop Floor color treatment must apply to all order-detail tiles, not only the part cards visible in the first screenshot.
- Mistake pattern: Treating the most visually prominent subsection in a reference image as the full component scope without inventorying peer cards on every order-detail tab.
- Preventive rule: When a user requests a visual treatment for a family of tiles, inventory every peer tile and tab first, then verify the shared class or token is present across each rendered surface before calling the work complete.
- Applied in next session where: Same-session order-detail tile expansion across Overview, Notes & Files, Full Order Files, BOM, To-do / Checklist, and Log.
# 2026-08-25 — Identifier fixes need active-path and deployment-state confirmation
- Trigger: The owner still saw year-month-day quote numbers after the DDMMYY generator had been implemented locally.
- Mistake pattern: Treating a committed generator and unit test as sufficient evidence without clearly distinguishing historical identifiers and the still-older held production build.
- Preventive rule: For generated identifiers, verify every create path, test the exact next value for the current local date, state whether historical records are intentionally preserved, and include the generator file in deployment verification before reporting the behavior live.
- Applied in next session where: Same-session quote-header batch reconfirmed the single service-owned `DDMMYY-###` path and added it to the held `.72` deployment checklist.
# 2026-08-26 — Production deployment scripts must target Windows PowerShell 5.1
- Trigger: The guarded release script used `[System.IO.Path]::GetRelativePath`, which exists in newer .NET runtimes but not the server's Windows PowerShell 5.1 host.
- Mistake pattern: Validating PowerShell syntax locally without also checking runtime API compatibility against the production host.
- Preventive rule: Keep `.72` deployment helpers compatible with Windows PowerShell 5.1/.NET Framework APIs, and structure scripts so archive/hash/manifest validation completes before stopping or modifying the live app.
- Applied in next session where: Same release replaced the helper with a rooted-substring calculation; the failed attempt left ShopApp untouched and healthy.

# 2026-08-27 — Uploaded file count is not the same as drawing count
- Trigger: A customer may send one PDF containing many individual part drawings instead of one PDF per part.
- Mistake pattern: Treating every uploaded file as exactly one part and extracting one aggregate title block from all PDF pages.
- Preventive rule: At drawing-ingest boundaries, detect document packets, preserve page identity, classify non-part pages, retain the original source, and regression-test both one-file/one-part and one-file/many-part inputs.
- Applied in next session where: Multi-page PDF packet import now rasterizes and extracts pages individually while keeping BOM/cover context and the original PDF.

# 2026-08-27 — PDF splitting is incomplete until extraction quality is measured
- Trigger: Page splitting passed structural tests, but real drawing-field accuracy dropped sharply after packet pages moved from native PDF text to temporary vision images.
- Mistake pattern: Verifying page counts, routing, builds, and health without a representative field-accuracy comparison, while swallowing model/file-processing errors into fallback data.
- Preventive rule: Any drawing-ingest representation change requires a small labeled eval set covering part number, name, quantity, material, finish, and revision; transient model input failures must be observable and retried before fallback.
- Applied in next session where: Same-session direct image inputs, title-block detail crops, bounded retry, and extraction regression coverage.
# 2026-08-27 — Health recovery must distinguish busy from dead
- Trigger: A large drawing ZIP kept taking ShopApp offline even though Node produced no crash report or error output; the health monitor was terminating the still-listening process after the synchronous import work delayed `/api/health`.
- Mistake pattern: Treating several failed application-level health probes as proof that the process was dead, without considering a legitimate long-running CPU-heavy operation.
- Preventive rule: Before destructive automated recovery, combine endpoint health with process/listener state and an expiring operation marker; defer during a fresh known operation only while the listener remains present, and always recover when the listener disappears.
- Applied in next session where: Long ZIP drawing imports use per-request markers and the Windows monitor differentiates a busy import from a dead runtime.

# 2026-08-27 — An empty application log does not prove who terminated the process
- Trigger: After the monitor guard was corrected, a repeated mixed-ZIP upload still ended with no Node process, task result `1`, and an empty stderr log; the monitor had not performed the later restart.
- Mistake pattern: Treating the absence of a runtime error as sufficient evidence for one external failure mechanism before process-exit diagnostics existed.
- Preventive rule: Instrument the launcher to record exit codes and runtime crash reports before assigning causality; separately log long-operation begin/finish boundaries, and preserve requested functionality while reducing one native-resource pressure point at a time.
- Applied in next session where: Mixed-ZIP hardening retained width/thickness, serialized native PDF work, avoided unrelated-file inflation, and activated Node fatal/uncaught/exit diagnostics.

# 2026-08-27 — Restarting a scheduled task must account for child processes
- Trigger: A health-monitor recovery stopped the ShopApp scheduled task but left its standalone Node child alive, after which Windows reported the task Ready while the orphan still served traffic.
- Mistake pattern: Assuming `Stop-ScheduledTask` guarantees termination of every child process created by its PowerShell action.
- Preventive rule: For recovery of a known service, stop the task, identify and terminate only the exact expected runtime command line, then start the task and verify both HTTP health and the task's managed Running state.
- Applied in next session where: The `.72` monitor now removes only `C:\ShopApp\app\.next\standalone\server.js` Node processes before recovery; controlled dead/healthy cycles verified restart and PID preservation.

# 2026-08-27 — Route-level activity begins too late to protect request-body intake
- Trigger: The real mixed ZIP made health unresponsive and the monitor terminated Node while the route-level import marker and durable begin event were still absent.
- Mistake pattern: Assuming code placed before `request.formData()` runs before the framework/server has received or buffered the multipart request body.
- Preventive rule: Long-upload recovery needs two phases: a short persisted grace when the exact runtime is present but no handler marker exists, followed by the longer explicit operation-marker window after the route begins; missing runtimes still recover immediately.
- Applied in next session where: `.72` now uses a five-minute `pre-route-grace` plus the existing 45-minute drawing-import marker window.

# 2026-08-27 — Restore a proven pipeline before redesigning around a narrow extraction request
- Trigger: The owner asked for the previously accurate PDF reader to add width and thickness, but the response expanded into packet rendering, worker isolation, and repeated crash investigation.
- Mistake pattern: Treating a narrow schema/prompt extension as permission to replace the proven document representation and execution path.
- Preventive rule: When an owner identifies a known-good pipeline and asks for additional fields, restore and preserve that pipeline first; change only its extraction contract unless the owner separately approves an architecture change.
- Applied in next session where: The serial PDF-text-to-model reader was restored with finished width and thickness added to its existing extraction prompt/schema.

# 2026-08-27 — Production snapshot rollbacks require exact proof
- Trigger: The owner selected a known-working drawing-reader snapshot while newer shared types no longer accepted it in the full current validation pass.
- Preventive rule: Preserve data unless an explicit database rollback is requested; pause monitoring during planned downtime; prove the target source with a server-side hash and verify loopback/LAN health, task state, monitor state, and cleanup of any temporary build accommodation.
- Applied in next session where: Restored `order-intake-reliability-20260827-103153` with exact source-hash and health verification.
# 2026-08-27 — Bind importer redesigns to the owner’s actual entry workflow
- Trigger: The owner clarified twice that Drawing Import V2 is specifically for quote creation, while the implementation plan kept the engine’s rollout phrasing broad enough to include direct orders.
- Mistake pattern: Treating a reused component and shared save types as permission to expand a workflow-specific redesign into every entry point.
- Preventive rule: Separate reusable engine architecture from rollout scope. Name the exact initiating screen and saved entity in the plan, leave other entry points on their proven path, and test downstream conversion as data preservation rather than reprocessing.
- Applied in next session where: Drawing Import V2 is integrated only through `QuoteEditor`; direct orders remain legacy and quote conversion never reruns extraction or quantity expansion.

# 2026-08-28 — Native module paths must be tested through the packaged HTTP path
- Trigger: The first real Drawing Import V2 quote upload failed before page creation because Next compiled `require.resolve('pdfjs-dist/package.json')` into numeric webpack module ID `15754`, causing `path.dirname(15754)` at runtime even though source tests and the unbundled PDF worker passed.
- Mistake pattern: Treating source-level native PDF tests, build success, and an unbundled worker ping as sufficient proof for an in-process server-bundled call path that the worker did not actually own.
- Preventive rule: Any server-bundled native/document runtime must pass a production standalone HTTP upload smoke using the real route and representative private fixture before deployment. Build output must reject numeric `dirname(...)` PDF.js font resolvers, and runtime resource paths must resolve from verified copied filesystem layouts rather than webpack-transformed module resolvers.
- Applied in next session where: The emergency V2 fix added a standalone build guard and personally verified the exact ZIP through local and `.72` packaged quote-upload APIs to nine-page review readiness.
# 2026-08-28 — Model extraction needs host-packaged upload proof and uncertainty containment
- Trigger: Direct Terra benchmarking materially improved dimensions but repeated runs still produced an occasional incomplete response or uncertain page classification.
- Mistake pattern: Treating one successful model run as deterministic proof, or allowing local fallback labels to create a normal part after an incomplete full-page response.
- Preventive rule: Ship model extraction only behind durable review, force incomplete responses to uncertain/manual review, preserve resolved fields during refinement, and run an isolated real HTTP upload from the actual packaged deployment before completion.
- Applied in next session where: V3 production smoke used the approved packet against copied DB/storage, verified all nine canonical pages and Terra routes, and left three pages in manual review without touching production records.
# 2026-08-28 — Keep manufacturing review dense, semantic, and deterministic
- Trigger: The owner found the first evidence-heavy V3 review visually overwhelming, then found a native Material select unreadable in dark mode and excess whitespace caused by a shared grid row stretching around long warnings.
- Mistake pattern: Exposing internal extraction structure as many equally prominent colored panels, and using one shared CSS grid for fields whose validation messages vary greatly in height.
- Preventive rule: Keep durable evidence and diagnostics available but collapsed; present ordinary manufacturing fields as one compact form; style native controls explicitly for both color schemes; use independent semantic columns when field messages have unequal heights; never expose locally derived shop math as an AI-editable value.
- Applied in next session where: Quote Drawing Import V3 now uses compact columns, restrained attention states, a dark-safe Material select, Material-only catalog creation, and locally computed cut/stock totals.

# 2026-08-28 — Production UI releases need runtime gates separated from stale server fixtures
- Trigger: Two narrow production UI deployments correctly rolled back after server-resident legacy tests/type fixtures failed against newer live V3 modules, despite the complete current-source local suite, TypeScript, and production build passing.
- Mistake pattern: Treating old tests left in the deployment checkout as an authoritative release gate for a narrow runtime-only update when those fixtures were not part of the staged release and no longer matched production modules.
- Preventive rule: Prefer syncing the complete relevant current-source test slice; when a narrowly staged emergency UI release cannot safely do that, require the complete current-source regression locally, exact-hash staged copies, a clean server production build, automatic rollback, and authenticated runtime verification. Document the fixture drift instead of weakening or silently skipping gates.
- Applied in next session where: The final drawing-review releases used local full regression plus exact-hash copy, clean `.72` build, health/task/log checks, and authenticated production review.
# 2026-08-29 — Provenance is not a confirmation decision
- Weak local candidates remain evidence, but candidate-choice controls appear only when the authoritative field status is actually `conflicting`.
- Never infer a required human decision from candidate count alone.

---
# 2026-08-31 — Optional fields must not appear required in review
- Missing revision is legitimate: keep it nullable through save and omit empty revision from attention styling and missing/unreadable filter counts. Keep genuine revision conflicts visible.
- Unit controls change display/entry units, never reinterpret or rewrite canonical dimensions merely on toggle. Preserve the inch-based saw allowance and test metric edits through quote-save mapping.

# 2026-08-29 — Native disclosure state must survive importer refreshes
- Do not let an untouched input blur create a human correction.
- Keep review-explanation disclosure state controlled so background snapshots cannot immediately collapse it.
- Evaluate explicit file-only classification before extraction failure or part-field validation.

---
# 2026-09-01 — Async launch sources must be visible, retryable dependencies
- Trigger: Repeat Orders sometimes opened a blank/crashed new-order form or later claimed no customer was selected, while launching from the original order appeared to work.
- Mistake pattern: Treating URL-supplied template data and customer options as incidental effects instead of prerequisites, then allowing wizard progression while they were missing or stale.
- Preventive rule: Model external form sources as explicit loading/error/ready state, cancel stale requests, expose retry, render durable source identity immediately, block advance/submit until valid, and validate inherited or replacement ownership again in the service. Browser-test the actual list-to-form navigation, not only repository creation.
- Applied in next session where: The production Repeat Orders list opened a real template with its WASTEBUILT customer visibly preselected and selectable after the guarded release.

# 2026-09-01 — Preserve drawing fidelity while fixing intake throughput
- Trigger: Multi-photo phone uploads felt slow/stuck, but earlier attempts to simplify drawing inputs had caused large accuracy regressions.
- Mistake pattern: Conflating upload throughput, normalization cost, model latency and extraction accuracy, then considering a model/image downgrade before measuring the stage that was actually blocked.
- Preventive rule: Optimize independent transport work with aggregate preflight, bounded concurrency, idempotent partial retry, durable heartbeats and stage-specific queues; retain full-fidelity drawing inputs and model settings unless representative accuracy/latency evidence justifies a change.
- Applied in next session where: Phone uploads run two-at-a-time with per-file recovery and V2 scheduling/recovery is bounded without changing Terra or reducing image quality.
## 2026-09-03 — Production source is authoritative for ShopApp fixes
- Trigger: The owner corrected an initial local-code review because the workstation checkout was not current and explicitly directed the work to the server source.
- Preventive rule: Before diagnosing or implementing a ShopApp production issue, read or download the exact `C:\ShopApp\app` targets over the documented SSH path, preserve a pristine live comparison, implement against that baseline, and reconcile focused changes back locally. Never infer production behavior from a dirty/stale workstation checkout.
- Applied: This session used two separate read-only production downloads, reviewed the exact live-to-staged hunks, and left deployment pending rather than overwriting production from the broader local tree.
## 2026-09-03 — Treat standing approval as an execution preference, not a security bypass
- Trigger: the owner explicitly asked not to be repeatedly interrupted by approval questions and requested auto approval.
- Preventive rule: use existing saved command rules and the owner's standing authorization without conversational re-confirmation; explain once that the agent cannot alter or bypass application-enforced approval policy, and request escalation only when the platform technically requires it.
- Applied: subsequent build and static checks used existing rules directly; the only elevated test execution was the Windows `esbuild` spawn fallback required after the sandbox returned `EPERM`.
# 2026-09-03 — Copied runtime databases can override isolated storage environment variables
- Trigger: Repeat-order attachment copying still targeted `/app/storage` even though the local process received an isolated `ATTACHMENTS_DIR`.
- Mistake pattern: Assuming an environment override wins without checking persisted application settings copied with the database.
- Preventive rule: When creating an isolated runtime from a copied database, inspect and rewrite only the copied runtime's storage-related settings, then verify both the database attachment record and the physical destination file. Verify the source fixture exists before diagnosing copy logic.
- Applied in this session where: The isolated `AppSettings.attachmentsDir` was changed to the isolated local attachment root; a known local PDF then copied successfully into repeat order `STD-1014`.

# 2026-09-03 — Partial source mirrors are not standalone packaging proofs
- Trigger: The production-derived source mirror built successfully but its standalone server could not load Next's `cpu-profile` module.
- Mistake pattern: Treating a selectively mirrored project root as equivalent to the normal dependency/layout context used by the release build.
- Preventive rule: Use an exact source mirror for source and browser behavior, but validate standalone completeness from the normal project/package layout unless the mirror also includes the complete dependency and build-input topology.
- Applied in this session where: The exact staged source ran through the root-installed Next development binary, while the normal root production build completed and copied standalone assets.
# 2026-09-03 — Preserve the complete drawing-import feature gate when restarting locally
- Trigger: After changing reasoning and verbosity, the restarted local quote editor reported Drawing Import V2 unavailable.
- Mistake pattern: Reconstructing a long-running local command with the new AI settings but omitting the independent `DRAWING_IMPORT_V2_MODE` availability flag.
- Preventive rule: Treat the drawing-import runtime flags as one verified profile. After every restart, check both `/api/health` and `/api/admin/drawing-import`, then open the quote drawing panel before reporting local readiness.
- Applied in this session where: The server was restarted with `DRAWING_IMPORT_V2_MODE=admin_beta`, V3 enabled, Terra/refinement medium, and verbosity low; the endpoint returned enabled V3 and Chrome showed the active import panel.

# 2026-09-03 — Title-block labels are not identifier values
- Trigger: A blanket rule equating drawing number with part number caused the importer to return the printed `REVISION` label as every part number.
- Mistake pattern: Converting a common title-block convention into an unconditional identity rule without protecting against label-only extraction.
- Preventive rule: Let page context and explicit labels determine the part identifier, reject known field-label tokens such as `REVISION` when they are returned without a value, and regression-test the exact observed false positive before release.
- Applied in this session where: The drawing-number override was removed from prompt and merge logic, and label-only part numbers are now rejected for human review.

# 2026-09-03 — Stop is not disable for recurring health monitors
- Trigger: The current health-monitor run was stopped before a long production test/build window, but its still-enabled schedule fired again and relaunched the old runtime while the build was active.
- Mistake pattern: Treating `Stop-ScheduledTask` as protection from future triggers during the same maintenance window.
- Preventive rule: Disable the recurring monitor before stopping the application; stop the exact runtime; build and verify with no serving process; then enable/start the monitor only after the new runtime is healthy or rollback has fully restored the old build.
- Applied in this session where: The relaunched runtime was detected and stopped before build completion; the final process started after the successful build and all health/hash/log gates passed.
