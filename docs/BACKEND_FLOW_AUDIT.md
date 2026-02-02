# Backend Flow Audit Report

**Date:** 2026-02-02  
**Auditor:** Senior Backend Review (Automated)  
**Scope:** Backend only — API routes, service/repo layers, Prisma schema, auth checks

---

## 1. System Map (One-Page)

### Backend Modules Overview

| Module | Main Endpoints | Services | Repos | Notes |
|--------|----------------|----------|-------|-------|
| **Orders** | `/api/orders`, `/api/orders/[id]/*` | `orders.service.ts` | `orders.repo.ts` | Core business entity |
| **Quotes** | `/api/admin/quotes/*` | `quotes.service.ts` | `quotes.repo.ts` | Admin-only, converts to Orders |
| **Time** | `/api/time/*`, `/api/timer/*` | `time.service.ts` | `time.repo.ts` | TimeEntry tracking |
| **Users** | `/api/admin/users/*` | `users.repo.ts` | `users.repo.ts` | Admin management |
| **Auth** | `/api/auth/[...nextauth]` | `lib/auth.ts` | Direct Prisma | NextAuth credentials |
| **Admin** | `/api/admin/*` | Various | Various | Customers, Materials, Vendors, etc. |

### Cross-Module Dependencies

```
Orders ←→ TimeEntry (via orderId, partId)
Orders ←→ Quotes (via quote conversion)
Orders ←→ Customers (via customerId FK)
Orders ←→ Vendors (via vendorId FK)
Orders ←→ Users (via assignedMachinistId, notes.userId, etc.)
TimeEntry ←→ Users (via userId FK)
Quotes ←→ Customers (via customerId FK)
OrderCharge ←→ Department (via departmentId FK)
OrderCharge ←→ Addon (via addonId FK)
OrderPart ←→ Material (via materialId FK)
```

### Key Data Flow Paths

1. **Quote → Order Conversion:** `POST /api/admin/quotes/[id]/convert`
2. **Time Tracking:** `POST /api/time/start` → `POST /api/time/stop`
3. **Timer Flow:** `POST /api/timer/start` → `POST /api/timer/pause` → `POST /api/timer/finish`
4. **Order Part Workflow:** Create → Update → Transition Department → Complete

---

## 2. Ranked Issues List

### P0 — Critical (Data Loss / Security / Hard Crash)

#### P0-1: TimeEntry.create() FK Violation on Invalid orderId/partId

**Title:** Prisma FK violation when TimeEntry.create() receives invalid orderId  
**Priority:** P0  
**Where:**
- `src/modules/time/time.repo.ts:createTimeEntry()`
- `src/modules/time/time.service.ts:startTimeEntry()`
- `src/app/api/time/start/route.ts`

**Symptom:** Prisma throws `Foreign key constraint failed` error, returns 500 to client when orderId doesn't exist.

**Root Cause:** The `createTimeEntry()` function directly creates a TimeEntry with the provided `orderId` and `partId` without first verifying these entities exist in the database.

**Repro Steps:**
1. Authenticate as any user
2. `POST /api/time/start` with `{ "orderId": "nonexistent-id", "partId": null, "operation": "test" }`
3. Observe 500 error with Prisma FK constraint violation

**Fix Plan:**
1. In `time.service.ts:startTimeEntry()`, add validation before `createTimeEntry()`:
   ```ts
   const order = await prisma.order.findUnique({ where: { id: input.orderId } });
   if (!order) return fail(404, 'Order not found');
   if (input.partId) {
     const part = await prisma.orderPart.findFirst({ where: { id: input.partId, orderId: input.orderId } });
     if (!part) return fail(404, 'Part not found');
   }
   ```
2. Apply same pattern to `startTimeEntryWithConflict()` and `resumeTimeEntry()`

**Risk:** Minimal. Adding validation only; existing valid flows unaffected.

**Test Plan:**
- Unit test: call startTimeEntry with invalid orderId → expect 404
- Unit test: call startTimeEntry with invalid partId → expect 404
- Unit test: call startTimeEntry with valid IDs → expect 201

---

#### P0-2: TimeEntry.create() with Empty String IDs

