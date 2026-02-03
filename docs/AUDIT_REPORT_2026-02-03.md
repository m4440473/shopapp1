# ShopApp1 Codebase Audit Report
**Date**: 2026-02-03  
**Perspective**: Machine Shop Owner & Machinist UX Evaluation  
**Focus**: Outdated/Unused Code, UI-Backend Connections, UX Workflow Analysis

---

## Executive Summary

This audit identifies critical architectural violations, duplicated code paths, and UX friction points from the perspective of real machine shop workflows. The findings are organized by **Priority** and mapped to **ROADMAP.md phases** for staged implementation.

### Critical Findings
- **Duplicate Timer APIs**: Two parallel endpoint systems (`/api/timer/*` vs `/api/time/*`) create confusion
- **Architecture Violations**: 8+ instances of UI pages directly calling Prisma (violates CANON.md layering)
- **Bloated Services**: Orders service at 1,367 lines - mixing CRUD, events, checklists, and time tracking
- **Quote System Not Modular**: Quote logic scattered across `/lib`, `/modules/quotes`, and admin pages
- **Dead Code**: Unused utilities and unreferenced pages consuming maintenance overhead

---

## 1. OUTDATED & UNUSED CODE

### 1.1 Critical: Duplicate Timer APIs ⚠️

**Issue**: Two parallel time tracking endpoint systems exist:

| Endpoint Set | Routes | Used By |
|--------------|--------|---------|
| `/api/timer/*` | start, pause, finish, active | Order detail page UI |
| `/api/time/*` | start, pause, resume, stop, summary | Not currently used in UI |

**Evidence**:
- Both call identical `time.service` functions
- `/api/timer/start` includes conflict detection + part event logging
- `/api/time/start` lacks the same safety checks
- Order page (`src/app/orders/[id]/page.tsx` lines 231, 262, 277) hardcoded to `/api/timer/*`

**Impact**:
- **Maintainability**: Duplicate logic creates drift risk
- **Debugging**: Logs show two different endpoint patterns
- **Shop Floor**: Inconsistent error responses if routes diverge

**Recommendation**: 
- **Phase 1 (P0)** - Consolidate to `/api/time/*` with all safety checks
- Migrate UI to use consolidated endpoints
- Archive or remove `/api/timer/*` routes

---

### 1.2 High: Unused Utilities

#### `fetchJson` utility (src/lib/fetchJson.ts)
- **Status**: Defined but ZERO active imports
- **Evidence**: `grep -r "import.*fetchJson" src/` returns only definition file
- **Used in**: 11 admin client components import it but all use native `fetch()` directly
- **Recommendation**: Remove entirely (code uses fetch with try/catch instead)

#### `colors.ts` (src/lib/colors.ts)
- **Status**: Color palette definition, no imports
- **Recommendation**: Remove or document if planned for theming

---

### 1.3 Medium: Dead/Underutilized Pages

#### Machinist Detail Page (`src/app/machinists/[id]/page.tsx`)
- **Issue**: 
  - Queries `prisma` directly (violates CANON.md boundaries)
  - No navigation links to this page in AppNav or other UIs
  - Only 2 indirect references found in codebase
- **Recommendation**: 
  - **Option A**: Migrate to proper service layer + add to navigation
  - **Option B**: Remove if not part of current roadmap
  
#### About Page (`src/app/about/page.tsx`)
- **Issue**: Marketing landing page with duplicate CTAs
- **Status**: Not in main navigation; low discoverability
- **Recommendation**: Either integrate into nav or move to `/docs` as informational

---

## 2. UI-BACKEND CONNECTION VIOLATIONS

### 2.1 Critical: Direct Prisma Access in Pages

**Violation**: Pages importing and calling `prisma` directly, bypassing service layer.

| File | Line(s) | Issue |
|------|---------|-------|
| `src/app/page.tsx` | 33-55 | Home page queries orders/customers directly |
| `src/app/search/page.tsx` | Multiple | Search performs raw Prisma queries |
| `src/app/machinists/[id]/page.tsx` | Multiple | User detail queries without service |
| `src/app/admin/quotes/[id]/page.tsx` | Multiple | Quote detail uses prisma instead of quotes.service |

**Impact**:
- **CANON.md Violation**: "UI never imports Prisma or repo/service" (§67)
- **Testing**: Pages cannot be tested without full database
- **Security**: No validation/authorization layer between UI and data

