# tasks/todo.md — Session Plan + Verification

## Session Metadata
- Date: 2026-02-23
- Agent: GPT-5.2-Codex
- Task ID: P2-T2
- Goal: Enforce Quotes domain layering by removing remaining Quotes Prisma usage outside Quotes repos and shifting quote schema ownership to the Quotes module boundary.

## Plan First (Required for non-trivial tasks)
- [x] Scope confirmed (single task ID)
- [x] Dependencies reviewed and prior-task quality validated
- [x] Steps written (3+ step tasks must list concrete steps)
- [x] Plan verified before implementation

## Implementation Checklist
- [x] Step 1: Audit Quotes Prisma usage and Quotes domain ownership usage in `src/lib/*` vs `src/modules/quotes/*`.
- [x] Step 2: Move quote Prisma access in public attachment route behind Quotes service/repo boundary.
- [x] Step 3: Add module-owned quote schema entry point and migrate Quotes call sites off `src/lib/zod-quotes.ts`.
- [x] Step 4: Keep `src/lib/zod-quotes.ts` as a deprecation shim to preserve compatibility without domain ownership.

## Verification Checklist
- [x] Relevant build command(s) run
- [x] Relevant test/lint command(s) run
- [x] Runtime/behavior verification captured (if applicable)
- [x] DoD pass/fail evidence mapped to task board criteria

## Review + Results
- Summary: Added `findQuoteAttachmentByStoragePath` in Quotes repo/service and routed quote-attachment lookup in the public attachments route through Quotes services; created `src/modules/quotes/quotes.schema.ts` and moved active quotes callers to module-owned schema imports while leaving `src/lib/zod-quotes.ts` as a compatibility shim.
- Blockers/Risks: Build/lint still surface pre-existing React hook warnings in `src/app/orders/[id]/page.tsx` and baseline-browser-mapping/swc version warnings; no blocking failures.
- Follow-ups (logged, not implemented):
  - Consider migrating quote metadata/visibility helpers from `src/lib/*` into `src/modules/quotes/*` to fully complete schema+helper ownership alignment.