**Title:** Empty string "" passed as orderId bypasses Zod min(1) but fails at DB level  
**Priority:** P0  
**Where:**
- `src/modules/time/time.schema.ts:TimeEntryStart`
- `src/app/api/timer/start/route.ts` (manual parsing)

**Symptom:** Zod schema has `min(1)` but `/api/timer/start` manually parses orderId/partId without schema validation. Empty strings can reach the repo layer.

**Root Cause:** `/api/timer/start/route.ts` manually extracts `orderId` and `partId` from JSON body without using the Zod schema:
```ts
const orderId = typeof json?.orderId === 'string' ? json.orderId : '';
const partId = typeof json?.partId === 'string' ? json.partId : '';
```
If client sends `{ "orderId": "", "partId": "" }`, the check `if (!orderId || !partId)` catches empty strings, but the logic differs from `/api/time/start` which uses Zod.

**Repro Steps:**
1. `POST /api/timer/start` with `{ "orderId": "   ", "partId": "valid-id" }` (whitespace-only)
2. Observe inconsistent behavior vs `/api/time/start`

**Fix Plan:**
1. Unify validation: use the same `TimeEntryStart` Zod schema in `/api/timer/start/route.ts`
2. Or add `.trim()` and strict empty check in manual parsing

**Risk:** Low. Standardizes validation.

**Test Plan:**
- Test whitespace-only orderId returns 400
- Test empty string orderId returns 400

---

#### P0-3: Note.create() with Invalid orderId/userId FK Violation

**Title:** createOrderNote() doesn't validate orderId or userId existence  
**Priority:** P0  
**Where:**
- `src/modules/orders/orders.repo.ts:createOrderNote()`
- `src/modules/orders/orders.service.ts:addOrderNote()`
- `src/app/api/orders/[id]/notes/route.ts`

**Symptom:** If orderId is invalid or userId is invalid, Prisma throws FK constraint error → 500.

**Root Cause:** `addOrderNote()` only validates partId (if provided) but not the orderId or userId before creating the note.

**Repro Steps:**
1. `POST /api/orders/invalid-order-id/notes` with valid session
2. Observe 500 error

**Fix Plan:**
1. In `addOrderNote()`, add:
   ```ts
   const order = await findOrderById(orderId);
   if (!order) return fail(404, 'Order not found');
   const user = await findUserById(userId);
   if (!user) return fail(400, 'Invalid user');
   ```

**Risk:** Minimal.

