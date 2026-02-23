# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-23
- Agent: GPT-5.2-Codex
- Task ID: ad-hoc scoped fix
- Goal: Fix only the pre-existing React hook warnings in `src/app/orders/[id]/page.tsx` that the user explicitly requested.

## Plan First
- [x] Confirmed scope limited to React hook warning cleanup in one file.
- [x] Identified warning sources (`parts` derivation and `tick` dependency in memoized elapsed timer).
- [x] Planned minimal in-file hook dependency stabilization changes.

## Implementation Checklist
- [x] Memoize `parts` from `item?.parts` to keep dependencies stable.
- [x] Replace `tick` counter approach with `nowMs` time source used directly by elapsed-time memo.
- [x] Verify lint/build behavior after changes.

## Verification Checklist
- [x] `npm run lint`
- [x] `npm run build`

## Review + Results
- `npm run lint` now reports no ESLint warnings/errors.
- `npm run build` succeeds; React hook warnings are resolved.
- Existing non-hook build advisories (`@next/swc` mismatch + baseline-browser-mapping age notice) remain unrelated to this scoped request.
