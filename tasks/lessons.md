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