**Test Plan:**
- Test with invalid orderId → 404
- Test with valid orderId but invalid userId → 400 (though this shouldn't happen with auth)

---

### P1 — High (Breaks Core Workflows / Frequent 500s)

#### P1-1: resumeTimeEntry() Trusts Previous Entry's orderId

**Title:** resumeTimeEntry creates new entry with orderId from old entry without revalidation  
**Priority:** P1  
**Where:**
- `src/modules/time/time.service.ts:resumeTimeEntry()`

**Symptom:** If the original Order was deleted between TimeEntry creation and resume, FK violation occurs.

**Root Cause:** `resumeTimeEntry()` copies `previous.orderId` and `previous.partId` to create a new entry without checking if those entities still exist.

**Repro Steps:**
1. Start a time entry on an order
2. Stop the time entry
3. Delete the order
4. `POST /api/time/resume` with the old entryId
5. Observe FK violation → 500

**Fix Plan:**
1. Add existence check in resumeTimeEntry():
   ```ts
   const order = await prisma.order.findUnique({ where: { id: previous.orderId } });
   if (!order) return fail(404, 'Order no longer exists');
   ```

**Risk:** Low.

**Test Plan:**
- Resume entry for deleted order → 404
- Resume entry for existing order → 201

---

#### P1-2: /api/orders/[id]/assign Accepts Any machinistId Without Validation

**Title:** assignMachinistToOrder() doesn't validate machinistId exists  
**Priority:** P1  
**Where:**
- `src/modules/orders/orders.service.ts:assignMachinistToOrder()`
- `src/modules/orders/orders.repo.ts:updateOrderAssignee()`
- `src/app/api/orders/[id]/assign/route.ts`

**Symptom:** Assigning a non-existent machinistId causes FK violation → 500.

**Root Cause:** No validation of machinistId before updating.

**Repro Steps:**
1. `POST /api/orders/valid-id/assign` with `{ "machinistId": "nonexistent-user" }`
2. Observe 500 error

**Fix Plan:**
1. In `assignMachinistToOrder()`:
   ```ts
   if (machinistId) {
     const user = await findUserById(machinistId);
     if (!user) return fail(404, 'Machinist not found');
   }
   ```

**Risk:** Low.

**Test Plan:**
- Assign invalid machinistId → 404
- Assign valid machinistId → 200
- Assign null (unassign) → 200

---

#### P1-3: createOrderFromPayload() Accepts Invalid customerId

**Title:** Order creation with invalid customerId causes FK violation  
**Priority:** P1  
**Where:**
- `src/modules/orders/orders.service.ts:createOrderFromPayload()`
- `src/app/api/orders/route.ts:POST`

**Symptom:** Creating an order with non-existent customerId causes Prisma FK error → 500.

**Root Cause:** The Zod schema validates `customerId` is a non-empty string but doesn't verify it references an actual Customer.

**Repro Steps:**
1. `POST /api/orders` with `{ "customerId": "fake-customer-id", ... }`
2. Observe 500 error

**Fix Plan:**
1. In `createOrderFromPayload()` add:
   ```ts
   const customer = await prisma.customer.findUnique({ where: { id: body.customerId } });
   if (!customer) return fail(404, 'Customer not found');
   ```

**Risk:** Low.

**Test Plan:**
- Create order with invalid customerId → 404
- Create order with valid customerId → 201

---

#### P1-4: createChargeForOrder() partId Validation Returns 404 Instead of 400

**Title:** Charge creation validates partId but wrong status code  
**Priority:** P1  
**Where:**
- `src/modules/orders/orders.service.ts:createChargeForOrder()`

**Symptom:** When partId is provided but part doesn't exist on order, returns 404. Should arguably be 400 since the partId is invalid input.

**Root Cause:** Semantic mismatch — "Part not found on order" is more of a bad request than resource-not-found.

**Repro Steps:**
1. `POST /api/orders/valid-order/charges` with `{ "partId": "wrong-part", ... }`
2. Observe 404

**Fix Plan:**
1. Consider using 400 for "Part not found on order" since the orderId exists but partId doesn't belong.
2. Alternatively, document this as expected behavior.

**Risk:** Breaking change if clients rely on 404.

**Test Plan:**
- Test creates charge with invalid partId → appropriate status code

---

#### P1-5: Quote Conversion Missing Customer Validation

**Title:** convertQuoteToOrder() uses quote.customerId without verifying Customer exists  
**Priority:** P1  
**Where:**
- `src/modules/quotes/quotes.repo.ts:convertQuoteToOrder()`
- `src/app/api/admin/quotes/[id]/convert/route.ts`

**Symptom:** If Customer was deleted after Quote creation, conversion fails with FK violation.

**Root Cause:** The route checks `!quote.customerId` but doesn't verify the referenced Customer still exists.

**Repro Steps:**
1. Create quote with customerId
2. Delete the customer
3. Convert quote → 500

**Fix Plan:**
1. In convert route, after checking `!quote.customerId`:
   ```ts
   const customer = await prisma.customer.findUnique({ where: { id: quote.customerId } });
   if (!customer) return NextResponse.json({ error: 'Customer no longer exists' }, { status: 400 });
   ```

**Risk:** Low.

**Test Plan:**
- Convert quote with deleted customer → 400
- Convert quote with valid customer → 200

---

### P2 — Medium (Correctness Edge Cases / Inconsistent Behavior)

#### P2-1: Inconsistent Validation Between /api/time/* and /api/timer/*

**Title:** Two parallel timer APIs with different validation approaches  
**Priority:** P2  
**Where:**
- `src/app/api/time/*` — uses Zod schemas
- `src/app/api/timer/*` — manual JSON parsing

**Symptom:** Different error messages and validation strictness for equivalent operations.

**Root Cause:** Historical parallel implementation. `/api/timer/*` was added later with different patterns.

**Repro Steps:**
1. Compare validation errors from both endpoints
2. Note inconsistent responses

**Fix Plan:**
1. Consolidate to use Zod schemas in both
2. Or deprecate one set of endpoints
3. Document which is canonical

**Risk:** Breaking change if clients use both.

**Test Plan:**
- Verify both return consistent errors for same invalid input

---

#### P2-2: updateOrderDetails() Accepts Empty Update Payload After Validation

**Title:** OrderUpdate schema allows all-optional fields but service rejects empty  
**Priority:** P2  
**Where:**
- `src/modules/orders/orders.service.ts:updateOrderDetails()`
- `src/modules/orders/orders.schema.ts:OrderUpdate`

**Symptom:** Zod validation passes but service returns 400 "No fields to update".

**Root Cause:** Schema makes all fields optional, then service checks if any were provided. Validation should happen at schema level.

**Repro Steps:**
1. `PATCH /api/orders/valid-id` with `{}`
2. Observe 400 from service, not schema

**Fix Plan:**
1. Add `.refine()` to OrderUpdate schema requiring at least one field
2. Or document this as expected

**Risk:** None.

**Test Plan:**
- Empty PATCH body → 400 at validation level

---

#### P2-3: Status Transition Allows Invalid Statuses

**Title:** updateOrderStatusForEmployee() hardcodes allowed statuses  
**Priority:** P2  
**Where:**
- `src/modules/orders/orders.service.ts:updateOrderStatusForEmployee()`

**Symptom:** Status enum in schema differs from hardcoded array in service.

**Root Cause:** Duplication of status values in schema and service.

**Schema enum:**
```
RECEIVED, PROGRAMMING, SETUP, RUNNING, FINISHING, DONE_MACHINING, INSPECTION, SHIPPING, CLOSED
```

**Service allowed:**
```
NEW, PROGRAMMING, RUNNING, INSPECTING, READY_FOR_ADDONS, COMPLETE, CLOSED
```

**Repro Steps:**
1. Try to set status to 'SETUP' via POST /api/orders/[id]/status
2. Observe 400 "Invalid status"

**Fix Plan:**
1. Align service allowed statuses with schema enum
2. Import from schema to avoid drift

**Risk:** Medium — may break existing workflows relying on hardcoded values.

**Test Plan:**
- Test all schema-defined statuses are accepted
- Test invalid statuses are rejected

---

#### P2-4: toggleChecklistItem() Complex Input Validation

**Title:** Checklist toggle accepts checklistId OR chargeId OR addonId inconsistently  
**Priority:** P2  
**Where:**
- `src/app/api/orders/[id]/checklist/route.ts`
- `src/modules/orders/orders.service.ts:toggleChecklistItem()`

**Symptom:** Can provide multiple identifiers; behavior unclear.

**Root Cause:** Flexible API design without clear priority/exclusivity.

**Repro Steps:**
1. `POST /api/orders/id/checklist` with both `checklistId` and `chargeId`
2. Observe which takes precedence

**Fix Plan:**
1. Document precedence: checklistId > chargeId > addonId
2. Or reject if multiple provided
3. Add Zod discriminated union for clearer validation

**Risk:** Breaking change if clients send multiple.

**Test Plan:**
- Test each identifier type works alone
- Test multiple identifiers uses documented precedence

---

#### P2-5: PartEvent Creation Accepts Null userId

**Title:** createPartEvent() accepts null userId without validation  
**Priority:** P2  
**Where:**
- `src/modules/orders/orders.repo.ts:createPartEvent()`

**Symptom:** PartEvents can be created without attribution. Schema allows nullable userId.

**Root Cause:** Schema design allows nullable userId for system-generated events.

**Repro Steps:**
1. Call createPartEvent with `userId: null`
2. Event created with no user attribution

**Fix Plan:**
1. Document when null userId is acceptable
2. Add service-level check if attribution is required for certain event types

**Risk:** None if intentional.

**Test Plan:**
- Verify system events can be created without userId
- Verify user-initiated events have userId

---

### P3 — Low (Maintainability / Tech Debt)

#### P3-1: Duplicate Repository Pattern

**Title:** Repos exported via wrapper files and directly  
**Priority:** P3  
**Where:**
- `src/repos/time.ts`, `src/repos/users.ts`, `src/repos/orders.ts`
- `src/modules/*/repo.ts`

**Symptom:** Two patterns coexist: direct module repos and wrapper repos.

**Root Cause:** Test mode support via repos/index.ts switching.

**Fix Plan:**
1. Document the pattern
2. Consider consolidating to one approach

**Risk:** None.

---

#### P3-2: Inconsistent Error Response Shapes

**Title:** Some endpoints return `{ error: string }`, others return `{ error: { ... } }`  
**Priority:** P3  
**Where:** Various API routes

**Symptom:** Client must handle multiple error shapes.

**Root Cause:** Zod `.flatten()` returns object, manual errors return string.

**Fix Plan:**
1. Standardize: always return `{ error: string | { message: string, ... } }`
2. Create helper function for error responses

**Risk:** Breaking change for clients parsing errors.

---

#### P3-3: `any` Type Casts for Session User

**Title:** Extensive `(session.user as any)` casts  
**Priority:** P3  
**Where:** All API routes

**Symptom:** Type safety lost when accessing session.user properties.

**Root Cause:** NextAuth types don't include custom user properties.

**Fix Plan:**
1. Extend NextAuth types in `next-auth.d.ts`
2. Create typed helper: `getAuthUser(session)`

**Risk:** None.

---

#### P3-4: Service Result Pattern Inconsistency

**Title:** Some services return `{ ok: true/false }`, others throw  
**Priority:** P3  
**Where:** Various services

**Symptom:** Callers must handle both patterns.

**Root Cause:** Gradual migration to Result pattern not complete.

**Fix Plan:**
1. Complete migration to `ServiceResult<T>` pattern
2. Document expected error handling

**Risk:** None.

---

#### P3-5: Missing Request Body Validation for Some POST Endpoints

**Title:** Some POST handlers don't use Zod schemas  
**Priority:** P3  
**Where:**
- `src/app/api/orders/[id]/assign/route.ts`
- `src/app/api/orders/[id]/status/route.ts`

**Symptom:** Manual JSON extraction without schema validation.

**Root Cause:** Older patterns not updated.

**Fix Plan:**
1. Add Zod schemas for all POST body validation
2. Standardize pattern across routes

**Risk:** None.

---

## 3. Data Integrity Audit

### Prisma Write Operations

| Operation | Location | Risk Level | FK Fields | Validation |
|-----------|----------|------------|-----------|------------|
| `TimeEntry.create` | `time.repo.ts:55` | **HIGH** | orderId, partId, userId | ❌ None |
| `Order.create` | `orders.repo.ts:196` | **HIGH** | customerId, vendorId, assignedMachinistId | ❌ customerId only via route |
| `OrderPart.create` | `orders.repo.ts:435` | MEDIUM | orderId, materialId | ✅ orderId checked |
| `Note.create` | `orders.repo.ts:276` | **HIGH** | orderId, userId | ❌ None |
| `StatusHistory.create` | `orders.repo.ts:259` | MEDIUM | orderId, userId | ✅ orderId checked |
| `OrderCharge.create` | `orders.repo.ts:713` | MEDIUM | orderId, partId, departmentId, addonId | ✅ Partial validation |
| `Quote.create` | `quotes.repo.ts:81` | **HIGH** | createdById, customerId | ✅ userId from session, ❌ customerId |
| `PartEvent.create` | `orders.repo.ts:390` | LOW | orderId, partId, userId | ✅ orderId/partId checked |

### Empty/Invalid ID Paths

| Entity | Field | Can Be Empty? | Can Be Invalid? | Impact |
|--------|-------|---------------|-----------------|--------|
| TimeEntry | orderId | ❌ Zod blocks | ✅ Yes | FK violation |
| TimeEntry | partId | ✅ Nullable | ✅ Yes | FK violation |
| TimeEntry | userId | ❌ From session | Unlikely | FK violation |
| Order | customerId | ❌ Zod blocks | ✅ Yes | FK violation |
| Order | vendorId | ✅ Nullable | ✅ Yes | FK violation |
| Order | assignedMachinistId | ✅ Nullable | ✅ Yes | FK violation |
| Note | orderId | ❌ From route | ✅ Yes | FK violation |
| Note | userId | ❌ From session | Unlikely | FK violation |

### FK Risk Paths (Priority Order)

1. **TimeEntry.create with invalid orderId** — Direct API exposure
2. **TimeEntry.create with invalid partId** — Direct API exposure
3. **Order.create with invalid customerId** — Direct API exposure
4. **Order.assign with invalid machinistId** — Direct API exposure
5. **Quote.create with invalid customerId** — Direct API exposure
6. **Note.create with invalid orderId** — URL path param

### Schema vs Runtime Mismatches

| Schema Constraint | Runtime Expectation | Gap |
|-------------------|---------------------|-----|
| `TimeEntry.userId` NOT NULL | Session always provides | OK |
| `TimeEntry.orderId` NOT NULL | Zod min(1) | ✅ Validated, ❌ FK not checked |
| `Order.customerId` NOT NULL | Zod min(1) | ✅ Validated, ❌ FK not checked |
| `OrderCharge.departmentId` NOT NULL | Zod min(1) | ✅ FK checked in service |
| `Note.orderId` NOT NULL | URL param | ❌ Not validated |
| `StatusHistory.orderId` NOT NULL | From context | ✅ Usually validated |

---

## 4. Error Handling + Validation Audit

### Endpoints That Can Return 500 on User Input

| Endpoint | Method | Trigger | Should Be |
|----------|--------|---------|-----------|
| `/api/time/start` | POST | Invalid orderId | 404 |
| `/api/time/resume` | POST | Invalid entryId referencing deleted order | 404 |
| `/api/timer/start` | POST | Invalid orderId/partId | 400/404 |
| `/api/orders` | POST | Invalid customerId | 404 |
| `/api/orders/[id]/assign` | POST | Invalid machinistId | 404 |
| `/api/orders/[id]/notes` | POST | Invalid orderId (rare) | 404 |
| `/api/admin/quotes/[id]/convert` | POST | Deleted customer | 400 |

### Recommended Validation Approach

**Current State:** Mix of Zod schemas and manual checks.

**Recommendation:**
1. **Layer 1 - Route:** Zod schema for request body shape/types
2. **Layer 2 - Service:** FK existence checks, business rule validation
3. **Layer 3 - Repo:** Prisma constraints as last line of defense

**Standard Pattern:**
```ts
// Route
const parsed = Schema.safeParse(body);
if (!parsed.success) return json({ error: parsed.error.flatten() }, { status: 400 });

// Service
const entity = await findById(id);
if (!entity) return fail(404, 'Not found');

// Business rule
if (!canPerformAction(entity, user)) return fail(403, 'Forbidden');
```

### Missing Status Codes

| Current | Should Be | Endpoint | Reason |
|---------|-----------|----------|--------|
| 500 | 404 | `/api/time/start` | Order not found |
| 500 | 404 | `/api/orders` | Customer not found |
| 500 | 404 | `/api/orders/[id]/assign` | User not found |
| 404 | 400 | `/api/orders/[id]/charges` | Invalid partId (belongs to different order) |

---

## 5. Security / Auth Audit

### Auth Check Summary

| Endpoint Pattern | Auth Required | Admin Required | Notes |
|------------------|---------------|----------------|-------|
| `/api/health` | ❌ | ❌ | Public health check |
| `/api/auth/*` | ❌ | ❌ | NextAuth routes |
| `/api/whoami` | ✅ | ❌ | Returns user info |
| `/api/time/*` | ✅ | ❌ | Any authenticated user |
| `/api/timer/*` | ✅ | ❌ | Any authenticated user |
| `/api/orders` GET | ✅ | ❌ | List orders |
| `/api/orders` POST | ✅ | ✅ | Create order |
| `/api/orders/[id]` GET | ✅ | ❌ | View order |
| `/api/orders/[id]` PATCH | ✅ | ✅ | Update order |
| `/api/orders/[id]/notes` | ✅ | Machinist+ | Add notes |
| `/api/orders/[id]/status` | ✅ | Machinist+ | Change status |
| `/api/orders/[id]/checklist` | ✅ | Machinist+ | Toggle checklist |
| `/api/orders/[id]/assign` | ✅ | ✅ | Assign machinist |
| `/api/orders/[id]/charges/*` | ✅ | ✅ | Manage charges |
| `/api/orders/[id]/parts/*` | ✅ | ✅ | Manage parts |
| `/api/admin/*` | ✅ | ✅ | All admin routes |
| `/api/custom-fields` | ✅ | ❌ | Read custom fields |
| `/api/intelligence/*` | ✅ | ❌ | Department feed |

### Endpoints Missing Auth Checks

✅ All endpoints checked have appropriate auth.

### Inconsistent Admin Evaluation

| Location | Method | Notes |
|----------|--------|-------|
| `middleware.ts` | Middleware | Checks admin for `/admin/*` UI routes |
| API routes | Per-handler | `canAccessAdmin(user)` in each handler |

**Issue:** Middleware only protects UI routes (`/admin/*`), not API routes (`/api/admin/*`). API routes have their own checks, which is correct, but creates duplication.

**Recommendation:** Consider adding API route protection to middleware for defense-in-depth:
```ts
matcher: ['/admin/:path*', '/api/admin/:path*']
```

### Trust Client Input Hazards

| Input | Endpoint | Trust Level | Risk |
|-------|----------|-------------|------|
| orderId | `/api/time/start` | User-provided | FK violation |
| partId | `/api/time/start` | User-provided | FK violation |
| machinistId | `/api/orders/[id]/assign` | Admin-provided | FK violation |
| customerId | `/api/orders` POST | Admin-provided | FK violation |
| userId (session) | All routes | Session-derived | Trusted |

**Recommendation:** Never trust client-provided entity IDs without existence check.

---

## 6. Action Plan

### P0/P1 Weekend Fix Plan (Fast and Safe)

**Day 1 - Time Entry FK Validation:**

1. [ ] Add order existence check in `startTimeEntry()` 
2. [ ] Add part existence check in `startTimeEntry()` when partId provided
3. [ ] Add same checks to `startTimeEntryWithConflict()`
4. [ ] Add order existence check in `resumeTimeEntry()`
5. [ ] Test all time entry creation paths

**Day 1 - Order FK Validation:**

6. [ ] Add customer existence check in `createOrderFromPayload()`
7. [ ] Add user existence check in `assignMachinistToOrder()`
8. [ ] Add order existence check in `addOrderNote()`

**Day 2 - Quote Conversion:**

9. [ ] Add customer existence check in quote conversion route
10. [ ] Test conversion with deleted customer

**Day 2 - Testing:**

11. [ ] Add integration tests for FK validation
12. [ ] Verify no regressions in happy paths

### P2/P3 Hardening Plan

**Week 1:**
- [ ] Unify `/api/time/*` and `/api/timer/*` validation patterns
- [ ] Align status enum between schema and service
- [ ] Add Zod schemas to all POST endpoints

**Week 2:**
- [ ] Standardize error response shapes
- [ ] Extend NextAuth types to eliminate `as any` casts
- [ ] Document service result pattern

**Week 3:**
- [ ] Add middleware protection for `/api/admin/*`
- [ ] Audit all FK paths systematically
- [ ] Add missing existence checks

### Recommended Order of Operations

1. **P0 fixes first** — Prevent 500s on invalid IDs
2. **Add tests** — Prevent regressions
3. **P1 fixes** — Complete FK validation
4. **Validation standardization** — Reduce inconsistency
5. **Type safety improvements** — Prevent future issues

### Minimal Tests to Add

```ts
// tests/api/time.test.ts
describe('POST /api/time/start', () => {
  it('returns 404 for non-existent orderId', async () => {});
  it('returns 404 for non-existent partId', async () => {});
  it('returns 201 for valid orderId and partId', async () => {});
});

// tests/api/orders.test.ts
describe('POST /api/orders', () => {
  it('returns 404 for non-existent customerId', async () => {});
  it('returns 201 for valid customerId', async () => {});
});

describe('POST /api/orders/[id]/assign', () => {
  it('returns 404 for non-existent machinistId', async () => {});
  it('returns 200 for valid machinistId', async () => {});
  it('returns 200 for null machinistId (unassign)', async () => {});
});
```

---

## Questions for Matt

1. **Status Enum Alignment:** The schema defines statuses like `SETUP`, `FINISHING`, `DONE_MACHINING`, but the status update service only allows `NEW`, `PROGRAMMING`, `RUNNING`, etc. Which is canonical?

2. **Parallel Timer APIs:** Are both `/api/time/*` and `/api/timer/*` intended to coexist? They have different validation patterns. Should one be deprecated?

3. **Test Mode:** The repo switching via `isTestMode()` suggests mock repos exist. Should the FK validation be added to mock repos as well, or only production Prisma repos?

---

*End of Backend Flow Audit Report*
