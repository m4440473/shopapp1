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
