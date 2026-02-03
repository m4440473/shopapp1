# Audit Summary - Quick Reference
**Date**: 2026-02-03  
**Full Report**: See `AUDIT_REPORT_2026-02-03.md`

## TL;DR - What Needs Work

### 🔴 Critical (Fix First)
1. **Duplicate Timer APIs** - Merge `/api/timer/*` → `/api/time/*` (UI uses timer, time endpoints unused)
2. **Prisma in Pages** - 8+ pages bypass services (violates CANON.md §67)
3. **Orders Service Too Big** - 1,367 lines, needs split into parts/checklist/charges services

### 🟡 High Priority (Architecture)
4. **Quote System Incomplete** - Logic scattered: lib/quote-*.ts, modules/quotes/, admin pages
5. **Components Import Services** - ShopFloorLayouts, RecentOrdersTable violate layer separation
6. **No Part-Centric Views** - Can't see "my parts" across orders (violates CANON.md §22)

### 🟢 Medium (UX & Cleanup)
7. **No Quick Resume** - Must navigate 5 levels to restart last job
8. **Dead Code** - fetchJson (0 imports), colors.ts (unused), machinist page (unreferenced)
9. **Department Queue Static** - No polling/WebSocket, shows stale data
10. **Order Page Overloaded** - 4 tabs + timer controls = cognitive overload

---

## What to Work On First (Aligned with ROADMAP.md)

### Stage 1: Clean Up (Phase 1 - P0) ← **START HERE**
**Effort**: 1-2 sessions | **Risk**: Low

```bash
# Actions:
1. Consolidate /api/timer/* and /api/time/* into single system
2. Delete src/lib/fetchJson.ts (unused)
3. Move ShopFloorLayouts/RecentOrdersTable to use API routes
4. Decide: Keep or remove src/app/machinists/[id]/page.tsx
```

**Success Metrics**:
- Only 1 timer endpoint system exists
- Zero components import services
- No unused utility files

---

### Stage 2: Modularize (Phase 2 - P2)
**Effort**: 3-4 sessions | **Risk**: Medium

```bash
# Actions:
1. Move src/lib/quote-*.ts → src/modules/quotes/
2. Split orders.service.ts → parts/checklist/charges services
3. Remove all Prisma imports from src/app/ pages
4. Add service layer tests
```

**Success Metrics**:
- Quote module complete (repo/service/schema/types)
- Orders service < 400 lines
- Zero Prisma outside *.repo.ts

---

### Stage 3: Part-Centric Model (Phase 3 - P1)
**Effort**: 4-5 sessions | **Risk**: Medium-High

```bash
# Actions:
1. Create /parts and /parts/[partId] routes
2. Extract parts.service from orders.service
3. Add "My Parts" to navigation
4. Department feed links to parts, not orders
```

**Success Metrics**:
- Machinists see cross-order part list
- Part detail page with timer exists
- Dept feed clickable to part workspace

---

### Stage 4-5: UX Polish & Live Updates (Phase 4-5)
**Effort**: 5-7 sessions | **Risk**: Medium

Later phases - see full report for details.

---

## Machine Shop Perspective Summary

### What Works ✅
- Mobile navigation exists
- Timer conflict detection prevents double-booking
- Department routing dialog on checklist complete
- Part event logging captures activity

### What's Painful 🔴
- **Time Tracking**: Must navigate deep to resume work → "Resume Last" needed
- **Part Management**: Can't see all my parts → Need /parts route
- **Department Queue**: Shows stale data → Need polling/refresh
- **Order Page**: Too much info at once → Split into focused views

### What Machinists Need Most
1. **Quick start button** - "Resume my last job" on home page
2. **My Parts list** - See assigned work across all orders
3. **Simple transitions** - "Move to next dept" button on part cards
4. **Persistent timer** - See active job on every page

---

## Questions Before Implementation

**For User to Answer:**
1. Should we start with Stage 1 (timer API merge + cleanup)?
2. Is machinist detail page (`/machinists/[id]`) needed? (remove if not)
3. Confirm part-centric model matches real workflows?
4. Department queue: 30s polling OK or WebSocket required?
5. Offline support: must-have or nice-to-have?

---

## Risk Matrix

| Change | Risk Level | Why |
|--------|-----------|-----|
| Remove fetchJson | 🟢 Low | Zero imports, safe delete |
| Merge timer APIs | 🟢 Low | Behavior-preserving refactor |
| Quote module migration | 🟡 Medium | Complex dependencies |
| Orders service split | 🟡 Medium | 40+ functions to refactor |
| Part-centric routing | 🔴 High | Fundamental model change |
| Real-time updates | 🟡 Medium | New infrastructure |

---

## Next Steps

1. **User**: Review this summary + full report
2. **User**: Answer 5 questions above
3. **Agent**: Execute Stage 1 (consolidate & clean)
4. **Agent**: Progress through stages 2-5 per ROADMAP.md gates

**Full details**: `docs/AUDIT_REPORT_2026-02-03.md`
