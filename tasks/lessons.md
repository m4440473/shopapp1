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