**Recommendation**:
- **Phase 2 (P2)** - Migrate all pages to call services only
- Create service methods for common query patterns (e.g., `orders.service.getOrderListForHomePage()`)

---

### 2.2 Critical: Components Importing Services

**Violation**: React components importing business logic modules.

| Component | Import | Issue |
|-----------|--------|-------|
| `ShopFloorLayouts.tsx` | `orders.service` | Component should call API routes, not services |
| `RecentOrdersTable.tsx` | `orders.service` | Direct service access in component |

**CANON.md Rule**: Services must not import React; UI must not import services (§7 layering).

**Recommendation**:
- **Phase 1 (P0)** - Create dedicated API routes for component data needs
- Example: `/api/intelligence/recent-orders` instead of direct service call

---

### 2.3 High: Quote System Not Modularized

**Issue**: Quote domain logic scattered across multiple locations:

```
src/lib/quote-*.ts           ← Prisma queries outside modules
  ├─ quote-visibility.ts
  ├─ quote-metadata.ts
  ├─ quote-part-pricing.ts
  └─ (5 more quote utils)

src/modules/quotes/          ← Incomplete module structure
  ├─ quotes.repo.ts          ← Exists but minimal
  ├─ quotes.service.ts       ← Stub only
  └─ (no schema, types, ui)

src/app/admin/quotes/*/page.tsx  ← Direct prisma queries
```

**Recommendation**:
- **Phase 2 (P2)** - Follow orders module pattern:
  1. Move all quote logic from `src/lib/quote-*.ts` → `src/modules/quotes/`
  2. Establish full module structure (repo, service, schema, types, ui)
  3. Migrate admin pages to call `quotes.service` instead of prisma

---

### 2.4 Medium: Orders Service Bloat

**Metrics**:
- `orders.service.ts`: **1,367 lines**
- `orders.repo.ts`: **872 lines**
- **40+ exported functions** mixing concerns

**Concerns Mixed**:
- CRUD operations
- Part event logging
- Checklist management
- Attachment handling
- Department routing
- Charge calculations

**Recommendation**:
- **Phase 2 (P2)** - Split into focused modules:
  - `orders.service.ts` - Core order CRUD only
  - `parts.service.ts` - Part-specific operations
  - `checklist.service.ts` - Checklist logic
  - Keep time tracking in `time.service.ts` (already separate)

---

## 3. UX ISSUES (MACHINE SHOP PERSPECTIVE)

### 3.1 Critical: Time Tracking Mental Model

#### Issue: Duplicate APIs Confuse Debugging
- **Scenario**: Machinist reports "timer didn't start"
- **Problem**: Network logs show mix of `/timer/start` and `/time/start`
- **Impact**: Support can't determine which endpoint failed

#### Issue: No "Resume Last Job" Quick Action
- **Current Flow**: 
  1. Go to Orders page
  2. Find last order
  3. Open order detail
  4. Click part
  5. Start timer
- **CANON.md Expectation**: "Operators can see what they last did without digging" (§40)
- **Recommendation**: Add "Resume Last" button to home page or persistent timer dock

---

### 3.2 High: Order Management Overload

#### Single Order Page Does Too Much
**File**: `src/app/orders/[id]/page.tsx` (210+ lines)

**Manages**:
- Order overview
- Parts list with time tracking
- Notes and attachments
- Checklist toggle
- Department routing dialog
- Part event log

**Shop Floor Impact**:
- **Cognitive Load**: Machinists see 4 tabs + timer controls on one screen
- **Switching Cost**: Can't keep timer visible while browsing parts
- **Interruption Risk**: Form state lost if navigating away

**Recommendation**:
- **Phase 4 (P1)** - Split into:
  - Order summary view (read-only)
  - Part detail view with timer (focused workspace)
  - Separate notes/files interface

---

### 3.3 High: Parts Not First-Class Citizens

**CANON.md Mental Model**: "Parts are the real units of work" (§22)

**Current Reality**:
- Parts only accessible via `orders/[id]` → parts list
- No `/parts` or `/parts/[id]` routes
- Cannot view "all my assigned parts" across orders
- Department feed shows parts but links back to order pages

**Machinist Workflow Pain**:
- "Which parts do I have in queue?" → Must scan all orders
- "What's the next part for drilling?" → Must check department feed, then navigate to order
- "Show me this part number across all jobs" → No part-centric search

