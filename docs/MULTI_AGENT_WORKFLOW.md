# Multi-Agent Workflow Runbook (ShopApp1)

Use this when you want multiple agents working without drift.

## 1) Coordinator Model (required)

- **You (human owner) are coordinator.**
- Assign exactly **one task ID per agent session** from `docs/AGENT_TASK_BOARD.md`.
- Agents must not self-expand scope beyond assigned task ID.

## 2) What to send the next agent (copy/paste)

Use this exact handoff package:

1. Task ID (for example `P2-T1`)
2. Prompt wrapper from `AGENT_PROMPTS.md`
3. Repo constraints for this run (if any)
4. Last completed commit hash + short summary

Template:

```md
Execute task **<TASK_ID>** from `docs/AGENT_TASK_BOARD.md`.

Required pre-reads (in order):
1. CANON.md
2. ROADMAP.md
3. docs/AGENT_CONTEXT.md
4. PROGRESS_LOG.md
5. docs/AGENT_HANDOFF.md
6. docs/AGENT_TASK_BOARD.md
7. AGENT_PROMPTS.md
8. tasks/todo.md
9. tasks/lessons.md

Additional constraints for this run:
- <constraint 1>
- <constraint 2>

Starting point:
- Base commit: <hash>
- Last task status: <pass/fail + short note>
```

## 3) Parallelization Strategy (safe)

Use parallel agents only when tasks are independent.

### Safe to parallelize
- Audit/report tasks in different domains.
- Documentation-only tasks.
- Test harness improvements that do not alter domain behavior.

### Do not parallelize together
- Two tasks touching same domain runtime paths (e.g., Orders API + Orders service refactor).
- Any dependent tasks where one task’s DoD is prerequisite for another.

## 4) Branching + merge sequence

- One branch per agent task.
- Merge in dependency order from `docs/AGENT_TASK_BOARD.md`.
- After each merge, next agent rebases from latest main before starting.

## 5) Completion gate before starting next task

The next agent must validate prior task quality before implementation:

- DoD evidence exists and is credible.
- Continuity docs updated (`PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`).
- Build/test evidence exists for changed paths.
- Any known gaps are logged as blockers/follow-ups.

If gaps exist: report first, then pause implementation until acknowledged.

## 6) Multi-agent status board format

Track this in your issue tracker or notes:

- Task ID
- Assigned agent
- Status (`queued`, `in_progress`, `blocked`, `review`, `done`)
- Dependency status
- Last evidence command
- Merge commit

## 7) Suggested operating cadence

1. Daily: pick next dependency-safe tasks.
2. Midday: checkpoint evidence + blockers.
3. End of day: merge validated tasks only; update handoff docs.

## 8) Failure handling

- If an agent returns weak evidence or scope drift, do not merge.
- Re-assign same task ID with stricter constraints and explicit failure notes.
- Add prevention rule to `tasks/lessons.md`.
