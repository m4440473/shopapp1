**Non-authoritative operational history. CANON.md and ROADMAP.md are authoritative.**

# Agent Handoff (Update Every Session)

Date: 2026-02-02
Agent: Copilot
Goal (1 sentence): Restrict non-admin access to Quote/PO/Invoice attachments while keeping other attachments visible.

## What I changed
- Summary: Filtered attachments in non-admin order responses and blocked public attachment downloads for Quote/PO/Invoice labels. Added unit tests for attachment filtering.

## Files touched
- src/lib/quote-visibility.ts
- src/lib/__tests__/quote-visibility.test.ts
- src/app/(public)/attachments/[...path]/route.ts
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm ci
- npm test -- src/lib/__tests__/quote-visibility.test.ts
- npm run lint (failed: existing QuoteEditor no-unescaped-entities + hooks warnings)
- npm run build (failed: Google Fonts fetch blocked)

## Notes / gotchas
- Attachment restriction uses label matching ("quote", "po", "purchase order", "invoice") and part attachment kind "PO".

## Next steps
- [ ] Consider adding a first-class attachment type for order-level attachments (invoice/quote/po) to avoid label heuristics.