**Recommendation**:
- **Phase 3 (P1)** - Create part-centric views:
  - `/parts` - Part list with filters (status, department, assigned to me)
  - `/parts/[partId]` - Part detail with timer, notes, history
  - Refactor order page to link to part pages instead of inline editing

---

### 3.4 Medium: Department Handoff UX Hidden

**Current State**:
- Department assignment API exists: `/api/orders/[id]/parts/assign-department`
- Used by routing dialog when checklist completes
- No standalone "move part to next dept" UI

**Shop Floor Workflow**:
- **Scenario**: Part finishes in Lathe, needs to go to Mill
- **Current**: Supervisor opens order, finds part, opens routing dialog
- **Expected**: Click part card, hit "Send to Mill" button

**Recommendation**:
- **Phase 4 (P1)** - Add quick-transition UI:
  - Department feed cards show "Move to..." button
  - Confirm dialog with destination dropdown
  - Logs transition in part events

---

### 3.5 Medium: No Real-Time Department Queue

**Current State**:
- `ShopFloorLayouts` component loads department feed once on mount
- Uses `orders.service.getDepartmentParts()` directly (violates layer separation)
- No polling, WebSocket, or refresh mechanism

**Shop Floor Impact**:
- **Stale Data**: Department queues show outdated part counts
- **Coordination Failures**: Two machinists start same part
- **Manual Refresh Required**: User must reload page

**Recommendation**:
- **Phase 5 (P3)** - Add live updates:
  - Option A: Polling every 30s with visual indicator
  - Option B: WebSocket for real-time push
  - Add "Last updated: 2m ago" timestamp to feed

---

### 3.6 Low: Mobile Touch Target Sizes

**Issue**: Dropdown-heavy UI for part selection
- Order page uses `<Select>` components for part picker
- Department filter uses dropdown

**Shop Floor Reality**:
- Touchscreens, often gloved hands
- Standing at machine, not desk
- Small dropdowns are tap-misses

**Recommendation**:
- **Phase 5 (P3)** - Convert to card-based selections:
  - Part list as cards with large tap areas
  - Department filter as pill buttons
  - Add "Quick Start" for most recent parts

---

## 4. PRIORITIZED RECOMMENDATIONS

### Stage 1: Consolidate & Clean (Phase 1 - P0)
**Timeline**: 1-2 sessions  
**Goal**: Remove duplicate code, fix critical architecture violations

- [ ] **Merge Timer APIs**: Consolidate `/api/timer/*` into `/api/time/*`
- [ ] **Remove Dead Code**: Delete `fetchJson`, unused `colors.ts`
- [ ] **Fix Component-Service Imports**: Create API routes for `ShopFloorLayouts` and `RecentOrdersTable`
- [ ] **Audit Machinist Page**: Decide keep (refactor) vs remove

**Success Criteria**:
- Only one timer endpoint system exists
- Zero UI components import services directly
- Grep returns no matches for `fetchJson` imports

---

### Stage 2: Modularize Backend (Phase 2 - P2)
**Timeline**: 3-4 sessions  
**Goal**: Enforce CANON.md module boundaries

- [ ] **Quote Module Complete**: Move `src/lib/quote-*.ts` → `src/modules/quotes/`
- [ ] **Split Orders Service**: Extract parts, checklist, charges into separate services
- [ ] **Migrate Pages to Services**: Remove all `prisma` imports from `src/app/` pages
- [ ] **Add Service Tests**: Cover new service boundaries

**Success Criteria**:
- No Prisma access outside `*.repo.ts` files
- Orders service under 400 lines
- Quote system follows repo/service/schema pattern

---

### Stage 3: Part-Centric Refactor (Phase 3 - P1)
**Timeline**: 4-5 sessions  
**Goal**: Make parts the primary work unit

- [ ] **Create Part Routes**: `/parts`, `/parts/[partId]`
- [ ] **Add Part Service**: Extract from orders service
- [ ] **Update Navigation**: Add "My Parts" to AppNav
- [ ] **Refactor Department Feed**: Link to part pages, not order pages

**Success Criteria**:
- Machinists can see "all my parts" without order context
- Part detail page exists with timer, notes, log
- Department queue clickable to part workspace

---

### Stage 4: UX Polish for Shop Floor (Phase 4 - P1)
**Timeline**: 3-4 sessions  
**Goal**: Fulcrum-level time tracking and clarity

