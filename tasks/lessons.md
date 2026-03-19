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