- [ ] **Resume Last Job**: Add quick-start button to home page
- [ ] **Simplify Order Page**: Split into overview + focused part workspace
- [ ] **Quick Department Transitions**: Add "Move to..." on part cards
- [ ] **Persistent Timer Dock**: Show active timer across all pages

**Success Criteria**:
- Time from login → timer running: under 10 seconds
- No cognitive overload on order pages
- Department handoff obvious to new users

---

### Stage 5: Live Data & Mobile (Phase 5 - P1/P3)
**Timeline**: 2-3 sessions  
**Goal**: Real-time updates and touch-friendly UI

- [ ] **Department Queue Polling**: Refresh feed every 30s
- [ ] **Card-Based Selection**: Replace dropdowns with tap targets
- [ ] **Offline Support (Optional)**: Queue actions when network down

**Success Criteria**:
- Department feed never more than 30s stale
- All primary actions tappable by gloved finger
- Optional: Works offline for time tracking

---

## 5. ALIGNMENT WITH ROADMAP.md

| This Audit Phase | ROADMAP.md Phase | Status |
|------------------|------------------|--------|
| Stage 1 (Consolidate & Clean) | Phase 1 - Platform Stability | ✅ Ready to execute |
| Stage 2 (Modularize Backend) | Phase 2 - Modularization | ✅ Mapped to canon patterns |
| Stage 3 (Part-Centric Refactor) | Phase 3 - Time Tracking Core | ⚠️ Depends on modularization |
| Stage 4 (UX Polish) | Phase 4 - UX Flow Alignment | ⚠️ Depends on part refactor |
| Stage 5 (Live Data & Mobile) | Phase 5 - UI Polish | 📝 Nice-to-have enhancements |

---

## 6. RISK ASSESSMENT

### Low Risk (Safe to Execute Immediately)
- Remove unused utilities (`fetchJson`, `colors.ts`)
- Consolidate timer APIs (behavior-preserving refactor)
- Archive dead pages (machinist detail, about)

### Medium Risk (Requires Testing)
- Quote module migration (complex data model)
- Orders service split (40+ function dependencies)
- Page-to-service migration (auth/session changes)

### High Risk (Architectural Change)
- Part-centric routing (fundamental model shift)
- Real-time department feed (new infrastructure)
- Offline support (requires service workers)

---

## 7. QUESTIONS FOR STAKEHOLDER

Before proceeding with implementation:

1. **Timer API Priority**: Merge timer APIs immediately or defer to Phase 2?
2. **Machinist Page**: Keep and refactor, or remove entirely?
3. **Part-Centric Model**: Confirm this aligns with shop workflows (CANON.md says yes, but worth validating)
4. **Real-Time Updates**: Is 30s polling acceptable, or WebSocket required?
5. **Offline Support**: Is this a must-have or nice-to-have?

---

## Appendix A: File Inventory

### Files to Remove
- `src/lib/fetchJson.ts` (unused)
- `src/lib/colors.ts` (unused)
- `src/app/machinists/[id]/page.tsx` (if confirmed dead)
- `src/app/about/page.tsx` (relocate or remove)

### Files to Refactor (Violate Boundaries)
- `src/app/page.tsx` (calls prisma directly)
- `src/app/search/page.tsx` (calls prisma directly)
- `src/components/ShopFloorLayouts.tsx` (imports service)
- `src/components/RecentOrdersTable.tsx` (imports service)
- All `src/lib/quote-*.ts` files (prisma outside modules)

### Files to Split (Bloat)
- `src/modules/orders/orders.service.ts` (1,367 lines)
- `src/modules/orders/orders.repo.ts` (872 lines)

---

## Appendix B: Metrics

| Metric | Value | Target |
|--------|-------|--------|
| API Route Duplication | 2 timer systems | 1 system |
| Prisma Imports in UI | 8+ violations | 0 violations |
| Orders Service LOC | 1,367 | <400 per service |
| Quote Module Completeness | 30% | 100% (repo/service/schema) |
| Part-Centric Routes | 0 | 2+ (/parts, /parts/[id]) |

---

**End of Report**

_This audit was performed with the explore agent to systematically identify outdated code, architecture violations, and UX friction from a machine shop workflow perspective. All recommendations align with CANON.md principles and ROADMAP.md phasing._
