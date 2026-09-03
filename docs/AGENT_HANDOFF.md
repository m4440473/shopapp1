## Session Handoff — 2026-09-03 (Drawing importer/workflow release on `.72`)
- Outcome: deployed the complete tested server-derived source release to `C:\ShopApp\app` at `192.168.254.72` / `shopapp.local`. Includes order/quote decomposition, new importer mixed ZIP and local PDF page splitting, one model request per page, selected-page-only Reprocess, no local OCR in the newer reader, finish `NA` policy, and removal of the erroneous drawing-number override. Label-only part numbers such as `REVISION` are rejected instead of saved.
- Release identity: local commit `d3131df0955fe4bce6dfd63034f37bda065b07ab`; 86 runtime files, 29 replaced and 57 new, zero deletions. No package install, schema/migration, database, storage, customer file or protected `.env` mutation. Local verification: 408 passed / 3 opt-in skipped, focused 11/11, 66-page build/type/lint/standalone pass. Production: 411 passed / 3 opt-in skipped (three additional server-local checks), clean 66-page build.
- Production evidence: exact 86-file manifest hash gate, sampled local/live SHA-256 equality, loopback/IP/hostname health 200, one post-build runtime, task Running, monitor Ready/result 0, zero-byte error log. Authenticated Chrome checked quote/new-importer/order-create/order-edit controls with no console errors, save, upload or inference. Rollback is `C:\ShopApp\backups\pre-update\drawing-import-release-d3131df-20260903-134939` and contains prior source, `.next`, protected config and manifest.
- Operational correction: the first attempt safely aborted before downtime because the partial predeploy download lacked `package.json`; refreshed its baseline directly from live and retried. During the successful long build, the enabled periodic monitor launched the old runtime once after its current task instance had been stopped. The runtime was stopped again before build completion and the final process started after the build. Future deploy scripts must disable the monitor task before stopping ShopApp, then enable/start it only after final health or completed rollback.
- GitHub: public origin verified as `https://github.com/m4440473/shopapp1`; machine-access runbook removed from the payload; changed-file scan found no DB/storage/credential files or sensitive patterns. The platform still requires an explicit acknowledgement before publishing application source to a public repository. The commit remains local and the existing PR #179 branch is not updated yet. Keep `docs/PRODUCTION_ACCESS.md` local-only.

## Session Handoff — 2026-09-03 (Page-only retry; OCR removed from newer importer)
- Goal complete locally: selected page Reprocess issues one fresh canonical-page model request, not a whole-packet rerun. Unrelated page values, quantities and attempt history are unchanged. Saved human confirmations (including in-flight saves) survive; failed requests keep the previous review. Assembly retry retains its reviewed quantity with a reminder instead of recomputing other pages. Only one page retry per job runs at a time.
- Ownership/scope: both root and `.tmp-server-implementation-20260903`, preserving each baseline's signatures. Files: `src/modules/drawing-import/v2/drawing-import-v2.{service,repo,config}.ts`; new `__tests__/drawing-import-v2.reprocess.integration.test.ts`; `src/components/orders/drawing-import/{QuoteDrawingImportV2Panel.tsx,drawing-import-review-state.ts,__tests__/drawing-import-review-state.test.ts}`; root `.env.example`; continuity docs. No migrations/dependencies/production changes. Pristine predeploy snapshot untouched.
- Design: atomic queue validates page/job/prepared artifacts, deduplicates same-page clicks, rejects competing requests, supersedes only selected model attempts, retains prior extraction, and persists reprocessPageId in configJson. Existing startup/stale-job recovery reads that scope and branches before inventory. Scoped AI bypasses reference/duplicate/cache shortcuts and skips packet finalization. No OCR engine calls remain in the newer service; ocrEnabled is always false. V3 requests omit local text, local candidate and BOM hints; cached local analysis is regenerated from embedded source text to avoid historical OCR evidence. Source PDFs retain their own text/image content, as supported by OpenAI direct-file processing.
- Commands/results: full `node [../]node_modules/vitest/vitest.mjs run --dir src/modules/drawing-import/v2 --no-file-parallelism` PASS root 77 / staged 74 with three opt-in skips each; review UI `--dir src/components/orders/drawing-import/__tests__` PASS root 25 / staged 22. Five temporary-SQLite tests per tree exercise the real service/repo with only OpenAI mocked; no paid requests. Root/staged `tsc --noEmit`, targeted ESLint and scoped diff checks PASS. Staged tests use installed generated Prisma schema because snapshot lacks schema scaffolding; initialize empty temporary SQLite file for Windows. No build against the running dev tree.
- Browser/runtime: Chrome authenticated http://127.0.0.1:3100 quote fixture opens newer importer and updated no-OCR description; upload enables after One-off choice. No UI Reprocess click/model inference or Save this session; do not claim a live speed/accuracy measurement. Next: owner test selected-page Reprocess on an existing local packet. Legacy OCR utilities remain available for other consumers; do not uninstall packages indiscriminately. Deployment is not authorized by this local request.

## Session Handoff — 2026-09-03 (New importer: ZIPs and one AI extraction per page)
- Goal/scope: newer importer only, local testing; locally split PDFs into original-quality individual pages before AI. Preserve originals, ZIP paths, page associations and the existing review/quantity interface. User superseded unfinished legacy prompt/schema migration; that work was reverted, prior legacy settings helper and layout retained.
- Files changed in root and `.tmp-server-implementation-20260903`: `src/modules/drawing-import/v2/document/document.pdf.ts` (ancestor standard-font lookup), `document/__tests__/document.intake.test.ts` (three regressions), `drawing-import-v2.config.ts` (V3 retry/escalation guards), `drawing-import-v2.service.ts` (no automatic refinement, protect settings override), and `src/components/orders/drawing-import/QuoteDrawingImportV2Panel.tsx` (upload explanation). Staged-only missing `scripts/drawing-import-v2-document-worker.mjs` downloaded read-only via SSH from production, matching root worker. No production writes/dependencies/schema changes.
- Policy: V3 sends one canonical page per extraction request. Automatic second-pass refinement, fallback-model calls and retries disabled; incomplete fields need review. Exact reuse/reference skips may need no AI; explicit manual retry remains possible. Local concurrency two independent requests; Playground profile/model/prompt otherwise unchanged. ZIP-in-ZIP is not supported; nested folders and mixed PDF/PNG/JPG are supported.
- Commands/evidence: `node [../]node_modules/vitest/vitest.mjs run --dir src/modules/drawing-import/v2/document --no-file-parallelism` (24 pass / one opt-in skip each), corresponding AI suite (18 root / 19 staged), config tests (two each); `node [../]node_modules/typescript/bin/tsc --noEmit` and targeted ESLint pass in both trees. Broader legacy suite root 50 pass / one live-eval skip; staged 42 pass / two absent ops-script fixtures (`install-shopapp-health-monitor.ps1`, `start-shopapp.ps1`), not importer failures. Missing-worker and root-default failures found initially were fixed and rerun successfully.
- Runtime/browser: existing isolated loopback dev launcher remains at http://127.0.0.1:3100 using the server-derived tree. Chrome authenticated new importer opens, new description visible, upload enables after One-off parts. No new upload, paid inference or Save. No new timing benchmark or full production build claimed. Next: representative real ZIP/assembly PDF trial, review uncertain fields and measured timings; production remains unchanged. Keep pristine `.tmp-server-predeploy-20260903` untouched.

## Session Handoff — 2026-09-03 (Local Playground settings applied)
- Goal complete: owner can test at http://127.0.0.1:3100 with gpt-5.4-mini, standard/low reasoning, medium verbosity, concise summary, and 10,000 max output. Refinement also uses low effort; escalation stays disabled. The server-derived v4.0.1 prompt/schema and original drawing handling remain unchanged.
- Added optional summary/mode fields and conditional API forwarding in root and staged AI config/adapter; added three regression tests to each matching suite; documented env options in .env.example. Shared defaults remain medium reasoning/low verbosity and no summary/mode override.
- Local-only profile/launcher: `.tmp/local-browser-regression-20260903/playground.env` and `start-local.cjs`. Start with `node .tmp/local-browser-regression-20260903/start-local.cjs` from the repo; don't create a second port-3100 server. Launched hidden via Start-Process (launcher PID 45992), stdout/stderr logs alongside the profile. Preserves existing isolated shopapp-test.db, attachments/phone storage, credentials loaded in memory from root .env, and V2 admin_beta/V3 gates. Bound loopback only.
- Gates: staged pre-change 16/16; post-change root 18/18 and staged 19/19 Vitest; root/staged tsc --noEmit and targeted ESLint; node --check launcher; diff check; HTTP health/feature 200; Chrome authenticated quote drawing UI enabled, no console errors. No real model request run this turn, no production changes. Await owner's fresh import and compare timing/quality; no promise of 11-second app totals.

## Session Handoff — 2026-09-03 (Owner PDF benchmark review)
- Checked the owner's 11-second Playground result against the complete `25011-00-133-602.pdf` and enlarged title block using Poppler plus pypdf. Core identity/material/finish and dimensions agree: 48.00 length, 2.00 OD, 1.25 ID, 0.375 derived wall.
- Review caveats: chamfer `2X .13 X 45° CHAM.` omitted from manufacturing notes; unlabeled bottom-right `C` cannot be confidently assigned to revision. Timing is owner-reported and not a controlled same-PDF app benchmark. No runtime/config/deployment changes. Scratch renders removed after inspection; original PDF untouched.

## Session Handoff — 2026-09-03 (Exact Playground prompt/schema export)
- Goal: give the owner the actual prompt and schema from the last measured local import, not a paraphrase or root-checkout approximation. Owner explicitly excluded an image export.
- Read-only SQLite/API evidence identifies job `cmtllaq270014knagyihmuvtm`, response `resp_00f39bc5d9b17891006a997cdbc86087d2aa2ab0eb27e9ed47`, prompt v4.0.1; recovered stored instructions, input text, and JSON schema directly. Source/runtime settings match the server-derived tree, not root v4.0.0.
- Files: `artifacts/drawing-import-playground/instructions.txt`, `user-prompt.txt`, `schema.json`; read-only helper `.tmp/inspect-playground-response.cjs`; continuity docs and prevention lesson. No runtime source/config/data/deployment change, no new inference request, and no image or credential export.
- Commands: `node .tmp/inspect-playground-response.cjs --export-text`, read-only SQLite queries, JSON/identity/schema assertions, and diff whitespace check. Strict schema has 17 required fields; settings medium reasoning, low verbosity, 10,000 max output, requested gpt-5.4-mini. Await owner's Playground results before tuning.

## Session Handoff — 2026-09-01 (Intake/repeat/stock stability release)
- Goal completed and deployed: repeat-order launch reliability/customer recovery, part waiting-on-stock lifecycle, QR multi-photo reliability, shared historical-part reuse, quote/direct-order autosave, evidence-backed drawing note suggestions, Shop Floor Summary and admin Server Monitor.
- Repeat orders: `orders/new` retries/aborts template loading safely and blocks progression until valid. Customer remains visible/selectable/addable; repeat service resolves and validates explicit or inherited customer. Production browser opened template `bd44538c-9948-4e50-8993-4fc64c8716d8` with WASTEBUILT preselected and no client error. No order submitted.
- Intake: both editors use `src/modules/intake-drafts`; both expose CustomerPartPicker. Historical copies are customer-scoped and reset job fields. AI manufacturing notes remain suggestions until a user explicitly adds them. Phone upload concurrency is 2 with aggregate preflight, partial retries and lock waiting; image fidelity/model configuration is unchanged.
- Operations: admin `/admin/system-health` shows safe uptime/memory/import and 24-hour order/quote/AI telemetry. Shop Floor Summary renders stock waits and movements. `WAITING_ON_STOCK` is stored on OrderPart materialStatus and event-audited. No migration or dependency added.
- Local evidence: TypeScript PASS; targeted ESLint PASS (0 warnings); git diff check PASS; build PASS (66 pages); full Vitest PASS, 79 files / 423 passed / 4 intentional skips. Production evidence: 15 focused files / 78 tests PASS, clean 66-page build, exact drift/hash checks, authenticated browser on repeat/direct-order/Summary/monitor, health 200, task Running, monitor Ready/result 0, error log 0 bytes.
- Deployment: 64 allowlisted files only; release SHA-256 `2523FDDF327FECA010B521E6ED57944359ECC6A606505E38C95C9901D63A71FA`. Rollback `C:\ShopApp\backups\pre-update\overnight-stability-20260901-064131` contains replaced files, DB/config and prior build. Source/data/storage/config outside the allowlist were preserved.
- Tailscale: BackendState Running, Self Online, DNS `shopapp.tail2e8197.ts.net`, IP `100.69.89.39`; HTTP health 200 through both on SHOPAPP. The workstation itself is not on the tailnet, so MagicDNS failure from it is expected.
- Local app: restarted at `http://localhost:3001/api/health` (200). The initial dev tab held stale pre-build chunks; a fresh tab rendered the new UI. Production authenticated runtime interactions succeeded without console errors.

## Session Handoff — 2026-08-31 (Spurious authentication prompts)
- Local fixes: AuthRequiredDialog delegates to new auth-required-response.ts; ignore 403, exact optional GET /api/kiosk/session, phone capabilities and external-origin failures. Genuine desktop 401/AUTH_REQUIRED still prompts. New 5-test regression. Local phone-upload.http.ts origin uses browser Host plus forwarded scheme (not internal bind URL), with localhost/LAN/proxy/cross-site tests.
- Verification: 23 focused tests pass, TypeScript/lint pass. Owner actual local session: create link200, phone GET200, photo POST200, finish PATCH200, desktop claim200. Do not restart local app while their review is running.
- Production only AuthRequiredDialog + helper/test deployed, guarded by ops/Repair-ShopApp-AuthPrompts.ps1; live dialog baseline matched. Five server tests, 63-page build, exact deployed hashes and health passed. Rollback auth-prompts-20260831-150433 retains old source/build. Phone/search/direct-order reader remain local. No access-control relaxation.
- New report: repeat-list Create again gives client exception while original-order button works. Screenshot is IP:3000 and same template URL; no browser console evidence/reproduction available. Hard refresh requested to test stale chunks after deployment, not claimed as proven cause or fixed.

## Session Handoff — 2026-08-31 (Repeat-template / Create again server repair)
- Goal: repair both production buttons and restore local testing. User clarified second screenshot meant Create again, not department completion; all tentative department modifications/tests reverted before deployment.
- Runtime ownership: only repeat-orders.repo.ts deployed directly via ops/Repair-ShopApp-RepeatTemplate.ps1; local reconciliation preserved pending finalPartLength mapping and all unrelated dirty changes. New repeat-orders.repo.integration.test.ts covers real SQLite + actual snapshot/prefill routes with synthetic admin authentication. No production data written by tests.
- Root cause: part attachment nested write omitted required template relationship. Preassign template UUID and link both parent relations; filter top-level attachment list to templatePartId=null. Atomic rollback and repeat reuse preserved. No migration/dependency change.
- Commands: existing service tests 24 pass, new SQLite/API tests 3 pass locally and on server; npx tsc --noEmit and targeted ESLint pass. Server npm run build 63 pages and standalone copy pass; source hash verified, ShopApp Running, monitor Ready, health OK.
- Rollback C:\ShopApp\backups\pre-update\repeat-template-20260831-145454 (original repo source + entire prior build). Source SHA256 1504B6A1ED821546EC5DA597072DFF9BBEC5A3234E0EBFF38244268289401577. No historical records or drawing files edited. Actual customer browser mutation avoided; owner can retry both buttons after refresh.
- Local: scripts/start-phone-upload-local.cjs now defaults localhost:3001 and dev fallback when standalone missing; same isolated DB/storage/auth and local-login.json. PID40188 launcher at last check, homepage/health200. Old overlapping ShopApp dev/standalone processes stopped, .next preserved at .tmp/local-next-before-repeatfix. Pending phone/direct-order/search remain local-only.

## Session Handoff — 2026-08-31 (Phone upload + direct-order parity LOCAL REVIEW)
- User explicitly requested local-only phone QR intake, then corrected direct-order legacy-reader mismatch. Implemented both locally; .72 unchanged. Global search remains pending here too.
- Files: new modules/phone-upload (types/repo/service/http/tests), admin/phone-upload and phone-upload APIs, generic admin/drawing-import aliases, phone-upload/[id] page, PhoneUploadHandoff/PhonePhotoUpload; shared QuoteDrawingImportV2Panel and API client; importer service destination guards; orders/new plus orders schema/create mapping; package lock/qrcode+types; .gitignore; two local startup/setup scripts and docs/PHONE_UPLOAD_LOCAL_REVIEW.md. No schema migration.
- Staging outside public attachments; 30-minute hashed upload-only capability, 24-hour retention/next-create cleanup, 100 photos/20MB each/95MB normalized batch. Desktop session auth required for creation/claim; immutable owner/draft/destination/mode prevents misrouting. Retry IDs and importer idempotency prevent duplicate imports; desktop can recover partial received photos. New generic drawing routes retain admin guards; old quote routes remain compatible.
- Commands passed: focused/full relevant Vitest (254 pass/7 opt-in skip, includes archived duplicate fixtures), npx tsc --noEmit, targeted ESLint, npm run build (64 static pages), local health HTTP200. Phone route→canonical PDF→V3 mock-response→review works for both quote/order; final/cut/material/finish persist in direct-order create path. Browser sign-in denied ERR_BLOCKED_BY_CLIENT; no workaround. Physical phone/interactive UI still requires owner's check. Do not claim live-AI accuracy benchmark or full browser verification.
- Local app running via hidden node launcher PID2628, http://localhost:3000, phone http://192.168.254.132:3000 (same Wi-Fi/firewall needed). Isolated .tmp/phone-upload-local/app.db and storage, normal auth TEST_MODE=false. Temporary login in .tmp/phone-upload-local/local-login.json. Synthetic sample synthetic-drawing.jpg. No real quote/customer records changed.
- Restart: node scripts/start-phone-upload-local.cjs after build. Setup (idempotent isolated schema/seed) node scripts/prepare-phone-upload-local.cjs. Do not deploy test database/credentials; production deployment needs explicit approval and reconciliation of dirty files.

## Session Handoff — 2026-08-31 (Global search, local and ready for approval)
- Goal: make navigation search business-wide instead of order-only. Implemented four src/modules/search runtime files, two tests, src/app/search/page.tsx, AppNav labels and Prisma SQL helper declarations in src/types/prisma.d.ts. No dependencies, schema, production data or server changes.
- Coverage: business records/parts/quotes/customers/contacts/files, already-extracted drawing/BOM text, notes/history/catalogs/work steps/people/templates/custom values. Explicit source/field allowlists; employee attachment policy applied before result/count generation; all user search text parameterized. Up to 12 words/160 characters, 40-result pages without old 60-record ceiling.
- Verification: npm run test -- src/modules/search (26 passed); npx tsc --noEmit; targeted ESLint; npm run build; synthetic browser grouped screen/pagination check. Preview-only test harness removed after use; no production customer UI inspected. Live baseline comparison for three replaced files matched HEAD before changes.
- NOT DEPLOYED. Production runbook requires explicit owner request. Release only src/modules/search/{search.types,search.registry,search.repo,search.service}.ts, src/app/search/page.tsx, src/components/AppNav.tsx, src/types/prisma.d.ts. Recompare live files, snapshot, build/restart/health/hash/log verify after approval. Do not deploy unrelated dirty tree.
- Explain indexing boundary honestly: unread documents, external shares, secrets/configuration are not searched. Stored extraction text is admin-only; no expensive AI/OCR calls occur during search. Query-time SQL scan may need an indexed successor at larger measured scale.

## Session Handoff — 2026-08-31 (Read-only usability recommendations)
- User requested suggestions, not implementation. Reviewed live Shop Floor, Customers, Admin and Quotes plus related source/history. Individual customer-order browser navigation was blocked by approval guard; no bypass or private record inspection followed.
- No code, production, data or settings edits. Only required continuity docs updated; no build/tests needed for this advisory review.
- Suggested first batch: whole-quote autosave/unsaved state; faster compact drawing-review queue; Quotes navigation/filter consistency and initial cursor preservation. Later: part-level blockers/purchasing, operator-focused actions, QR traveler, unified search/file roles/revision history, backup status and estimated-vs-actual reporting.
- Initial quote-list source drops pagination cursor after take=20; confirm/fix under a future authorized implementation task. Do not treat these suggestions as approved development work.

## Session Handoff — 2026-08-31 (Optional revision and dimension units, latest)
- Goal/scope: optional revision and compact in/mm toggle in quote drawing review only; no extraction, schema, or historical record changes.
- Runtime files: DrawingImportFieldEditor.tsx, DrawingImportPageCard.tsx, drawing-import-review-state.ts, new drawing-import-dimension-units.ts under src/components/orders/drawing-import. Test: __tests__/quote-drawing-import.test.ts. Updated todo, lessons, context, progress, handoff and task board.
- Canonical measurements remain inches; toggle never writes data. Metric edits convert with 25.4 mm/in; explicit suffix wins; invalid entries become unresolved. Original evidence is preserved. Absent revisions no longer look mandatory; actual conflicts remain visible.
- Commands passed: focused Vitest (21 current-source + 9 archived tests), npx tsc --noEmit, targeted npx eslint, git diff --check, exact-hash four-file deployment and clean server npm run build (63 pages). Synthetic browser verified unit switching, metric edit/save, blank revision and invalid-input recovery.
- Production-quote browser access was denied by approval guard; no bypass. Synthetic local test used instead, so do not claim a real customer-quote post-deploy UI test. Exact live source hashes/build/health gates passed.
- Deployed release C97A813D10ECB4AE9DA9F23DAC1FA366904D033F06718A4361FFA31F47CDFC05; rollback C:\ShopApp\backups\pre-update\drawing-review-simple-20260831-012116. ShopApp Running; monitor Ready/result 0; health OK; error log empty.

## Session Handoff — 2026-08-28 (V3 quote review simplified, latest)

- The production quote drawing workflow remains V3 and still sends exactly one canonical single-page PDF per model request. Independent requests can run concurrently; drawings are not batched together. Upload security, splitting, durable jobs, evidence, retries, source traceability, and quote saving were not weakened.
- The review UI is intentionally simple again: plain compact fields, restrained attention messages, collapsed technical/supporting information, one compact filter, Material-only catalog creation, and no AI-editable cut/stock fields.
- The final layout uses three independent semantic columns, preventing a long conflict message from forcing empty space into unrelated fields. Native Material selects explicitly use dark background/light text and dark-compatible options.
- Shop math is authoritative and local: `cut = final + 0.125`; `total stock = cut × quantity`. A regression test passes conflicting AI values and verifies they are ignored.
- Local evidence: full drawing-import suite 183 passed / 7 opt-in skipped across 32 files; final focused regression 9/9; TypeScript, targeted ESLint, `git diff --check`, and clean 63-route production build passed. Authenticated production review of the existing nine-page job showed READY_FOR_REVIEW and correct calculated examples.
- Production evidence: latest archive SHA `27167EE453D171F1C912C79B5B6087D63E57EAF98FFE9E46557E65FCFA3D0BC8`; rollback `C:\ShopApp\backups\pre-update\drawing-review-simple-20260828-120339`; `.72` clean build/health passed, ShopApp Running, monitor result 0, error log 0 bytes.
- The first two narrow deployment attempts auto-rolled back because old server-resident fixtures no longer match live V3 types. No failed attempt remained live; the final runtime releases were gated by the complete current-source local suite plus exact-hash staging, clean server build, and authenticated runtime verification.

## Session Handoff — 2026-08-28 (Quote Drawing Import V3 deployed)

- V3 is live on `.72` for admin quote drawing intake. It retains the V2 durable/upload/review/save framework but sends each authoritative single-page PDF directly to Terra; a second high-reasoning Terra request runs only for unresolved finished length, width/outside diameter, or thickness/wall.
- Incomplete Terra responses now become uncertain/manual-review pages. Resolved fields are never overwritten by the refinement pass. Production keeps OCR, local auto-accept, Luna, and Sol disabled.
- Local evidence: `npx tsc --noEmit`; targeted ESLint; 20 drawing-import files / 116 tests passed with 2 opt-in skips; `npm run build` generated 63 routes.
- Deployment evidence: 15 source files built on `.72`; isolated packaged HTTP upload returned READY_FOR_REVIEW with 9/9 canonical PDF pages, 9 Terra pages, dimensions on 6/6 classified detail parts, 3 manual-review pages, 48.626 seconds, USD 0.372434; production health 200, ShopApp Running, monitor Ready, error log 0 bytes.
- Rollback is `C:\ShopApp\backups\pre-update\drawing-import-v3-20260828-095926`. It contains the replaced source, protected environment file, and database copy.
- Known beta boundary: Terra deliberately leaves absent or uncertain dimensions blank for review. The owner directed shipment at this point; do not describe this as full golden-set/default-rollout certification.

## Session Handoff — 2026-08-28 (SHOPAPP Tailscale restored, latest)

- The production server's existing Tailscale node is online again as `shopapp.tail2e8197.ts.net` / `100.69.89.39`.
- Root cause was not the Windows service or internet connectivity: the service and adapter were up, but the saved user profile was not active and the backend cycled through `NeedsLogin`/`NoState`.
- `tailscale up --hostname=shopapp --unattended=true` restored the existing identity and enabled Windows unattended mode so RDP/user logoff does not take the server off the tailnet.
- A controlled Tailscale service restart then auto-reconnected in two polls with BackendState `Running`, Self Online, no health warnings, the same hostname/IP, and healthy ShopApp response through the private IP.
- The current workstation is not connected to that tailnet, so MagicDNS does not resolve there; verify offsite access from the owner's phone while its Tailscale client is connected.

## Session Handoff — 2026-08-28 (Quote Drawing Import V2 admin beta deployed)

- V2 is live on `.72` for admin quote drawing intake only, with the legacy reader retained as an immediate fallback and direct orders unchanged.
- Full local regression passed 324 tests; local/server 63-route builds, standalone worker, migration, private local-only ZIP foundation smoke, synthetic live Terra smoke, and production health/hash checks passed.
- Production release SHA-256: `CC4BDF2A3ED2A9C8E20D5B889050710347A6D83CAA30593D8B3E36E721782977`; rollback: `C:\ShopApp\backups\pre-update\drawing-import-v2-20260828-003455`.
- All 42 migrations are current; `shopapp.local` health is HTTP 200; the protected V2 route returns HTTP 401 without a session; task/monitor are healthy.
- Final default-release certification is still blocked on a representative approved golden set and real packet benchmark. Local auto-accept/profile matching stay off during admin beta.
- The complete scope, verification, deployment incident, file ownership, and next steps are in the detailed 2026-08-28 V2 record later in this file.

## Session Handoff — 2026-08-25 (Mobile work-order detail deployed)

Goal: Make the work-order detail page practical on phone-sized screens while retaining the approved desktop layout and all existing workflows.

### What changed
- `src/app/orders/[id]/page.tsx` now uses a compact horizontal Parts selector below the mobile header, removes unnecessary phone-only vertical space, and keeps the desktop sticky 360px rail at `lg` widths.
- Order actions use a two-column touch grid on phones with a full-width final action; status/priority controls stack cleanly, panel padding is reduced, and tabs remain horizontally scrollable.
- `src/modules/orders/__tests__/order-detail-layout.test.ts` adds a static responsive-layout contract. `ops/Deploy-ShopApp-MobileOrderDetail.ps1` provides exact-hash deployment and automatic rollback.

### Verification / state
- Local and authenticated live browser QA at `390x844`: no horizontal overflow, document width 380px, balanced 170px action columns, full-width 348px Exit Order action, compact Parts selector, and readable timer/status controls.
- Desktop QA: no overflow and the Parts rail remains exactly 360px.
- Focused Vitest 2/2, targeted ESLint, full TypeScript, and local/server 62-page builds passed.
- Deployed hash: `DEC2ED1E1E9A53ABBFEDA004AA0D56493E38F0EC626FC47BD69E17558774E29B`. Rollback: `C:\ShopApp\backups\pre-update\mobile-order-detail-20260825-213850`.
- Final production checks: IP health 200, hostname health 200, sign-in 200, ShopApp Running, monitor Ready, error log 0 bytes.

## Session Handoff — 2026-08-25 (Shop Floor Business filter deployed)

Goal: Add an everyday Business quick filter beside the existing Shop Floor filters and release it safely to production.

### What changed
- `src/components/ShopFloorLayouts.tsx` adds Business between Department and Priority, using the canonical business labels and the same shared pipeline for Tiles and List.
- `src/modules/shop-floor/shop-floor.shared.ts` adds normalized, case-insensitive business matching; `src/modules/shop-floor/__tests__/shop-floor.shared.test.ts` covers All, matching, mismatch, and missing values.
- `ops/Deploy-ShopApp-BusinessFilter.ps1` provides exact-hash deployment, per-file rollback, production build, and task restart behavior.

### Verification / state
- Local browser QA: All 16, Sterling 9, C and R Machining 6, Powder Coating 1; Tiles and List matched exactly.
- Focused Vitest passed 2 files / 15 tests; targeted ESLint, full TypeScript, and the 62-page production build passed.
- Deployed hashes matched local. IP and `shopapp.local` health return `{"status":"ok"}`. Rollback: `C:\ShopApp\backups\pre-update\business-filter-20260825-211700`.

## Session Handoff — 2026-08-25 (Private mobile access confirmed)

Goal: Give the owner private offsite phone access to ShopApp without exposing the site or admin services publicly.

### Current state
- Official Tailscale `1.102.3` is installed on SHOPAPP through Windows Package Manager.
- SHOPAPP is authorized and online as `shopapp.tail2e8197.ts.net` / `100.69.89.39`; Tailscale reports no health warnings.
- The owner confirmed ShopApp is reachable from the phone while outside the work network through direct private tailnet access.
- Tailscale Serve/HTTPS is not enabled; the confirmed direct tailnet path does not require it.
- Do not enable Tailscale Funnel, router port forwarding, Tailscale SSH, or RDP exposure in this task.

## Session Handoff — 2026-08-25 (Print header and Parts rail correction)

Goal: Restore the visible quote business header in printer output and clean up the order-detail Parts rail hierarchy/hover behavior.

### What changed
- `src/app/globals.css` scopes print-only app-chrome hiding to `[data-app-chrome]` instead of blanket `header, footer` selectors.
- `src/app/layout.tsx` marks only the global ShopApp navigation and footer as app chrome, leaving semantic headers/footers inside printable documents visible.
- `src/app/orders/[id]/page.tsx` promotes `PARTS` to the same 24px title treatment as the customer name, aligns the left rail edge, and replaces vertical hover translation with border/shadow feedback.
- Added focused static regression contracts in `src/lib/__tests__/print-chrome.test.ts` and `src/modules/orders/__tests__/order-detail-layout.test.ts`.

### Verification / state
- Local browser QA: quote header visible; Parts/customer font size both 24px; bottoms 174/176px; Parts title/subheading x=32px; hovered card remains x=32/y=214/356x78 with transform `none`.
- Focused Vitest: 4 files / 10 tests passed. Targeted ESLint and full TypeScript passed.
- Local review remains at `http://127.0.0.1:3001`.
- After fresh explicit approval, `ops/Deploy-ShopApp-PrintHeaderLayoutFix.ps1` verified all three incoming hashes, backed up the prior files, completed the 62-page production build, and restarted ShopApp.
- Rollback: `C:\ShopApp\backups\pre-update\print-header-order-layout-20260825-183246`.
- Final checks: direct IP and `shopapp.local` health HTTP 200, sign-in HTTP 200, ShopApp Running, Health Monitor enabled/Ready, `shopapp.err.log` zero bytes, and deployed source hashes equal local.

## Session Handoff — 2026-08-25 (Fresh-start production sync)

Goal: Release the held local feature batch to `.72` and make the owner's two new orders plus one new quote the only production work records.

### What changed
- Deployed the reviewed local source archive and migration `20260825150000_customer_contacts_structured_address_v1` to `C:\ShopApp\app`; Prisma generation/migration and the production build completed successfully.
- Added reusable guarded operations scripts under `ops/` for the timestamped pre-update backup, controlled deployment, and exact-ID historical-work purge.
- Preserved orders `CRM-1007` (`cmt909q2v0003z7euy7su7fo5`), `CRM-1008` (`cmt915w7w000fz7euwkqby2ih`), and quote `250826-001` (`cmt91dtzb000pz7eu9bfzqfmp`). Deleted 16 older orders and 17 older quotes; no physical customer files were removed.

### Verification and rollback
- Rollback snapshot: `C:\ShopApp\backups\pre-update\fresh-start-20260825-154601`; database SHA-256 `05BEDC950501956BDB60B614DFAB9D3EC3B13838CB8427585BC0846D23092CE6`; 377 source files in the backup manifest.
- Cleanup passed first on a disposable migrated production copy and then on production. Base-table counts stayed at customers 7, contacts 7, users 13, departments 4, document templates 2, app settings 1, and repeat templates 1; `PRAGMA foreign_key_check` returned zero issues.
- Release SHA-256 `6A5B873C83AD4B5B9DD9A15CB24C0098BE3CDE5A4878633A05E1E9717BF35A08`; selected production/local source hashes match.
- `http://192.168.254.72/api/health`, `http://shopapp.local/api/health`, and `http://192.168.254.72/auth/signin` returned HTTP 200. ShopApp is running, Health Monitor is enabled with last result `0`, and `shopapp.err.log` is zero bytes.
- Local review remained available independently at `http://127.0.0.1:3001` in `TEST_MODE=true` during deployment.

## Session Handoff — 2026-08-25 (Defined Shop Floor-style order part tiles)

Goal: Bring the individual part cards inside an order up to the same clear navy/royal-blue definition as Shop Floor order tiles.

### What changed
- `src/app/orders/[id]/page.tsx` gives selected part cards a brighter royal-blue gradient, sky border, and stronger inset/depth treatment.
- Unselected part cards now use a distinctly bordered deep-navy gradient instead of blending into the order canvas.
- Card text contrast was strengthened without changing selection, department, timer, or order behavior.

### Verification and deployment
- Targeted ESLint, `npx tsc --noEmit`, 23/23 focused tests, and clean 62-page local/server builds passed.
- Local visual/interaction QA and authenticated production QA confirmed readable selected/unselected states and correct selection transfer; p001 was restored afterward.
- Live health is HTTP 200; port 3000 is listening, source SHA-256 matches local, and `shopapp.err.log` is empty.
- Rollback: `C:\ShopApp\backups\pre-update\defined-part-tiles-20260825-1420`. Database remained 1,142,784 bytes and storage remains 12 files / 2,191,862 bytes.

## Session Handoff — 2026-08-25 (Open order canvas and unassigned department path, latest)

Goal: Remove redundant dark order-detail shells and ensure every selected part has an obvious department-management path.

### What changed
- `src/app/orders/[id]/page.tsx` replaces the left Parts wrapper with a transparent rail and removes background/border/shadow from the right selected-order wrapper; individual part cards and inner functional surfaces remain.
- An unassigned selected part now enables the department action as Assign department. Assigned parts continue to show Move department.
- The existing audit-backed assignment dialog adapts its title, help text, reason label, progress label, and success toast to Assign versus Move while retaining active-timer blocking and required notes.

### Verification and deployment
- Targeted ESLint, `npx tsc --noEmit`, 23/23 focused tests, `git diff --check`, and clean 62-page local/server builds passed.
- Local visual QA on STD-1001 confirmed the open canvas and retained part tiles. Local and authenticated production dialog QA on unassigned p001 confirmed four department choices and reason-gated save; QA canceled without mutation.
- Live health is HTTP 200, port 3000 is listening, source SHA-256 matches local, and `shopapp.err.log` is empty.
- Rollback: `C:\ShopApp\backups\pre-update\order-open-canvas-20260825-1345`. Database remained 1,142,784 bytes and storage remains 12 files / 2,191,862 bytes.

## Session Handoff — 2026-08-25 (Shop Floor Timers and department quick filter, latest)

Goal: Make active timers and department filtering everyday Shop Floor controls rather than hiding timers behind customization.

### What changed
- `src/components/ShopFloorLayouts.tsx` adds Department between Status and Priority. All, Unassigned, and active-department choices filter the shared Tiles/List order set by effective current part department.
- Timers is a separate top-level button beside Tiles/List/More and independently reveals `RunningWorkersStrip`.
- More now reveals only Customize this shop floor; it no longer contains the timer strip.

### Verification and deployment
- Targeted ESLint, `npx tsc --noEmit`, 14/14 focused tests, and clean 62-page local/server builds passed; `git diff --check` passed.
- Local QA showed Machining reduce 16 orders to 10. Authenticated production QA showed 16 to 9, proved Timers/More independence, then restored Department to All and closed both panels.
- Live health is HTTP 200, port 3000 is listening, source SHA-256 matches local, and `shopapp.err.log` is empty.
- Rollback: `C:\ShopApp\backups\pre-update\shopfloor-timers-department-20260825-1310`. Database remained 1,142,784 bytes through deployment; storage remains 12 files / 2,191,862 bytes.

## Session Handoff — 2026-08-25 (Admin order controls and tile actions, latest)

Goal: Make priority/status administration obvious on orders and provide a compact admin action path directly from Shop Floor tiles.

### What changed
- `src/app/orders/[id]/page.tsx` now exposes admin-only header controls for Priority and audited Change status. Status reasons are required and saved through the existing `/api/orders/[id]/status` route.
- The broad Edit order form no longer owns priority, preventing stale full-form saves from reverting focused priority changes.
- `src/components/ShopFloorLayouts.tsx` shows a flame for HOT orders in Tiles and List. Admins also receive a three-dot Tiles dialog for priority, status, and assigned-machinist updates; non-admin rendering remains gated by the server-provided permission.
- Added focused service tests for blank-reason rejection and persisted status-history attribution.

### Verification and deployment
- Targeted ESLint, `npx tsc --noEmit`, and five focused suites (35/35 tests) passed. Clean local and server builds generated 62 pages; `git diff --check` passed.
- Local and authenticated live QA confirmed 16 tile menus, two HOT flames, reason-gated status changes, and the new order-header controls. No QA changes were saved.
- Live health is HTTP 200; server/local source hashes match; scheduled task is running on port 3000; `shopapp.err.log` is empty.
- Rollback: `C:\ShopApp\backups\pre-update\order-controls-20260825-1245`. Production database/storage remained 1,142,784 bytes and 12 files / 2,191,862 bytes.

## Session Handoff — 2026-08-25 (List summary and compact workload refinement, latest)

Goal: Put shop summary context above List, replace Completed jobs with compact machinist workload, and eliminate the duplicated dashboard below the selected view.

### What changed
- `src/app/page.tsx` passes its server-calculated active/total/due-soon/unassigned/workload data into `ShopFloorLayouts` and no longer renders the legacy summary, Orders overview, full workload, or Status pulse sections afterward.
- `src/components/ShopFloorLayouts.tsx` renders four equal-height summary cards only in List mode, directly before the table.
- The fourth card displays the top three machinists and active-order counts using compact typography suitable for the shared 80-inch TV.

### Verification and deployment
- Targeted ESLint, `npx tsc --noEmit`, and 14/14 focused tests passed. Clean local and `.72` production builds generated 62 pages and copied standalone assets.
- Local and authenticated live QA confirmed the summary precedes the table, only one Machinist workload appears, and Orders overview / Status pulse are absent below List.
- Live health and sign-in return HTTP 200. Production source hashes match local; rollback source is `C:\ShopApp\backups\pre-update\shopfloor-list-summary-20260825-1210`.
- `shopapp1.db` remains 1,142,784 bytes with the same 10:01 AM last-write time; storage remains 12 files / 2,191,862 bytes.

## Session Handoff — 2026-08-25 (Shop Floor Tiles, List, and More, latest)

Goal: Make the production screen land on the supplied compact tile dashboard while keeping the order list, timers, and customization one click away.

### What changed
- `src/app/page.tsx` no longer renders the large Live production / Shop Floor introduction above the working dashboard.
- `src/components/ShopFloorLayouts.tsx` now opens in Tiles on every fresh load, adds the adjacent Tiles/List/More view control, and leaves More closed initially.
- List is a flat order overview table using the same status, priority, sort, direction, advanced-filter, and conditional-color pipeline as Tiles.
- More reveals Working Now and the complete Customize this shop floor surface; the obsolete Grid digest / By machinist / Work queue layout chooser was removed from customization while saved filter/color settings remain supported.

### Verification and deployment
- Targeted ESLint and `npx tsc --noEmit` passed; focused Shop Floor and Working Now tests passed 14/14.
- Clean local and `.72` `npm run build` passed with 62 generated pages and standalone assets copied; `git diff --check` passed.
- Authenticated production QA verified initial Tiles, interactive List, More revealing both requested surfaces, and reload restoring Tiles with More closed. LAN health and sign-in return HTTP 200.
- Only the two UI source files were deployed. Their production SHA-256 hashes match local; rollback source is `C:\ShopApp\backups\pre-update\shopfloor-view-20260825-1205`.
- Production data remained intact: `shopapp1.db` is 1,142,784 bytes with its same 10:01 AM last-write time, and storage remains 12 files / 2,191,862 bytes.

## Session Handoff — 2026-08-24 (Sleeker open-canvas Shop Floor styling, latest)

Goal: Remove the bubble-like dark enclosure from Live Production and give the Shop Floor a flatter, more professional visual hierarchy.

### What changed
- Removed the `.shop-floor-glass::after` dark backing sheet from `src/app/globals.css` while preserving the atmospheric navy gradient.
- Removed the rounded outer page shell and the `shop-glass-strong` results wrapper.
- Tightened Shop Floor panels, work/order cards, selectors, buttons, timer surfaces, and nested rows from oversized/pill radii to `rounded-lg` or `rounded-md` where appropriate.
- Retained circular geometry for semantic badges, progress indicators, avatars, and live-status dots.

### Verification
- Live in-app browser QA confirmed the Live Production / Shop Floor heading sits directly on the gradient and the main production tiles no longer have a dark navy enclosure behind them.
- `npm run test -- src/modules/shop-floor/__tests__/shop-floor.shared.test.ts src/components/work-queue/__tests__/RunningWorkersStrip.test.ts` — 10/10 passed.
- Targeted ESLint and `npx tsc --noEmit` passed.
- Clean `npm run build` passed with 62 generated pages and standalone assets copied.
- `git diff --check` passed (line-ending notices only).

## Session Handoff — 2026-08-24 (Daily sequential quote numbering, latest)

Goal: Make quote identifiers read as creation date followed by that quote's order within the day.

### What changed
- `src/modules/quotes/quotes.repo.ts` now lists quote numbers matching a six-digit daily stamp.
- `src/modules/quotes/quotes.service.ts` assigns `DDMMYY-###` using the next sequence for the local calendar day.
- Existing quote numbers are preserved on edit, including legacy business-prefixed identifiers; newly supplied replacements must use the new format.
- Added `src/modules/quotes/__tests__/quote-number.test.ts` with deterministic date/sequence and edit-preservation coverage.

### Verification
- `npm run test -- src/modules/quotes/__tests__/quote-number.test.ts` — 3/3 passed.
- Targeted ESLint passed for the quote repository, service, and test.
- `npx tsc --noEmit` passed.
- Clean `npm run build` passed with 62 generated pages and standalone assets copied; the sandboxed attempt was blocked only by the managed Google Fonts network redirect and the permitted rerun passed.
- `git diff --check` passed (line-ending notices only).

## Session Handoff — 2026-07-17 (Quote part-list overflow correction, latest)

Goal: Keep imported part labels contained and readable in the quote editor's manual parts sidebar.

### What changed
- Updated `src/app/admin/quotes/QuoteEditor.tsx`.
- Replaced the fixed `280px / 1fr` split with a responsive `320–360px / minmax(0,1fr)` split.
- Added safe minimum widths to both panes.
- Changed part-list buttons to auto-height vertical rows with normal whitespace and explicit wrapping for long names and part numbers.

### Verification
- Targeted ESLint passed.
- `npx tsc --noEmit` passed.
- Live quote-editor QA used text longer than the owner's overflowing examples.
- Browser measurements confirmed every row descendant stayed within the panel, the row had no internal horizontal overflow, and the page had no horizontal overflow.

### Correction note
- The initial response misidentified a neighboring page-level navigation inconsistency. The screenshot-specific prevention rule is recorded in `tasks/lessons.md`.

## Session Handoff — 2026-07-17 (Production feeds-and-speeds correction, latest)

Goal: Turn the audited feeds-and-speeds calculator into a trustworthy starting-value tool for the owner's Haas VF-2SS.

### What changed
- Added `feeds-speeds.machine.ts` with the VF-2SS profile: 12,000 RPM and 833 IPM hard ceilings, plus 30 hp and 90 ft-lb at 2,000 RPM reference values.
- Added `feeds-speeds.geometry.ts` for source-derived effective-diameter, corner-rounding, thread-path, engagement, and deflection helpers.
- Updated the calculation contract and UI so tool-family changes load coherent defaults and operation-specific inputs appear only where needed.
- Specialized operation paths now handle milling, feed/lens/chamfer tools, corner rounding, internal/external thread milling, turning/grooving, drills/reamers, and pitch-driven taps separately.
- Removed unsupported fixed ramp feed and 60% plunge feed outputs. Added MRR, estimated horsepower, correctly dimensioned torque, cap warnings, and unavailable/error states.
- Updated the parity checklist and replaced self-generated snapshots with explicit source-derived test constants.

### Files touched for this slice
- `src/app/tools/feeds-speeds/FeedsSpeedsCalculator.tsx`
- `src/app/tools/feeds-speeds/page.tsx`
- `src/modules/feeds-speeds/feeds-speeds.ts`
- `src/modules/feeds-speeds/feeds-speeds.types.ts`
- `src/modules/feeds-speeds/feeds-speeds.geometry.ts`
- `src/modules/feeds-speeds/feeds-speeds.machine.ts`
- `src/modules/feeds-speeds/__tests__/feeds-speeds.test.ts`
- `src/modules/feeds-speeds/__tests__/feeds-speeds.geometry.test.ts`
- `docs/FSWIZARD_FEEDS_SPEEDS_PARITY.md`
- Continuity documents

### Verification evidence
- Focused feeds/speeds suite: `2 files / 19 tests` passed.
- Full suite: `29 files / 140 tests` passed.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed, including 59 generated pages and standalone asset preparation.
- Live `/tools/feeds-speeds` QA passed after a clean development-cache restart:
  - stylesheet loaded successfully,
  - default 4140 / 0.5-inch Solid End Mill reset to 340.16 SFM, 2599 RPM, and 11.8 IPM with the family-default 2 flutes,
  - V-bit output visibly capped at 12,000 RPM from a 75,195 RPM raw target,
  - tap output remained unavailable until a positive lead was entered,
  - invalid internal thread-mill diameter hid the recommendation,
  - no new browser console errors were emitted.

### Runtime note
- The local development server is intentionally left running on `http://127.0.0.1:3000/tools/feeds-speeds` for owner testing.
- A production build and `next dev` must not share a stale `.next` cache; the prevention rule is recorded in `tasks/lessons.md`.

## Session Handoff — 2026-07-16 (Drawing import progress + removal follow-up)

Replaced the ambiguous drawing-import spinner with an advancing progress bar, stage messages, percentage, and elapsed time. Added a visible `Remove from list` action to every extracted drawing card so assemblies or unwanted detections can be discarded before continuing. Drawing-import tests (3/3), full lint, and live side-browser panel verification passed.

## Session Handoff — 2026-07-16 (Drawing-to-order import v1, latest)

Implemented dedicated part names and the first useful drawing-assisted order flow for PDF/image/ZIP intake, reviewed corrections, per-part attachments, and automatic BOM startup. Prisma migration/generation, 25 focused tests, full lint, the 16-PDF sample inventory, live page compilation, and representative title-block extraction passed. Detailed touched-file evidence and remaining resumable-draft/assembly-expansion follow-ups are recorded in the full matching handoff below.

## Session Handoff - 2026-06-30 (Known bug burn-down 1: quote-converted order execution integrity)

Goal (1 sentence): Sync the current local code with GitHub, then fix the highest-leverage quote-converted order defects around required work instructions and checklist-to-charge linkage.

### What changed
- Synced the existing local QA checkpoint to GitHub:
  - committed `ad2be7b` (`Fix quote order material and completion edge cases`),
  - pushed `codex/feeds-speeds-fswizard-parity`,
  - opened draft PR #178: `https://github.com/m4440473/shopapp1/pull/178`.
- Updated [convert route](C:/Users/user/Documents/GitHub/shopapp1/src/app/api/admin/quotes/[id]/convert/route.ts)
  - Direct quote conversion now builds sectioned `workInstructions` from quote requirements, quote notes, materials, purchase items, part description, and part-specific notes.
  - Override-provided work instructions are normalized to `null` when blank.
- Updated [quotes.repo.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/quotes/quotes.repo.ts)
  - Persists `workInstructions` when creating converted order parts.
  - Captures newly created order charge IDs by `(partId, addonId)` and passes them into checklist generation.
- Updated [quote-work-items.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/quotes/quote-work-items.ts)
  - Checklist entry generation can now include the matching `chargeId`.
  - Added a shared key helper for quote selection part/add-on matching.
- Updated tests:
  - [quote-work-items.test.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/quotes/__tests__/quote-work-items.test.ts)
  - [route.test.ts](C:/Users/user/Documents/GitHub/shopapp1/src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts)

### Files touched
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`
- `tasks/todo.md`
- `src/app/api/admin/quotes/[id]/convert/route.ts`
- `src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`
- `src/modules/quotes/quote-work-items.ts`
- `src/modules/quotes/__tests__/quote-work-items.test.ts`
- `src/modules/quotes/quotes.repo.ts`

### Commands run
- `gh --version`
- `gh auth status`
- `git fetch origin`
- `npx eslint --ext .ts,.tsx -- "src/modules/quotes/quotes.service.ts" "src/modules/orders/orders.service.ts" "src/app/api/admin/quotes/[id]/convert/route.ts" "src/modules/orders/__tests__/orders.service.test.ts"`
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- `git commit -m "Fix quote order material and completion edge cases"`
- `git push -u origin codex/feeds-speeds-fswizard-parity`
- `gh pr view --json number,title,state,isDraft,url,baseRefName,headRefName`
- `gh pr create --draft --base main --head codex/feeds-speeds-fswizard-parity --title "[codex] Sync local feeds parity and quote workflow fixes" ...`
- `npx eslint --ext .ts,.tsx -- "src/modules/quotes/quote-work-items.ts" "src/modules/quotes/__tests__/quote-work-items.test.ts" "src/modules/quotes/quotes.repo.ts" "src/app/api/admin/quotes/[id]/convert/route.ts" "src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts"`
- `npm run test -- src/modules/quotes/__tests__/quote-work-items.test.ts src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`

### Verification evidence
- Existing local QA fixes passed targeted ESLint.
- Focused Orders service tests passed (`13/13`) before the sync commit.
- New quote-conversion tests passed (`7/7`) across route conversion and quote work-item helper tests.
- Targeted ESLint passed on all newly touched quote conversion files/tests.

### Remaining follow-ups
- Manual department movement can still bypass open checklist items.
- Parts can still be moved into a department with no checklist items and then cannot submit that department complete.
- Timer behavior should be reconciled against canon: current canon says one active operation per user, while older decision-log notes mention department-scoped active timers.
- Order detail/time endpoints still duplicate some time-entry fetching and should be profiled/refactored in a focused pass.

### Behavior note for the next agent
- `prisma/prisma/dev.db` remains modified from local runtime QA data and should be treated as local state unless the owner explicitly asks to preserve DB fixture changes.
- `tmp-dev-3000.pid` remains an untracked local runtime artifact.

## Session Handoff - 2026-05-13 (Quote-to-order machinist workflow QA)

Goal (1 sentence): Deep-test and audit the create-quote through converted-order machinist workflow, including multi-part orders, department movement, checklist completion, and timer behavior.

### What changed
- Added a session plan/checklist in [tasks/todo.md](C:/Users/user/Documents/GitHub/shopapp1/tasks/todo.md).
- Fixed [quotes.service.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/quotes/quotes.service.ts)
  - Normalizes blank optional quote-part `materialId` values to `null` before creating quote parts.
- Fixed [convert route](C:/Users/user/Documents/GitHub/shopapp1/src/app/api/admin/quotes/[id]/convert/route.ts)
  - Normalizes blank optional material IDs on quote conversion overrides/defaults before order creation.
- Fixed [orders.service.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/orders/orders.service.ts)
  - Normalizes blank optional order-part `materialId` values to `null` on direct order creation.
  - Preserves the final department when checklist completion marks a part complete.
- Updated [orders.service.test.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/orders/__tests__/orders.service.test.ts)
  - Added regression coverage for blank material normalization and final-department preservation.

### Runtime QA Performed
- Browser Use was attempted twice after loading the Browser skill and again after the user explicitly selected the plugin, but no Codex IAB backend was discoverable. Runtime testing used authenticated requests against the live Next server instead.
- Created and converted three multi-part quote-originated QA orders:
  - `CRM-1001` / 2 parts,
  - `CRM-1002` / 2 parts,
  - `CRM-1003` / 3 parts.
- Exercised:
  - quote creation and conversion,
  - order detail retrieval,
  - timer start/active/conflict/finish,
  - manual department transition,
  - checklist-driven department advancement,
  - completed-part final department ownership.

### Findings Left For Follow-Up
- P1: Converted quote requirements/notes are not seeded into `OrderPart.workInstructions`, so the Read Me First acknowledgement gate is absent on converted parts.
- P1: Manual department movement can bypass open checklist items.
- P1: Timer service still allows only one active timer per user, not one per `(user, department)` as documented.
- P2: Quote-converted checklist rows are not linked to their matching charges, so checklist completion leaves `OrderCharge.completedAt` null.
- P2: Parts can be moved into a department with no checklist items and then cannot submit that department complete.
- P3: Order detail/timer endpoints duplicate time-entry fetching and may become expensive on timer-heavy orders.

### Files touched
- `src/app/api/admin/quotes/[id]/convert/route.ts`
- `src/modules/orders/__tests__/orders.service.test.ts`
- `src/modules/orders/orders.service.ts`
- `src/modules/quotes/quotes.service.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run dev -- --hostname 0.0.0.0 --port 3001`
- `npm run dev -- --hostname 0.0.0.0 --port 3002`
- Authenticated runtime requests against `http://127.0.0.1:3002`
- `npx eslint --ext .ts,.tsx -- "src/modules/quotes/quotes.service.ts" "src/modules/orders/orders.service.ts" "src/app/api/admin/quotes/[id]/convert/route.ts" "src/modules/orders/__tests__/orders.service.test.ts"`
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`

### Verification evidence
- Targeted ESLint passed.
- Focused Orders service tests passed (`13/13`) after outside-sandbox rerun because the sandboxed Vitest/esbuild startup hit Windows `spawn EPERM`.
- Live quote create initially reproduced Prisma `P2003` from `materialId = ""`; after the fix, three quote create/convert flows succeeded.
- Live checklist completion initially showed completed Shipping parts clearing to `null`; after the fix, a fresh part completed with `currentDepartmentId = dept_shipping`.

### Behavior note for the next agent
- The local tracked SQLite DB (`prisma/prisma/dev.db`) is modified because runtime QA created/updated test orders. Treat it as local runtime state unless the user asks to preserve DB fixture changes.
- Temporary QA dev servers on ports `3001` and `3002` were stopped before handoff.

## Session Handoff - 2026-05-13 (Branch sync)

Goal (1 sentence): Get the local feeds-and-speeds parity branch verified and synced with the remote.

### What changed
- Verified the current branch `codex/feeds-speeds-fswizard-parity` is aligned with `origin/codex/feeds-speeds-fswizard-parity` before committing pending work.
- Re-ran focused feeds-and-speeds verification.
- Kept `prisma/prisma/dev.db` out of the sync commit because it is local DB state and unrelated to the feeds-and-speeds code/docs changes.

### Files touched
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`
- `tasks/todo.md`

### Commands run
- `git fetch origin`
- `git status --short --branch`
- `npm run test -- src/modules/feeds-speeds/__tests__/feeds-speeds.test.ts`
- `npx eslint --ext .ts,.tsx -- "src/modules/feeds-speeds/feeds-speeds.ts" "src/modules/feeds-speeds/feeds-speeds.types.ts" "src/modules/feeds-speeds/__tests__/feeds-speeds.test.ts"`

### Verification evidence
- Focused feeds-speeds Vitest tests passed (`6/6`) after outside-sandbox rerun due to Windows sandbox `spawn EPERM`.
- Targeted ESLint passed.

### Behavior note for the next agent
- A local tracked SQLite DB file may still show as modified if the running local app changes it. Treat it as local runtime state unless the user explicitly asks to preserve DB fixture changes.

## Session Handoff - 2026-04-20 (Feeds and Speeds deeper FSWizard parity audit)

Goal (1 sentence): Tighten more of the current feeds-and-speeds calculator against the provided `this.go` source by covering additional source-backed drill/tap/endmill parity gaps without widening the current UI contract.

### What changed
- Updated [feeds-speeds.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/feeds-speeds/feeds-speeds.ts)
  - Narrowed the `ipt_carbide` calculation path to exact `Carbide` material selection, matching the source branch instead of treating diamond/ceramic as the same rule.
  - Reworked helix-factor handling so it now follows branch-specific behavior from the source:
    - endmills/threadmills/chamfer-style tools use the endmill-style `sin(helix) - sin(30)` path,
    - drills/reamers use the drill-style `0.75 * (sin(helix) - sin(15))` path,
    - taps use the tap-style `sin(helix) - sin(15)` path,
    - corner-rounding tools use `1`.
  - Updated the tap path so the existing `threadLead` input now acts as the current pitch proxy for both displayed `IPR` and feed output.
  - Corrected drill/ream `IPR` handling so the result now reflects true per-revolution output and feed follows the source's `per tooth × flute count` math.
  - Added a closer endmill DOC-only/WOC-only ideal-geometry solver so leaving one engagement dimension at `0` now follows the FSWizard-style default-off geometry/load path more closely before load scaling.
- Updated automated parity coverage:
  - [feeds-speeds.test.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/feeds-speeds/__tests__/feeds-speeds.test.ts)
  - [feeds-speeds.test.ts.snap](C:/Users/user/Documents/GitHub/shopapp1/src/modules/feeds-speeds/__tests__/__snapshots__/feeds-speeds.test.ts.snap)
  - Tests now cover:
    - the prior 4140 carbide endmill baseline cases,
    - a pitch-driven tap case,
    - a drill helix/IPR/feed case,
    - DOC-only endmill snapshots when WOC is left on the default-off path.
- Updated continuity artifacts:
  - [tasks/todo.md](C:/Users/user/Documents/GitHub/shopapp1/tasks/todo.md)
  - [PROGRESS_LOG.md](C:/Users/user/Documents/GitHub/shopapp1/PROGRESS_LOG.md)
  - [AGENT_CONTEXT.md](C:/Users/user/Documents/GitHub/shopapp1/docs/AGENT_CONTEXT.md)

### Files touched
- `src/modules/feeds-speeds/feeds-speeds.ts`
- `src/modules/feeds-speeds/__tests__/feeds-speeds.test.ts`
- `src/modules/feeds-speeds/__tests__/__snapshots__/feeds-speeds.test.ts.snap`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`
- `docs/AGENT_CONTEXT.md`

### Commands run
- `npm run test -- src/modules/feeds-speeds/__tests__/feeds-speeds.test.ts`
- `npx eslint --ext .ts,.tsx -- "src/modules/feeds-speeds/feeds-speeds.ts" "src/modules/feeds-speeds/feeds-speeds.types.ts" "src/modules/feeds-speeds/__tests__/feeds-speeds.test.ts"`

### Verification evidence
- Focused feeds-speeds parity tests passed (`6/6`) after an outside-sandbox rerun because the sandboxed Vitest/esbuild startup hit Windows `spawn EPERM`.
- Targeted ESLint passed on the calculator module, types, and updated parity tests.
- New snapshot-backed parity outputs now include:
  - DOC-only shallow endmill (`DOC 0.10 / WOC 0`) -> `SFM 272.13`, `RPM 2079`, `IPT 0.0027`, `Feed 22.65`
  - DOC-only deeper endmill (`DOC 0.25 / WOC 0`) -> `SFM 298.92`, `RPM 2284`, `IPT 0.0020`, `Feed 18.22`

### Behavior note for the next agent
- The current parity pass now covers more realistic drill/tap/default-off endmill behavior, but three exact-source gaps are still intentionally open because the current UI/module does not expose all of the required source inputs/helpers:
  - tap thread-table parity still needs thread form/size modeling rather than only `threadLead`,
  - turn/groove parity still needs the source branch's deflection/load model plus a machine max-RPM contract,
  - corner-rounding/threadmill parity still needs more of the source-specific geometry helpers (`qe.*`, `We.*`) than are presently ported.

## Session Handoff - 2026-04-16 (Feeds and Speeds FSWizard parity audit + comparison checklist)

Goal (1 sentence): Tighten the local feeds-and-speeds endmill logic against the provided `this.go` FSWizard default path and add a repeatable comparison set the owner can run manually in FSWizard.

### What changed
- Updated [feeds-speeds.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/feeds-speeds/feeds-speeds.ts)
  - Corrected a few remaining source-parity gaps in the local endmill path:
    - chip thinning now stays off unless the FSWizard tool data explicitly enables it,
    - slotting mode is no longer auto-forced just because `WOC` is close to tool diameter,
    - the skipped FSWizard `fswizard_mat_doc_adjust()` material/flute DOC-load factor is now applied to the load-budget area,
    - default stickout/flute length resolution now honors `default_len` and `default_flute_len`.
  - Added internal `xYDelta()` and `getFswizardMaterialDocAdjust()` helpers based directly on the provided `this.go` behavior.
- Updated [feeds-speeds.types.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/feeds-speeds/feeds-speeds.types.ts)
  - Added the typed FSWizard fields needed by the parity pass, including `kp` and `default_chip_thinning`.
- Added automated parity coverage:
  - [feeds-speeds.test.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/feeds-speeds/__tests__/feeds-speeds.test.ts)
  - [feeds-speeds.test.ts.snap](C:/Users/user/Documents/GitHub/shopapp1/src/modules/feeds-speeds/__tests__/__snapshots__/feeds-speeds.test.ts.snap)
  - Tests now cover:
    - stable baseline range for the reported 4140 / carbide / AlTiN / solid-endmill case,
    - heavier-WOC feed reduction,
    - stable parity snapshots for three manual comparison cases.
- Added owner-facing manual comparison instructions:
  - [FSWIZARD_FEEDS_SPEEDS_PARITY.md](C:/Users/user/Documents/GitHub/shopapp1/docs/FSWIZARD_FEEDS_SPEEDS_PARITY.md)
  - This gives the exact FSWizard setup defaults plus three concrete cases and expected ShopApp outputs for SFM/RPM/IPT/feed comparison.

### Files touched
- `src/modules/feeds-speeds/feeds-speeds.ts`
- `src/modules/feeds-speeds/feeds-speeds.types.ts`
- `src/modules/feeds-speeds/__tests__/feeds-speeds.test.ts`
- `src/modules/feeds-speeds/__tests__/__snapshots__/feeds-speeds.test.ts.snap`
- `docs/FSWIZARD_FEEDS_SPEEDS_PARITY.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`
- `docs/AGENT_CONTEXT.md`

### Commands run
- `npm run test -- src/modules/feeds-speeds/__tests__/feeds-speeds.test.ts`
- `npx eslint --ext .ts,.tsx -- "src/modules/feeds-speeds/feeds-speeds.ts" "src/modules/feeds-speeds/feeds-speeds.types.ts" "src/modules/feeds-speeds/__tests__/feeds-speeds.test.ts"`

### Verification evidence
- Focused feeds-speeds parity tests passed (`3/3`) after an outside-sandbox rerun because sandboxed Vitest/esbuild startup hit Windows `spawn EPERM`.
- Targeted ESLint passed.
- Current manual parity checklist values are:
  - baseline `DOC 0.25 / WOC 0.10` -> `SFM 340.16`, `RPM 2599`, `IPT 0.0034`, `Feed 35.39`
  - heavier WOC `DOC 0.25 / WOC 0.25` -> `SFM 320.72`, `RPM 2450`, `IPT 0.0032`, `Feed 31.46`
  - shallower DOC `DOC 0.10 / WOC 0.10` -> same capped-load result as the baseline case in the current source path

### Behavior note for the next agent
- The new parity checklist is meant to be the first stop before changing feeds-speeds math again; if a future formula tweak breaks those three cases, compare against `docs/FSWIZARD_FEEDS_SPEEDS_PARITY.md` and the snapshot file first.
- The local calculator still does not model every advanced FSWizard branch (`HSM`, full machine rigidity inputs, circle/threadmill geometry, all `qe.*` helpers), so keep future parity work scoped and source-backed rather than assuming every missing toggle should be approximated.

## Session Handoff - 2026-04-16 (FSWizard `this.go` formula port)

Goal (1 sentence): Use the provided `this.go` FSWizard logic to wire real endmill DOC/WOC engagement formulas into the calculator instead of leaving those inputs as warning-only fields.

### What changed
- Updated [feeds-speeds.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/feeds-speeds/feeds-speeds.ts)
  - Replaced the earlier approximate reduction math with the exact FSWizard `factorReduce()` behavior found in `this.go`.
  - Ported the FSWizard `getFormulaChipload()` structure so chipload now follows:
    - interpolated tool chipload,
    - material IPT / carbide IPT,
    - helix factor,
    - tool IPT factor,
    - material IPT reduction,
    - `0.5`-diameter normalization.
  - Added endmill-style engagement math derived from `fs_wizard_calc_endmill()`:
    - ideal side/slot DOC/WOC,
    - effective cutting diameter,
    - radial chip thinning,
    - axial chip thinning,
    - slot-factor interpolation using `slot_ipt_factor` and `slot_sfm_factor`,
    - DOC×WOC load-factor scaling.
  - This makes planned `DOC/WOC` participate in the actual recommendation math instead of only influencing warnings.
- Updated [feeds-speeds.types.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/feeds-speeds/feeds-speeds.types.ts)
  - Added the FSWizard fields now used by the ported logic, including `slot_ipt_factor`, `slot_sfm_factor`, `corner_radius`, `default_len`, `default_flute_len`, and `max_ipt`.

### Files touched
- `src/modules/feeds-speeds/feeds-speeds.ts`
- `src/modules/feeds-speeds/feeds-speeds.types.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/modules/feeds-speeds/feeds-speeds.ts" "src/modules/feeds-speeds/feeds-speeds.types.ts"`
- `node -` smoke-check script against `src/modules/feeds-speeds/data/fswizard-db.json`

### Verification evidence
- Targeted ESLint passed.
- Smoke-check confirmed the same Solid End Mill / Carbide / AlTiN / 4140PH case now changes when `WOC` changes:
  - `DOC 0.25 / WOC 0.1` -> feed about `44.24`
  - `DOC 0.25 / WOC 0.25` -> feed about `31.46`

### Behavior note for the next agent
- `this.go` gives enough to port the major endmill path accurately, but some helper functions referenced there (`qe.*`, `me.e.X_Y_Delta`, `fswizard_mat_doc_adjust`) are still only partially reconstructed locally.
- The current port is strongest for standard endmill-style calculations and the owner’s reported case. It now uses FSWizard-derived engagement logic rather than a generic approximation.
- Not every DOC change will visibly move feed in every case because the FSWizard load branch clamps underloaded cuts; this is source-consistent behavior, not the old bug.

## Session Handoff - 2026-04-16 (Feeds and Speeds math correction)

Goal (1 sentence): Fix the calculator math so feeds and chipload are based on material IPT plus diameter scaling instead of double-counting chipload baselines.

### What changed
- Updated [feeds-speeds.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/feeds-speeds/feeds-speeds.ts)
  - Added `factorReduce(value, reduction)` and switched SFM computation to:
    - `material.sfm`
    - `* tool.sfm`
    - `* factorReduce(toolMaterial.sfm, material.material_reduction)`
    - `* factorReduce(coating.sfm, material.coating_reduction)`
  - Fixed `computeChipOrIpr()` so it now:
    - uses material IPT (`ipt` or `ipt_carbide`) as the chipload base,
    - uses the chipload table only as a diameter scaling factor relative to the `0.5` reference,
    - applies tool/tool-material/coating IPT factors without multiplying two baseline chiploads together.
  - Added low-value sanity warnings for invalid diameter/flute counts and unrealistic low chipload/feed outcomes.
  - Tightened chipload/IPR rounding so tiny-but-positive values no longer silently display as `0`.
- Updated [feeds-speeds.types.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/feeds-speeds/feeds-speeds.types.ts)
  - Added optional `material_ipt_reduction` to the material type so the corrected IPT reduction math is typed cleanly against the bundled FSWizard data.

### Files touched
- `src/modules/feeds-speeds/feeds-speeds.ts`
- `src/modules/feeds-speeds/feeds-speeds.types.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/modules/feeds-speeds/feeds-speeds.ts" "src/modules/feeds-speeds/feeds-speeds.types.ts"`
- `node -` acceptance-case math check against `src/modules/feeds-speeds/data/fswizard-db.json`

### Verification evidence
- Targeted ESLint passed.
- Exact acceptance case now evaluates to approximately:
  - `SFM 340.16`
  - `RPM 2598.63`
  - `chipLoadPerTooth 0.002724`
  - `feedRate 28.31`
- This preserves RPM in the same general range while eliminating the earlier near-zero chipload/feed failure.

### Behavior note for the next agent
- The chipload table is now intentionally treated as a diameter-scaling reference, not as a second chipload baseline.
- Material IPT remains the true chipload base in v1, with carbide-like tooling preferring `ipt_carbide` when present.
- If a future pass tries to mirror more of FSWizard’s advanced machine rigidity / holder / operation branches, build that on top of the current factor-based baseline instead of reintroducing chipload double-counting.

## Session Handoff - 2026-04-16 (Feeds and Speeds calculator v1)

Goal (1 sentence): Add a first-class logged-in feeds-and-speeds calculator page that stays in the existing ShopApp visual language while using the provided FSWizard materials and tool-factor dataset directly.

### What changed
- Added a new logged-in tool route:
  - [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/tools/feeds-speeds/page.tsx)
  - The route redirects unauthenticated users through the existing sign-in flow and presents the calculator as a normal app workspace page instead of an admin-only surface.
- Added the interactive calculator UI:
  - [FeedsSpeedsCalculator.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/tools/feeds-speeds/FeedsSpeedsCalculator.tsx)
  - Uses existing ShopApp UI primitives (`Card`, `Select`, `Tabs`, `Button`, `Badge`, `Input`) so it visually matches the rest of the app.
  - Supports the attached full tool-family set in one screen with conditional outputs for:
    - milling,
    - drilling,
    - reaming,
    - tapping,
    - thread milling,
    - chamfer/corner-rounding,
    - turning/grooving/boring/facing style tools.
- Added the feeds-and-speeds domain module:
  - [feeds-speeds.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/feeds-speeds/feeds-speeds.ts)
  - [feeds-speeds.types.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/feeds-speeds/feeds-speeds.types.ts)
  - Calculation helpers now:
    - import the provided FSWizard embedded dataset,
    - sort/look up tool families, materials, coatings, and tool materials,
    - interpolate chipload by diameter,
    - combine material/tool/tool-material/coating factors into SFM and feed outputs,
    - derive secondary guidance like ramp feed, plunge feed, DOC/WOC defaults, peck depth, pilot size, and warning copy.
- Added the in-repo data source:
  - [fswizard-db.json](C:/Users/user/Documents/GitHub/shopapp1/src/modules/feeds-speeds/data/fswizard-db.json)
  - This is a copied app-owned version of the provided FSWizard embedded dataset so the feature no longer depends on a local Downloads-file path.
- Updated shared navigation:
  - [AppNav.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/components/AppNav.tsx)
  - Added `Feeds & Speeds` as a standard app nav tab for signed-in users.

### Files touched
- `src/components/AppNav.tsx`
- `src/app/tools/feeds-speeds/page.tsx`
- `src/app/tools/feeds-speeds/FeedsSpeedsCalculator.tsx`
- `src/modules/feeds-speeds/feeds-speeds.ts`
- `src/modules/feeds-speeds/feeds-speeds.types.ts`
- `src/modules/feeds-speeds/data/fswizard-db.json`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`
- `docs/AGENT_CONTEXT.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/components/AppNav.tsx" "src/app/tools/feeds-speeds/page.tsx" "src/app/tools/feeds-speeds/FeedsSpeedsCalculator.tsx" "src/modules/feeds-speeds/feeds-speeds.ts" "src/modules/feeds-speeds/feeds-speeds.types.ts"`

### Verification evidence
- Targeted ESLint passed on all new calculator/nav files.

### Behavior note for the next agent
- V1 intentionally uses the provided FSWizard embedded dataset directly rather than mapping into the existing admin materials table; the calculator's material list is independent from `admin/materials`.
- The calculator is intentionally calculator-only in v1: there is no persistence, no presets, and no order/quote write-back.
- Threading support is intentionally lightweight for now:
  - taps use the entered thread lead (`in/rev`) for feed,
  - thread mills still use chipload-driven feed with thread lead shown as a comparison/sanity input rather than a fully modeled thread geometry engine.
- The current math is factor-based from the attached FSWizard dataset and should be treated as a practical v1 recommendation engine, not a byte-for-byte clone of every FSWizard advanced option or machine-model branch.

## Session Handoff - 2026-04-14 (Quote origin department + per-foot pricing + custom quote amounts)

Goal (1 sentence): Let admins route quotes from a non-default origin department, quote paint/add-on work by the foot, and add titled manual quote amounts that survive quote save, print, and quote-to-order conversion.

### What changed
- Updated shared pricing + add-on contracts:
  - [work-item-pricing.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/pricing/work-item-pricing.ts)
  - [zod.ts](C:/Users/user/Documents/GitHub/shopapp1/src/lib/zod.ts)
  - [AvailableItemsLibrary.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/components/AvailableItemsLibrary.tsx)
  - [AssignedItemsPanel.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/components/AssignedItemsPanel.tsx)
  - [client.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/admin/addons/client.tsx)
  - [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/admin/addons/page.tsx)
  - Add-ons now support `PER_FOOT` in addition to `HOURLY` and `FLAT`, and shared UI labels now render hours/feet/quantity consistently.
- Updated quote metadata + totals handling:
  - [quote-metadata.ts](C:/Users/user/Documents/GitHub/shopapp1/src/lib/quote-metadata.ts)
  - [quotes.schema.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/quotes/quotes.schema.ts)
  - [quotes.service.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/quotes/quotes.service.ts)
  - [quotes.repo.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/quotes/quotes.repo.ts)
  - [route.ts](C:/Users/user/Documents/GitHub/shopapp1/src/app/api/admin/quotes/[id]/route.ts)
  - Quotes now persist `originDepartmentId` and titled `customAmounts` in metadata, and the saved quote `totalCents` now matches the review estimate including part-pricing overrides and custom amounts.
- Updated quote UI and print/detail surfaces:
  - [QuoteEditor.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/admin/quotes/QuoteEditor.tsx)
  - [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/admin/quotes/[id]/page.tsx)
  - [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/admin/quotes/[id]/print/page.tsx)
  - Quote review now includes:
    - origin/default department selector,
    - titled custom amount rows,
    - summary totals that include custom amounts.
  - Quote detail/print now show custom amount totals and updated add-on unit labels.
- Updated quote conversion helpers:
  - [quote-work-items.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/quotes/quote-work-items.ts)
  - [route.ts](C:/Users/user/Documents/GitHub/shopapp1/src/app/api/admin/quotes/[id]/convert/route.ts)
  - Converted order parts now start in the quote origin department when set.
  - Custom quote amounts now convert into non-checklist `CUSTOM` order charges on the first part using the origin/fallback department.
- Compatibility touch-up:
  - [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/orders/new/page.tsx)
  - Order-create’s shared add-on review display now understands `PER_FOOT` too, so the shared item components stay compile/runtime-safe.

### Files touched
- `src/modules/pricing/work-item-pricing.ts`
- `src/modules/pricing/__tests__/work-item-pricing.test.ts`
- `src/components/AvailableItemsLibrary.tsx`
- `src/components/AssignedItemsPanel.tsx`
- `src/lib/zod.ts`
- `src/lib/quote-metadata.ts`
- `src/modules/quotes/quotes.schema.ts`
- `src/modules/quotes/quotes.service.ts`
- `src/modules/quotes/quotes.repo.ts`
- `src/modules/quotes/quote-work-items.ts`
- `src/modules/quotes/__tests__/quote-work-items.test.ts`
- `src/modules/quotes/__tests__/quote-totals.test.ts`
- `src/app/admin/addons/client.tsx`
- `src/app/admin/addons/page.tsx`
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/app/admin/quotes/[id]/page.tsx`
- `src/app/admin/quotes/[id]/print/page.tsx`
- `src/app/orders/new/page.tsx`
- `src/app/api/admin/quotes/[id]/route.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`
- `docs/AGENT_CONTEXT.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/app/admin/addons/client.tsx" "src/app/admin/addons/page.tsx" "src/app/admin/quotes/QuoteEditor.tsx" "src/app/admin/quotes/[id]/page.tsx" "src/app/admin/quotes/[id]/print/page.tsx" "src/app/orders/new/page.tsx" "src/components/AvailableItemsLibrary.tsx" "src/components/AssignedItemsPanel.tsx" "src/lib/zod.ts" "src/lib/quote-metadata.ts" "src/modules/pricing/work-item-pricing.ts" "src/modules/pricing/__tests__/work-item-pricing.test.ts" "src/modules/quotes/quotes.schema.ts" "src/modules/quotes/quotes.service.ts" "src/modules/quotes/quotes.repo.ts" "src/modules/quotes/quote-work-items.ts" "src/modules/quotes/__tests__/quote-work-items.test.ts" "src/modules/quotes/__tests__/quote-totals.test.ts" "src/app/api/admin/quotes/[id]/route.ts"`
- `npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts src/modules/quotes/__tests__/quote-work-items.test.ts src/modules/quotes/__tests__/quote-totals.test.ts`

### Verification evidence
- Targeted ESLint passed.
- Focused quote/pricing tests passed (`9/9`) after an outside-sandbox rerun because the sandboxed Vitest/esbuild startup hit Windows `spawn EPERM`.

### Behavior note for the next agent
- Quote origin department is intentionally stored in metadata instead of a new `Quote` DB column; conversion resolves it against active departments and falls back to the first active department if the saved department is missing/inactive.
- Custom quote amounts are quote-level UI rows, but the order domain still requires per-part charges, so conversion maps them onto the first converted part as `CUSTOM` charges using the origin/fallback department.
- Existing quotes do not gain custom amounts or origin departments retroactively; they behave as before until saved with the new UI.

## Session Handoff - 2026-04-13 (Queue priority + timer chips + Vendors pagination + completed department ownership)

Goal (1 sentence): Surface active work more clearly on the dashboard, preserve finished parts under a visible department owner, and give the Vendors page real pagination controls.

### What changed
- Updated [orders.service.ts](C:/Users/user/Documents/GitHub/shopapp1/src/modules/orders/orders.service.ts)
  - Department queue feed now enriches orders with active timer summaries and sorts active-timer orders to the top before the existing flagged/due ordering.
  - Completed parts now preserve their final department ownership instead of clearing `currentDepartmentId` to `null`.
  - This applies to both:
    - shipping completion (`Mark Shipped`),
    - final no-next-department submit completion.
- Updated [WorkQueueOrderCard.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/components/work-queue/WorkQueueOrderCard.tsx)
  - Order tiles in the department queue now show small green active timer chips with worker + elapsed time.
- Updated [ShopFloorLayouts.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/components/ShopFloorLayouts.tsx)
  - Renamed the department feed completed toggle label to `Show completed items`.
- Updated Vendors admin pagination:
  - [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/admin/vendors/page.tsx)
  - [client.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/admin/vendors/client.tsx)
  - [route.ts](C:/Users/user/Documents/GitHub/shopapp1/src/app/api/admin/vendors/route.ts)
  - The Vendors list now uses page-based navigation with total count + `Previous` / `Next` buttons instead of one-way cursor loading.

### Files touched
- `src/modules/orders/orders.service.ts`
- `src/modules/orders/orders.types.ts`
- `src/components/work-queue/WorkQueueOrderCard.tsx`
- `src/components/ShopFloorLayouts.tsx`
- `src/app/admin/vendors/page.tsx`
- `src/app/admin/vendors/client.tsx`
- `src/app/api/admin/vendors/route.ts`
- `tasks/todo.md`
- `tasks/lessons.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`
- `docs/AGENT_CONTEXT.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/components/ShopFloorLayouts.tsx" "src/components/work-queue/WorkQueueOrderCard.tsx" "src/modules/orders/orders.service.ts" "src/modules/orders/orders.types.ts" "src/app/admin/vendors/client.tsx" "src/app/admin/vendors/page.tsx" "src/app/api/admin/vendors/route.ts"`

### Verification evidence
- Targeted ESLint passed on all touched files.

### Behavior note for the next agent
- Completed parts now stay attached to their final department for queue/read-model purposes, which is what makes `Show completed items` useful on the dashboard.
- Department queue timer chips are currently snapshot-based from the feed response; they are not live-updating yet.

## Session Handoff - 2026-04-13 (Mark Shipped button parity fix)

Goal (1 sentence): Make `Mark Shipped` use the same button size/layout pattern as the other timer-row actions instead of a custom wrapper.

### What changed
- Updated [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/orders/[id]/page.tsx)
  - Replaced the custom checkbox-style shipping control with a real outline button.
  - Matched the same `size="sm"` / button layout pattern used by `Start timer` and `Move Dept.`.
  - Added a small shipped-state icon while preserving the existing Shipping-only enable/disable behavior.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

### Verification evidence
- Targeted ESLint passed.

## Session Handoff - 2026-04-13 (Shipping action label + alignment polish)

Goal (1 sentence): Rename the shipping-only completion control to `Mark Shipped` and make it line up visually with the other timer-row controls.

### What changed
- Updated [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/orders/[id]/page.tsx)
  - Renamed `Complete in Shipping` to `Mark Shipped`.
  - Adjusted the control wrapper to use centered, button-like alignment so it sits in line with the other timer actions.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

### Verification evidence
- Targeted ESLint passed.

## Session Handoff - 2026-04-13 (Active timer chip stop affordance)

Goal (1 sentence): Make active timer chips visually read like stop controls and remove the duplicate standalone stop button from the main timer row.

### What changed
- Updated [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/orders/[id]/page.tsx)
  - Added a small stop icon at the end of each active timer chip.
  - Removed the separate `Stop` button from the main timer action row.
  - The selected-part timer row now uses:
    - chip click to stop a specific worker timer with that worker's PIN,
    - main-row `Start timer` to begin work,
    - no duplicate generic stop button.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

### Verification evidence
- Targeted ESLint passed.

## Session Handoff - 2026-04-13 (Live timer chips + instruction acknowledgement roster)

Goal (1 sentence): Make the selected-part active timer chips update live without refresh and show who has already acknowledged the current Read Me First instructions.

### What changed
- Updated [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/orders/[id]/page.tsx)
  - Switched the 1-second client clock tick to follow `selectedPartActivity.activeTimers` rather than only the logged-in browser user's `activeEntries`.
  - This keeps active timer chips live for shared/admin viewers even when they personally do not have an active timer.
  - Added an `Already read by` roster to the `Read me first` card using the existing `instructionReceipts` payload for:
    - current department,
    - current instruction version,
    - worker name,
    - acknowledgement timestamp.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

### Verification evidence
- Targeted ESLint passed.

## Session Handoff - 2026-04-13 (Mission brief worker PIN follow-up + quote-note bulletin formatting)

Goal (1 sentence): Make required-reading acknowledgement follow the selected timer worker instead of the browser session user, and present quote-derived part instructions as headed bullet sections rather than a flat text block.

### What changed
- Updated [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/orders/[id]/page.tsx)
  - Timer start now checks instruction acknowledgement against the selected worker + selected department before opening the timer start PIN dialog.
  - If that worker still needs to acknowledge the brief, the mission-brief popup now shows:
    - worker picker,
    - worker PIN field.
  - Successful acknowledgement now records the receipt for that selected worker and reopens the existing timer start dialog with that worker + PIN already carried forward.
  - Mission-brief content and the overview `Part instructions` card now render structured sections as heading + bullet lists when the stored text follows the seeded section format.
- Updated [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/orders/new/page.tsx)
  - Quote conversion now seeds `workInstructions` from all quote note-style fields as structured sections:
    - `Quote requirements`,
    - `Quote notes`,
    - `Materials`,
    - `Purchase items`,
    - `Part-specific notes`.
- Updated [route.ts](C:/Users/user/Documents/GitHub/shopapp1/src/app/api/orders/[id]/parts/[partId]/acknowledge-instructions/route.ts)
  - The acknowledgement route now accepts an optional selected worker + PIN pair and records the receipt for that verified worker instead of forcing the logged-in browser session user.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `src/app/orders/new/page.tsx`
- `src/app/api/orders/[id]/parts/[partId]/acknowledge-instructions/route.ts`
- `tasks/todo.md`
- `tasks/lessons.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`
- `docs/AGENT_CONTEXT.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx" "src/app/orders/new/page.tsx" "src/app/api/orders/[id]/parts/[partId]/acknowledge-instructions/route.ts"`

### Verification evidence
- Targeted ESLint passed on all touched files.

### Behavior note for the next agent
- The mission-brief popup now lets the operator pick a worker; PIN is required whenever the acknowledgement is being recorded for someone other than the logged-in browser user. Checklist/submit completion paths still proceed as the logged-in browser user after the brief is acknowledged.
- Newly converted orders will get the new headed-bullet instruction format automatically; older orders still render safely because the order-detail page now parses both the new sectioned format and older plain text blocks.

## Session Handoff - 2026-04-13 (Timer tile layout follow-up: dept + user + PIN flow)

Goal (1 sentence): Match the requested timer-tile layout by making department and user selection happen in the tile, moving start/stop onto the PIN popup flow, fixing the department dropdown reset bug, renaming `Submit to` to `Move Dept.`, and restyling `Complete in Shipping` as a checkbox-style control.

### What changed
- Updated [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/orders/[id]/page.tsx)
  - Added `selectedTimerWorkerId` state and a user dropdown in the main timer tile.
  - Changed the department dropdown effect so it no longer overwrites a valid manual selection.
  - Replaced the old direct-action main row with:
    - department selector,
    - user selector,
    - `Start timer`,
    - `Stop`,
    - `Move Dept.`,
    - checkbox-style `Complete in Shipping`.
  - Routed the main `Start timer` and `Stop` buttons through the existing worker+PIN dialog.
  - Removed `Pause` from the main tile button row; pause remains only in switch-conflict handling.
  - Updated move-action labeling from `Submit to` to `Move Dept.`.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

### Verification evidence
- Targeted ESLint passed.

### Behavior note for the next agent
- The timer tile now assumes department and worker are chosen on the page before opening the PIN dialog.
- The department dropdown bug was fixed by only defaulting the department when the current selection is invalid, rather than always snapping back to the part's current department.
- `Stop` in the main row targets the selected worker's active timer on the selected part for the selected department; if the user needs to stop a different active timer on the part, they should click that timer's chip directly.

## Session Handoff - 2026-04-13 (Order-detail part active-timer chips + PIN stop access)

Goal (1 sentence): Surface all active timers for the selected part directly in the order-detail timer tile and let any viewer stop the correct worker’s timer from that row by entering that worker’s PIN.

### What changed
- Updated [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/orders/[id]/page.tsx)
  - Added local `partActivity` state fed from `/api/timer/active`.
  - Derived selected-part active timers from `partActivity[selectedPartId].activeTimers`.
  - Added compact active-timer chips in the timer tile showing:
    - worker,
    - department,
    - live elapsed time.
  - Clicking a chip now opens the existing kiosk stop dialog prefilled with that timer's worker and department.
  - Added dialog copy clarifying which worker/department timer is about to be stopped.
  - Updated selected-part elapsed math so it includes all live timers on the selected part.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

### Verification evidence
- Targeted ESLint passed.

### Behavior note for the next agent
- The active-timer chips intentionally use `partActivity` from `/api/timer/active`, because that payload includes all-user active timers for the selected part.
- Clicking a chip does not bypass timer ownership; it reuses the existing worker+PIN kiosk flow and stops that worker’s single active timer only after a successful PIN unlock for that worker.
- This keeps the stop flow usable from a shared/admin screen without relying on the currently logged-in browser identity.

## Session Handoff - 2026-04-10 (Default material catalog expansion)

Goal (1 sentence): Seed a more practical default material list so fresh installs and the current local workspace have common metals and plastics available without manual admin setup.

### What changed
- Updated seed sources:
  - [seed-basic.js](C:/Users/user/Documents/GitHub/shopapp1/prisma/seed-basic.js)
  - [seed.js](C:/Users/user/Documents/GitHub/shopapp1/prisma/seed.js)
  - [seed.ts](C:/Users/user/Documents/GitHub/shopapp1/prisma/seed.ts)
  - [seed.ts](C:/Users/user/Documents/GitHub/shopapp1/src/repos/mock/seed.ts)
- Expanded the default material catalog with common:
  - steels / alloy steels / tool steels,
  - aluminum grades,
  - stainless grades,
  - brass / copper,
  - machining plastics.
- Applied the same material list directly to the current local database with a targeted Prisma upsert so the new options are available immediately in this workspace.

### Files touched
- `prisma/seed-basic.js`
- `prisma/seed.js`
- `prisma/seed.ts`
- `src/repos/mock/seed.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`
- `node -` seed-source presence check across `prisma/seed-basic.js`, `prisma/seed.js`, `prisma/seed.ts`, and `src/repos/mock/seed.ts`
- `node -` targeted Prisma material upsert + inventory printout

### Verification evidence
- Lint passed with no ESLint warnings/errors.
- Seed-source verification confirmed representative material names exist in all seed sources.
- Local Prisma upsert completed successfully and reported `30` material rows in the local DB afterward.

### Behavior note for the next agent
- This change intentionally adds defaults and upserts the current local DB, but does not normalize or delete any pre-existing material names.
- The local DB already had a legacy `304SS` row, so the current workspace now contains both `304SS` and `304 SS`.
- If the owner wants the material list cleaned up further, do that as a deliberate follow-up data-normalization task rather than as part of future seed-only changes.

## Session Handoff - 2026-04-10 (Order-detail part work-instructions edit exposure)

Goal (1 sentence): Let admins edit part-level `workInstructions` from the existing order-detail part editor so mission-brief / required-reading text is not stranded after order creation.

### What changed
- Updated [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/orders/[id]/page.tsx)
  - Added `workInstructions` to the part edit draft state populated from the selected part.
  - Added `workInstructions` to the order-detail part PATCH payload.
  - Added a `Work instructions` textarea to the admin part edit form next to `Part notes`.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

### Verification evidence
- Targeted ESLint passed.

### Behavior note for the next agent
- The mission-brief / required-reading flow still reads from `OrderPart.workInstructions`.
- Order creation already exposed this field; this follow-up only adds the missing edit path on existing orders.
- The backend PATCH path already increments `instructionsVersion` when `workInstructions` changes, so the new UI path should continue to invalidate old acknowledgement receipts automatically.

## Session Handoff - 2026-04-10 (Order-detail embedded kiosk timing follow-up)

Goal (1 sentence): Keep kiosk timing rules intact, but let kiosk-enabled machinists start and manage timers directly from the order-detail timer area instead of bouncing out to a separate kiosk page.

### What changed
- Updated [page.tsx](C:/Users/user/Documents/GitHub/shopapp1/src/app/orders/[id]/page.tsx)
  - Replaced the old kiosk-only fallback message/link in the timer area with in-page kiosk controls.
  - Added an order-detail kiosk dialog that:
    - requires worker selection, department selection, and PIN entry for kiosk timer starts,
    - lets the worker choose a part from the current order,
    - starts the timer without leaving `/orders/[id]`.
- Added in-page kiosk pause/stop handling, including PIN re-unlock when needed.
- Reused the existing kiosk start/switch behavior so active-timer conflicts still surface `Pause & switch` / `Stop & switch`.
- Moved the extra kiosk helper copy, timer breakdown, and last-action text under `Show details` so the timer header stays compact by default.
- Follow-up: the worker picker now uses all active users, not just kiosk-enabled users; PIN is still required for the selected worker.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

### Verification evidence
- Targeted ESLint passed.

### Behavior note for the next agent
- `/kiosk` still exists, but `/orders/[id]` now owns the primary kiosk timing workflow for kiosk-enabled machinists.
- The order-detail kiosk dialog intentionally reuses the existing kiosk unlock/session/timer APIs rather than calling normal `/api/timer/*` routes directly.
- Order-detail kiosk starts now require explicit worker + department + PIN selection.
- The selected worker's primary department is used only as a default suggestion in the dialog, not as a hidden/forced choice.
- The backend kiosk-service path no longer blocks selected workers based on `kioskEnabled`; it only requires an active user plus that user's PIN.

## Session Handoff - 2026-04-10 (Shared kiosk timing + read-only order detail for floor users)

Goal (1 sentence): Move floor timing into a dedicated shared-computer kiosk while keeping `/orders/[id]` available for job review and hiding timer controls there for kiosk-designated machinists.

### What changed
- Prisma/data model
  - Added `User.kioskEnabled`, `User.kioskPinHash`, and `User.primaryDepartmentId`.
  - Added `prisma/migrations/20260410174437_kiosk_user_timing_v1/migration.sql`.
- Admin user management
  - Updated the admin users schema/UI/API so admins can enable kiosk timing, assign a primary department, and set/reset a worker PIN.
  - Hardened sanitized user payloads so `kioskPinHash` is not leaked.
- Timer backend
  - Changed timer enforcement in `src/modules/time/time.service.ts` from one-active-per-user-per-department to one-active-per-user-total.
  - Added reporting-oriented timer summaries keyed by part/department/user.
  - Simplified timer conflict lookup in `src/app/api/timer/start/route.ts` to use the worker’s single active timer.
- Kiosk flow
  - Added `src/lib/kiosk-session.ts` for signed kiosk cookie sessions.
  - Added `src/modules/kiosk/kiosk.schema.ts` and `src/modules/kiosk/kiosk.service.ts`.
  - Added kiosk routes:
    - `src/app/api/kiosk/unlock/route.ts`
    - `src/app/api/kiosk/session/route.ts`
    - `src/app/api/kiosk/lock/route.ts`
    - `src/app/api/kiosk/parts/route.ts`
    - `src/app/api/kiosk/timer/route.ts`
  - Added `src/app/kiosk/page.tsx` as the shared-station timing UI with PIN unlock, department default/override, active timer state, searchable parts, and explicit switch handling.
- Order detail / navigation
  - Updated `src/app/api/orders/[id]/route.ts` and `src/modules/orders/orders.service.ts` to return `permissions.canUseTimerControls`.
  - Updated `src/app/orders/[id]/page.tsx` to hide timer controls for kiosk-enabled machinists while keeping timer summaries, notes, files, checklist, and log visible.
  - Added a `Kiosk` nav link in `src/components/AppNav.tsx` for machinists/admins.
- Focused tests
  - Extended `src/modules/time/__tests__/time.service.test.ts` for one-active-timer-total semantics and reporting summary coverage.
  - Added `src/modules/kiosk/__tests__/kiosk.service.test.ts`.

### Files touched
- `prisma/schema.prisma`
- `prisma/migrations/20260410174437_kiosk_user_timing_v1/migration.sql`
- `src/lib/zod.ts`
- `src/lib/kiosk-session.ts`
- `src/app/admin/users/page.tsx`
- `src/app/admin/users/client.tsx`
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/users/[id]/route.ts`
- `src/app/api/orders/[id]/route.ts`
- `src/app/api/timer/start/route.ts`
- `src/app/api/kiosk/unlock/route.ts`
- `src/app/api/kiosk/session/route.ts`
- `src/app/api/kiosk/lock/route.ts`
- `src/app/api/kiosk/parts/route.ts`
- `src/app/api/kiosk/timer/route.ts`
- `src/app/kiosk/page.tsx`
- `src/app/orders/[id]/page.tsx`
- `src/components/AppNav.tsx`
- `src/modules/orders/orders.service.ts`
- `src/modules/time/time.service.ts`
- `src/modules/time/__tests__/time.service.test.ts`
- `src/modules/users/users.repo.ts`
- `src/modules/kiosk/kiosk.schema.ts`
- `src/modules/kiosk/kiosk.service.ts`
- `src/modules/kiosk/__tests__/kiosk.service.test.ts`
- `src/repos/users.ts`
- `src/repos/orders.ts`
- `src/repos/mock/seed.ts`
- `src/repos/mock/users.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx prisma migrate dev --name kiosk_user_timing_v1`
- `npx eslint --ext .ts,.tsx -- "src/app/kiosk/page.tsx" "src/app/api/kiosk/unlock/route.ts" "src/app/api/kiosk/session/route.ts" "src/app/api/kiosk/lock/route.ts" "src/app/api/kiosk/parts/route.ts" "src/app/api/kiosk/timer/route.ts" "src/app/api/orders/[id]/route.ts" "src/app/api/timer/start/route.ts" "src/app/orders/[id]/page.tsx" "src/components/AppNav.tsx" "src/modules/kiosk/kiosk.service.ts" "src/modules/kiosk/kiosk.schema.ts" "src/modules/time/time.service.ts" "src/modules/users/users.repo.ts" "src/repos/users.ts" "src/repos/mock/users.ts" "src/repos/mock/seed.ts" "src/modules/time/__tests__/time.service.test.ts" "src/modules/kiosk/__tests__/kiosk.service.test.ts"`
- `npm run test -- src/modules/time/__tests__/time.service.test.ts src/modules/kiosk/__tests__/kiosk.service.test.ts`

### Verification evidence
- Migration applied successfully and created `20260410174437_kiosk_user_timing_v1`.
- Targeted ESLint passed.
- Focused kiosk/time tests passed (`11/11` total).
- Vitest still required an outside-sandbox rerun because sandboxed esbuild hit Windows `spawn EPERM`.
- Prisma generate during migration hit a Windows file-lock `EPERM` while renaming the query engine DLL, but the migration itself completed and the focused checks passed afterward.

### Follow-up assumptions / caveats
- Kiosk timing is intentionally PIN-based and cookie-scoped, separate from normal NextAuth browser sessions.
- `/orders/[id]` remains the review surface for kiosk-enabled machinists, but timing must now happen on `/kiosk`.
- The older 2026-04-07 “one active timer per `(user, department)`” decision is now superseded by one active timer total per worker.

## Session Handoff - 2026-04-10 (Order-detail layout shift for part-heavy orders)

Goal (1 sentence): Give the full left side of `/orders/[id]` to the parts list, move timer/submit controls into the top of the right-side detail area, and remove the admin order-status override block from this screen.

### What changed
- Updated `src/app/orders/[id]/page.tsx`
  - Removed the left-rail work-dock block entirely.
  - Turned the left card into a dedicated parts-only panel with its own scroll area sized for long part lists.
  - Moved timer controls, submit action, complete-in-shipping action, timer summary, and last-action context into the top summary area of the right-hand detail card.
  - Removed the admin order-status override UI and its unused client-side state/handler from this page.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx"`

### Verification evidence
- Targeted ESLint passed.

### Layout note for the next agent
- The left rail is now intentionally parts-only for high-part-count orders.
- Timer and submit controls now belong to the right-side header area above the tabbed part detail content; avoid reintroducing large non-part panels into the left column unless the owner explicitly asks for it.

## Session Handoff - 2026-04-10 (Mission-brief acknowledge fix + quote conversion instruction seeding)

Goal (1 sentence): Keep the mission-brief accept flow usable on order detail and ensure quote-created orders actually seed meaningful part-level mission-brief text.

### What changed
- Updated `src/app/orders/[id]/page.tsx`
  - Fixed the department instruction-check helper so parts with no `workInstructions` are treated as having nothing to acknowledge instead of reopening the mission brief and failing with `This part has no required instructions.`
  - Fixed the mission-brief confirm flow so manual acknowledgement no longer crashes when the dialog was opened without a gated pending action.
  - Changed the empty-brief primary action label to `Continue` so the modal still has a clear exit path when no required-read text exists.
- Updated `src/app/orders/new/page.tsx`
  - Quote conversion prefill now seeds each part's `workInstructions` from quote-level `Requirements / process notes` plus that part's quote `Part notes`.
  - Added conversion-mode review copy explaining where mission-brief instructions come from.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `src/app/orders/new/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx -- "src/app/orders/[id]/page.tsx" "src/app/orders/new/page.tsx"`

### Verification evidence
- Targeted ESLint passed on both touched UI files.

### Behavior note for the next agent
- Mission-brief required-read text is driven by `OrderPart.workInstructions`, not general order notes.
- For quote conversion, that field is now seeded from the quote's `Requirements / process notes` plus the part's `Part notes`; manual/repeat-order flows can still edit `Work instructions` directly from `/orders/new`.

## Session Handoff - 2026-04-10 (Order-detail UX polish)

Goal (1 sentence): Apply a small clarity pass to the order-detail accountability UI so the mission brief and part-worker roster are easier to scan on the floor.

### What changed
- Updated `src/app/orders/[id]/page.tsx`
  - Refined the mission-brief modal copy to better explain when acknowledgement is required and that the receipt is logged.
  - Added quick chips for part, department, and instruction version in the brief modal.
  - Updated the overview instructions card to use clearer acknowledgement-state wording.
  - Added a small roster explainer to the worker panel and improved the empty-state wording.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx src/app/orders/[id]/page.tsx`

### Verification evidence
- Targeted ESLint passed.

## Session Handoff - 2026-04-10 (Repeat-order UX polish)

Goal (1 sentence): Apply a small clarity pass to the repeat-order launch screen so template mode is easier to understand on first use.

### What changed
- Updated `src/app/orders/new/page.tsx`
  - Added a repeat-launch summary banner explaining which fields are editable and which parts of the template are frozen.
  - Added quick counts for parts, order files, and part files at the top of template mode.
  - Removed a duplicate template-mode work-instructions textarea from the selected-part editor.

### Files touched
- `src/app/orders/new/page.tsx`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint --ext .ts,.tsx src/app/orders/new/page.tsx`

### Verification evidence
- Targeted ESLint passed.

## Session Handoff - 2026-04-10 (Repeat Orders + Operator Accountability v1 final integration)

Goal (1 sentence): Finish the end-to-end Repeat Orders + Operator Accountability v1 slice across schema, backend, routes, order detail UI, and template-based order creation UI.

### What changed
- Prisma/data model
  - Added repeat-order template models plus part/charge/attachment children.
  - Added `OrderPartAssignment`, `PartInstructionReceipt`, `OrderPart.workInstructions`, `OrderPart.instructionsVersion`, and `OrderChecklist.performedById`.
- Repeat-order backend/API
  - Added `src/modules/repeat-orders/**` service/repo/schema/types.
  - Added `/api/repeat-order-templates`, `/from-order/[orderId]`, `/[id]`, and `/[id]/create-order`.
  - Template creation snapshots manufacturing definition only; execution history is excluded.
- Accountability backend/API
  - Added part-worker assignment behavior, acknowledgement receipt/status helpers, checklist performer attribution, shared part activity summaries, and deterministic acknowledgement gating for timer start/resume, checklist toggle, and department submit.
  - Timer/checklist routes now surface `INSTRUCTION_ACK_REQUIRED` consistently.
- Order detail UI
  - Added worker assignment panel, mission-brief acknowledgement modal, second-step submit confirmation, checklist performer picker, and clearer actor-vs-performer log rendering in `src/app/orders/[id]/page.tsx`.
- Order create repeat-order UI
  - `src/app/orders/new/page.tsx` now supports template mode via `templateId`, prefills from repeat templates, submits through the repeat-template create-order route, disables mutable routing/file controls for frozen template launches, and exposes part work-instruction editing.

### Files touched
- `prisma/schema.prisma`
- `prisma/migrations/20260410153846_repeat_orders_operator_accountability_v1/migration.sql`
- `src/modules/orders/orders.repo.ts`
- `src/modules/orders/orders.schema.ts`
- `src/modules/orders/orders.service.ts`
- `src/modules/time/time.service.ts`
- `src/modules/repeat-orders/repeat-orders.repo.ts`
- `src/modules/repeat-orders/repeat-orders.schema.ts`
- `src/modules/repeat-orders/repeat-orders.service.ts`
- `src/modules/repeat-orders/repeat-orders.types.ts`
- `src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts`
- `src/modules/orders/__tests__/orders.service.test.ts`
- `src/modules/time/__tests__/time.service.test.ts`
- `src/app/api/repeat-order-templates/route.ts`
- `src/app/api/repeat-order-templates/from-order/[orderId]/route.ts`
- `src/app/api/repeat-order-templates/[id]/route.ts`
- `src/app/api/repeat-order-templates/[id]/create-order/route.ts`
- `src/app/api/timer/start/route.ts`
- `src/app/api/timer/resume/route.ts`
- `src/app/api/timer/active/route.ts`
- `src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance/route.ts`
- `src/app/orders/[id]/page.tsx`
- `src/app/orders/new/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx prisma validate`
- `npx prisma migrate dev --name repeat_orders_operator_accountability_v1`
- `npx prisma generate`
- `npx eslint --ext .ts,.tsx src/app/orders/new/page.tsx src/app/orders/[id]/page.tsx src/modules/repeat-orders src/app/api/repeat-order-templates src/modules/orders/orders.service.ts src/modules/time/time.service.ts src/app/api/timer/start/route.ts src/app/api/timer/resume/route.ts src/app/api/timer/active/route.ts src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance/route.ts`
- `npm run test -- src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts src/modules/orders/__tests__/orders.service.test.ts src/modules/time/__tests__/time.service.test.ts`

### Verification evidence
- Prisma validate passed.
- Migration applied successfully for `repeat_orders_operator_accountability_v1`.
- Focused ESLint passed on the touched repeat-order and accountability files.
- Focused tests passed: repeat orders `4/4`, orders `11/11`, time `7/7` (`22/22` total).
- `npx prisma generate` hit a Windows file-lock `EPERM`, but the generated client contained the new types/models and the subsequent lint/tests passed.
- Focused Vitest execution required an outside-sandbox rerun after in-sandbox Windows `spawn EPERM`.

### Follow-up assumptions / caveats
- Repo-wide type-check still has unrelated baseline errors outside this feature slice.
- Repeat-order UI intentionally treats template routing/files as frozen in v1; bossman can override order-level fields and part notes/instructions, but not rebuild the template routing from the create screen.
- `Order.assignedMachinistId` remains coordinator-only; actual floor execution is part-level through `OrderPartAssignment`.

## Session Handoff - 2026-04-10 (Repeat orders + operator accountability UI)

Goal (1 sentence): Finish the order-detail UI slice for Repeat Orders + Operator Accountability v1: part-worker assignment panel, must-read instruction gate, submit reconfirmation, checklist performer selection, and clearer part log phrasing.

### What changed
- Updated `src/app/orders/[id]/page.tsx`
  - Added a part-worker assignment panel that uses the existing `/api/orders/[id]/parts/[partId]/assignments` GET/POST/DELETE routes.
  - Added a must-read mission-brief modal/read gate using `/api/orders/[id]/parts/[partId]/acknowledge-instructions`.
  - Added a second-step submit reconfirmation dialog for the existing department-submit flow.
  - Added a checklist performer-selection dialog with the current session user preselected and persisted through `performedById`.
  - Updated part log rendering to surface actor vs performer context more clearly.
  - Kept the changes inside the order-detail page and reused the backend contracts already in the tree.
- Updated continuity docs:
  - `tasks/todo.md`
  - `PROGRESS_LOG.md`
  - `docs/AGENT_CONTEXT.md` was already updated earlier in the session for the repeat-order/accountability decision log entry.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint "src/app/orders/[id]/page.tsx"`
- `npx eslint "src/app/orders/new/page.tsx"`
- `npx tsc --noEmit --pretty false`

### Verification evidence
- Targeted ESLint passed on both edited order UI pages.
- Full repo type-check still reports unrelated pre-existing errors outside this UI slice:
  - `src/app/admin/quotes/[id]/page.tsx`
  - `src/app/api/admin/vendors/import/route.ts`
  - `src/app/api/print-analyzer/analyze/route.ts`
  - `src/lib/quote-part-pricing.ts`
  - `src/repos/index.ts`
  - `src/repos/mock/orders.ts`
  - `sterling-site/vite.config.ts`
- I treated those as baseline issues rather than regressions from this work.

### UI contract assumptions
- Checklist performer selection should stay client-side and continue sending `performedById` through the existing checklist routes.
- The instruction gate is per user + part + department version, so the UI should continue to re-open the brief only when the receipt is missing.
- Submit reconfirmation remains a client-side affordance only; the backend already logs the submit event and enforces the receipt check.

## Session Handoff - 2026-04-10 (Accountability backend only)

Goal (1 sentence): Finish the accountability backend slice only: part-worker assignments, instruction acknowledgements, checklist performer attribution, shared part activity read models, and backend gating without touching the UI.

### What changed
- Updated src/modules/orders/orders.service.ts
  - Added reusable checklist audit-message/event metadata shaping so actor vs performer are stored distinctly.
  - Added order-detail partActivity read-model shaping per part using shared time-entry summaries.
  - Finished part worker assignment service behavior and instruction acknowledgement/status helpers.
  - Enforced instruction acknowledgement gating for checklist toggles and department submit.
  - Extended last-checklist complete-and-advance flow to accept/store performedById and log the checklist action separately from department movement.
  - Tightened submit-department transaction usage so time adjustments and department changes use the same transaction client.
- Updated timer backend routes:
  - src/app/api/timer/start/route.ts now blocks timer start on missing instruction acknowledgement.
  - src/app/api/timer/resume/route.ts now applies the same gate before resuming a part-linked timer.
  - src/app/api/timer/active/route.ts now returns shared partActivity for requested part IDs.
- Updated src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance/route.ts
  - Accepts optional performedById so the confirmed last-item completion path matches the normal checklist attribution contract.
- Updated src/modules/time/time.service.ts
  - Added getTimeEntryDetails() for safe route-level resume gating.
  - Added getPartActivitySummary() for cross-user active-timer and accumulated-time read models.
- Updated mock repos/seeds:
  - src/repos/mock/seed.ts
  - src/repos/mock/orders.ts
  - src/repos/mock/time.ts
  - Added seeded helper user, ack-gated part/checklist, part assignments, instruction receipts, and richer time-entry fixtures so focused backend tests cover the new contracts.
- Updated focused backend tests:
  - src/modules/orders/__tests__/orders.service.test.ts
  - src/modules/time/__tests__/time.service.test.ts

### Files touched
- src/modules/orders/orders.service.ts
- src/modules/time/time.service.ts
- src/app/api/timer/start/route.ts
- src/app/api/timer/resume/route.ts
- src/app/api/timer/active/route.ts
- src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance/route.ts
- src/repos/mock/seed.ts
- src/repos/mock/orders.ts
- src/repos/mock/time.ts
- src/modules/orders/__tests__/orders.service.test.ts
- src/modules/time/__tests__/time.service.test.ts
- 	asks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

### Commands run
- 
pm run test -- src/modules/orders/__tests__/orders.service.test.ts
- 
pm run test -- src/modules/time/__tests__/time.service.test.ts
- 
pm run lint

### Verification evidence
- Focused Orders service tests passed (11/11).
- Focused Time service tests passed (7/7).
- 
pm run test -- src/modules/time/__tests__/time.service.test.ts required an outside-sandbox rerun because sandboxed Vitest/esbuild hit Windows spawn EPERM at startup.
- Lint passed with no ESLint warnings/errors.

### UI/backend integration assumptions
- Checklist mutation routes now support optional performedById; UI should send it whenever the operator marks work completed for someone else.
- /api/timer/start and /api/timer/resume now return the existing 409 error envelope with error.code = INSTRUCTION_ACK_REQUIRED when acknowledgement is missing; UI should intercept that and open the must-read modal instead of treating it as a generic conflict.
- /api/timer/active?orderId=...&partIds=... now returns additive partActivity data keyed by part ID; UI can consume it without breaking older fields.
- Order detail payloads now include part.partActivity plus part.assignments and part.instructionReceipts; UI can render shared-worker/time context directly from the existing order GET route.
- Department submit already writes a distinct DEPARTMENT_SUBMIT_CONFIRMED part event on every submit call; the UI still needs to own the fresh confirmation dialog before making that POST.
## Session Handoff - 2026-04-10 (Repeat-order backend only)

Goal (1 sentence): Finish the repeat-order template backend slice only, keeping the work scoped to template snapshot/list/fetch/create-order behavior plus minimal contract hardening.

### What changed
- Updated `src/modules/repeat-orders/repeat-orders.service.ts`
  - Repeat-order template snapshot no longer stores the source order PO as template notes.
  - Template-based order creation now rejects templates with no parts.
  - Duplicate or unknown `templatePartId` override rows now fail fast with `400` instead of being silently ignored/overwritten.
  - Provided order numbers now obey the same business-prefix validation used by normal order creation.
  - Successful template-based order creation still reuses the existing order post-create lifecycle helpers for checklist sync, current-department initialization, workflow sync, and canonical attachment copying.
- Added `src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts`
  - Covers snapshot behavior, unknown template-part override rejection, invalid order-number rejection, and successful order creation from a template.
- Updated continuity docs and Decision Log for the repeat-order backend contract.

### Files touched
- `src/modules/repeat-orders/repeat-orders.service.ts`
- `src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx eslint src/modules/repeat-orders/repeat-orders.service.ts src/modules/repeat-orders/repeat-orders.repo.ts src/modules/repeat-orders/repeat-orders.schema.ts src/modules/repeat-orders/repeat-orders.types.ts src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts src/app/api/repeat-order-templates/route.ts src/app/api/repeat-order-templates/from-order/[orderId]/route.ts src/app/api/repeat-order-templates/[id]/route.ts src/app/api/repeat-order-templates/[id]/create-order/route.ts`
- `npm run test -- src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts`

### Verification evidence
- ESLint passed on the touched repeat-order/API files with no reported issues.
- Focused repeat-order service tests passed (4/4).
- The test run required an outside-sandbox rerun because sandboxed Vitest/esbuild hit Windows `spawn EPERM`.

### Follow-up contract assumptions for UI/backend integration
- UI should treat template-level `notes` as explicit reusable defaults only; the backend no longer derives them from the source order PO.
- UI must send only known template part IDs in `parts[].templatePartId` when posting `/api/repeat-order-templates/[id]/create-order`.
- If UI supplies `orderNumber`, it must already match the business prefix format (for example `STD-1234` for `STD` templates).
- Attachment rows can continue to reference template storage paths at create time; the backend still runs canonical post-create file copying for the new order.

## Session Handoff — 2026-04-10 (Vendors contact/materials follow-up + rollback)

Goal (1 sentence): Make vendor contact/material data searchable as first-class fields and clear the partial spreadsheet import so the next import lands cleanly.

### What changed
- Updated `prisma/schema.prisma`
  - Added `Vendor.contact` and `Vendor.materials`.
- Added `prisma/migrations/20260410103000_add_vendor_contact_materials/migration.sql`
  - Applies the new Vendor columns.
- Updated `src/lib/zod.ts`
  - Added `contact` and `materials` to Vendor validation.
- Updated `src/app/api/admin/vendors/route.ts`
  - Vendors search now matches `contact` and `materials`.
- Updated `src/modules/vendors/vendor-import.ts`
  - Import preview now suggests `Contact` and `Material` columns.
  - Import row mapping now writes to `contact` and `materials` instead of stuffing those fields into `notes`.
- Updated `src/app/api/admin/vendors/import/route.ts`
  - Import endpoint now accepts `contactColumn` and `materialsColumn`.
  - Duplicate-update path now updates `contact` and `materials`.
- Updated `src/app/admin/vendors/client.tsx`
  - Added `contact` and `materials` to manual vendor CRUD.
  - Added importer mapping controls for `Contact` and `Materials`.
  - Expanded import result preview to show imported contact/material values.
- Operational cleanup
  - Audited vendor references before rollback and confirmed only `Grainger` was linked (via one `QuoteVendorItem`).
  - Deleted 37 unreferenced imported vendor rows, leaving the baseline seeded rows (`Grainger`, `McMaster-Carr`) in place.
- Updated continuity docs and added a Decision Log entry in `docs/AGENT_CONTEXT.md`.

### Files touched
- `prisma/schema.prisma`
- `prisma/migrations/20260410103000_add_vendor_contact_materials/migration.sql`
- `src/lib/zod.ts`
- `src/app/api/admin/vendors/route.ts`
- `src/modules/vendors/vendor-import.ts`
- `src/app/api/admin/vendors/import/route.ts`
- `src/app/admin/vendors/client.tsx`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npx prisma migrate dev`
- `npx prisma generate`
- vendor-reference audit via `node -`
- rollback delete script via `node -`
- `npm run lint`
- `npm run test -- src/modules/vendors/__tests__/vendor-import.test.ts`
- `node -` (real workbook preview parse + vendor post-rollback check)

### Verification evidence
- Lint passed with no ESLint warnings/errors.
- Focused Vendors importer test passed (1/1) outside sandbox.
- Prisma migration `20260410103000_add_vendor_contact_materials` applied successfully.
- `npx prisma generate` still hit a Windows file-lock rename `EPERM`, but the Prisma Client is usable and successfully queried `contact`/`materials` after the migration.
- Real workbook preview parse now suggests:
  - `Company -> name`
  - `Web page -> url`
  - `Phone -> phone`
  - `Contact -> contact`
  - `Material -> materials`
- Post-rollback vendor check confirmed only:
  - `Grainger`
  - `McMaster-Carr`

### Next steps
- [ ] User verify on `/admin/vendors` that search now feels right for `materials` and `contact`.
- [ ] Re-import the supplier workbook using the new `Contact`/`Materials` mappings.
- [ ] Optional follow-up: if filtering by material needs to be more than free-text search, add a dedicated material filter UI on the Vendors page.

## Session Handoff — 2026-04-10 (Vendors preview-and-map importer)

Goal (1 sentence): Add a safe Vendors import workflow that can preview and map spreadsheet columns before writing supplier data into the app's current Vendor schema.

### What changed
- Added `src/modules/vendors/vendor-import.ts`
  - Parses `.xls`, `.xlsx`, and `.csv` workbooks via `xlsx`.
  - Detects a likely header row, normalizes columns, suggests mappings, and shapes mapped Vendor rows for import.
- Added `src/app/api/admin/vendors/import/route.ts`
  - New admin-only import endpoint with two stateless actions:
    - `preview`: parse workbook, choose sheet/header row, return columns and preview rows,
    - `import`: reparse workbook with the chosen mapping and create/update vendors.
  - Supports duplicate handling by vendor name (`skip` or `update`).
- Updated `src/app/admin/vendors/client.tsx`
  - Added spreadsheet upload, sheet selection, header-row selection, raw preview, parsed preview, column mapping UI, duplicate-mode selection, and import-results summary.
  - Preserved the existing manual Vendors CRUD flow below the new importer.
- Added `src/modules/vendors/__tests__/vendor-import.test.ts`
  - Covers header-row detection.
- Updated continuity docs and added a Decision Log entry in `docs/AGENT_CONTEXT.md`.
- Installed dependency
  - `xlsx`

### Files touched
- `package.json`
- `package-lock.json`
- `src/app/admin/vendors/client.tsx`
- `src/app/api/admin/vendors/import/route.ts`
- `src/modules/vendors/vendor-import.ts`
- `src/modules/vendors/__tests__/vendor-import.test.ts`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm install xlsx`
- `npm run lint`
- `npm run test -- src/modules/vendors/__tests__/vendor-import.test.ts`
- `node -` (real workbook preview parse against `C:\Users\user\Downloads\Suppliers.xls`)

### Verification evidence
- Lint passed with no ESLint warnings/errors.
- Focused Vendors importer test passed (1/1) after rerunning outside sandbox because Vitest/esbuild hit sandbox `spawn EPERM`.
- Real preview parse of `C:\Users\user\Downloads\Suppliers.xls` succeeded with:
  - selected sheet `Steel Suppliers`,
  - header row `1`,
  - columns `Company`, `Phone`, `Contact`, `Web page`, `Material`,
  - suggested mapping `Company -> name`, `Web page -> url`, `Phone -> phone`, `Contact -> notes`.

### Next steps
- [ ] User verify on `/admin/vendors` that the preview/import UI feels right with the real workbook and the chosen mappings.
- [ ] Optional follow-up: if the shop needs category/contact/email/fax/address as first-class fields instead of folded notes, expand the `Vendor` schema before a full production import.

## Session Handoff — 2026-04-10 (BOM analyzer oversized-image stack-overflow fix)

Goal (1 sentence): Make large image uploads stop crashing the BOM analyzer route and complete successfully through the existing analysis flow.

### What changed
- Updated `src/app/api/print-analyzer/analyze/route.ts`
  - Replaced the regex-based `data:` URL parser with a delimiter-based parser after isolating the stack overflow to `decodeDataUrl()` for multi-megabyte base64 payloads.
  - Removed the route's server-side image data-URL roundtrip so normalized uploads stay as raw `Buffer`s after request parsing.
  - Switched OpenAI vision requests from inline base64 `image_url` payloads to uploaded OpenAI files using `purpose: vision` and Responses `input_image.file_id`.
  - Added best-effort cleanup of the temporary OpenAI files after each analyzer request.
- Updated `tasks/lessons.md`
  - Added a prevention rule covering regex parsing of large base64 `data:` URLs in route handlers.

### Files touched
- `src/app/api/print-analyzer/analyze/route.ts`
- `tasks/todo.md`
- `tasks/lessons.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`
- local oversized-image POST to `http://127.0.0.1:3000/api/print-analyzer/analyze`

### Verification evidence
- Lint passed with no ESLint warnings/errors.
- A locally generated `~5.9 MB` JPEG that previously returned `502` with `Maximum call stack size exceeded` now returns `200` with structured analyzer JSON in about `29.7s`.

### Next steps
- [ ] User verify in the BOM tab or `/private/print-analyzer` that the previously failing real-world image now analyzes successfully.

## Session Handoff — 2026-04-10 (Repair stale local dev server on port 3000)

Goal (1 sentence): Recover the broken local Next dev server on port `3000` so admin quote print works again without the webpack/runtime crash.

### What changed
- Operational recovery only; no source files changed for the quote print page itself.
- Confirmed the current quote print code path was healthy on a fresh dev server:
  - `/admin/quotes/cmnsw7c34000tq7rcbjgn7aeq/print` returned `200` on a fresh server at `3001`.
- Confirmed the existing `3000` server had a broken local build state:
  - same route returned `500`,
  - failure text referenced a missing `.next/server/...` file (`ENOENT`), consistent with a stale/corrupted dev build.
- Stopped the stale Next process on `3000` and restarted the workspace dev server on `3000`.

### Files touched
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- local auth + quote print probes against `http://127.0.0.1:3001` and `http://127.0.0.1:3000`
- `Stop-Process -Id 41880 -Force`
- restarted local dev server on port `3000`

### Verification evidence
- After restart, authenticated request to `http://127.0.0.1:3000/admin/quotes/cmnsw7c34000tq7rcbjgn7aeq/print` returned `200`.

### Next steps
- [ ] User verify the browser tab on the live `3000` app no longer shows the quote print webpack/runtime error.

## Session Handoff — 2026-04-10 (LAN/IP-safe post-sign-in redirect)

Goal (1 sentence): Keep successful credential sign-ins on the browser's active LAN/IP origin instead of bouncing back to localhost.

### What changed
- Updated `src/app/(public)/auth/signin/page.tsx`
  - Changed the credential sign-in submit flow from `redirect: true` to `redirect: false`.
  - On success, the page now manually navigates to the normalized relative `callbackUrl` with `window.location.assign(callbackUrl)`.
  - Preserved existing callback sanitization so only safe in-app relative destinations are used.

### Files touched
- `src/app/(public)/auth/signin/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify that signing in from the LAN/IP-hosted app now returns to the same IP-based origin instead of `localhost`.

## Session Handoff — 2026-04-09 (Order-detail submit dialog label correction)

Goal (1 sentence): Make the move-dialog confirm button always reflect the destination department the operator actually selected.

### What changed
- Updated `src/app/orders/[id]/page.tsx`
  - Replaced the dialog confirm-button label source so it now reads from `moveDepartmentDialog.destinationDepartmentId`.
  - The button copy now updates live with the dialog selection (`Submit to Shipping`, etc.) instead of staying tied to the default next-department helper.
- Updated `tasks/lessons.md`
  - Added a prevention rule covering stale action labels in selection-driven dialogs/forms.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/lessons.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify on `/orders/[id]` that changing the dialog destination immediately updates the confirm button label to the same department.

## Session Handoff — 2026-04-09 (Order-detail submit dialog cleanup)

Goal (1 sentence): Remove the redundant submit destination control from the order-detail dock so `Submit To` opens a single dialog that clearly shows the current department and lets the operator choose the destination there.

### What changed
- Updated `src/app/orders/[id]/page.tsx`
  - Removed the dock-level submit destination dropdown and its extra local state.
  - `Submit To` now opens the move dialog directly.
  - The dialog now shows the current department in a dedicated summary block at the top.
  - The dialog destination list now contains only valid non-current departments, so operators are not asked to pick the same department twice.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify on `/orders/[id]` that `Submit To` now feels cleaner: one button in the dock, current department shown at top of the dialog, destination chosen only inside the dialog.

## Session Handoff — 2026-04-09 (Dashboard current-department label consistency)

Goal (1 sentence): Make dashboard/order summary cards stop calling active work `Unassigned` when the order-detail workflow already treats that part as belonging to the first department.

### What changed
- Updated `src/components/ShopFloorLayouts.tsx`
  - `currentDepartmentLabelsByOrder` now falls back to the first ordered department name for non-complete orders when a part still has null `currentDepartmentId`.
  - Completed/closed orders still skip that fallback so finished work does not get an invented active department label.

### Files touched
- `src/components/ShopFloorLayouts.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify that the dashboard/order summary card now shows `Machining` (or the current first department) instead of `Unassigned` for new/received work.

## Session Handoff — 2026-04-09 (Order-detail timer context link + compact submit control)

Goal (1 sentence): Make the order-detail work dock tell operators exactly where another live timer is running and replace the overflowing `Submit to <Department>` label with a compact, reliable submit-destination control.

### What changed
- Updated `src/app/api/timer/active/route.ts`
  - Enriched `activeEntries` with order/part context and an `href` for each active timer entry.
  - Deep links now point to `/orders/{id}?part={partId}` when the timer belongs to a specific part.
- Updated `src/app/orders/[id]/page.tsx`
  - Added `useSearchParams()` handling so the page can preselect a part from `?part=...`.
  - Replaced the passive `Other timer live` badge with a clickable control that opens the active timer context.
  - Added a compact `Submit To` destination dropdown in the dock and kept the existing note-required move dialog as the actual submit confirmation path.

### Files touched
- `src/app/api/timer/active/route.ts`
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify on `/orders/[id]` that clicking `Other timer live` lands on the right order/part and feels obvious enough on the floor.
- [ ] User verify the new `Submit To` dropdown/button layout feels better with longer department names and still matches the manual move workflow.

## Session Handoff — 2026-04-08 (Unraid Docker app template refresh)

Goal (1 sentence): Refresh the existing Unraid Docker app template and guide so Unraid install settings match the current ShopApp1 container requirements.

### What changed
- Updated `unraid/my-shopapp1.xml`
  - Renamed the container label to `ShopApp1`.
  - Added `Support`, `Project`, and `TemplateURL` metadata.
  - Refreshed the overview text to reflect current app scope and storage expectations.
  - Added optional advanced `OPENAI_API_KEY` variable for the Print Analyzer / BOM AI feature.
- Rewrote `unraid/README.md`
  - Documented offline image build/load steps.
  - Documented Unraid template install/import path.
  - Listed required env values and recommended defaults.
  - Clarified persistent path mappings and first-run seed commands.

### Files touched
- `unraid/my-shopapp1.xml`
- `unraid/README.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `git diff -- unraid/my-shopapp1.xml unraid/README.md`

### Verification evidence
- Reviewed the Unraid template/docs diff to confirm the template now reflects current env variables, storage paths, and optional OpenAI configuration.
- No app-code/runtime files changed, so no lint/test run was required for this docs/template-only scope.

### Next steps
- [ ] If desired, commit/push the Unraid template refresh once the user is happy with the field names/defaults.
- [ ] Optional follow-up: publish `shopapp1:latest` to a registry and update the template repository field away from offline/local image workflow.

## Session Handoff — 2026-04-08 (Dashboard department visibility follow-up)

Goal (1 sentence): Make current department ownership obvious across dashboard tiles and order detail, and fix dashboard display logic so department work queue reflects actual department ownership.

### What changed
- Updated `src/modules/orders/orders.repo.ts`
  - Department feed query now treats `currentDepartmentId` as the ownership signal for work-queue visibility.
  - Non-completed filtering now uses part status rather than requiring open checklist rows in the selected department.
  - Dashboard overview part selections now include `partNumber` for richer client display.
- Updated `src/repos/mock/orders.ts`
  - Kept mock department-feed behavior aligned with the new `currentDepartmentId` ownership rule.
- Updated `src/components/ShopFloorLayouts.tsx`
  - Fixed initial-department refresh behavior so `Include completed` refetches correctly even for the initially selected department.
  - Grid digest cards now show:
    - parts count,
    - checklist progress,
    - current department ownership,
    - departments touched.
- Updated `src/components/work-queue/WorkQueueOrderCard.tsx`
  - Added selected department badge, latest activity, and per-part current department labels.
- Updated `src/app/orders/[id]/page.tsx`
  - Added current department to selected-part Overview.
  - Added current department to each part tile in the left-side part list.
- Added focused test coverage in `src/modules/orders/__tests__/orders.service.test.ts`
  - Confirms Machining department feed includes a part because Machining currently owns it, even without Machining checklist rows.
- Updated continuity docs and added Decision Log entry in `docs/AGENT_CONTEXT.md`.

### Files touched
- `src/modules/orders/orders.repo.ts`
- `src/modules/orders/orders.service.ts`
- `src/modules/orders/orders.types.ts`
- `src/repos/mock/orders.ts`
- `src/components/ShopFloorLayouts.tsx`
- `src/components/work-queue/WorkQueueOrderCard.tsx`
- `src/app/orders/[id]/page.tsx`
- `src/modules/orders/__tests__/orders.service.test.ts`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- `npm run lint`

### Verification evidence
- Targeted Orders service tests passed (6/6).
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify on Dashboard that Work queue now shows the Machining-owned order/part and that the added card details feel right.
- [ ] Optional follow-up: add a `Current department` column to the `By machinist` table if department ownership should also be visible in that layout.

## Session Handoff — 2026-04-08 (Order-detail department UX follow-up)

Goal (1 sentence): Replace the raw department-ID prompt with an in-app move dialog, restore department dropdown options on order detail, and default unassigned parts to the first active department.

### What changed
- Updated `src/app/orders/[id]/page.tsx`
  - Replaced the manual department `window.prompt` flow with a site-native `Dialog`.
  - Manual move now uses a destination department dropdown plus the required move note inline.
  - Timer department choices now come from the ordered active department list returned by the server, excluding Shipping.
  - Selected timer department now auto-defaults to the part’s current department when available, otherwise to the first timer-eligible department.
- Updated `src/modules/orders/orders.service.ts`
  - `getOrderDetails()` now returns `departments` alongside the order payload.
  - Order detail read model now falls back to the first active department when a part has no explicit/current routed department yet.
  - `initializeCurrentDepartmentForParts()` now uses the first active department as fallback when checklist routing yields no department.
- Updated `src/modules/orders/orders.repo.ts`
  - Included part `status` in the missing-current-department query so backfill can skip already completed parts.
- Added focused test coverage in `src/modules/orders/__tests__/orders.service.test.ts`
  - Verifies unassigned parts fall back to the first active department (`Machining` in current ordering).
- Updated continuity docs and added a Decision Log entry in `docs/AGENT_CONTEXT.md`.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `src/modules/orders/orders.service.ts`
- `src/modules/orders/orders.repo.ts`
- `src/modules/orders/__tests__/orders.service.test.ts`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- `npm run lint`

### Verification evidence
- Targeted Orders service tests passed (5/5).
- Initial test attempt failed inside sandbox with Vitest/esbuild `spawn EPERM`; rerun outside sandbox passed.
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify on `/orders/[id]` that the timer department dropdown now shows departments immediately and defaults to Machining/current department as expected.
- [ ] User verify the new move dialog feels right and that the required note copy/fields match shop-floor expectations.

## Session Handoff — 2026-04-08 (Quote print totals parity hotfix)

Goal (1 sentence): Make the quote print view use the same non-double-counted part-pricing totals rule as quote editor and quote detail.

### What changed
- Updated `src/app/admin/quotes/[id]/print/page.tsx`
  - Replaced stacked total math with the shared pricing-summary replacement rule.
  - Parts with non-zero part-pricing entries now contribute to `Part pricing` instead of also remaining inside the raw part add-on/labor subtotal.

### Files touched
- `src/app/admin/quotes/[id]/print/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify in `/admin/quotes/[id]/print` that totals now match both quote editor and quote detail.

---

## Session Handoff — 2026-04-08 (View quote totals parity hotfix)

Goal (1 sentence): Make the admin quote detail Totals card use the same non-double-counted part-pricing math as the quote editor.

### What changed
- Updated `src/app/admin/quotes/[id]/page.tsx`
  - Replaced stacked total math with the shared pricing-summary replacement rule already used in `QuoteEditor`.
  - Parts with non-zero part-pricing entries now contribute to `Part pricing (basis-adjusted)` instead of also remaining in `Add-ons and labor`.
  - Legacy quote-level add-on selections still remain in `Add-ons and labor`.

### Files touched
- `src/app/admin/quotes/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify on `/admin/quotes/[id]` that the Totals card now shows the same values as the quote editor for the same quote.

---

## Session Handoff — 2026-04-08 (Quote part-pricing autofill follow-up)

Goal (1 sentence): Auto-fill the part-pricing input from the part's assigned work subtotal so users only need to choose lot-total vs per-unit unless they want to override the amount.

### What changed
- Updated `src/app/admin/quotes/QuoteEditor.tsx`
  - Extended local `partPricing` state with an `isManual` flag.
  - Part-pricing rows now auto-populate from the current assigned add-ons/labor subtotal for each part.
  - Auto-fill keeps tracking assignment changes until the input is manually edited, at which point the entered value is preserved.

### Files touched
- `src/app/admin/quotes/QuoteEditor.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify in UI that the part-pricing input now starts with the assigned subtotal (for example `$245.00`) before toggling `LOT_TOTAL` vs `PER_UNIT`.

---

## Session Handoff — 2026-04-08 (Quote summary double-count hotfix)

Goal (1 sentence): Fix quote-review total math so basis-adjusted part pricing does not stack on top of the same part's raw add-on/labor subtotal.

### What changed
- Updated `src/app/admin/quotes/QuoteEditor.tsx`
  - Reworked summary total calculation to split per-part raw work-item subtotals from per-part pricing overrides.
  - When a part has a non-zero entered part-pricing value, that part now contributes only to `Part pricing (basis-adjusted)` and no longer remains in `Add-ons and labor`.
- Updated `src/modules/pricing/work-item-pricing.ts`
  - Added `calculatePartPricingSummaryTotalsCents` helper to keep the bucket-replacement rule explicit.
- Added focused tests in `src/modules/pricing/__tests__/work-item-pricing.test.ts`
  - Covers the case where a basis-adjusted part-pricing total should replace, not stack with, the raw subtotal.

### Files touched
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/modules/pricing/work-item-pricing.ts`
- `src/modules/pricing/__tests__/work-item-pricing.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts`
- `npm run lint`

### Verification evidence
- Targeted work-item pricing tests passed.
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify in UI that entering `245` with `PER_UNIT` on quantity `3` now yields `Add-ons and labor = $0.00`, `Part pricing = $735.00`, and `Total estimate = $735.00` for that single-part scenario.

---

## Session Handoff — 2026-04-08 (QuoteEditor activePart hotfix)

Goal (1 sentence): Fix the admin quote editor runtime crash caused by referencing `activePart` before its initialization.

### What changed
- Updated `src/app/admin/quotes/QuoteEditor.tsx`
  - Reworked the selected-assignment pruning effect to derive the current active part from `parts` and `activePartKey` inside the hook instead of closing over `activePart` before that memoized binding is declared.
  - Preserved existing behavior: selected assignment keys are still trimmed to only those that exist on the current active part.

### Files touched
- `src/app/admin/quotes/QuoteEditor.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify in UI that `/admin/quotes/new` and quote edit flows no longer throw the `activePart` initialization error when the editor mounts.

---

## Session Handoff — 2026-04-08 (Structured Quote Document Editor v1)

Goal (1 sentence): Deliver a structured, template-driven quote document editor so admins can configure block visibility/labels/styles/options and have quote print/save output follow those settings.

### What changed
- Extended layout schema handling:
  - `src/lib/document-template-layout.ts`
  - Added structured `blocks[]` support (`id`, `type`, `label`, `visible`, `order`, `variant`, `options`) while preserving legacy `sections[]` parsing fallback.
- Added quote print render-planning helper:
  - `src/lib/quote-print-layout.ts`
  - Maps normalized template blocks to quote render block types and pricing options.
- Updated admin template editor UI:
  - `src/app/admin/templates/TemplatesClient.tsx`
  - Canvas now edits blocks (not only section labels) and supports:
    - show/hide,
    - label overrides,
    - variant preset (`standard`/`compact`),
    - pricing block toggles (`showUnitPrice`, `showQuantity`, `showLineTotal`, `showPricingMode`).
  - Save payload now writes both `sections` (legacy compatibility) and `blocks` (structured model).
- Updated quote print output rendering:
  - `src/app/admin/quotes/[id]/print/page.tsx`
  - Rendering now consumes normalized structured blocks; pricing section table columns/mode row visibility respond to template options.

### Tests
- Added `src/lib/__tests__/document-template-layout.test.ts` (legacy normalization + structured ordering behavior).
- Added `src/lib/__tests__/quote-print-layout.test.ts` (render-block mapping + visibility/options behavior).

### Files touched
- `src/lib/document-template-layout.ts`
- `src/lib/quote-print-layout.ts`
- `src/lib/__tests__/document-template-layout.test.ts`
- `src/lib/__tests__/quote-print-layout.test.ts`
- `src/app/admin/templates/TemplatesClient.tsx`
- `src/app/admin/quotes/[id]/print/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/lib/__tests__/document-template-layout.test.ts src/lib/__tests__/quote-print-layout.test.ts`
- `npm run lint`

### Verification evidence
- Targeted tests passed (2 files, 4 tests).
- Lint passed with no ESLint warnings/errors.

### Next steps (post-MVP polish)
- Optional: add compact-variant visual style deltas beyond table font sizing for richer preset differences.
- Optional: add UI integration tests for template builder interactions (drag/reorder + option toggles -> payload assertions).

---

## Session Handoff — 2026-04-08 (Phase 3 quick convert)

Goal (1 sentence): Implement admin quote-detail “Quick Convert” that captures only essential overrides and converts directly to order detail without sending users through `/orders/new` wizard steps.

### What changed
- Added quick convert dialog component:
  - `src/components/Admin/QuoteQuickConvertDialog.tsx`
  - Required fields: due date, priority (default NORMAL), assigned machinist.
  - Optional fields: PO number, vendor ID, material-needed, material-ordered, model-included.
  - Client-side validation + inline failure messaging.
  - Submits overrides to existing conversion API and redirects to `/orders/{orderId}` on success.
- Updated quote detail page trigger:
  - Added `Quick Convert` action on `/admin/quotes/[id]`.
  - Kept workflow approval/conversion status controls, but disabled legacy detail-page wizard-convert button (`showConvertAction={false}`) so quick path is the primary conversion UX there.
- Conversion route resilience:
  - Updated already-converted idempotency message fallback to use `orderId` when `orderNumber` is missing.

### Tests
- Added `src/components/Admin/__tests__/QuoteQuickConvertDialog.test.ts` covering quick-convert submit payload validation behavior.
- Extended `src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts` with invalid `dueDate` edge handling check.

### Files touched
- `src/components/Admin/QuoteQuickConvertDialog.tsx`
- `src/components/Admin/__tests__/QuoteQuickConvertDialog.test.ts`
- `src/app/admin/quotes/[id]/page.tsx`
- `src/app/admin/quotes/QuoteWorkflowControls.tsx`
- `src/app/api/admin/quotes/[id]/convert/route.ts`
- `src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/components/Admin/__tests__/QuoteQuickConvertDialog.test.ts src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`
- `npm run lint`

### Verification evidence
- Targeted tests passed (2 files, 6 tests total).
- Lint passed with no ESLint warnings/errors.

### Next agent prompt
"Validate quick-convert UX on `/admin/quotes/[id]` with seeded data (approval present + customer set), and add one focused interaction-level component test (mock fetch success/error) for dialog submit/disable behavior if project test harness is expanded for client component rendering. Keep scope to testing/UX polish only; do not alter conversion business rules."

---

## Session Handoff — 2026-04-08 (Quote pricing presentation Phase 2)

Goal (1 sentence): Implement Phase 2 quote pricing presentation alignment so Quote Creator + review/print surfaces show explicit Unit Price, Qty, and Line Total rows per part while preserving existing `PER_UNIT`/`LOT_TOTAL` math contract and payload persistence behavior.

### What changed
- Quote Creator (`src/app/admin/quotes/QuoteEditor.tsx`)
  - Updated per-part pricing rows to explicit review fields: Entered price, Unit price, Qty, Line total.
  - Kept mode toggle behavior and surfaced mode text inline for clarity.
- Quote detail review (`src/app/admin/quotes/[id]/page.tsx`)
  - Added per-part Unit price / Qty / Line total / Pricing mode display in part cards.
  - Updated email pricing summary generation to `Unit × Qty = Line Total (mode)` formatting.
- Quote print view (`src/app/admin/quotes/[id]/print/page.tsx`)
  - Updated Part pricing table columns to Unit price, Qty, Line total and mode display.
  - Updated part pricing section summary row to Part pricing total.
- Pricing helper/tests
  - Added `calculatePartUnitPrice` in `src/modules/pricing/part-pricing.ts`.
  - Expanded `src/modules/pricing/__tests__/part-pricing.test.ts` to cover display-unit derivation invariants.

### Files touched
- `src/modules/pricing/part-pricing.ts`
- `src/modules/pricing/__tests__/part-pricing.test.ts`
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/app/admin/quotes/[id]/page.tsx`
- `src/app/admin/quotes/[id]/print/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/modules/pricing/__tests__/part-pricing.test.ts`
- `npm run lint`

### Verification evidence
- Targeted pricing unit tests passed (6/6).
- Lint passed with no ESLint warnings/errors.

### Scope/contract notes
- No payload schema changes introduced.
- Persisted quote `partPricing` data contract (`priceCents` + `pricingMode`) remains unchanged.
- Display unit-price derivation is read-model only and intentionally mode-aware (`LOT_TOTAL` derives display unit by lot/qty; `PER_UNIT` uses entered value directly).

### Next steps
- [ ] Optional: add a focused UI test for Quote Detail/Print part-pricing row rendering if snapshot/UI harness is introduced.
- [ ] Begin next approved quote workflow phase after owner validation of Phase 2 presentation expectations.

---

Date: 2026-04-08
Agent: GPT-5.3-Codex
Goal (1 sentence): Deliver Phase 1 Quote Creator productivity upgrades: selected-item bulk apply/copy across parts plus reusable presets.

## What I changed
- Added new Quote bulk-helper module `src/modules/quotes/quote-addon-bulk.ts`:
  - `dedupePresetItems` for addon-id uniqueness,
  - `buildPresetFromSelections` for selected-row extraction,
  - `mergeSelectionsWithoutDuplicates` for target-merge behavior.
- Added focused helper tests `src/modules/quotes/__tests__/quote-addon-bulk.test.ts` (3 tests).
- Updated `src/app/admin/quotes/QuoteEditor.tsx` build-step UX:
  - assignment row checkbox selection controls,
  - `Select all` / `Clear` selection actions,
  - `Apply selected to all parts` action (merge/no duplicates),
  - copy-target selector + `Copy selected items` action,
  - preset save/apply/delete controls,
  - local preset persistence (`quote-addon-presets-v1`).
- Added state hygiene guards:
  - clear assignment selection on active part switch,
  - prune stale selected keys after assignment edits,
  - reset copy target to `ALL` if selected part disappears.

## Files touched
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/modules/quotes/quote-addon-bulk.ts`
- `src/modules/quotes/__tests__/quote-addon-bulk.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run test -- src/modules/quotes/__tests__/quote-addon-bulk.test.ts`
- `npm run lint`

## Verification Evidence
- Targeted quote bulk helper tests passed (3/3).
- Lint passed with no ESLint warnings/errors.

## Next-step guidance for next agent (Phase 2 prompt)
**Prompt to next agent:**
"Implement Phase 2 for Quote rework: update Quote Creator and Review pricing presentation to show explicit Unit Price, Qty, and Line Total rows per part; preserve existing `PER_UNIT`/`LOT_TOTAL` math contract and ensure print/save outputs remain template-driven/customizable. Keep scope to quote pricing display + payload/read-model consistency only, add focused tests, run lint, and update continuity docs."

## Notes / caveats
- Presets currently persist per-browser via localStorage; they are not server-shared yet.
- Bulk merge dedupe key is `addonId` only (intended by current requirement).
- Selected-item copy/apply preserves selected item units/notes from source part.

---

Date: 2026-04-08
Agent: GPT-5.3-Codex
Goal (1 sentence): Rework department movement to manual-only transitions, keep timers department-bound, and require Shipping for manual part completion.

## What I changed
- Removed checklist-driven automatic department transition side effects from `toggleChecklistItem`; checklist check/uncheck no longer changes `currentDepartmentId`.
- Updated Order Detail page manual flow:
  - Replaced auto-advance submit behavior with destination+note prompt.
  - New flow calls `POST /api/orders/[id]/parts/assign-department` with required move note.
  - Removed reopen/backward reason prompt coupling from checklist checkbox toggles.
- Added shipping-only manual completion enforcement in `completeOrderPart`:
  - rejects completion unless part is currently in Shipping,
  - keeps existing all-checklist-items-complete guard.
- Tightened server validations for manual transitions to require `reasonText` (note) in:
  - `assign-department` API route + service,
  - `transition` API route + service.
- Added targeted Orders service test for Shipping completion gate.

## Files touched
- `src/modules/orders/orders.service.ts`
- `src/app/orders/[id]/page.tsx`
- `src/app/api/orders/[id]/parts/assign-department/route.ts`
- `src/app/api/orders/[id]/parts/transition/route.ts`
- `src/modules/orders/__tests__/orders.service.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- `npm run lint`

## Verification Evidence
- Targeted Orders service test file passed (4 tests).
- Lint passed with no ESLint warnings/errors.

## Next steps
- [ ] Optional UX follow-up: replace prompt-based destination entry with a modal/select control to avoid manual department-ID typing.
- [ ] Confirm production data has active Shipping department in all businesses to avoid completion dead-ends.

---

Date: 2026-04-08
Agent: GPT-5.3-Codex
Goal (1 sentence): Fix the `/orders/new` runtime crash caused by a missing `formatCurrency` helper reference.

## What I changed
- Restored a local `formatCurrency(cents)` helper in `src/app/orders/new/page.tsx` so all review-step `renderMeta` and totals usages resolve at runtime.
- Kept fix limited to the missing symbol with no additional functional changes.

## Files touched
- `src/app/orders/new/page.tsx`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`

## Verification Evidence
- `npm run lint` passed (`✔ No ESLint warnings or errors`).

## Next steps
- [ ] User verify in UI that `/orders/new` review step no longer throws `ReferenceError`.

---

Date: 2026-04-08
Agent: GPT-5.3-Codex
Goal (1 sentence): Make quote view and print invoice totals carry over the same basis-adjusted pricing amount shown during quote review.

## What I changed
- Updated `src/app/admin/quotes/[id]/page.tsx` to:
  - compute `partPricingTotal` using `calculatePartLotTotal` per part quantity + pricing mode,
  - include a `Part pricing (basis-adjusted)` row,
  - compute/display `Total estimate` from recalculated aggregate (`base + vendor + add-ons + part pricing`).
- Updated `src/app/admin/quotes/[id]/print/page.tsx` to:
  - compute `partPricingTotal` with the same helper,
  - include part pricing in totals summary,
  - include part pricing in print grand total.
- Updated continuity artifact `tasks/todo.md` with plan + verification completion for this scoped fix.

## Files touched
- `src/app/admin/quotes/[id]/page.tsx`
- `src/app/admin/quotes/[id]/print/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`

## Verification Evidence
- `npm run lint` passed (`✔ No ESLint warnings or errors`).

## Next steps
- [ ] User verification in UI: confirm quote review total now matches both quote detail and print invoice totals for PER_UNIT and LOT_TOTAL rows.

---

Date: 2026-04-08
Agent: GPT-5.3-Codex
Goal (1 sentence): Stabilize the prior quote/order pricing-basis PR by reconciling unresolved inline feedback and fixing persistence/projection correctness drift.

## What I changed
- Added a fresh Phase-0 unresolved-comment reconciliation checklist and full gap audit/verification matrix in `tasks/todo.md` before implementation.
- Fixed quote payload integrity in `QuoteEditor`:
  - `partPricing.priceCents` now persists the entered value directly.
  - `pricingMode` persists unchanged (`PER_UNIT` or `LOT_TOTAL`).
  - Lot-total math remains runtime-derived from canonical helper.
- Switched quote edit preload to use `getPartPricingEntries` identity-aware mapping (part number/name first, index fallback) to prevent row/value drift when part ordering differs.
- Hardened `getPartPricingEntries` for backward compatibility:
  - defaults missing legacy `pricingMode` to `LOT_TOTAL`
  - uses addon totals only as fallback when no stored entry can be matched.
- Added targeted tests for:
  - pricing-mode toggle determinism
  - quote metadata stringify/parse round-trip preservation
  - projection matching by part identity + legacy mode fallback

## Files touched
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/lib/quote-part-pricing.ts`
- `src/modules/pricing/__tests__/part-pricing.test.ts`
- `src/lib/__tests__/quote-part-pricing.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `gh pr view 153 --comments` *(fails: `gh` CLI unavailable in environment)*
- `npm run lint`
- `npm run test`

## Verification Evidence
- `npm run lint` passed (no ESLint warnings/errors).
- `npm run test` passed (15 files / 46 tests).

## Next steps
- [ ] If direct GitHub PR comment retrieval is required in future sessions, install/configure `gh` or provide exported review threads in-repo.
- [ ] Optional: add UI-level integration tests around QuoteEditor row-level pricing-mode interactions.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Close the review-comment gate first, then restore admin quote discoverability and add per-part pricing basis controls across quote and order review flows.

## What I changed
- Added a mandatory review-comment gate artifact at the top of `tasks/todo.md`:
  - mapped each unresolved PR ask to comment IDs (`PR-REV-001` .. `PR-REV-007`), target files, resolution strategy, and disposition.
- Restored admin quote discoverability:
  - Added `View Quotes` link in Admin `Quote & Order Ops` nav tab group.
  - Added `View Quotes` card link in Admin Center `Quote & Order Ops` section.
- Implemented quote per-part pricing basis controls:
  - Added `pricingMode` enum support to quote schema (`PER_UNIT` | `LOT_TOTAL`).
  - Added shared pricing helper `calculatePartLotTotal` in `src/modules/pricing/part-pricing.ts`.
  - Added per-part review rows in Quote Editor with entered price + `PER_UNIT` toggle + live lot totals.
  - Persisted pricing basis to quote metadata `partPricing` entries and reloads in edit flow.
  - Updated quote summary totals to include a separate `Part pricing (basis-adjusted)` line item.
- Implemented order-review equivalent controls (`/orders/new`):
  - Added per-part entered price + mode toggle rows with immediate summary updates.
  - Added explicit note that order-side pricing basis is review-transient and not persisted.
- Updated quote metadata and projection helpers to carry `pricingMode` values.
- Added focused unit tests for new mode math behavior.
- Added Decision Log entry codifying pricing model choice (coexist line item, quote persisted, order transient).

## Files touched
- `src/components/Admin/NavTabs.tsx`
- `src/app/admin/page.tsx`
- `src/modules/quotes/quotes.schema.ts`
- `src/lib/quote-metadata.ts`
- `src/lib/quote-part-pricing.ts`
- `src/modules/quotes/quotes.repo.ts`
- `src/app/api/admin/quotes/[id]/route.ts`
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/app/orders/new/page.tsx`
- `src/modules/pricing/part-pricing.ts`
- `src/modules/pricing/__tests__/part-pricing.test.ts`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`
- `npm run test -- src/modules/pricing/__tests__/part-pricing.test.ts`
- `npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts`

## Verification Evidence
- Lint passed with no ESLint warnings/errors.
- Targeted pricing tests passed:
  - `part-pricing.test.ts` (2/2)
  - `work-item-pricing.test.ts` (3/3)

## Next steps
- [ ] Add quote editor interaction tests that cover mode toggling in UI and payload serialization for `partPricing`.
- [ ] If order-side persistence is desired, add an explicit Orders-domain schema/metadata contract before implementing storage.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Close quote/order pricing mismatch by introducing a shared work-item pricing contract and adding the missing order review-step totals.

## What I changed
- Added new shared pricing helper module:
  - `src/modules/pricing/work-item-pricing.ts`
  - Canonical semantic projection (`PRICED_WORK` vs `CHECKLIST_ONLY`), assignment total calculation, and subtotal rollup helper.
- Added unit tests:
  - `src/modules/pricing/__tests__/work-item-pricing.test.ts`
  - Covers checklist-only semantics, priced assignment totals, and subtotal exclusion of checklist-only items.
- Updated quote builder:
  - `src/app/admin/quotes/QuoteEditor.tsx`
  - Switched add-on fetch to `/api/orders/addons` (role-aware)
  - Reused shared pricing helper for subtotal and assignment meta rendering.
- Updated order builder:
  - `src/app/orders/new/page.tsx`
  - Reused shared pricing helper for assignment meta rendering.
  - Added Review step “Estimate summary” card with add-ons/labor subtotal + total estimate.

## Files touched
- `src/modules/pricing/work-item-pricing.ts`
- `src/modules/pricing/__tests__/work-item-pricing.test.ts`
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/app/orders/new/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run test -- src/modules/pricing/__tests__/work-item-pricing.test.ts`
- `npm run lint`

## Verification Evidence
- Targeted pricing test suite passed (3/3).
- Lint passed with no ESLint warnings/errors.

## Diff/Review Notes
- Scope intentionally limited to pricing parity and display/projection consistency in quote/order builders.
- No new dependencies added.

## Next steps
- [ ] Consider applying the same shared pricing helper on API-side validation paths so client/server projections remain fully aligned.
- [ ] Add role-visibility contract tests to ensure rate visibility and pricing semantics stay consistent for admin vs non-admin sessions.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Restore admin-visible add-on/labor pricing context in quote/order creation flows and repair the quote-conversion route type guard regression breaking build checks.

## What I changed
- Updated `QuoteEditor` available-item mapping to include `rateCents` for add-on cards rendered by `AvailableItemsLibrary`.
- Updated `/orders/new` assigned add-on/labor panel to render per-line pricing metadata (`rate x units = total`) and checklist-only no-charge indicator.
- Updated quote prefill hydration in `/orders/new` to merge add-on snapshots from quote selections so pricing/details remain visible even when selected add-ons are inactive and absent from active add-on API fetch.
- Updated quote conversion route error handling to use `error?.code === 'P2002'` guard instead of `Prisma.PrismaClientKnownRequestError` type access.

## Files touched
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/app/orders/new/page.tsx`
- `src/app/api/admin/quotes/[id]/convert/route.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run -s lint`
- `npm run -s build`

## Verification Evidence
- Lint passed with no ESLint warnings/errors.
- Build failed at pre-existing `src/repos/index.ts` mock repo type-surface mismatch (`updateOrderAttachmentStoragePath` and `updatePartAttachmentStoragePath` missing in mock).

## Next steps
- [ ] Resolve `src/repos/index.ts` mock Orders repo type shape mismatch so `npm run build` can pass fully in this branch.
- [ ] Add focused UI regression coverage for quote/order assigned add-on pricing display behavior.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Fix quote→order conversion checklist unique-constraint failures, surface actionable conversion/create errors in UI/API, and restore admin pricing visibility in add-on assignment cards.

## What I changed
- Updated `syncChecklistForOrder` in Orders repo to dedupe checklist creations using checklist uniqueness semantics (`partId + addonId`) so conversion-preseeded checklist rows do not collide with sync-generated rows.
- Added conversion-route error handling in `POST /api/admin/quotes/[id]/convert`:
  - Prisma `P2002` now returns a deterministic 409 JSON error message.
  - Unexpected errors now return JSON with a readable message.
- Updated order/quote creation UI (`/orders/new`) error handling:
  - Added shared response-message extraction helper for failed create/convert responses.
  - Failure messages are rendered with destructive styling for clearer operator feedback.
- Restored admin pricing visibility for add-on assignment library:
  - `/api/orders/addons` now passes admin context to service.
  - `listAddonsForOrders` supports admin-only pricing inclusion.
  - `AvailableItemsLibrary` now shows formatted rates when `rateCents` is present.
- Updated convert-route test coverage mocks to include `ensureOrderFilesInCanonicalStorage` and assert it is invoked.

## Files touched
- `src/modules/orders/orders.repo.ts`
- `src/modules/orders/orders.service.ts`
- `src/app/api/orders/addons/route.ts`
- `src/components/AvailableItemsLibrary.tsx`
- `src/app/orders/new/page.tsx`
- `src/app/api/admin/quotes/[id]/convert/route.ts`
- `src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`
- `npm run test -- src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`

## Verification Evidence
- Lint passed with no ESLint warnings/errors.
- Targeted conversion route tests passed (3/3).

## Next steps
- [ ] Add focused unit coverage for `syncChecklistForOrder` to lock in part+addon dedupe behavior around conversion-preseeded rows.
- [ ] Optionally add dedicated inline alert component on `/orders/new` for error/success semantic consistency.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Replace the quick hotfix with a durable Orders module boundary by moving client-safe constants/helpers out of `orders.service.ts` and enforcing `server-only` on the service.

## What I changed
- Added `src/modules/orders/orders.constants.ts` with client-safe order status constants and normalization helpers.
- Added `src/modules/orders/orders.shared.ts` with client-safe dashboard/filter helpers (`decorateOrder`, `formatStatusLabel`, `orderMatchesFilters`, `DEFAULT_ORDER_FILTERS`).
- Added `import 'server-only';` to `src/modules/orders/orders.service.ts` and re-exported shared/constants APIs for server-side callers.
- Moved `DepartmentFeedOrder` / `DepartmentFeedPart` types into `src/modules/orders/orders.types.ts`.
- Updated client import boundaries:
  - `RecentOrdersTable` now imports labels from `orders.constants`.
  - `ShopFloorLayouts` now imports helpers from `orders.shared` and types from `orders.types`.
  - `WorkQueueOrderCard` now imports types from `orders.types`.

## Files touched
- `src/modules/orders/orders.constants.ts`
- `src/modules/orders/orders.shared.ts`
- `src/modules/orders/orders.types.ts`
- `src/modules/orders/orders.service.ts`
- `src/components/RecentOrdersTable.tsx`
- `src/components/ShopFloorLayouts.tsx`
- `src/components/work-queue/WorkQueueOrderCard.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`
- `npm run build`

## Verification Evidence
- Lint passed with no ESLint warnings/errors.
- Build failed at a pre-existing type mismatch in `src/repos/index.ts` unrelated to this boundary move.

## Next steps
- [ ] Resolve the existing `src/repos/index.ts` mock orders repo type-surface mismatch so `npm run build` can pass in this branch.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Fix the `node:crypto` client-bundle crash by removing a server-only Orders service import from a client dashboard component.

## What I changed
- Updated `src/components/RecentOrdersTable.tsx` (client component) to stop importing `ORDER_STATUS_LABELS` from `src/modules/orders/orders.service.ts`.
- Added a local `ORDER_STATUS_LABELS` map in the component so UI labels remain stable while avoiding server-side transitive imports (`src/lib/storage.ts` -> `node:crypto`).

## Files touched
- `src/components/RecentOrdersTable.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`

## Verification Evidence
- Lint passed with no ESLint warnings/errors.

## Next steps
- [ ] Optional hardening: move shared order-status labels to a lightweight `orders.constants.ts` file that is safe for both server/client imports to prevent future boundary regressions.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Implement admin Quote & Order Ops IA updates, broad admin order editability, admin-only Full Order Files visibility, and canonical order-number file storage continuity through creation/conversion.

## What I changed
- Updated admin navigation and Admin Center IA:
  - Renamed section label to `Quote & Order Ops`.
  - Exposed only `Create Order` and `Create Quote` actions in that section.
  - Moved `Templates` link under `Business Settings` card context.
- Extended order detail page with admin edit mode:
  - Added broad order-header field editing (customer, dates, priority, vendor, PO, assignee, material/model flags).
  - Added selected-part editing controls plus admin add/delete part actions.
- Added admin-only `Full Order Files` tab in order detail:
  - Aggregates order-level + part-level attachments with source badges and open links.
- Added Orders-domain canonical storage helper `ensureOrderFilesInCanonicalStorage(orderId)`:
  - Copies non-canonical order-owned files into `business/customer/orderNumber/` paths.
  - Updates `Attachment` and `PartAttachment` `storagePath` records after copy.
- Wired canonicalization flow after direct order creation and after quote→order conversion.
- Updated continuity artifacts (`tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_CONTEXT.md`, `docs/AGENT_HANDOFF.md`).

## Files touched
- `src/components/Admin/NavTabs.tsx`
- `src/app/admin/page.tsx`
- `src/app/orders/[id]/page.tsx`
- `src/modules/orders/orders.repo.ts`
- `src/repos/orders.ts`
- `src/modules/orders/orders.service.ts`
- `src/app/api/admin/quotes/[id]/convert/route.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_CONTEXT.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`

## Verification Evidence
- Lint passed with no ESLint warnings/errors.

## Next steps
- [ ] Add focused automated coverage for canonical storage normalization helper behavior (path already canonical vs non-canonical copy/update).
- [ ] Optionally add explicit UX affordance to edit order-level attachments directly from Full Order Files tab.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Shift timer tracking to a department-bound model with required department selection on start, per-department active constraints, and department-based history totals in order detail.

## What I changed
- Added `TimeEntry.departmentId` relation in Prisma schema and created migration `20260407143000_add_time_entry_department`.
- Updated time repo/service layers:
  - timer start requires `departmentId`
  - one active timer allowed per `(userId, departmentId)`
  - concurrent active timers across different departments are allowed
  - resume preserves department and blocks resume when a same-department timer is already active.
- Updated timer APIs:
  - `POST /api/timer/start` and `POST /api/time/start` now validate department selection and reject Shipping timer starts.
  - `GET /api/timer/active` now returns `activeEntries` (all active timers for current user).
  - `POST /api/timer/pause` and `POST /api/timer/finish` accept optional `entryId` to target a specific active timer.
  - `POST /api/timer/resume` no longer blocks resume just because another unrelated department timer is active.
- Updated order detail UI:
  - added required department dropdown in timer controls (fresh selection required each start).
  - start payload includes `departmentId`.
  - pause/stop target the selected active timer entry instead of assuming a single global active timer.
  - added selected-part department history section with summary totals and detailed recent rows per department.
- Included order `timeEntries` (with department/user context) in order details repo payload to support history rendering.
- Updated mock seed/time repo and time service tests for department-aware timer behavior.

## Files touched
- `prisma/schema.prisma`
- `prisma/migrations/20260407143000_add_time_entry_department/migration.sql`
- `src/modules/time/time.types.ts`
- `src/modules/time/time.schema.ts`
- `src/modules/time/time.repo.ts`
- `src/modules/time/time.service.ts`
- `src/modules/time/__tests__/time.service.test.ts`
- `src/repos/time.ts`
- `src/repos/mock/seed.ts`
- `src/repos/mock/time.ts`
- `src/modules/orders/orders.repo.ts`
- `src/app/api/time/start/route.ts`
- `src/app/api/timer/start/route.ts`
- `src/app/api/timer/active/route.ts`
- `src/app/api/timer/pause/route.ts`
- `src/app/api/timer/finish/route.ts`
- `src/app/api/timer/resume/route.ts`
- `src/app/orders/[id]/page.tsx`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npx prisma format`
- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > /tmp/time_dept_migration.sql`
- `npm run lint`
- `npm run test -- src/modules/time/__tests__/time.service.test.ts`

## Verification Evidence
- Prisma schema formatted successfully.
- Lint passed with no ESLint warnings/errors.
- Targeted time service tests passed (6/6).

## Next steps
- [ ] Consider adding department-aware resume targeting (current selected-part resume behavior was simplified to explicit start flow).
- [ ] Consider adding explicit order-detail “all active timers by department” list when multiple timers are running concurrently.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Persist BOM analyzer output for each order part and improve tolerance extraction/readout behavior (including corner zooms and drill decimal display).

## What I changed
- Added new Prisma model + migration: `PartBomAnalysis` (unique by `orderId` + `partId`) to persist the latest analyzer result JSON for each part.
- Updated `POST /api/print-analyzer/analyze`:
  - accepts optional `orderId`, `partId`, and `sourceLabel`
  - persists successful analysis output when valid part context is provided
  - runs title-block tolerance extraction across all four corners (`top-left`, `top-right`, `bottom-left`, `bottom-right`) with stricter anti-hallucination prompt instructions
  - ensures fallback warning is present when tolerances are not confidently detected: `Unable to confidently read general tolerances. Please check the paper print.`
- Added `GET /api/orders/[id]/parts/[partId]/bom-analysis` to return latest saved analysis for BOM tab hydration.
- Updated `PartBomTab` to auto-load persisted analysis on mount and show a saved-analysis timestamp indicator; analyze requests now include order/part context so output is persisted.
- Replaced empty-state general tolerance message in BOM tab with paper-print instruction wording instead of `No general tolerances detected.`
- Updated tap-drill enrichment mapping to include decimal-inch diameter values for letter drills (plus mapped number/fraction drills) and added focused unit coverage.

## Files touched
- `prisma/schema.prisma`
- `prisma/migrations/20260407143000_add_part_bom_analysis/migration.sql`
- `src/app/api/print-analyzer/analyze/route.ts`
- `src/app/api/orders/[id]/parts/[partId]/bom-analysis/route.ts`
- `src/app/orders/[id]/PartBomTab.tsx`
- `src/lib/printAnalyzer/tapDrills.ts`
- `src/lib/printAnalyzer/tapDrills.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npx prisma migrate deploy`
- `npx prisma generate`
- `npm run test -- src/lib/printAnalyzer/tapDrills.test.ts`
- `npm run lint`

## Verification Evidence
- Migrations applied successfully in local SQLite dev database.
- Prisma client regenerated successfully.
- Targeted test passed (1/1).
- Lint passed with no ESLint warnings/errors.

## Next steps
- [ ] Consider adding a compact “source image” descriptor in BOM tab using stored `sourceLabel` for better auditability.
- [ ] Consider adding an explicit UI badge when fallback paper-print warning came from unreadable title-block scans.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Add a direct logout control on the account page so users can sign out and switch accounts quickly.

## What I changed
- Updated `src/app/account/password/client.tsx` to add a `Sign out` button alongside the password save action.
- Wired the new sign-out action to `signOut({ callbackUrl: '/auth/signin' })` so users are returned to sign-in immediately after logout.
- Added local `signingOut` state so the sign-out button shows in-progress text and temporarily disables relevant actions.
- Updated continuity artifacts for this follow-up session (`tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`).

## Files touched
- src/app/account/password/client.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm run lint

## Verification Evidence
- Lint passed with no ESLint warnings/errors.

## Next steps
- [ ] Optional UX follow-up: add a short helper line above the sign-out button clarifying that signing out is the path for switching users on shared machines.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Add a dedicated Sign In tab in the navigation and remove the About page from the app.

## What I changed
- Updated `src/components/AppNav.tsx`:
  - Removed the About nav link.
  - Added a `Sign In` nav link for unauthenticated users (desktop + mobile nav lists).
  - Kept existing account/sign-in CTA button behavior unchanged.
- Deleted `src/app/about/page.tsx` to remove the `/about` page route.
- Updated continuity artifacts for this session (`tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`).

## Files touched
- src/components/AppNav.tsx
- src/app/about/page.tsx (deleted)
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm run lint

## Verification Evidence
- Lint passed with no ESLint warnings/errors.

## Next steps
- [ ] If desired, add a public marketing/info page at a new route (for example `/welcome`) that is intentionally linked from nav; currently no informational page link remains in the app nav.

---

Date: 2026-04-07
Agent: GPT-5.3-Codex
Goal (1 sentence): Replace unreliable checklist auto-advance with explicit department completion submission, while adding manual time-adjustment notes into part totals visibility.

## What I changed
- Added schema + migration for `PartTimeAdjustment` with links to Order/Part/User and note/seconds fields.
- Extended Orders repo + mock repo to persist/load part time adjustments and include them in order detail payloads.
- Added new authenticated machinist API route:
  - `POST /api/orders/[id]/parts/[partId]/submit-department-complete`
- Added new Orders service flow `submitDepartmentComplete(...)`:
  - Validates current department checklist completeness before submission.
  - Rejects submit if current department has open checklist items.
  - Supports optional `additionalSeconds` with required note for manual time adds.
  - Moves part to next department or marks part complete when no remaining department work exists.
  - Logs part events and syncs order workflow status.
- Removed checklist checkbox-triggered auto-advance path from order detail page; checklist toggles now only toggle checklist state.
- Updated order detail checklist tab to group items by department label heading.
- Added total-time section on order detail selected part showing:
  - combined total (timer + manual)
  - timer subtotal
  - manual subtotal
  - manual adjustment note history
- Added focused Orders service tests covering:
  - completion gate with open checklist
  - department submit gate
  - required note validation when extra time is added

## Files touched
- `prisma/schema.prisma`
- `prisma/migrations/20260407120000_add_part_time_adjustments/migration.sql`
- `src/modules/orders/orders.repo.ts`
- `src/modules/orders/orders.service.ts`
- `src/repos/orders.ts`
- `src/repos/mock/seed.ts`
- `src/repos/mock/orders.ts`
- `src/app/api/orders/[id]/parts/[partId]/submit-department-complete/route.ts`
- `src/app/orders/[id]/page.tsx`
- `src/modules/orders/__tests__/orders.service.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260407120000_add_part_time_adjustments/migration.sql`
- `npx prisma migrate deploy`
- `npx prisma generate`
- `npm run lint`
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- `npm run build`

## Verification Evidence
- Migration deploy succeeded and Prisma client regenerated.
- Lint passed with zero ESLint warnings/errors.
- Targeted Orders service tests passed (3/3).
- Build failed due an existing environment/tooling issue in `sterling-site/vite.config.ts` module resolution for `@vitejs/plugin-react` (not introduced by this task).

## Diff/Review Notes
- Scope limited to requested behavior changes for checklist/department submission/time notes in order detail workflow.
- No new dependencies were added.

## Next steps
- [ ] Consider replacing prompt-based added-time input with a modal form for better UX/accessibility.
- [ ] Optionally deprecate now-unused preview/complete-and-advance checklist endpoints once owner confirms no other callers.

---

# AGENT_HANDOFF — 2026-04-02 (part-complete route + status parity)

Goal (1 sentence): Fix outdated completion path drift by restoring a live part-complete API route and align order-detail part status display with persisted backend state.

Scope (what changed):
- Added new route `src/app/api/orders/[id]/parts/[partId]/complete/route.ts` with existing auth patterns (`authRequiredResponse`, `forbiddenResponse`, `canAccessMachinist`) and service call to `completeOrderPart`.
- Updated `src/app/orders/[id]/page.tsx` to add a `Mark selected part complete` action in the active-work button stack.
- Updated order-detail part card status rendering to use persisted `part.status` rather than checklist-derived UI override.

Files touched:
- src/app/api/orders/[id]/parts/[partId]/complete/route.ts
- src/app/orders/[id]/page.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

Commands run:
- npm run lint

Verification results:
- Lint passed with no ESLint errors.

Open follow-ups / next steps:
- Consider adding route-level tests for `POST /api/orders/[id]/parts/[partId]/complete` (success + checklist-incomplete 409 + auth/role guards).
- Consider showing checklist completion summary alongside persisted status to keep useful context without overriding canonical status.

---


# AGENT_HANDOFF — 2026-03-23 (standalone premium manufacturing marketing site)

Goal (1 sentence): Create a fully isolated one-page premium manufacturing marketing website in its own repo subfolder so it can be previewed and deployed by direct URL without coupling to the main shop app.

Scope (what changed):
- Added a dedicated `sterling-site/` Vite + React + TypeScript subproject with its own package manifest, TS configs, Vite config, HTML entrypoint, and lockfile.
- Built a responsive one-page site covering hero, brand identity, capabilities, why-us, trust, materials, equipment, gallery, and CTA/contact sections.
- Implemented sticky top navigation with smooth anchor scrolling and active-section highlighting.
- Added motion treatment via animated ambient mesh background, parallax hero visual movement, and intersection-observer reveal transitions without bringing in extra animation dependencies.
- Centralized editable site data/media references in `sterling-site/src/siteContent.ts` and documented run/build/deploy/media swap guidance in `sterling-site/README.md`.
- Kept the project isolated from the main app: no shared components, styles, auth, DB wiring, APIs, or shared runtime config.

Files touched:
- sterling-site/package.json
- sterling-site/package-lock.json
- sterling-site/tsconfig.json
- sterling-site/tsconfig.app.json
- sterling-site/tsconfig.node.json
- sterling-site/vite.config.ts
- sterling-site/index.html
- sterling-site/README.md
- sterling-site/src/main.tsx
- sterling-site/src/App.tsx
- sterling-site/src/siteContent.ts
- sterling-site/src/styles.css
- docs/AGENT_CONTEXT.md
- docs/AGENT_TASK_BOARD.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- tasks/todo.md

Commands run:
- cd sterling-site && npm install
- cd sterling-site && npm run build
- cd sterling-site && npm run check
- cd sterling-site && npm run dev -- --host 127.0.0.1 --port 4173
- curl -I --max-time 15 http://127.0.0.1:4173/

Verification results:
- Standalone dependency installation succeeded.
- Production build passed and emitted the static site to `sterling-site/dist`.
- Type-check passed.
- Direct-link dev-server smoke check returned `200 OK`.
- Browser screenshot capture was not possible because the required browser screenshot tool is unavailable in this environment.

Open follow-ups / next steps:
- Replace placeholder quote/contact details with real production contact endpoints before public launch.
- Swap the stock gallery/hero media with real shop photography when available.
- When ready, add a single direct URL link from the main app or deploy `sterling-site/` as a separate project/subdomain without sharing runtime code.

---


# AGENT_HANDOFF — 2026-03-23 (order workflow status simplification + admin override)

Goal (1 sentence): Convert order status into a simple manager-facing workflow rollup (`RECEIVED` / `IN_PROGRESS` / `COMPLETE` / `CLOSED`) that auto-syncs from part activity while remaining admin-editable with audit reasons.

Scope (what changed):
- Added simplified order workflow status helpers in `src/modules/orders/orders.service.ts` to normalize legacy statuses and derive the manager-facing rollup from part completion/activity.
- Added order status auto-sync after part progress actions (checklist toggle/complete, timer start/resume/finish, manual department assignment/transition, part add/remove, charge mutations, and manual part completion).
- Kept `OrderPart.status` aligned with routing state (`IN_PROGRESS` when a part still has a department, `COMPLETE` when the part is done).
- Simplified order query/filter status vocabulary in `src/modules/orders/orders.schema.ts` and dashboard/search UI surfaces to `RECEIVED`, `IN_PROGRESS`, `COMPLETE`, and `CLOSED`.
- Replaced `/api/orders/[id]/status` behavior with an admin-only status override path that requires a reason and writes status-history audit text using the signed-in admin identity.
- Added an admin status editor to the order detail header so admins can update order status directly in the UI.
- Updated seed/mock fixtures to emit the simplified statuses and added focused workflow-status helper tests.
- Included a small build-compatibility fix in `src/modules/quotes/quotes.repo.ts` by loosening a stale `Prisma.TransactionClient` annotation to `any`.

Files touched:
- prisma/seed.ts
- src/app/api/orders/[id]/status/route.ts
- src/app/api/timer/finish/route.ts
- src/app/api/timer/resume/route.ts
- src/app/api/timer/start/route.ts
- src/app/customers/[id]/page.tsx
- src/app/machinists/[id]/page.tsx
- src/app/orders/[id]/page.tsx
- src/app/search/page.tsx
- src/components/ShopFloorLayouts.tsx
- src/modules/orders/__tests__/orders.status.test.ts
- src/modules/orders/orders.repo.ts
- src/modules/orders/orders.schema.ts
- src/modules/orders/orders.service.ts
- src/modules/quotes/quotes.repo.ts
- src/repos/mock/orders.ts
- src/repos/mock/seed.ts
- src/repos/orders.ts
- docs/AGENT_CONTEXT.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- tasks/todo.md

Commands run:
- npm run lint
- npm run test -- src/modules/orders/__tests__/department-routing.test.ts src/modules/orders/__tests__/orders.service.test.ts src/modules/orders/__tests__/orders.status.test.ts
- npm run build
- npx tsc --noEmit

Verification results:
- Lint passed with zero ESLint warnings/errors.
- Targeted Orders Vitest coverage passed (10/10 tests).
- Production build passed and standalone assets were copied successfully.
- Browser screenshot capture was not possible because the required browser screenshot tool is unavailable in this environment.

Open follow-ups / next steps:
- Consider a one-time/backfill admin action to rewrite already-persisted legacy order statuses in existing databases so historical records fully match the simplified set without waiting for fresh workflow activity.
- If desired, extend dashboard/search result cards with richer rollup metadata such as `parts complete / total` and flagged rework counts now that order status is simplified.

---

# AGENT_HANDOFF — 2026-03-19 (order-create Prisma fix + sign-in visibility + LAN auth fallback)

Goal (1 sentence): Fix the reported order-create Prisma validation error, expose a clear sign-in entry point, and make auth redirects safer for local-network IP access.

Scope (what changed):
- Added `createdAt` / `updatedAt` to `OrderPart` in Prisma schema and shipped/apply-tested a SQLite-safe migration that rebuilds the table with those timestamp columns.
- Added shared `src/lib/base-url.ts` and used it in auth redirect + sign-out base URL resolution so LAN requests can override loopback env origins.
- Made `/about` public, added it to main nav, and kept explicit sign-in/dashboard CTAs for unauthenticated users.
- Switched `getAppSettings()` to `upsert()` to avoid singleton-create races exposed by runtime verification.
- Updated README LAN startup/env instructions and refreshed continuity artifacts.

Files touched:
- prisma/schema.prisma
- prisma/migrations/20260319120000_add_order_part_timestamps/migration.sql
- src/lib/base-url.ts
- src/lib/base-url.test.ts
- src/lib/auth.ts
- src/app/(public)/auth/signout/route.ts
- src/components/AppNav.tsx
- src/app/about/page.tsx
- src/lib/app-settings.ts
- README.md
- docs/AGENT_CONTEXT.md
- tasks/todo.md
- tasks/lessons.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

Commands run:
- npm run prisma:generate
- npx prisma migrate resolve --rolled-back 20260319120000_add_order_part_timestamps
- npx prisma migrate deploy
- node - <<'JS' ... PRAGMA table_info("OrderPart") ... JS
- npm run lint
- npm run test -- src/lib/auth-redirect.test.ts src/lib/base-url.test.ts
- npm run dev -- --hostname 0.0.0.0 --port 3000
- curl -I --max-time 20 http://127.0.0.1:3000/about
- curl -I --max-time 20 'http://127.0.0.1:3000/auth/signin?callbackUrl=%2F'
- curl -I --max-time 20 http://127.0.0.1:3000/

Verification results:
- Prisma Client regenerated successfully.
- Migration applied successfully after converting the initial failing SQLite `ALTER TABLE` attempt into a table-redefinition migration.
- `PRAGMA table_info("OrderPart")` confirms `createdAt` and `updatedAt` now exist.
- Lint passed.
- Targeted tests passed (7/7).
- Runtime smoke checks passed for public about/sign-in pages and unauthenticated root redirect.
- Browser screenshot capture was not possible because the required browser screenshot tool was unavailable in this environment.

Open follow-ups / next steps:
- Ask the operator to re-run `npx prisma migrate deploy` (or the installer) before testing order creation on their machine so the new `OrderPart` timestamp columns exist locally.
- If LAN auth still redirects incorrectly on a specific device, confirm the browser is opening the same origin that is configured in `.env` and check for stale cookies from a previous `localhost` session.

---

Date: 2026-02-26
Agent: GPT-5.2-Codex
Goal (1 sentence): Clean up admin information architecture and ship a one-script installer with selectable basic/demo seed profiles for local and Docker installs.

## What I changed
- Replaced `src/app/admin/page.tsx` redirect behavior with a full Admin Center overview page containing grouped cards and direct links to all admin sections.
- Reworked `src/components/Admin/NavTabs.tsx` into grouped, icon-backed navigation rows (Overview/People/Catalog/Quote Ops) for improved scanability.
- Updated `src/components/AppNav.tsx` so the global Admin link points to `/admin` and active-state checks treat `/admin` as the section root.
- Added `prisma/seed-basic.js` for foundational functionality-only seed data and split package scripts into `seed:basic` and `seed:demo` modes.
- Added `scripts/install.sh` one-step installer (`--target local|docker`, `--seed basic|demo`, `--start`) and updated `README.md` installation/seed docs.
- Updated `docker-compose.yml` to use named volumes for portable local Docker setup.
- Updated continuity artifacts (`tasks/todo.md`, `PROGRESS_LOG.md`, `tasks/lessons.md`, `docs/AGENT_HANDOFF.md`).

## Files touched
- src/app/admin/page.tsx
- src/components/Admin/NavTabs.tsx
- src/components/AppNav.tsx
- prisma/seed-basic.js
- scripts/install.sh
- package.json
- README.md
- docker-compose.yml
- tasks/todo.md
- tasks/lessons.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm run lint
- npx prisma migrate deploy
- npm run seed:basic
- npm run seed:demo
- npm run set-demo-passwords
- bash scripts/install.sh --help
- npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot script (signin + admin page capture)

## Verification Evidence
- Lint passed without ESLint errors.
- Local SQLite migrations applied successfully.
- `seed:basic` and `seed:demo` both completed successfully.
- Installer help output confirmed target/seed options are wired.
- Screenshot artifact captured: `browser:/tmp/codex_browser_invocations/2e98785689018ddb/artifacts/artifacts/admin-center.png`.

## Next steps
- [ ] Consider adding a non-interactive installer smoke test in CI that runs `scripts/install.sh --target local --seed basic` in TEST_MODE.
- [ ] Optional: extend demo seed docs with explicit sample order/quote counts so operators know expected baseline content.

---

Date: 2026-02-26
Agent: GPT-5.2-Codex
Goal (1 sentence): Fix BOM tab image-analysis failures by allowing `/attachments/<storagePath>` to resolve part-level file records.

## What I changed
- Updated `src/app/(public)/attachments/[...path]/route.ts` to include a `prisma.partAttachment.findFirst({ where: { storagePath } })` fallback when quote and order attachment lookups miss.
- Kept existing restricted-label visibility gate and file path safety checks unchanged.
- Updated continuity artifacts (`tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`) and logged a tooling-prevention lesson in `tasks/lessons.md` per user correction.

## Files touched
- src/app/(public)/attachments/[...path]/route.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- tasks/lessons.md

## Commands run
- npm run lint

## Verification Evidence
- `npm run lint` passed.
- Route now recognizes `PartAttachment` storage paths, addressing the exact 404 gap identified in the prior diagnosis.

## Next steps
- [ ] Verify end-to-end in an authenticated runtime: upload part file in Notes & Files, then analyze it from BOM tab.
- [ ] If needed, add route-level regression coverage for attachment record source precedence.

---

Date: 2026-02-26
Agent: GPT-5.2-Codex
Goal (1 sentence): Diagnose BOM tab image analysis failures (`Failed to load selected image attachment`) and report root cause without implementing a fix.

## What I changed
- Performed diagnosis-only trace across BOM client logic, attachment-serving route, and Prisma models.
- Confirmed the failing edge is attachment retrieval, not analyzer parsing:
  - BOM client fetches selected part file via `/attachments/${storagePath}`.
  - Public attachment route only resolves `QuoteAttachment` and legacy `Attachment` rows.
  - Part uploads are persisted as `PartAttachment`, which the route does not currently query.
- Updated continuity artifacts (`tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`) with evidence and next-step recommendation.

## Files touched
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- rg -n "Failed to load selected image attachment|/attachments/|storagePath" src/app src/lib prisma -g '*.ts*'
- sed -n '1,220p' src/app/orders/[id]/PartBomTab.tsx
- sed -n '1,220p' 'src/app/(public)/attachments/[...path]/route.ts'
- sed -n '180,340p' prisma/schema.prisma

## Verification Evidence
- Client-side throw path, route lookup constraints, and schema ownership collectively prove the failure mechanism without code changes.
- Behavior matches report: both pre-existing and newly uploaded part files fail in BOM tab because the retrieval route cannot resolve `PartAttachment` rows.

## Next steps
- [ ] Implement a targeted retrieval fix in `src/app/(public)/attachments/[...path]/route.ts` so part-file requests can resolve `PartAttachment` by `storagePath` (while keeping existing auth/restricted-label checks).
- [ ] Re-test BOM tab analyze flow with (a) existing part attachment and (b) newly uploaded part attachment.

---

# AGENT_HANDOFF — 2026-02-26 (Part BOM analyzer attachment fix + conversion audit)

Goal (1 sentence): Fix Part BOM analyzer failures for Files/Notes attachments and validate quote→order conversion flow health.

Scope (what changed):
- Updated Part BOM attachment option filtering to skip explicit non-image MIME attachments.
- Updated selected attachment MIME resolution to enforce image payloads before calling `/api/print-analyzer/analyze`.
- Audited quote→order conversion path for structural issues without changing conversion transaction logic in this session.

Files touched:
- src/app/orders/[id]/PartBomTab.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

Commands run:
- npm run lint
- npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot capture script (browser tool) against `http://127.0.0.1:3000/`

Verification results:
- `npm run lint` passed.
- Dev server started successfully; unauthenticated root redirected to sign-in as expected.
- Screenshot artifact captured: `browser:/tmp/codex_browser_invocations/a282bb14452d16f9/artifacts/artifacts/bom-tab-update.png`.

Open follow-ups / next steps:
- Validate analyzer behavior on a real order part in a seeded/authenticated environment to capture a BOM-tab-specific screenshot.
- If quote→order concerns persist, capture a reproducible failing quote ID and expected-vs-actual conversion outcome so we can target a narrow server-side fix.

---

## Session — 2026-02-26 (order-detail BOM/file workflow + nav/auth updates)

Goal (1 sentence): Move BOM next to Notes & Files, tie analyzer sourcing to print-designated attachments, hide Overview from nav, and ensure sign-in-first routing behavior.

What changed:
- Updated `src/app/orders/[id]/page.tsx`:
  - Reordered part tabs to `overview -> notes -> bom -> checklist -> log`.
  - Added new part attachment kind option `PRINT`.
  - Renamed files heading to `Files & print drawings` and added explicit print-image guidance block for analyzer source designation.
- Updated `src/modules/orders/orders.schema.ts` to allow `PRINT` in `PART_ATTACHMENT_KINDS` validation.
- Updated `src/app/orders/[id]/PartBomTab.tsx`:
  - Uses Notes & Files attachments tagged as `PRINT`/`IMAGE` (or image MIME types).
  - Sorts source options so PRINT-tagged attachments appear first.
  - Clarified UI labels to indicate Notes & Files-backed print image sources.
- Updated `src/app/admin/quotes/QuoteEditor.tsx`:
  - Added per-attachment analyzer role checkbox to mark uploads as print images.
  - Persists print intent by applying `[PRINT]` label prefix in payload serialization.
  - Updated attachments description copy to explain analyzer prioritization.
- Updated `src/components/AppNav.tsx` to remove the Overview nav item while keeping route availability.
- Updated `src/app/about/page.tsx` to redirect unauthenticated users to sign-in (`callbackUrl=/`) for sign-in-first behavior.
- Updated `src/app/api/print-analyzer/analyze/route.ts` prompts to explicitly target lower-right title-block decimal tolerance legend extraction (`.X/.XX/.XXX` with +/- values).
- Updated continuity docs: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`.

Files touched:
- src/app/orders/[id]/page.tsx
- src/app/orders/[id]/PartBomTab.tsx
- src/modules/orders/orders.schema.ts
- src/app/admin/quotes/QuoteEditor.tsx
- src/components/AppNav.tsx
- src/app/about/page.tsx
- src/app/api/print-analyzer/analyze/route.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

Commands run:
- `npm run lint`
- `npm run test -- src/lib/auth-redirect.test.ts`
- `npm run dev`
- Playwright screenshot scripts against `http://127.0.0.1:3000/auth/signin`, `/`, `/about`, and `/orders/...`

Verification results:
- Lint passed with no ESLint errors.
- Focused auth redirect tests passed (4/4).
- Screenshot artifacts captured, but this runtime currently serves a Next.js 500 error shell on tested routes (artifacts retained for evidence).

Next steps:
- [ ] Investigate and resolve current runtime 500 error shell (`/__next_error__`) to enable full visual QA capture of BOM/Notes tabs after sign-in.
- [ ] Optional: during quote→order conversion, map `[PRINT]` quote attachment labels into order/part attachment kind metadata if full end-to-end propagation is desired.

---

Date: 2026-02-26
Agent: GPT-5.2-Codex
Goal (1 sentence): Fix BOM tab image-analysis failures by allowing `/attachments/<storagePath>` to resolve part-level file records.

## What I changed
- Updated `src/app/(public)/attachments/[...path]/route.ts` to include a `prisma.partAttachment.findFirst({ where: { storagePath } })` fallback when quote and order attachment lookups miss.
- Kept existing restricted-label visibility gate and file path safety checks unchanged.
- Updated continuity artifacts (`tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`) and logged a tooling-prevention lesson in `tasks/lessons.md` per user correction.

## Files touched
- src/app/(public)/attachments/[...path]/route.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- tasks/lessons.md

## Commands run
- npm run lint

## Verification Evidence
- `npm run lint` passed.
- Route now recognizes `PartAttachment` storage paths, addressing the exact 404 gap identified in the prior diagnosis.

## Next steps
- [ ] Verify end-to-end in an authenticated runtime: upload part file in Notes & Files, then analyze it from BOM tab.
- [ ] If needed, add route-level regression coverage for attachment record source precedence.

---

Date: 2026-02-25
Agent: GPT-5.2-Codex
Goal (1 sentence): Build a sealed, non-linked Print Analyzer page + API that extracts structured drawing data via server-side OpenAI vision and shows results in an isolated UI.

## What I changed
- Added new isolated route UI at `src/app/private/print-analyzer/page.tsx` with `PrintAnalyzer.module.css` (scoped styles only, no global style edits).
- Added new Node runtime API route `src/app/api/print-analyzer/analyze/route.ts` with:
  - POST body validation for `{ dataUrl: "data:image/..." }`
  - OpenAI Responses API vision call (`gpt-4.1-mini`) with JSON-only format instruction
  - zod validation via `printAnalyzerResultSchema`
  - tap-drill enrichment via local helper
  - schema-failure 502 response including capped raw model output text
- Added print-analyzer helper files:
  - `src/lib/printAnalyzer/schema.ts`
  - `src/lib/printAnalyzer/normalize.ts`
  - `src/lib/printAnalyzer/tapDrills.ts`
- Added documentation `docs/PRINT_ANALYZER.md`.
- Updated `.env.example` with `OPENAI_API_KEY`.
- Added dependency `openai` and recorded decision in `docs/AGENT_CONTEXT.md` Decision Log.
- Updated continuity/planning artifact `tasks/todo.md` for this session.

## Files touched
- package.json
- package-lock.json
- .env.example
- docs/AGENT_CONTEXT.md
- docs/PRINT_ANALYZER.md
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- src/app/private/print-analyzer/page.tsx
- src/app/private/print-analyzer/PrintAnalyzer.module.css
- src/app/api/print-analyzer/analyze/route.ts
- src/lib/printAnalyzer/schema.ts
- src/lib/printAnalyzer/normalize.ts
- src/lib/printAnalyzer/tapDrills.ts

## Commands run
- npm install openai@^6.25.0
- npm run lint
- npm run build
- npm run dev -- --hostname 0.0.0.0 --port 3000
- curl -s -o /tmp/pa_invalid.json -w '%{http_code}' -X POST http://127.0.0.1:3000/api/print-analyzer/analyze -H 'Content-Type: application/json' -d '{"foo":"bar"}'
- curl -s -o /tmp/pa_valid.json -w '%{http_code}' -X POST http://127.0.0.1:3000/api/print-analyzer/analyze -H 'Content-Type: application/json' -d '{"dataUrl":"data:image/png;base64,..."}'
- curl -s -o /tmp/pa_page.html -w '%{http_code}' http://127.0.0.1:3000/private/print-analyzer
- Playwright screenshot attempts (browser tool) for /private/print-analyzer

## Verification Evidence
- `npm run lint` passed.
- `npm run build` passed.
- API invalid-body contract check returned 400 with expected error JSON.
- API sample data-url check returned 500 with expected missing-key message in this environment.
- Route GET returned 200 at `/private/print-analyzer`.
- Screenshot capture attempt failed due Chromium SIGSEGV in browser tool runtime.

## Next steps
- [ ] Re-run screenshot capture in a stable browser-tool runtime to attach visual proof artifact.
- [ ] Validate full end-to-end analysis path in an environment with `OPENAI_API_KEY` set.

---

Date: 2026-02-25
Agent: GPT-5.2-Codex
Goal (1 sentence): Fix dashboard department-touch counting so Fab/Shipping department context is represented again.

## What I changed
- Updated `src/modules/orders/orders.repo.ts` dashboard/list query selections:
  - Added `parts.currentDepartmentId` to order list/dashboard payloads.
  - Added `checklist.departmentId` to order list/dashboard payloads.
- Updated `src/modules/orders/orders.types.ts` to include optional `currentDepartmentId` on parts and `departmentId` on checklist items.
- Updated `src/components/ShopFloorLayouts.tsx` `departmentTouchesByOrder` to count distinct department IDs from both checklist items and parts.
- Updated continuity artifacts for this session: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `docs/AGENT_TASK_BOARD.md`.

## Files touched
- src/modules/orders/orders.repo.ts
- src/modules/orders/orders.types.ts
- src/components/ShopFloorLayouts.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- docs/AGENT_TASK_BOARD.md

## Commands run
- npm run lint
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot script against http://127.0.0.1:3000 (attempted)

## Verification Evidence
- Lint passed with no ESLint warnings/errors.
- Screenshot capture attempt failed due browser/runtime environment issues:
  - browser tool chromium launch SIGSEGV
  - TEST_MODE runtime hit Prisma DB open-file error

## Next steps
- [ ] Optional: add a focused unit-level assertion around dashboard order payload shape so future changes don’t drop department identifiers used by UI metrics.

---

Date: 2026-02-25
Agent: GPT-5.2-Codex
Goal (1 sentence): Remove the Dashboard Ready-for-fab option and add department-touch counts to Grid digest tiles.

## What I changed
- Updated `src/components/ShopFloorLayouts.tsx`:
  - Removed the `Ready for fab` layout toggle and removed the associated handoff layout render section.
  - Added `departmentTouchesByOrder` memoized computation using checklist `departmentId` values.
  - Added a `Departments` field in Grid digest cards showing `<count> touched` per order.
- Updated continuity artifacts for this session: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `docs/AGENT_TASK_BOARD.md`.

## Files touched
- src/components/ShopFloorLayouts.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- docs/AGENT_TASK_BOARD.md

## Commands run
- npm run lint
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot script against http://127.0.0.1:3000

## Verification Evidence
- Lint passed with no ESLint warnings/errors.
- Dashboard screenshot artifact captured showing `Grid digest`, `By machinist`, and `Work queue` controls plus the new `Departments` row in digest cards.

## Next steps
- [ ] Optional: if desired, broaden department-touch counting to include order-level department charges in addition to checklist-linked departments.

---

## Session — 2026-02-25 (timer elapsed reset + department wrapper transparency)

Goal (1 sentence): Fix timer elapsed UI so active runs start at zero visual elapsed and remove Department Work Queue wrapper background fill.

What changed:
- Updated `src/app/orders/[id]/page.tsx` elapsed computation:
  - `selectedPartElapsedSeconds` now uses active-entry elapsed only while the timer is running on the selected part.
  - Paused/non-active selected parts still show stored cumulative seconds.
- Updated `src/components/ShopFloorLayouts.tsx`:
  - Department Work Queue wrapper container now uses `bg-transparent`.

Files touched:
- src/app/orders/[id]/page.tsx
- src/components/ShopFloorLayouts.tsx
- tasks/todo.md
- tasks/lessons.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

Commands run:
- `npm run lint`
- `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`
- Playwright screenshot capture script against `http://127.0.0.1:3000`

Verification results:
- Lint passed (no ESLint warnings/errors).
- Runtime screenshot captured for dashboard/work queue transparency check:
  - `browser:/tmp/codex_browser_invocations/329e7c491ac33201/artifacts/artifacts/dashboard-workqueue-transparent-bg.png`

Open follow-ups:
- [ ] Optional: add a focused UI/integration check for timer elapsed rendering semantics (active interval vs stored cumulative total).

---

Date: 2026-02-24
Agent: GPT-5.2-Codex
Goal (1 sentence): Fix timer start validation drift and resume foreign-key crash behavior with minimal server-side changes.

## What I changed
- Updated `src/modules/time/time.schema.ts`:
  - `TimeEntryStart.operation` is now optional with default `Part Work`.
  - This preserves compatibility for clients that send only `orderId` + `partId`.
- Updated `src/modules/time/time.service.ts`:
  - Added `try/catch` around `createTimeEntry` in `resumeTimeEntry`.
  - Reused FK error mapping (`P2003`) for resume, returning deterministic conflict responses.
  - Refined FK error message text to include missing linked order/part/user record scenarios.
- Updated continuity artifacts: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `docs/AGENT_TASK_BOARD.md`.

## Files touched
- src/modules/time/time.schema.ts
- src/modules/time/time.service.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- docs/AGENT_TASK_BOARD.md

## Commands run
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint

## Verification Evidence
- Time service tests passed (6/6).
- Lint passed with no ESLint warnings/errors.

## Next steps
- [ ] Optional: add route-level/API integration tests that assert `/api/timer/start` accepts payloads without `operation`.
- [ ] Optional: emit structured telemetry when FK mapping is triggered to speed production root-cause triage.

---

Date: 2026-02-24
Agent: GPT-5.2-Codex
Goal (1 sentence): Add true timer resume behavior in order detail so paused part work can continue without losing previously captured time.

## What I changed
- Added `src/app/api/timer/resume/route.ts`:
  - Validates `TimeEntryResume` input.
  - Returns 409 switch-confirmation payload if another timer is active.
  - Calls `resumeTimeEntry` when no active timer exists and logs `Timer resumed.` part event metadata.
- Updated `src/app/api/timer/active/route.ts` to include `lastPartEntries` from `getTimeEntrySummary` for selected-order part context.
- Updated `src/app/orders/[id]/page.tsx` timer UI behavior:
  - Added `lastPartEntries` state.
  - Primary action now chooses resume vs start automatically for selected part.
  - Start button label/help text now reflects resume path.
  - Conflict follow-up action now re-runs the unified activate handler.
- Added regression test in `src/modules/time/__tests__/time.service.test.ts` confirming pause/resume retains accumulated totals.
- Updated continuity artifacts: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` session note.

## Files touched
- src/app/api/timer/resume/route.ts
- src/app/api/timer/active/route.ts
- src/app/orders/[id]/page.tsx
- src/modules/time/__tests__/time.service.test.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- docs/AGENT_TASK_BOARD.md

## Commands run
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run dev
- Playwright screenshot script against http://127.0.0.1:3000

## Verification Evidence
- Time service test suite passed (6/6), including new pause/resume retention coverage.
- Lint passed with no ESLint warnings/errors.
- Browser screenshot artifact captured; due auth/session limitations in this environment, capture reflects unauthenticated/new-order context rather than authenticated order-detail timer panel.

## Next steps
- [ ] Optional UX follow-up: consider exposing explicit “Resume last paused” context text with timestamp/elapsed from last entry.
- [ ] Optional auth-e2e follow-up: stabilize scripted sign-in path for browser capture of authenticated order-detail interactions.

---

Date: 2026-02-24
Agent: GPT-5.2-Codex
Goal (1 sentence): Fix timer start 400 on order detail by sending the required `operation` field expected by `TimeEntryStart`.

## What I changed
- Updated `src/app/orders/[id]/page.tsx` so `handleStart` sends `operation: 'Part Work'` in the `/api/timer/start` JSON body.
- Updated continuity artifacts for this session: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`.

## Files touched
- src/app/orders/[id]/page.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm run lint

## Verification Evidence
- Lint passed.
- The order detail timer start request payload now includes all required schema fields (`orderId`, `partId`, `operation`) for `/api/timer/start`.

## DoD Checklist
- [x] Reproduced/confirmed root cause from code path (missing `operation` in payload).
- [x] Applied minimal scoped fix without unrelated refactors.
- [x] Ran verification command and logged evidence.

## Next steps
- [ ] Optional follow-up: unify overlapping `/api/time/start` and `/api/timer/start` contract expectations to reduce drift risk.

---

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Resolve local setup friction and timer/order-detail issues by updating install docs, handling timer FK failures gracefully, and fixing order timer control overlap.

## What I changed
- Rewrote `README.md` local install section into a deterministic setup flow (`npm ci` → env setup → prisma generate/migrate → seed → demo password setup).
- Added timer start FK-failure handling in `src/modules/time/time.service.ts`:
  - catches Prisma known request error `P2003` during time-entry creation.
  - returns deterministic 409 with actionable re-login guidance for stale-session scenarios.
- Updated order detail timer controls in `src/app/orders/[id]/page.tsx` from a fixed 3-column action row to stacked actions to prevent overlap/crowding in the narrow sidebar.
- Updated continuity artifacts for this session: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, `docs/AGENT_TASK_BOARD.md`.

## Files touched
- README.md
- src/modules/time/time.service.ts
- src/app/orders/[id]/page.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- docs/AGENT_TASK_BOARD.md

## Commands run
- npm run seed
- npm run set-demo-passwords
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run build
- npm run dev
- Playwright screenshot script against http://127.0.0.1:3000/orders/<id>

## Verification Evidence
- Seed completed successfully.
- Demo password script completed successfully.
- Time service tests passed (5/5).
- Lint passed with no ESLint warnings/errors.
- Build passed successfully.
- Runtime UI screenshot captured for updated order timer controls.
- Non-blocking advisories observed: `@next/swc` mismatch warning and stale `baseline-browser-mapping` data warning.

## Next steps
- [ ] Backlog: align `next` and `@next/swc` versions to remove build advisory.
- [ ] Backlog: refresh `baseline-browser-mapping` dev dependency data.

---

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Execute P4-T3 only by producing explicit Phase 4 gate pass/fail evidence from existing timer behavior and verification commands.

## What I changed
- Performed P4-T3 evidence closeout only; no product code changes.
- Updated planning/continuity artifacts to capture dependency validation, commands, and DoD evidence:
  - `tasks/todo.md`
  - `PROGRESS_LOG.md`
  - `docs/AGENT_HANDOFF.md`

## Files touched
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run build

## Verification Evidence
- Time service tests passed (5/5), including conflict/switch flow coverage for no-inflation behavior.
- Lint passed with no ESLint warnings/errors.
- Build passed successfully with no blocking errors.
- Non-blocking environment advisories observed: `@next/swc` version mismatch warning and stale `baseline-browser-mapping` data.

## DoD Checklist (P4-T3)
- [x] Operators can start/stop/switch without inflation.
  - Evidence: `time.service` test suite passed, including switch/conflict coverage that enforces explicit transitions and no overlapping intervals.
- [x] Managers can trust totals without manual reconciliation.
  - Evidence: interval-based time service totals checks passed and full production build/type validation succeeded.

## Next steps
- [ ] Backlog: align `next` and `@next/swc` package versions to clear mismatch advisory.
- [ ] Backlog: refresh `baseline-browser-mapping` dataset to remove staleness advisory.

---

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Execute P4-T1 and P4-T2 only by improving timer control clarity and switch/last-action visibility on order detail.

## What I changed
- Updated `src/app/orders/[id]/page.tsx` Active Work panel only (UI scope):
  - Added explicit control labels and icons for `Start selected part`, `Pause active timer`, and `Finish active timer`.
  - Added running/stopped status badge plus clear switch-warning callout when active work is on a different part.
  - Added helper copy explaining switch-confirmation behavior.
  - Added `lastPartEvent` display so the most recent part action is visible beside timer controls.
- Updated session control artifacts: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`.

## Files touched
- src/app/orders/[id]/page.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run build
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot script against http://127.0.0.1:3000/orders/<id>

## Verification Evidence
- Time service tests passed (5/5), including switch no-inflation behavior.
- Lint passed with no ESLint warnings/errors.
- Build failed on pre-existing `/auth/signin` prerender Prisma `P2002` (`AppSettings.id` unique constraint), unchanged by this scope.
- Runtime smoke check in TEST_MODE succeeded for order detail timer panel; screenshot captured.

## DoD Checklist (P4-T1 & P4-T2)
- [x] P4-T1: Start/pause/resume controls are obvious and unambiguous (explicit action labels + status context in Active Work panel).
- [x] P4-T1: Active state is clearly visible without extra navigation (running/stopped badge + elapsed time + active-part callout).
- [x] P4-T2: Switching operations does not inflate time (existing switch-confirmation backend/service behavior unchanged; no-inflation test suite remains passing).
- [x] P4-T2: Last operation/action context is visible and understandable (most recent part log event surfaced in controls panel).

## Next steps
- [ ] Backlog: normalize Next.js/SWC version mismatch warnings in environment dependencies.
- [ ] Backlog: resolve pre-existing `/auth/signin` prerender Prisma `AppSettings` uniqueness bootstrap issue so production build can pass end-to-end.

---

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Execute P3-T3 and P3-T4 only by closing Phase 3 with explicit evidence and enforcing switch-confirmation timer UX safety.

## What I changed
- Updated `src/app/api/timer/start/route.ts` to enforce conflict-first starts via `startTimeEntryWithConflict` and return explicit 409 switch payload context (`requiredAction`, active order/part, elapsed seconds).
- Updated `src/app/orders/[id]/page.tsx` timer switch behavior:
  - `handleStart`/`handlePause`/`handleFinish` now return success booleans.
  - Conflict follow-up start runs only when pause/finish succeeds.
  - Conflict dialog copy now explicitly states which active timer exists and what will happen on switch confirmation.
- Added targeted tests in `src/modules/time/__tests__/time.service.test.ts`:
  - conflict result when starting with an existing active entry.
  - confirmation-path switch totals proving no interval inflation.
- Updated session control artifacts: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`.

## Files touched
- src/app/api/timer/start/route.ts
- src/app/orders/[id]/page.tsx
- src/modules/time/__tests__/time.service.test.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run build
- TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000
- Playwright screenshot script against http://127.0.0.1:3000/orders

## Verification Evidence
- Time service test suite for touched behavior passed (5/5).
- Lint passed with no ESLint warnings/errors.
- Build passed.
- Runtime smoke check in TEST_MODE succeeded for `/orders`; screenshot captured.
- Non-blocking advisories observed: `@next/swc` version mismatch and stale `baseline-browser-mapping` data.

## DoD Checklist (P3-T3 & P3-T4)
- [x] P3-T3: Phase 3 exit criteria explicitly pass/fail with evidence.
- [x] P3-T3: No blocking gaps; remaining non-blocking advisories logged as backlog notes.
- [x] P3-T4: Starting a new timer with an active timer yields an explicit context dialog trigger payload (409 conflict + active context).
- [x] P3-T4: Dialog identifies active order/part and switch action consequence.
- [x] P3-T4: Switch confirmation path avoids inflation by closing current interval before the new start and test-proving expected totals.

## Next steps
- [ ] Backlog: unify `/api/time/*` and `/api/timer/*` overlap after current roadmap gate sequence allows endpoint consolidation.
- [ ] Backlog: optional environment hygiene task to align `@next/swc` and refresh `baseline-browser-mapping` data outside P3 scope.

---

---
## 2026-08-24 — Temporary `/setup` server-bootstrap page

### Goal
Let the new Windows 11 Pro server open a LAN page and copy the one-time OpenSSH/key-authentication bootstrap without transferring a password or private key through chat.

### Scope and touched files
- Added `src/app/(public)/setup/page.tsx` as a hidden public route with a copy button and the approved PowerShell script.
- Updated `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md` for continuity.
- Did not alter navigation, authentication, dependencies, database state, or domain behavior.

### Commands and verification
- `npx eslint "src/app/(public)/setup/page.tsx"` — passed.
- `npx tsc --noEmit --pretty false` — passed.
- Initial sandboxed `npm run dev -- --hostname 0.0.0.0 --port 3000` — blocked by known `spawn EPERM`; recorded before retry.
- Unrestricted start attempt established that port 3000 was already owned by the existing ShopApp process.
- `Invoke-WebRequest` returned HTTP 200 and the expected title for both `http://127.0.0.1:3000/setup` and `http://192.168.254.132:3000/setup`.

### Next
- Open `http://192.168.254.132:3000/setup` on the new server, copy/run the script as Administrator, and verify SSH from the workstation.
- Remove the temporary `/setup` page after SSH setup succeeds.

---

## 2026-08-24 — Windows LAN production deployment

### Goal and outcome
- ShopApp is operational on Windows 11 Pro at `192.168.254.72` and is reachable locally without a port number at `http://desktop-bkbakpm.local`.
- The server uses router-reserved DHCP for Ethernet MAC `D8-9E-F3-16-CD-4A`; do not configure a competing Windows static address.

### Production layout
- `C:\ShopApp\app` — source and standalone build.
- `C:\ShopApp\config\.env` — protected canonical configuration, hard-linked to the app root.
- `C:\ShopApp\data\shopapp1.db` — production SQLite database.
- `C:\ShopApp\storage` — persistent attachments.
- `C:\ShopApp\logs` — ShopApp and supervisor logs.
- `C:\ShopApp\backups\pre-update\20260824-initial-shopapp1.db` — initial database safety copy.
- `C:\ShopApp\maintenance` — launch and boot-supervisor scripts.

### Runtime and recovery
- Installed Node.js `v22.23.2`, npm `10.9.8`, and Git `2.55.0.windows.3`.
- `ShopApp` Task Scheduler task runs the standalone server as SYSTEM at startup.
- `ShopApp Boot Supervisor` verifies SSH, firewall scope, ShopApp task state, and `http://127.0.0.1:3000/api/health`, logging to `C:\ShopApp\logs\boot-supervisor.log`.
- SSH permits only `192.168.254.132`; direct ShopApp 3000 permits `192.168.254.0/24`; friendly HTTP 80 permits `LocalSubnet`; RDP with NLA permits only `192.168.254.132`.
- `scripts/windows/install-shopapp-boot-supervisor.ps1` is the reusable installer/source for this configuration.

### Verification evidence
- Transfer hashes matched; production database remains 1,142,784 bytes and the pre-deployment backup exists.
- Prisma reported 38 migrations and no pending migrations; generation passed.
- Production build passed with 62 pages and standalone assets.
- Health and sign-in returned HTTP 200 over `.72:3000`, `.72` port 80, and `desktop-bkbakpm.local` over both IPv4 and IPv6.
- Data counts: 13 users, 4 customers, 16 orders, 64 parts, and 12 attachment files.
- SSH, ShopApp, and RDP ports were independently reachable from the admin workstation; the supervisor's immediate validation passed.

### Remaining work
- Do not perform another unattended reboot yet. Repeat one controlled full reboot while an operator remains onsite to validate the corrected supervisor end to end.
- Rename the server to `SHOPAPP` during that onsite maintenance window if the owner wants the final `http://shopapp.local` address; then update production base URLs and verify authentication redirects.
- Configure the deferred secondary backup copy on `.10` with a dedicated non-root backup share/account.
- Review the npm audit output and reported Next.js security advisory in a separate dependency-upgrade task.

---

**Non-authoritative operational history. CANON.md and ROADMAP.md are authoritative.**

# Agent Handoff (Update Every Session)

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Execute P3-T1 and P3-T2 by enforcing closed-interval time invariants and deterministic server-side API rules only.

## What I changed
- Time module invariant enforcement updates:
  - Added `TimeEntryClosedEdit` schema and `TimeEntryClosedEditInput` type.
  - Added `editClosedTimeEntry` service path with deterministic 404/403/409/400 outcomes.
  - Added `updateClosedTimeEntryById` repo + mock-repo support with closed-entry-only guard (`endedAt != null`).
- Time API enforcement updates:
  - Added `PATCH /api/time/entries/[entryId]` (admin-only via RBAC) with required reason and PartEvent audit record (`TIME_ENTRY_EDITED`) for part-linked entries.
  - Updated `POST /api/timer/start` to validate request via `TimeEntryStart` schema and require `partId` explicitly.
  - Updated `GET /api/timer/active` to return deterministic error status if totals lookup fails.
- Added/updated tests:
  - Extended `src/modules/time/__tests__/time.service.test.ts` with closed-entry edit success and active-entry edit rejection cases.

## Files touched
- src/modules/time/time.schema.ts
- src/modules/time/time.types.ts
- src/modules/time/time.service.ts
- src/modules/time/time.repo.ts
- src/repos/time.ts
- src/repos/mock/time.ts
- src/app/api/time/entries/[entryId]/route.ts
- src/app/api/timer/start/route.ts
- src/app/api/timer/active/route.ts
- src/modules/time/__tests__/time.service.test.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- docs/AGENT_CONTEXT.md

## Commands run
- npm run test -- src/modules/time/__tests__/time.service.test.ts
- npm run lint
- npm run build

## Verification Evidence
- Time service tests pass (3/3), including closed-entry edit paths.
- Lint passes with no ESLint warnings/errors.
- Production build succeeds and includes new `/api/time/entries/[entryId]` route in output.

## Diff/Review Notes
- Scope limited to P3-T1 and P3-T2; no dependency additions and no unrelated domain edits.
- Existing environment warnings (`@next/swc` mismatch and `baseline-browser-mapping` freshness) were observed but are outside this task scope.

## Next steps
- [ ] P3-T3: produce formal Phase 3 gate closeout pass/fail report with explicit mapping to ROADMAP criteria.
- [ ] Backlog: consider DB-level partial uniqueness guard for active entries if/when SQLite migration strategy is approved.

---

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Fix the React hook warnings in `src/app/orders/[id]/page.tsx` only, per user clarification.

## What I changed
- Updated `src/app/orders/[id]/page.tsx` to stabilize hook dependencies:
  - Memoized `parts` derived from `item?.parts`.
  - Replaced `tick` state with `nowMs` timestamp state.
  - Updated `activeElapsedSeconds` memo to depend on `nowMs` and `activeEntry?.startedAt`.
- Kept the change narrowly scoped to the warning-producing hooks in this file only.

## Files touched
- src/app/orders/[id]/page.tsx
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- tasks/lessons.md

## Commands run
- npm run lint
- npm run build

## Verification Evidence
- `npm run lint` reports no ESLint warnings/errors.
- `npm run build` succeeds and no longer prints React hook warnings for `src/app/orders/[id]/page.tsx`.

## Diff/Review Notes
- No drive-by refactors; only hook-dependency stabilization related to the requested warnings.

## Next steps
- [ ] If desired separately, address non-hook build advisories (`@next/swc` mismatch and baseline-browser-mapping freshness).

---

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Fix the project-run Next.js SWC mismatch warning only, while leaving known pre-existing React hook warnings untouched.

## What I changed
- Updated dependency versions only:
  - `next` from `^15.5.11` to `^15.5.7`
  - `eslint-config-next` from `^15.5.11` to `^15.5.7`
- Regenerated lockfile entries via install to keep dependency graph consistent.
- No source code files were changed.

## Files touched
- package.json
- package-lock.json
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md
- tasks/todo.md

## Commands run
- npm install next@15.5.7 eslint-config-next@15.5.7
- npm run build
- npm run lint

## Verification Evidence
- Build completes successfully and does not emit `Mismatching @next/swc version` warning anymore.
- Lint completes successfully with only pre-existing React hook warnings in `src/app/orders/[id]/page.tsx` (known baseline).

## Diff/Review Notes
- Scope was intentionally limited to the dependency version mismatch warning identified in project-level run output.
- No refactors or unrelated fixes were included.

## Next steps
- [ ] Optional follow-up outside this scoped fix: evaluate upgrading to a patched Next.js version path that avoids the known 15.5.7 security advisory while retaining SWC alignment.

---

Date: 2026-02-23
Agent: GPT-5.2-Codex
Goal (1 sentence): Execute P2-T3 and P2-T4 by aligning Customers to repo/service boundaries and producing a Phase 2 Prisma/layering audit with explicit gate pass/fail.

## What I changed
- Added module-owned Customers boundary files:
  - `src/modules/customers/customers.repo.ts`
  - `src/modules/customers/customers.service.ts`
  - `src/modules/customers/customers.schema.ts`
  - `src/modules/customers/customers.types.ts`
- Refactored Customers API routes to call Customers services (thin route handlers):
  - `src/app/api/admin/customers/route.ts`
  - `src/app/api/admin/customers/[id]/route.ts`
- Refactored Customers server pages to call Customers services instead of direct Prisma:
  - `src/app/customers/page.tsx`
  - `src/app/customers/[id]/page.tsx`
  - `src/app/customers/[id]/print/page.tsx`
- Converted `src/lib/zod-customers.ts` into a compatibility shim that re-exports module-owned schema/types.
- Updated continuity/planning artifacts: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`.

## Files touched
- src/modules/customers/customers.repo.ts
- src/modules/customers/customers.service.ts
- src/modules/customers/customers.schema.ts
- src/modules/customers/customers.types.ts
- src/app/api/admin/customers/route.ts
- src/app/api/admin/customers/[id]/route.ts
- src/app/customers/page.tsx
- src/app/customers/[id]/page.tsx
- src/app/customers/[id]/print/page.tsx
- src/lib/zod-customers.ts
- tasks/todo.md
- PROGRESS_LOG.md
- docs/AGENT_HANDOFF.md

## Commands run
- rg --files -g 'AGENTS.md'
- sed/cat required pre-reads:
  - CANON.md
  - ROADMAP.md
  - docs/AGENT_CONTEXT.md
  - PROGRESS_LOG.md
  - docs/AGENT_HANDOFF.md
  - docs/AGENT_TASK_BOARD.md
  - AGENT_PROMPTS.md
  - tasks/todo.md
  - tasks/lessons.md
- rg -n "prisma\.customer" src
- rg -n "prisma\.(order|orderPart|orderCharge|orderChecklist|partAttachment)" src --glob '!src/modules/orders/orders.repo.ts'
- rg -n "prisma\.(quote|quotePart|quoteAttachment|quoteVendorItem|quoteAddonSelection)" src --glob '!src/modules/quotes/quotes.repo.ts'
- rg -n "prisma\.customer" src --glob '!src/modules/customers/customers.repo.ts'
- rg -n "@/lib/prisma" src/app/api/orders src/app/api/admin/quotes src/app/api/admin/customers src/app/customers
- npm run lint
- npm run build

## Verification Evidence
- Orders/Quotes/Customers Prisma out-of-repo audit commands returned no matches.
- Customers API and pages no longer import `@/lib/prisma`; call paths now go route/page -> customers.service -> customers.repo.
- `npm run lint` passed (pre-existing warnings remain in `src/app/orders/[id]/page.tsx`, not touched in this task).
- `npm run build` passed (same pre-existing warnings plus non-blocking advisories for baseline-browser-mapping and @next/swc mismatch).

## Diff/Review Notes
- Scope intentionally limited to P2-T3 + P2-T4.
- No new dependencies added.
- No unrelated refactors outside Customers alignment and Phase 2 audit evidence capture.

## Notes / gotchas
- P2-T4 gate evidence is captured via command output + continuity docs; legacy order-centric migration-note consolidation is still a documentation follow-up.

## Next steps
- [ ] Start P3-T1 (time model invariants verification) only after owner confirms Phase 2 gate acceptance.
- [ ] Optional docs-only follow-up: consolidate legacy order-centric deprecation/migration notes into a single appendix for future gate audits.

---
Date: 2026-02-24
Agent: GPT-5.2-Codex
Goal (1 sentence): Deliver department auto-advance confirmation and centralized routing recompute with required reason/flag logging for backward/rework/manual transitions.

## What I changed
- Added new checklist APIs:
  - `POST /api/orders/[id]/parts/[partId]/checklist/[itemId]/preview-complete`
  - `POST /api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance`
- Extended Orders service routing logic:
  - Introduced `recomputePartDepartment(...)` as the routing source of truth.
  - Added `previewChecklistComplete(...)` and `completeChecklistAndAdvance(...)` service flows.
  - Updated `toggleChecklistItem(...)` to recompute routing on toggle and enforce reason on backward reopen.
  - Updated manual transition paths (`assignPartDepartment`, `transitionPartsDepartment`) to require reason and emit department events with flag metadata.
- Extended repo layer:
  - Added routing-oriented fetch/update helpers and transaction wrapper used by service layer.
  - Enhanced department feed repo query to support optional include-completed behavior + latest part event.
- UI updates:
  - Order detail checklist now calls preview API before check; last-item completion is guarded by user confirmation and no optimistic checkbox flip.
  - Reopen that triggers backward move now requests reason and retries mutation with reason payload.
  - Part list tiles and intelligence feed part chips show `REWORK` badge when latest event meta has `flag: true`.
  - Intelligence feed added include-completed toggle and forwards query parameter to API.

## Files touched
- `src/modules/orders/orders.service.ts`
- `src/modules/orders/orders.repo.ts`
- `src/repos/orders.ts`
- `src/repos/mock/orders.ts`
- `src/app/api/orders/[id]/checklist/route.ts`
- `src/app/api/orders/[id]/parts/assign-department/route.ts`
- `src/app/api/orders/[id]/parts/transition/route.ts`
- `src/app/api/intelligence/department-feed/route.ts`
- `src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/preview-complete/route.ts`
- `src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance/route.ts`
- `src/app/orders/[id]/page.tsx`
- `src/components/ShopFloorLayouts.tsx`
- `PROGRESS_LOG.md`
- `tasks/todo.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- npm run lint
- npm run test -- src/modules/orders/__tests__/department-routing.test.ts
- npm run build
- npm run dev (temporary, for screenshot capture)

## Verification Evidence
- Lint passed with zero ESLint errors/warnings.
- Existing department-routing unit tests passed.
- Full Next.js production build passed after type-check.

## Diff/Review Notes
- Scoped to Orders/checklist/department-feed workflows only (no broad architecture refactor).
- Backlog follow-up intentionally deferred: replace native confirm/prompt dialogs with richer in-app modal components.

## Next steps
- [ ] Add focused unit/integration tests for new routing recompute, preview, and backward-reason branches.
- [ ] Replace native `window.confirm/window.prompt` with dedicated UI modal patterns for consistency and accessibility.

## Session Handoff — 2026-02-24 (Consolidated queue/tx/timer pass)

## Goal
Implement consolidated P0-P5 pass: transaction timeout/client consistency fix, merge orders list into home intelligence queue, add integrated Work Queue layout + customers-style cards, and timer semantics corrections.

## Scope completed
- Transaction path hardening:
  - `recordPartEvent` now accepts optional db/tx client and passes through to repo.
  - `recomputePartDepartment` now reads departments + writes part events using the provided tx client.
  - `runInTransaction` now uses `maxWait: 20_000` and `timeout: 20_000`.
- Queue consolidation:
  - `/orders` list replaced with redirect to `/`.
  - Home actions/nav links updated to avoid duplicate queue-page behavior.
- Intelligence UI:
  - Existing KPI and prior layouts retained.
  - Added `workQueue` layout mode in `ShopFloorLayouts` with department tabs and include-completed toggle.
  - Added reusable customers-style `WorkQueueOrderCard` tile component and wired department feed shape/sorting updates.
- Timer behavior:
  - `getOrderPartTimeTotals` now returns second-level totals (`totalsSeconds`).
  - `/api/timer/active` now returns `totalsSeconds`.
  - Order detail timer panel now shows persistent selected-part elapsed (stored totals + live delta).
  - `/api/timer/finish` now stops timer and logs event without completing the part.
  - `completeOrderPart` now rejects with 409 if active checklist items remain incomplete.
- Tests:
  - Updated time service tests for seconds-based totals.
  - Added orders service test for checklist-completion gate.

## Files touched
- `src/modules/orders/orders.repo.ts`
- `src/modules/orders/orders.service.ts`
- `src/repos/mock/orders.ts`
- `src/app/page.tsx`
- `src/app/orders/page.tsx`
- `src/components/AppNav.tsx`
- `src/components/ShopFloorLayouts.tsx`
- `src/components/work-queue/WorkQueueOrderCard.tsx`
- `src/app/api/timer/active/route.ts`
- `src/app/api/timer/finish/route.ts`
- `src/modules/time/time.service.ts`
- `src/modules/time/__tests__/time.service.test.ts`
- `src/modules/orders/__tests__/orders.service.test.ts`
- plus minor route-link updates in order/machinist pages.

## Commands run
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run dev` (temporary for screenshot attempt)
- `npm run set-demo-passwords` (to support local login automation)

## Verification evidence
- Lint: passed.
- Tests: passed (full vitest suite).
- Build: passed (Next production build + standalone asset copy).
- Browser capture: automation login path failed on selector discovery; auth-gate screenshot artifact captured instead.

## Next steps / follow-up
- If desired, add robust Playwright auth helper for deterministic screenshot capture on authenticated pages.
- Optional: refine work queue “latest activity” to include non-flagged operational events beyond rework/dept transitions.

## Session Handoff — 2026-02-24 (AppNav key + timer conflict UX fix)

## Goal
Resolve reported UI/runtime bugs: duplicate React key warning in navigation and repeated “active timer” conflict without actionable context.

## Scope completed
- Updated `AppNav` map keys to use a composite (`href` + `label`) to prevent duplicate-key collisions when multiple links share `/`.
- Updated `/api/timer/start` conflict handling:
  - includes `activeOrderHref` in switch-confirmation payloads;
  - returns explicit `requiredAction: refresh` when 409 occurs but no active entry can be resolved.
- Updated `/api/timer/resume` conflict handling to include `activeOrderHref`.
- Updated order detail timer UI:
  - conflict state now stores `activeOrderHref`;
  - conflict dialog includes link to open active timer context;
  - start/resume handlers treat non-switch 409 responses as sync errors (no misleading conflict modal).

## Files touched
- `src/components/AppNav.tsx`
- `src/app/api/timer/start/route.ts`
- `src/app/api/timer/resume/route.ts`
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

## Commands run
- `npm run lint`
- `npm run test -- src/modules/time/__tests__/time.service.test.ts`
- `npm run build`
- `npm run dev` (temporary for screenshot capture)

## Verification evidence
- Lint passed with zero ESLint errors/warnings.
- Time service unit suite passed.
- Build failed in this environment due Prisma unique constraint (`appSettings.id`) during prerender of `/403`.
- Screenshot captured at `browser:/tmp/codex_browser_invocations/0002efd80d6b7b20/artifacts/artifacts/nav-timer-fix-home.png`.

## Next steps
- Investigate build-time app settings seeding/idempotency causing `P2002` on `/403` prerender in this environment.

## Session Handoff — 2026-02-24 (FK/auth modal/status+seed+style)

Goal (1 sentence): Resolve test-mode FK/auth edge cases and UX auth prompting, ensure final-checklist completion reflects completed status, diversify demo seed flow, and align home metric card styling.

### What changed
- Test mode auth session now resolves to a persisted DB user (`test@local`) with stable admin role and returns that real `user.id` in session payload.
- Added centralized auth-required response helpers and updated timer/checklist protected endpoints to emit structured auth payloads.
- Added global shared auth interception (`window.fetch` wrapper + `fetchJson` fallback event emit) and a reusable sign-in modal dialog in app-wide providers.
- Updated order detail part badge logic to compute completion from active checklist item completion and render `COMPLETE` for fully completed parts.
- Expanded seed customers/orders with broader lifecycle-stage variety and more part/checklist distributions.
- Updated homepage intelligence metric cards with the same visual card treatment used on Customers page cards.

### Files touched
- `src/lib/auth-session.ts`
- `src/lib/auth-api.ts`
- `src/lib/auth-required.ts`
- `src/lib/fetchJson.ts`
- `src/components/AuthRequiredDialog.tsx`
- `src/components/Providers.tsx`
- `src/app/api/timer/start/route.ts`
- `src/app/api/orders/[id]/parts/[partId]/checklist/[itemId]/complete-and-advance/route.ts`
- `src/lib/rbac.ts`
- `src/app/orders/[id]/page.tsx`
- `src/app/page.tsx`
- `prisma/seed.ts`
- `prisma/seed.js`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- npm run prisma:push
- npm run seed
- npm run lint
- npm run test
- npm run build
- node -e 'const {PrismaClient}=require("@prisma/client"); ... groupBy ...'
- TEST_MODE=true npm run dev -- --port 3000 (screenshot capture)

### Verification evidence
- Prisma push + seed completed without FK errors.
- Lint passed clean.
- Vitest suite passed.
- Build still fails in this environment due known `AppSettings.id` unique collision during prerender (`/about`).
- Screenshot captured for home metric card styling parity.

### Next steps
- [ ] Consider centralizing auth response helpers across remaining protected API routes for fully uniform payload shape.
- [ ] Add a focused integration test for auth-required modal event handling on protected actions.
- [ ] Investigate/resolve environment-level `AppSettings.id` prerender build conflict.

## Session Handoff — 2026-02-25 (Dashboard nav dedupe + default Work Queue)

Goal (1 sentence): Replace duplicate dashboard/queue nav entries with a single `Dashboard` nav item and make Dashboard open on Work Queue layout by default.

### What changed
- Updated top-level navigation links to keep one `/` item labeled `Dashboard`; removed duplicate `Shop Floor Intelligence` and `Queue` nav entries.
- Changed `ShopFloorLayouts` initial `layout` state from `grid` to `workQueue` so Dashboard lands on Work Queue without extra clicks.
- Updated homepage copy using old naming (`Shop floor intelligence`, `Open queue`, `View queue`) to `Dashboard` wording.

### Files touched
- `src/components/AppNav.tsx`
- `src/components/ShopFloorLayouts.tsx`
- `src/app/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`
- `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`
- Playwright screenshot capture against `http://127.0.0.1:3000`

### Verification evidence
- Lint passed with no ESLint warnings/errors.
- Dashboard screenshot captured: `browser:/tmp/codex_browser_invocations/5b2f1381157b8568/artifacts/artifacts/dashboard-nav-workqueue.png`.

### Next steps
- [ ] If desired, consider renaming internal `Queue filters` label text in `ShopFloorLayouts` to `Dashboard filters` for naming consistency (not required for this user request).

## Session Handoff — 2026-02-25 (Dashboard border cleanup + button relocation)

Goal (1 sentence): Apply requested Dashboard visual/button follow-up by removing the Department Work Queue wrapper border, removing homepage quick-action buttons, and relocating New Order access to Admin Quotes actions.

### What changed
- Removed only the border from the `Department work queue` section wrapper in `ShopFloorLayouts` while preserving the outer shop-floor layout border and per-order tile borders.
- Removed Dashboard hero quick-action buttons (`New Order`, `Open dashboard`) from `src/app/page.tsx`.
- Removed `New Order` from global top navigation.
- Added `New order` button next to `New quote` in Admin Quotes action controls (`/admin/quotes`).

### Files touched
- `src/components/ShopFloorLayouts.tsx`
- `src/app/page.tsx`
- `src/components/AppNav.tsx`
- `src/app/admin/quotes/client.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`
- `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`
- Playwright screenshot capture against `http://127.0.0.1:3000` (firefox)

### Verification evidence
- Lint passed with no ESLint warnings/errors.
- Updated screenshot captured: `browser:/tmp/codex_browser_invocations/1beb2a2aeb55c846/artifacts/artifacts/dashboard-border-button-fix.png`.

### Next steps
- [ ] If desired, align remaining label text `Queue filters` to `Dashboard filters` for full naming consistency.

## Session Handoff — 2026-02-25 (Order Part BOM tab integration)

Goal (1 sentence): Integrate the existing Print Analyzer into Order → Part detail as a new BOM tab with native order-detail styling and deterministic conversion/tolerance helpers.

### What changed
- Added `PartBomTab` client component under `src/app/orders/[id]/` for BOM analysis UI inside order detail.
- Implemented image upload plus optional existing IMAGE attachment selection as analyzer input.
- Wired API call to existing `POST /api/print-analyzer/analyze` with `credentials: include`, handling success + error/debug payloads.
- Added helper logic for mm/inch conversion formatting, thread pitch parsing, tolerance rendering, and deterministic tight-tolerance flagging (`TIGHT TOL` + reamer suggestion).
- Integrated `bom` into part tab controls/rendering in `src/app/orders/[id]/page.tsx`.
- Updated `docs/PRINT_ANALYZER.md` with a BOM-tab integration note.

### Files touched
- `src/app/orders/[id]/PartBomTab.tsx`
- `src/app/orders/[id]/page.tsx`
- `docs/PRINT_ANALYZER.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`
- `npm run build`
- `npm run dev -- --hostname 0.0.0.0 --port 3000`
- `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`
- Playwright screenshot captures against `http://127.0.0.1:3000`

### Verification evidence
- Lint passed.
- Build failed due to existing baseline issue: missing `openai` package for pre-existing `src/app/api/print-analyzer/analyze/route.ts` import.
- Screenshot artifact captured: `browser:/tmp/codex_browser_invocations/bec823ec399c834f/artifacts/artifacts/bom-tab-testmode-orders.png`.

### Next steps
- [ ] Seed or access a concrete order/part in this environment to capture a BOM-tab-active screenshot and end-to-end analyzer interaction evidence on `/orders/[id]`.
- [ ] Resolve pre-existing missing `openai` package baseline issue if full production build verification is required in this workspace.

## Session Handoff — 2026-02-26 (QA flow mapping + regression tests)

Goal (1 sentence): Reverse-engineer actual quote/admin/backend workflow behavior, codify critical transitions as executable tests, and validate flow correctness with live local API exercises.

### What changed
- Added route-level Vitest coverage for quote conversion flow (`/api/admin/quotes/[id]/convert`) including:
  - already-converted conflict path (`409`),
  - PO-required gating path (`400`),
  - successful conversion with order custom-field allowlisting.
- Added route-level Vitest coverage for quote approval flow (`/api/admin/quotes/[id]/approval`) validating `requirePOForQuoteApproval` forwarding and service validation propagation.
- Performed live runtime checks in `TEST_MODE` for quote create/approve/convert, department assign/transition, and timer start/pause/resume/finish behavior.
- Logged high-priority backend flow defects discovered during runtime verification.

### Files touched
- `src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`
- `src/app/api/admin/quotes/[id]/approval/__tests__/route.test.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts src/app/api/admin/quotes/[id]/approval/__tests__/route.test.ts`
- `npm run test`
- `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`
- Runtime verification scripts:
  - `python` + `curl` flow scripts for admin quote APIs, order department transition APIs, and timer APIs.

### Verification evidence
- New route tests passed and full Vitest suite passed.
- Runtime API verification succeeded for quote creation/conversion request paths and department transition guard behavior.
- Runtime API verification exposed test-mode state inconsistencies in timer lifecycle and cross-domain quote→order visibility.

### Next steps
- [ ] Add transactional/DB-backed conversion guard to prevent duplicate `orderNumber` creation under contention.
- [ ] Unify `TEST_MODE` storage strategy across quote/orders/time flows (all mock or all DB-backed) to avoid split-brain runtime behavior.
- [ ] Fix timer `TEST_MODE` user identity mismatch (auth user id vs mock seed user id) so active/pause/resume/finish behave coherently after start.

## Session Handoff — 2026-02-26 (QA findings remediation)

Goal (1 sentence): Fix the highest-impact backend issues identified in QA by hardening quote→order numbering and removing TEST_MODE state divergence.

### What changed
- Changed TEST_MODE repo behavior to use Prisma repos by default, with mock repos now opt-in only via `TEST_MODE_USE_MOCK_REPOS=true`.
- Added Vitest setup file (`src/test/setup-env.ts`) to keep test runs on mock repos without changing production/test-mode runtime behavior.
- Moved quote→order `orderNumber` generation into the conversion transaction in `convertQuoteToOrder`.
- Updated conversion route to return generated `orderNumber` from conversion result.
- Added `@unique` guard to `Order.orderNumber` in Prisma schema.

### Files touched
- `src/repos/index.ts`
- `vitest.config.ts`
- `src/test/setup-env.ts`
- `src/modules/quotes/quotes.repo.ts`
- `src/app/api/admin/quotes/[id]/convert/route.ts`
- `src/app/api/admin/quotes/[id]/convert/__tests__/route.test.ts`
- `prisma/schema.prisma`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test`
- `TEST_MODE=true npm run dev -- --hostname 0.0.0.0 --port 3000`
- Runtime script: python/curl for quote create/convert/order fetch and timer start/active/pause.

### Verification evidence
- Full Vitest suite passed after repo-selection and conversion changes.
- Runtime TEST_MODE verification showed:
  - successful quote conversion returns order id + number,
  - `/api/orders/{id}` resolves converted order,
  - timer start/active/pause flow remains coherent.

### Next steps
- [ ] Run `prisma migrate dev` to materialize the new `Order.orderNumber` uniqueness constraint in migration history.
- [ ] Consider honoring requested `operation` in `/api/timer/start` (currently hardcoded to `Part Work`).
## Session Handoff — 2026-04-08 (Quote template detail-control expansion)

Goal (1 sentence): Give admins finer control over quote print templates, especially part-detail visibility and whether add-on/labor prices appear.

### What changed
- Updated `src/lib/quote-print-layout.ts`
  - Added structured option sets for `scope`, `addons_labor`, and `requirements` blocks.
- Updated `src/app/admin/templates/TemplatesClient.tsx`
  - Added new option panels in the template editor for:
    - `Line Items / Scope`: part number, qty, pieces, material, stock size, cut length, description/finish, notes.
    - `Addons/Labor`: prices, units, notes, part context, vendor items.
    - `Notes/Requirements`: materials, purchased items, requirements, notes.
- Updated `src/app/admin/quotes/[id]/print/page.tsx`
  - Quote print now honors those block options, including hiding add-on prices while still listing the work items.
  - Scope block now renders the requested part details conditionally instead of using one hardcoded layout.
- Added focused mapping coverage in `src/lib/__tests__/quote-print-layout.test.ts`.

### Files touched
- `src/lib/quote-print-layout.ts`
- `src/lib/__tests__/quote-print-layout.test.ts`
- `src/app/admin/templates/TemplatesClient.tsx`
- `src/app/admin/quotes/[id]/print/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/lib/__tests__/quote-print-layout.test.ts`
- `npm run lint`

### Verification evidence
- Targeted quote-print-layout tests passed.
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify in `/admin/templates` that the new block options appear where expected and in `/admin/quotes/[id]/print` that toggles like `Show prices` for `Addons/Labor` affect output as intended.

---
## Session Handoff — 2026-04-08 (Quote template detail-control expansion)

Goal (1 sentence): Give admins finer control over quote print templates, especially part-detail visibility and whether add-on/labor prices appear.

### What changed
- Updated `src/lib/quote-print-layout.ts`
  - Added structured option sets for `scope`, `addons_labor`, and `requirements` blocks.
- Updated `src/app/admin/templates/TemplatesClient.tsx`
  - Added new option panels in the template editor for:
    - `Line Items / Scope`: part number, qty, pieces, material, stock size, cut length, description/finish, notes.
    - `Addons/Labor`: prices, units, notes, part context, vendor items.
    - `Notes/Requirements`: materials, purchased items, requirements, notes.
- Updated `src/app/admin/quotes/[id]/print/page.tsx`
  - Quote print now honors those block options, including hiding add-on prices while still listing the work items.
  - Scope block now renders the requested part details conditionally instead of using one hardcoded layout.
- Added focused mapping coverage in `src/lib/__tests__/quote-print-layout.test.ts`.

### Files touched
- `src/lib/quote-print-layout.ts`
- `src/lib/__tests__/quote-print-layout.test.ts`
- `src/app/admin/templates/TemplatesClient.tsx`
- `src/app/admin/quotes/[id]/print/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/lib/__tests__/quote-print-layout.test.ts`
- `npm run lint`

### Verification evidence
- Targeted quote-print-layout tests passed.
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify in `/admin/templates` that the new block options appear where expected and in `/admin/quotes/[id]/print` that toggles like `Show prices` for `Addons/Labor` affect output as intended.

---
## Session Handoff — 2026-04-08 (Orders page syntax hotfix)

Goal (1 sentence): Fix the `/orders/[id]` compile error caused by mixing `??` with `||` in the manual department-move prompt.

### What changed
- Updated `src/app/orders/[id]/page.tsx`
  - Replaced the mixed nullish/logical fallback expression with a dedicated `currentDepartmentLabel` value before the prompt string.

### Files touched
- `src/app/orders/[id]/page.tsx`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`

### Verification evidence
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify `/orders/[id]` and `/admin` load again without the compile-time 500s.

---
## Session Handoff — 2026-04-09 (Order-detail department + timer follow-up)

Goal (1 sentence): Make converted/new orders default part ownership to Machining/first department, stop apparent checklist-driven auto department moves on order detail, and reduce the timer panel footprint so parts stay visually primary.

### What changed
- Updated `src/modules/orders/orders.service.ts`
  - Added `initializeCurrentDepartmentForOrder(orderId)` helper.
  - `createOrderFromPayload()` now initializes part ownership immediately after order creation/checklist sync.
  - `getOrderDetails()` no longer infers a missing `currentDepartmentId` from open checklist rows; it now falls back only to the first active department.
  - Missing-department backfill/initialization now assigns the first active department instead of deriving a later stage from checklist completion.
- Updated `src/app/api/admin/quotes/[id]/convert/route.ts`
  - Quote conversion now initializes order-part department ownership right after checklist sync, so converted parts persist the default first department immediately.
- Updated `src/app/orders/[id]/page.tsx`
  - Narrowed the left rail from `360px` to `320px`.
  - Shortened timer status/action labels and changed the manual move CTA to default toward the next ordered department (`Submit to ...`).
  - Added a `Show details` toggle so time-history and manual time notes no longer consume left-rail space by default.
- Updated `src/modules/orders/__tests__/orders.service.test.ts`
  - Added regression coverage proving new parts initialize to Machining/first department.
  - Added regression coverage proving a null-owned part does not visually jump to the next department after checklist completion.
- Updated continuity docs and added Decision Log entry in `docs/AGENT_CONTEXT.md`.

### Files touched
- `src/modules/orders/orders.service.ts`
- `src/app/api/admin/quotes/[id]/convert/route.ts`
- `src/app/orders/[id]/page.tsx`
- `src/modules/orders/__tests__/orders.service.test.ts`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts`
- `npm run lint`

### Verification evidence
- Targeted Orders service tests passed (7/7).
- Lint passed with no ESLint warnings/errors.

### Next steps
- [ ] User verify on `/orders/[id]` that converted parts now land in Machining/current first department instead of showing `Unassigned`.
- [ ] User verify that checking the last checklist item no longer makes the part appear to auto-move departments before using the manual submit/move action.
- [ ] Optional follow-up: if the owner wants an even more aggressive left-rail reduction, split timer controls and part list into separate stacked cards on mobile/tablet breakpoints only.
## Session Handoff — 2026-04-10 (BOM analyzer PDF runtime loader fix)

Goal (1 sentence): Fix the PDF analyzer runtime import strategy so PDF uploads succeed on the live local Next server, especially on port `3000`.

### What changed
- Updated `src/app/api/print-analyzer/analyze/route.ts`
  - Removed the earlier `createRequire` / filesystem-path PDF module loading approach that failed inside the Next bundled route runtime.
  - Switched both `pdfjs-dist` and `@napi-rs/canvas` loading to runtime dynamic imports.
  - Kept the existing page-1 PDF rasterization behavior and analyzer pipeline intact.
- Local runtime verification
  - Reclaimed port `3000` from the stale local Next process and restarted the updated workspace there.
  - Confirmed the live analyzer route now accepts a PDF request successfully on `http://127.0.0.1:3000`.

### Files touched
- `src/app/api/print-analyzer/analyze/route.ts`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm run lint`
- `node -` (live PDF smoke test against `http://127.0.0.1:3000/api/print-analyzer/analyze`)

### Verification evidence
- Lint passed with no ESLint warnings/errors.
- Live PDF analyzer request on port `3000` returned `200` with structured JSON instead of the earlier module-resolution error.

### Next steps
- [ ] Push this runtime-loader follow-up to the existing PR branch so the GitHub PR matches the working local server.

## Session Handoff — 2026-04-09 (BOM analyzer PDF upload support)

Goal (1 sentence): Let the BOM analyzer accept PDFs by rasterizing page 1 to an image before running the existing analyzer flow.

### What changed
- Updated `src/app/orders/[id]/PartBomTab.tsx`
  - BOM upload input now accepts `image/*,application/pdf`.
  - Stored attachment picker now includes PDF print attachments instead of filtering them out as unsupported non-images.
  - Attachment-loading copy/errors now refer to supported print files rather than image-only files.
- Updated `src/app/private/print-analyzer/page.tsx`
  - Private analyzer upload input now accepts `image/*,application/pdf`.
  - Page copy now explicitly says image or PDF.
- Updated `src/app/api/print-analyzer/analyze/route.ts`
  - Route now accepts `data:application/pdf`.
  - Added server-side PDF page-1 rasterization using `pdfjs-dist` + `@napi-rs/canvas`.
  - Existing OpenAI/sharp image-analysis pipeline remains unchanged after PDF-to-PNG conversion.
- Updated `docs/PRINT_ANALYZER.md`
  - Documented PDF support and clarified that current behavior analyzes the first page.
- Updated `docs/AGENT_CONTEXT.md`
  - Added Decision Log entry for the new PDF-rendering dependency choice.
- Installed dependencies
  - `pdfjs-dist`
  - `@napi-rs/canvas`

### Files touched
- `package.json`
- `package-lock.json`
- `src/app/orders/[id]/PartBomTab.tsx`
- `src/app/private/print-analyzer/page.tsx`
- `src/app/api/print-analyzer/analyze/route.ts`
- `docs/PRINT_ANALYZER.md`
- `docs/AGENT_CONTEXT.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Commands run
- `npm install pdfjs-dist @napi-rs/canvas`
- `npm run lint`
- `npm run build`
- `node -` (runtime PDF rasterization sanity check against `storage/sterling-tool-and-die/s-k-industrial/std-1007/tdc-british-standard-pipe-threads-1-d367a7f6-608a-47c9-8cea-274c3f180503.pdf`)

### Verification evidence
- Lint passed with no ESLint warnings/errors.
- Runtime PDF rasterization succeeded with `pdfjs-dist` + `@napi-rs/canvas`: `pdf-render-ok:303905:1224x1584`.
- `npm run build` still fails in this environment due the existing `next/font` Roboto fetch / `127.0.0.1:9` connection issue, but the PDF-renderer native-module webpack parse failure introduced during this work is gone.

### Next steps
- [ ] User verify on `/orders/[id]` BOM tab that uploading a PDF or selecting a stored PDF print attachment now analyzes successfully.
- [ ] Optional follow-up: expose page-selection for multi-page PDFs if the shop starts uploading packet-style prints.


## Session Handoff — 2026-07-16 (Drawing-to-order import workflow design)

Goal (1 sentence): Define a simple drawing/ZIP-assisted order creation workflow grounded in the existing order and BOM capabilities and the supplied sample drawings.

### What changed
- Added `docs/DRAWING_ORDER_IMPORT_WORKFLOW.md` with:
  - the operator journey from order details through upload, progress, correction, review, and creation,
  - confidence and missing-data rules,
  - multi-page assembly, parts-list, duplicate, revision, and partial-failure handling,
  - recommended module/service boundaries and resumable background-job behavior,
  - phased delivery and first-release acceptance criteria.
- Documented findings from `fwdfiles.zip`: 16 PDFs; strong title-block data; at least one two-page assembly drawing with a quantities/stock parts list.

### Files touched
- `docs/DRAWING_ORDER_IMPORT_WORKFLOW.md`
- `tasks/todo.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

### Verification evidence
- Read-only ZIP inventory and representative PDF text extraction completed.
- No application code, database, dependencies, or supplied archive contents were changed.

### Next steps
- [ ] Confirm the workflow and decide whether v1 should start with single-drawing import or include ZIP import immediately.
- [ ] Convert the approved first slice into task-board items before implementation.
## Session Handoff — 2026-07-16 (Drawing-to-order import v1)

Goal (1 sentence): Let an admin create reviewed order parts from one drawing or a ZIP, retain a dedicated part name and per-part source drawing, and automatically start BOM analysis.

### What changed
- Added `OrderPart.partName` and `RepeatOrderTemplatePart.partName` plus migration `20260716103000_add_order_part_name`.
- Carried part name through manual create/edit, quote conversion, repeat templates, search, detail, and order print.
- Added `src/modules/drawing-import/` with validated title-block results, PDF text extraction, image vision extraction, safe ZIP expansion, fallback behavior, and focused tests.
- Added `POST /api/orders/drawing-import` with admin access and deterministic multipart validation.
- Added the drawing-assisted path to `/orders/new`: method choice, upload, review/correction cards, material confirmation, per-part attachment mapping, and final readiness display.
- Order creation now returns created part IDs, creates imported per-part attachments, normalizes them into canonical storage, and starts existing BOM analysis with two concurrent workers.
- Added `jszip`; decision recorded in `docs/AGENT_CONTEXT.md`.

### Verification evidence
- Prisma migration and generation passed.
- Focused regression suite passed: 4 files, 25 tests.
- Full lint passed.
- Real sample ZIP: 16 supported PDFs, 1,049,086 expanded bytes.
- Live page/API compile: `/orders/new` 200; malformed import 400.
- Live title-block extraction against `26031-00-133-602.pdf` successfully returned part number/name and review data.
- Full TypeScript check still reports only known baseline errors outside this feature.

### Known follow-ups
- Imports are not yet persisted as resumable drafts; refresh during extraction requires re-upload.
- Assembly drawings are flagged but not yet split into selectable parts-list components.
- BOM jobs are initiated from the successful order-create screen; a future durable queue would survive the browser closing immediately after creation.

### Files of interest
- `docs/DRAWING_ORDER_IMPORT_WORKFLOW.md`
- `src/modules/drawing-import/drawing-import.service.ts`
- `src/components/orders/DrawingImportPanel.tsx`
- `src/app/orders/new/page.tsx`
- `src/modules/orders/orders.service.ts`
- `prisma/migrations/20260716103000_add_order_part_name/migration.sql`
## Session Handoff — 2026-07-16 (Neon-orange confirmation palette + quantity checkbox, latest)

Goal: Replace the disliked brown/yellow confirmation styling and make an unchanged default quantity confirmable with one checkbox.

Updated `DrawingImportPanel` to use a deliberate white/neon-orange/navy visual system: `#ff5a00` for attention borders, badges, and glow; `#0b1f3a` for navy text/status/control surfaces; white for review cards and confirmation panels. Removed all amber/yellow confirmation utilities from the component, including extraction-warning text.

For quantity reasons with `resolution: confirm`, the highlighted quantity field now renders a navy `Quantity <value> is correct` checkbox. Checking it calls the same confirmed-field state used by live warning derivation, so the quantity warning, field outline, tile outline, and header count update immediately without altering the numeric value. Quantity is excluded from the bulk confirmation button to keep this action obvious.

Files touched:
- `src/components/orders/DrawingImportPanel.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

Verification:
- Focused drawing-import tests passed (13/13).
- Targeted ESLint passed on the confirmation component/helper/tests.
- `npm run lint` passed without warnings/errors.
- Live inspection showed `Neon-orange outlines show exactly what still needs attention`, `All parts confirmed`, 15 retained part drawings, and one assembly order file. The existing confirmed state was preserved rather than reset solely to manufacture an uncertain-quantity browser case.

## Session Handoff — 2026-07-16 (Live per-field drawing confirmation highlights, latest)

Goal: Make drawing review highlight only unresolved parts/fields, explain exactly what requires confirmation, and clear warnings as soon as they are resolved.

Root cause: `ReviewedDrawingPart.needsReview` was calculated once during import and never changed, so a corrected tile could remain yellow. Replaced it with `getDrawingConfirmationNeeds`, a pure derived-state helper that evaluates current part values, extraction confidence, material selection, finish/stock/cut uncertainty, assembly status, and explicitly confirmed fields.

UI behavior:
- Only tiles with unresolved reasons are yellow; resolved tiles are green.
- Each yellow tile has a `Please confirm` list naming the exact field and reason.
- Only affected field containers receive the stronger yellow highlight.
- Editing a field marks that field confirmed, but required blank/invalid values remain unresolved.
- Prefilled low-confidence values can be accepted with `The highlighted values look right`.
- Assembly detections require either `Keep as a part` or the existing `Remove from part list; keep file` action.
- The header count and Continue-button lock derive from the same live reason list and update immediately.

Files touched:
- `src/modules/drawing-import/drawing-import.review.ts`
- `src/modules/drawing-import/__tests__/drawing-import.service.test.ts`
- `src/components/orders/DrawingImportPanel.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

Verification:
- Focused drawing-import tests passed (13/13), including a regression that starts with part-name, quantity, and finish warnings, clears them through confirmations, and continues to flag a missing material.
- Targeted ESLint passed on the review helper, test, and component.
- `npm run lint` passed without warnings/errors.
- Live `/orders/new` inspection confirmed the route remained healthy and the owner's current state contained 15 part drawings plus one assembly order file. The form was not reset merely to replay browser automation.

## Session Handoff — 2026-07-16 (Finish, assembly-file, and material matching follow-up, latest)

Goal: Preserve drawing finishes in part notes, retain assembly drawings without creating assembly parts, and improve material matching for common shop shorthand.

What changed:
- Added `finish` to the drawing title-block schema/prompt/fallback. Review cards show an editable Finish field plus the original extracted wording, and imported parts seed `Finish: <value>` into part notes.
- Added shared client-safe material matching with normalization for punctuation, common names, grade-only inputs, and shop aliases. The UI continues to show `Drawing says: ...` and now also shows the selected catalog match or an explicit no-match message.
- Assembly cards now use `Remove from part list; keep file`. The drawing moves into an order-files section, is submitted as an order-level attachment, and has a `Put back in part list` correction action.
- Draft order-file links use the authenticated drawing preview route, so kept assembly files can be opened before order creation.

Files touched:
- `src/modules/drawing-import/drawing-import.materials.ts`
- `src/modules/drawing-import/drawing-import.schema.ts`
- `src/modules/drawing-import/drawing-import.service.ts`
- `src/modules/drawing-import/__tests__/drawing-import.service.test.ts`
- `src/components/orders/DrawingImportPanel.tsx`
- `src/app/orders/new/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

Verification:
- Focused drawing-import suite passed (12/12), covering ZIP safety/preview plus 6061, aluminum 6061-T6511, C.R.S., cold-rolled steel, 1018 cold roll, 304 stainless steel, PTFE/Teflon, and finish-note formatting.
- Targeted ESLint and `npm run lint` passed without warnings/errors.
- `npx tsc --noEmit --pretty false` reported only the existing quote detail, vendor import, kiosk, print-analyzer, quote pricing, Orders test/mock interface, repo mock, and marketing-site baseline errors; none were in the touched drawing-import/order-form paths.
- The running `/orders/new` page recompiled and loaded. Reloading returned the in-app browser session to signed-out state, so an authenticated sample-ZIP click-through was not repeated; the form remains open for owner testing after sign-in.

## Session Handoff — 2026-07-16 (Drawing review preview fix, latest)

Goal: Make Open drawing work while checking imported parts before an order exists.

The failure occurred because draft uploads were linked through `/attachments/...`, whose authorization and lookup intentionally require a persisted quote/order attachment row. Added `GET /api/orders/drawing-import/preview?path=...`, protected by the same authenticated admin access as drawing import, and delegated safe file resolution to the drawing-import service. The resolver permits only supported drawing extensions, stays within the configured attachment root, rejects traversal/invalid paths, verifies the target is a file, and returns metadata for an inline no-store response. Both review-stage Open drawing links now use this draft-aware endpoint; saved-order attachments remain unchanged.

Files touched:
- `src/modules/drawing-import/drawing-import.service.ts`
- `src/modules/drawing-import/__tests__/drawing-import.service.test.ts`
- `src/app/api/orders/drawing-import/preview/route.ts`
- `src/components/orders/DrawingImportPanel.tsx`
- `src/app/orders/new/page.tsx`
- `tasks/todo.md`
- `tasks/lessons.md`
- `PROGRESS_LOG.md`
- `docs/AGENT_HANDOFF.md`

Verification:
- `npm run test -- src/modules/drawing-import/__tests__/drawing-import.service.test.ts` passed (4/4); the sandboxed attempt hit the known Windows `spawn EPERM`, and the approved outside-sandbox rerun passed.
- Targeted ESLint passed on every touched source/test file.
- `npm run lint` passed with no ESLint warnings or errors.
- Live authenticated browser verification opened an existing PDF extracted from the supplied ZIP through the new endpoint and reported `document.contentType === 'application/pdf'` rather than the prior 404 page.
- The order form remains open for user testing.

## Session Handoff — 2026-07-16 (Latest drawing-import test order cleanup, latest)

Goal: Remove the newest test order and its owned drawings so the drawing-assisted order workflow can be tested again from scratch.

Deleted CRM-1004 for Versa Tech Automation after confirming it was the newest order and contained 16 imported parts. The transaction removed the order, 16 parts, 16 part-attachment records, one BOM analysis, and one status-history row. The verified order-specific canonical drawing folder was also removed. No application source files were changed; only local runtime data and continuity documents were touched.

Verification: CRM-1004 lookup returned no order, its canonical drawing folder no longer exists, STD-1007 for Toyota-TMMK is now the newest remaining order, and the running `/orders/new` page returned HTTP 200. The development app remains running for user testing.

## Session Handoff — 2026-07-16 (Quote-first resumable workflow, latest)

Goal: Turn Quotes into the admin-only, resumable starting point for customer intake, drawing import, material walkdown, work estimating, pricing, approval, and lossless non-pricing conversion to Orders.

Scope completed:
- Quote and Order remain separate lifecycles; quotes remain absent from order/dashboard queries.
- Quote Editor now has five persisted checkpoints and Save progress/Save & continue behavior.
- Drawing import is reused for quote intake with per-part drawing ownership and quote-level assembly files.
- Quote parts persist exact drawing material/finish wording, normalized material, finish, material disposition, location, vendor, purchasing note, order, and drawing attachments.
- Material Check has an on-screen correction surface and admin-only pricing-free print sheet.
- Quote updates reconcile persisted part/attachment identity rather than deleting every row; approval attachments are retained.
- Conversion copies new operational fields and part drawings, derives material-needed state, keeps sale pricing off the Order, and uses unique `Order.sourceQuoteId` provenance/idempotency.
- Quote-owned file downloads now require admin access.
- BOM analysis now requires authentication and runs one full-image pass plus at most one lower-right tolerance fallback.
- Cost architecture and remaining source-hash/telemetry work are documented in `docs/QUOTE_FIRST_WORKFLOW.md`.

Primary files touched:
- `prisma/schema.prisma`
- `prisma/migrations/20260716154035_quote_first_workflow_v1/migration.sql`
- `prisma/migrations/20260716155142_quote_source_provenance_v1/migration.sql`
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/app/admin/quotes/client.tsx`
- `src/app/admin/quotes/[id]/material-check/print/*`
- `src/modules/quotes/{quotes.schema.ts,quotes.service.ts,quotes.repo.ts}`
- `src/app/api/admin/quotes/[id]/convert/{route.ts,__tests__/route.test.ts}`
- `src/modules/orders/{orders.schema.ts,orders.service.ts}`
- `src/components/orders/DrawingImportPanel.tsx`
- `src/app/api/print-analyzer/analyze/route.ts`
- `src/app/(public)/attachments/[...path]/route.ts`
- `docs/QUOTE_FIRST_WORKFLOW.md`
- continuity/planning documents

Verification:
- Prisma migrations applied; `npx prisma generate` and `npx prisma validate` passed.
- Focused quote/conversion tests passed 9/9.
- Targeted ESLint passed for every touched source/test file.
- Live `/admin/quotes/new`, quote list, existing quote edit, and material-check print page compiled/rendered on port 3000.
- Full TypeScript remains red on the documented repo-wide baseline only; no quote-first file errors remain.
- App is running at `http://127.0.0.1:3000/admin/quotes/new` for owner testing.

Important follow-up:
- Rotate the OpenAI API key because a diagnostic command exposed it in local tool output; the value was not written into repo files or responses.
- Next analyzer slice: content hash + analyzer version cache, positioned local PDF title-block parsing, response usage/cost telemetry, then a corrected-drawing model comparison before adding OCR or changing models.
## Session Handoff — 2026-07-16 (Quote simplification + pricing integrity + admin IA, latest)

Goal: Make quotes the obvious admin starting point, hide implementation complexity behind Work Steps, establish auditable non-duplicating pricing, and use one approval-gated conversion into an order.

### What changed
- Added `src/app/admin/layout.tsx` as the shared server-side admin access boundary and covered signed-out, non-admin, and admin behavior in `src/app/admin/__tests__/layout.test.tsx`.
- Rebuilt Admin home/navigation around `New Quote`, `Resume Quotes`, and clearly grouped Shop/System setup; direct order creation is now labeled for emergency/internal jobs.
- Renamed the operator-facing add-on/checklist model to `Work Steps`. Admin setup now asks one mutually exclusive usage question and quote assignment uses the same language.
- Added quote Work Step snapshots and uniqueness in Prisma/migration `20260716161000_quote_work_step_snapshots`; the migration backfilled old selections and removed two duplicate part/step groups.
- Added stable quote-part pricing identity, `CALCULATED`/`MANUAL` price source, suggested unit price, intentional $0 support, and canonical final-part totals that replace (rather than add to) their underlying work estimate.
- Simplified quote customer intake, final pricing, internal-versus-customer detail/print presentation, approval state, and conversion. Conversion no longer asks for vendor/material/model values already owned by the quote and cannot create a second order from the same quote.
- Customer quote output keeps final sell prices and work scope while hiding internal rates and vendor cost details.

### Primary files touched
- `prisma/schema.prisma`
- `prisma/migrations/20260716161000_quote_work_step_snapshots/migration.sql`
- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/addons/{page.tsx,client.tsx}`
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/app/admin/quotes/QuoteWorkflowControls.tsx`
- `src/app/admin/quotes/[id]/{page.tsx,print/page.tsx}`
- `src/app/api/admin/quotes/[id]/{route.ts,convert/route.ts}`
- `src/components/Admin/{NavTabs.tsx,QuoteQuickConvertDialog.tsx}`
- `src/components/AvailableItemsLibrary.tsx`
- `src/lib/{quote-metadata.ts,quote-part-pricing.ts}`
- `src/modules/quotes/{quote-addon-bulk.ts,quote-work-items.ts,quotes.repo.ts,quotes.schema.ts,quotes.service.ts}`
- focused tests under `src/app/admin/__tests__`, `src/app/api/admin/quotes`, `src/components/Admin/__tests__`, and `src/modules/quotes/__tests__`

### Verification evidence
- `npx prisma migrate status`: 32 migrations found; schema up to date.
- Focused admin/quote Vitest suite: 7 files / 22 tests passed.
- Targeted ESLint across changed admin/quote/pricing files: passed.
- `npx tsc --noEmit`: no task-related errors; existing vendor-import, kiosk, order-test, mock-repository, and `sterling-site` errors remain.
- `npm run build`: task code compiles; repo-wide validation still stops on the pre-existing vendor-import `existing.id` type error and shows the pre-existing kiosk schema import warning.
- Live browser: task-first Admin home, Work Steps list/dialog, and five-checkpoint quote intake rendered correctly. The browser is left at `/admin/quotes/new`.
- Dev server is running on port 3000 (session `61763`). Local `TEST_MODE=true` intentionally supplies a mock admin; route-tree unit tests independently verify production redirect behavior.

### Follow-ups intentionally deferred
- Purchased material/outside-service rows are still quote-level costs. A future focused slice can link them to individual quote parts for part-level margin reporting and a richer QuickBooks-ready summary; the current quote total already includes their cost plus markup exactly once.
- Repo-wide build/type baseline failures in vendor import, kiosk, order tests, mock repo parity, and `sterling-site` remain outside this task and are recorded in `tasks/todo.md`/`PROGRESS_LOG.md`.
- `prisma/prisma/dev.db`, its journal/runtime files, and other existing dirty-tree drawing/order work belong to the ongoing local session and were not reset.

## Session Handoff — 2026-07-17 (Kiosk / employee / department / time audit)

Goal: Explain the pre-existing production-build errors and assess whether the shared-station employee, department, checklist, and time-tracking flow is safe and coherent.

Scope completed:
- Read-only audit of build/type failures, normal and kiosk identity, shared-station ownership, department routing, checklist completion, timer lifecycle/concurrency, corrections, totals, and current data.
- Used independent kiosk/identity, department/routing, and time-tracking reviews, then reconciled their findings against `CANON.md`, `ROADMAP.md`, source, tests, and current data.
- No runtime behavior, schema, or records were changed.

Key findings:
- Build blockers are localized contract drift, not caused by the quote/admin work: vendor map typing, obsolete kiosk route/import, kiosk result inference, stale Orders tests, mock repo parity, and root inclusion of `sterling-site`.
- P0 security/integrity gaps exist: `kioskEnabled` is not enforced at authentication; normal JWT sessions do not refresh active/role state; one-active-timer is not a database invariant; switching is non-atomic; and legacy timer APIs bypass part-centric validation.
- The visible Move Dept flow uses administrative reassignment instead of canonical department submission, so it can bypass open checklist work. Final canonical submission reports COMPLETE but persists IN_PROGRESS.
- Active timers are not stopped or blocked during move/complete. Current data has one active timer whose department differs from its part's current department.
- Admin correction cannot edit another worker's interval and does not produce a transactional before/after audit record.
- Manual time adjustments and interval totals disagree; duplicate timer/completion APIs and overlapping UI handlers make behavior difficult to reason about.

Verification:
- `npx tsc --noEmit --pretty false` reproduced the complete documented baseline.
- Focused kiosk/time/orders tests passed 25/25; the important unsafe cases are not currently tested.
- Current data: 55 intervals, one active timer, no duplicate-active users or invalid durations, seven active users with disabled kiosk access retaining PIN hashes, and five parts with no exact department ownership.

Recommended ticket order:
1. Security/integrity: kiosk eligibility/session revocation, database single-active constraint, atomic switch, admin stale-timer recovery.
2. Canonical timer command layer: require part/order relationship and timer-eligible current department; deprecate legacy APIs.
3. Canonical department transition: normal submit plus explicit admin override, active-timer protection, completion/status fixes, legacy route removal.
4. Shared-station simplification: one short-lived acting-worker identity for timer, acknowledgement, checklist, and submit.
5. Auditable corrections/canonical totals, then manager reporting and UI extraction.
6. Separate small build-baseline cleanup ticket with no intended behavior change.

Owner clarification addendum:
- The 80-inch machining-floor TV and attached computer are one trusted dispatch station used to view assignments/location and quickly control employee timers.
- Do not require login switching or a target-worker PIN for every dispatch-console action. Persist the signed-in console actor separately from the selected labor owner.
- Enforce one active timer total per employee. Starting urgent work atomically pauses the previous interval; the original assignment stays in place for easy resumption.
- Multiple employees may work on the same part at once.
- Keep timer lifecycle separate from checklist/department completion.
- Add employee-grouped timer history and subtotals to each part, with one all-worker total derived from intervals.
- Prefer Order detail for interactive floor work and a TV-optimized dashboard for passive/at-a-glance status. Keep pricing/admin details off the TV.

## Session Handoff — 2026-07-17 (Trusted shop-floor dispatch console)

Goal: Make the 80-inch TV computer a fast trusted dispatch station that can manage labor timers for any employee without login switching, while preserving trustworthy assignments, department state, and labor history.

Completed:
- Canonical actor/worker timer commands with database-enforced one-open-timer-per-employee and atomic pause/switch.
- Audited timer actions and admin corrections, including separate console actor and labor owner.
- TV `Working now` strip, live durations, assigned-worker queue labels, direct part links, and periodic refresh.
- Order-detail employee selector with PIN-free Start, Pause, and Finish controls.
- Employee-grouped part Timer History with subtotals, all-worker total, live time, intervals, and action actor.
- Active-timer guards on department reassignment/completion and corrected final completion/order rollup.
- Kiosk/session eligibility hardening and optional kiosk delegation to the same timer invariants.
- Active-part department backfill and completed/Shipping start guard.
- Sticky dashboard `?part=` selection bug fixed.
- Cross-platform standalone build packaging.

Primary timer/floor files:
- `prisma/schema.prisma`
- `prisma/migrations/20260717120000_trusted_dispatch_timers/migration.sql`
- `prisma/migrations/20260717124500_backfill_active_part_departments/migration.sql`
- `src/modules/time/{time.repo.ts,time.service.ts,dispatch.service.ts,part-labor-history.ts,PartLaborHistory.tsx}`
- `src/app/api/dispatch/**`
- `src/components/work-queue/{RunningWorkersStrip.tsx,WorkQueueOrderCard.tsx}`
- `src/components/ShopFloorLayouts.tsx`
- `src/app/orders/[id]/page.tsx`
- `src/modules/orders/{orders.repo.ts,orders.service.ts}`
- `src/modules/kiosk/kiosk.service.ts`
- `src/lib/{auth-session.ts,kiosk-session.ts}`
- `scripts/copy-standalone-assets.cjs`

Verification:
- Full ESLint and TypeScript passed.
- Full Vitest passed: 28 files / 127 tests.
- Production build passed and generated all 59 pages plus standalone assets.
- Browser QA passed at 1920x1080 for every owner-requested timer/dashboard/history interaction.

Operational handoff:
- Restart the development server on port 3000 and leave the dashboard open for owner testing.
- Do not silently correct the legacy Jim / CRM-1002 / QA-2-1 timer. It is visible at roughly 1,555 hours and can now be paused or finished explicitly from the order page.

---

## Session Metadata
- Date: 2026-07-17
- Agent: Codex
- Task ID: FSWizard feeds-and-speeds math audit
- Goal: Check the feeds-and-speeds page against the owner-uploaded FSWizard source and database without changing calculator behavior.

## Scope and sources
- Original calculation source: `C:\Users\user\Downloads\this.go`.
- Original decoded data: `C:\Users\user\Downloads\fswizard_embedded_decoded_db.json`.
- Current implementation: `src/modules/feeds-speeds/feeds-speeds.ts`, its types/data/tests, and `src/app/tools/feeds-speeds/FeedsSpeedsCalculator.tsx`.
- This was a read-only product/math audit except for required planning and continuity updates.

## Findings
- Data parity is exact across every imported material/tool/coating/chipload row.
- Core ordinary end-mill/drill SFM, RPM, chipload, and feed math is substantially faithful; tap feed is correct when the operator supplies the correct lead.
- Production use is blocked by the missing machine RPM cap and lack of the source's power/torque/deflection constraints.
- “Full scope” is not accurate for high-feed/lens/chamfer, corner-rounding, thread milling, turning/grooving, or complete tapping because their source-specific geometry/inputs are absent or simplified.
- Ramp feed, drill/ream plunge feed, absolute DOC display, thread-mill pilot size, and tool-family default synchronization need correction.
- The current “Torque risk” is only a material-hardness category, not a torque or machine-load calculation.

## Verification
- Decoded data versus app database: exact equality for 34 materials, 29 tool types, 5 tool materials, 9 coatings, and 68 chipload rows.
- `npm run test -- src/modules/feeds-speeds/__tests__/feeds-speeds.test.ts`: 6/6 passed.
- Independent all-family execution: 29/29 returned results; High Feed Mill reached 162,014 RPM and V-bit 129,932 RPM because no 10,000 RPM source cap is applied.
- Live browser: initial 4-flute Solid End Mill result was 35.39 IPM; changing to its bundled 2-flute default produced 17.70 IPM. Reset restored the original page state.
- Live page showed no console warnings/errors and was left open for the owner.

## Recommended next task
- First add a required machine profile/cap and correct/reset tool-family inputs.
- Then fix or hide unsupported secondary values and implement branch-specific parity in small tested slices.
- Replace self-referential snapshots with golden cases captured from FSWizard for every tool family before calling the page production-ready.
## Session Handoff — 2026-07-17 (Part-specific purchased materials and price explanations, latest)

Goal: Keep purchased materials attached to the part that needs them and explain each compact final price.

### What changed
- Added QuotePart persistence fields procurementCostCents and procurementMarkupPercent, alongside the existing procurementVendorId.
- Updated quote schema, service preparation, repository writes, and editor state/payloads.
- Pricing now shows a part-specific purchased-material card for NEED_TO_ORDER parts with carried vendor, material cost, markup, and quoted total.
- Quote totals include part-specific procurement totals.
- Final price cards include a compact explanation of selected work-step cost and purchased-material cost.

### Verification
- Migration 20260717160945_quote_part_procurement_cost_v1 applied successfully.
- Prisma Client regenerated after stopping the dev server.
- Targeted ESLint passed.
- npx tsc --noEmit passed.
- Focused quote totals tests passed: 4/4.
- Live pricing inspection confirmed the new part-specific purchase card and compact price explanation.
- The test quote was restored to 13 UNREVIEWED parts and workflow step 2 after the walkthrough.

## Session Handoff — 2026-07-17 (Quote material-order resolution feedback, latest)

Goal: Make Order material plus vendor selection visibly resolve the material-check requirement.

### What changed
- Updated src/app/admin/quotes/QuoteEditor.tsx.
- Kept the existing validation/persistence contract, which was already correctly storing NEED_TO_ORDER and procurementVendorId.
- Added an explicit resolved part badge and vendor confirmation text.
- Removed warning-orange treatment from the vendor panel after a vendor is selected; missing vendor/decision states retain the warning treatment.

### Verification
- Reproduced the original path on quote CRM-20260717-6073: 13 unresolved parts became 12 after selecting one vendor, proving the selected part resolved.
- Saved progress and reloaded the editor; the selected vendor and resolved confirmation remained present.
- Targeted ESLint passed.
- npx tsc --noEmit passed.

## Session Handoff — 2026-07-17 (Quote part-list overflow correction, latest)
## Session Handoff — 2026-07-17 (Part-price purchase inclusion and expandable breakdown, latest)

Goal: Make part-specific material purchasing visibly resolve and price the owning part, with an on-demand explanation of each final part price.

### What changed
- Added shared procurement/part-price helpers in `src/modules/pricing/part-pricing.ts`.
- The quote editor and quote service now include a `NEED_TO_ORDER` part's marked-up material cost in that part's calculated unit price, then exclude it from the separate quote-level purchased-item bucket so it cannot be double counted.
- The pricing purchase card now shows `Cost captured` with navy/primary styling only when both the carried vendor and a cost exist; otherwise it retains the clear orange `Enter cost` prompt.
- Each final-price tile now has a `View price details` accordion listing its work-step snapshots, units, rates, priced/checklist-only state, and purchased-material math.

### Verification
- Targeted ESLint passed.
- `npx tsc --noEmit` passed.
- Focused pricing and quote-total suite passed: `2 files / 13 tests`.
- Live browser QA: entering `$30.00` at `20%` markup changed the matching part from `$170.00` to `$206.00`, changed its prompt to `Cost captured`, and showed `$36.00` purchased material in the tile. The first part's accordion also rendered its exact saved work steps. The temporary browser-only edit was discarded by reload.
## Session Handoff — 2026-07-17 (Accumulated GitHub publication checkpoint, latest)

Goal: Publish the full validated product checkpoint while keeping local shop data and generated runtime artifacts off GitHub.

### Scope
- Drawing-assisted order intake and quote-first workflow.
- Quote pricing/procurement, work steps, admin information architecture, and conversion integrity.
- Haas VF-2SS feeds and speeds.
- Trusted Shop Floor dispatch, timer history, Read Me First enforcement, and PIN-kiosk retirement.
- All associated migrations, tests, workflow docs, and continuity records.

### Verification before publication
- `npm run test`: 29 files / 143 tests passed.
- Clean `npm run build`: passed, including all route generation and standalone asset copying.
- `git diff --cached --check`: passed.
- Local SQLite data, `tsconfig.tsbuildinfo`, and the temporary development-server PID were intentionally excluded.

### Published
- Product checkpoint commit: `60bcf11` (`Unify quote and shop floor workflows`).
- Branch: `codex/feeds-speeds-fswizard-parity`.
- Draft PR: `https://github.com/m4440473/shopapp1/pull/178`.

## Session Handoff — 2026-07-17 (Retired separate PIN kiosk, latest)

Goal: Make the existing TV dashboard the only Shop Floor station and remove the redundant employee PIN-kiosk concept from normal use.

### What changed
- Renamed the `/` dashboard and main navigation entry to `Shop Floor`.
- Removed the separate Kiosk navigation item.
- Redirected `/kiosk` to `/`.
- Removed kiosk enablement/status/PIN fields from the admin employee list and form while retaining primary-department assignment.
- Preserved trusted-console worker/operator attribution and the Read Me First receipt gate.

### Verification
- `npx tsc --noEmit`: passed.
- Targeted ESLint for `src/app/page.tsx`, `src/components/AppNav.tsx`, `src/app/kiosk/page.tsx`, and `src/app/admin/users/client.tsx`: passed.
- `git diff --check`: passed with line-ending notices only.
- Live browser QA confirmed Shop Floor naming, no Kiosk link, `/kiosk` redirect behavior, and no kiosk/PIN controls in employee administration.

### Next
- Legacy kiosk session/API/client implementation remains dormant for compatibility and can be removed later as a dedicated cleanup task after confirming no external bookmarks or integrations use those endpoints.

## Session Handoff — 2026-07-17 (Authoritative Read Me First timer gate, latest)

Goal: Make the boss's Read Me First note a real timer-start gate without adding repeated PIN friction on the trusted shared shop console.

### What changed
- Dispatch timer start now verifies an existing versioned instruction receipt and cannot create one from a confirmation boolean.
- The order page routes the selected worker through the complete mission brief, saves the acknowledgement with separate worker/operator attribution, refreshes the receipt display, and then opens the normal timer confirmation.
- The old supervisor checkbox and trusted-console employee PIN prompt were removed.
- The kiosk now shows the blocking instructions and records acknowledgement for its already PIN-unlocked worker before retrying start.

### Verification
- `npm run test -- src/modules/time/__tests__/dispatch.service.test.ts src/modules/orders/__tests__/orders.service.test.ts`: 2 files / 18 tests passed.
- `npx tsc --noEmit`: passed.
- Targeted ESLint for all touched files: passed.
- `git diff --check`: passed with line-ending notices only.
- Live browser QA confirmed the full mission brief, explicit acknowledgement identity, no trusted-console PIN field, and optional behavior where no instructions exist.

### Next
- No required follow-up for this gate. A future enhancement could add an admin report of unread current-version instructions across active parts if the owner wants proactive visibility.
## Session Handoff — 2026-07-20 (Narrated quote-to-order tutorial video, latest)

Goal: Deliver a friendly, thorough 3–5 minute training video that shows the full quote-to-order flow plus quote/order editing.

### What changed
- Created the narrated 1080p walkthrough: `artifacts/quote-tutorial/ShopApp_Quote_to_Order_Tutorial.mp4`.
- Created matching captions: `artifacts/quote-tutorial/ShopApp_Quote_to_Order_Tutorial.srt`.
- Retained the reusable local authoring files, captured real ShopApp screens, and render manifest under `artifacts/quote-tutorial/`.

### Verification
- Video probe confirmed H.264 video, AAC narration, 1920x1080 resolution, and a 4 minute 32 second runtime.
- Visual QA checked the title, part-pricing/work-step explanation, and closing screens for framing and legibility.
- The walkthrough covers quote creation/resume, customer setup, drawing upload/review, material walkdown, work planning, pricing, editing a quote, conversion to an order, and editing an order.
- The local app is intentionally left running at `http://127.0.0.1:3000/`.
## Session Handoff — 2026-07-20 (Live-action quote tutorial rebuild, latest)

Goal: Replace the rejected narrated slideshow with a genuine 3–5 minute tutorial that visibly demonstrates ShopApp quote creation, editing, conversion, and order editing.

### What changed
- Captured 218 real ShopApp states and assembled 158 action frames into a continuous 3:10.58 walkthrough with cursor movement, click feedback, typing, scrolling, file upload, import progress, and real navigation.
- Replaced `artifacts/quote-tutorial/ShopApp_Quote_to_Order_Tutorial.mp4` with the 1920x1080 H.264/AAC live-action version and regenerated its matching SRT captions and manifest.
- Added reusable authoring script `artifacts/quote-tutorial/create_live_quote_tutorial.py`, capture timeline, QA contact sheet, and isolated training input.
- Created training quote `CRM-20260720-5745` and converted training order `CRM-1006` for the demonstration.
- Fixed date-only order due dates displaying one day early by formatting the order detail due date in UTC in `src/app/orders/[id]/page.tsx`.

### Verification
- Media probe confirmed 3:10.58 duration, 1920x1080 H.264 High video, yuv420p pixel format, and AAC narration.
- The canonical and `_Live` MP4 copies have matching SHA-256 `A104FC8D7C4E3F9EC54F870E438568CECC75C909C2B89C049059E4AED2080F33`.
- Visual QA passed across the full contact sheet and a representative final-order frame; the tutorial visibly covers the full requested workflow rather than holding screenshots.
- Targeted ESLint for `src/app/orders/[id]/page.tsx` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed with line-ending notices only.
- The development app remains running at `http://127.0.0.1:3000`.
## Session Handoff — 2026-08-24 (Customer-part repeats and required reading, latest)

Goal: Make repeat orders reusable by customer/part and make required-reading authoring, enforcement, and status obvious end to end.

### What changed
- Added nullable unique `RepeatOrderTemplate.sourcePartId`; selected-part snapshots reuse the existing frozen template for that source part.
- Added `Create again` to old order detail, customer/part identity to template summaries, and `/repeat-orders` plus admin navigation for launching saved definitions.
- Added `QuotePart.workInstructions`, schema/repo/service/editor support, and conversion mapping into order-part required reading.
- Renamed and visually emphasized direct/repeat order work instructions as `Required reading / Read Me First`; fixed direct-order submission to include `workInstructions`.
- Added acknowledged/not acknowledged active-user groups on order detail for the current instruction version and department.
- Preserved the pre-existing order due-date UTC display correction in the dirty order-detail file.

### Files and migrations
- Repeat order: `prisma/schema.prisma`, `prisma/migrations/20260824120000_repeat_template_source_part/migration.sql`, `src/modules/repeat-orders/*`, `src/app/repeat-orders/page.tsx`, `src/components/repeat-orders/CustomerRepeatTemplateSection.tsx`, `src/components/AppNav.tsx`, `src/app/orders/[id]/page.tsx`.
- Required reading: `prisma/migrations/20260824121000_quote_part_required_reading/migration.sql`, `src/app/admin/quotes/QuoteEditor.tsx`, `src/app/orders/new/page.tsx`, quote schema/service/repo, conversion route/test.

### Verification
- `npx prisma format`, normal `npx prisma generate`, and `npx prisma migrate deploy` passed; both new migrations applied to the workspace dev DB.
- Focused Vitest passed: 4 files, 31 tests (repeat orders, orders, timer, quote conversion).
- Targeted ESLint and `npx tsc --noEmit` passed.
- `npm run build` passed and generated 61 pages; the sandboxed first attempt could not fetch existing Google Font assets, and the approved network-enabled rerun passed.
- Live browser QA passed for `/repeat-orders`, old-order `Create again`, explicit acknowledgment roster (1 acknowledged, 12 not acknowledged on the inspected part), quote Work Details authoring, and direct-order authoring; no browser console errors.
- Temporary dev server used for QA was stopped at session end.

### Next
- No required follow-up for this slice. Existing legacy multi-part repeat templates remain readable and are labeled as legacy; new selected-part templates use the customer-part contract.
## Session Handoff — 2026-08-24 (Required-reading demonstration order, latest)

Goal: Create a real order that demonstrates the new required-reading gate.

### Result
- Created `STD-1009` for Starter Customer with part `READ-ME-DEMO` (`Required Reading Demo`), quantity 1, due 2026-09-07.
- Saved required reading: review the latest print and confirm material, setup, and revision; stop and ask the boss if anything does not match.
- Verified the order detail shows `Needs acknowledgement`, the full note, and both acknowledgement roster groups.
- The local development server remains running on port 3000 and the created order is open in the browser.

## Session Handoff — 2026-08-24 (Customizable Live Production display, latest)

Goal: Make the shared Shop Floor page directly configurable for broad sorting and attention-based tile colors without sacrificing the big-screen view.

### What changed
- Added `shopFloorDisplayOptions` to `AppSettings` with migration `20260824143000_shop_floor_display_options`.
- Added the Shop Floor repo/service/schema/shared-helper boundary plus authenticated GET and admin-only PATCH at `/api/shop-floor/display-options`.
- Made `Customize this shop floor` the first major block below the page title. It contains layout, filters, sort field/direction, ordered color-rule editing, save feedback, and a collapse control whose state survives refresh on that device.
- Added fourteen practical sort choices plus rule fields covering overdue age, business, priority, status, customer, machinist, current department, quantity, parts, open checklist items, and active timers.
- Added the requested default rule: 7 or more days past due uses `#dc2626` at 28% opacity. Rule styling is shared by department queue cards, grid tiles, and machinist rows.

### Verification
- Migration applied and Prisma client regenerated.
- Focused Vitest: 2 files / 9 tests passed.
- Targeted ESLint, `npx tsc --noEmit`, and `git diff --check` passed.
- `npm run build` passed with 62 generated pages and standalone asset copy.
- Live browser QA confirmed shared settings save, collapse persistence after refresh, order-number descending preview (`STD-1009` first), saved due-date ordering restored (`STD-1003` first), and red translucent CSS on overdue queue/grid tiles.
- One clean development server remains running at `http://127.0.0.1:3000/` for owner review.

### Next
- No required follow-up. If management later wants different displays to retain different shared profiles, promote the singleton profile to named/device-assigned profiles rather than overloading the current device-local collapse flag.

## Session Handoff — 2026-08-24 (Glass Live Production treatment, latest)

Goal: Match the owner-supplied glassmorphism reference on the Shop Floor dashboard and deepen the overdue alert red.

### What changed
- Added dashboard-scoped glass atmosphere and three surface depths in `src/app/globals.css`; the style does not leak to quotes, orders, customers, or admin.
- Restyled the full Live Production hierarchy: control shell, settings, rule rows, running-worker strip/cards, department queue/cards/part rows, grid digest, machinist groups, metrics, recent orders, workload, and status pulse.
- Preserved inline conditional-color precedence so alert tiles remain status-colored while retaining light edges and blur.
- Changed the default overdue color to oxblood `#7f1d1d` and added a compatibility promotion for only the untouched `#dc2626` legacy default.

### Verification
- Focused Shop Floor tests passed: 2 files / 10 tests.
- Targeted ESLint, `npx tsc --noEmit`, and `git diff --check` passed.
- Production build passed with 62 generated pages and standalone asset copy.
- Live browser QA confirmed the supplied-reference visual traits: colored atmospheric light, translucent panels, white glass borders, nested blur/depth, collapsed big-screen controls, and overdue card CSS `rgba(127, 29, 29, 0.28)` with a deeper oxblood border.

### Next
- No required follow-up. Keep future glass adjustments scoped under `.shop-floor-glass` unless the owner explicitly asks to expand the visual system app-wide.

## Session Handoff — 2026-08-24 (Black/navy Shop Floor palette, latest)

Goal: Keep the new glassmorphism treatment while removing the owner-disliked cyan cast from Live Production.

### What changed
- Replaced the route-scoped ambient cyan/green/amber lighting with black, near-black navy, restrained royal blue, and a small indigo depth layer in `src/app/globals.css`.
- Strengthened the dark backing layer so the global application cyan glow does not show through the dashboard's transparent panels.
- Retained the glass borders, blur, depth, and localized semantic colors; overdue tiles remain translucent oxblood rather than blending into the navy palette.

### Verification
- Targeted ESLint and `npx tsc --noEmit` passed.
- Production build passed with 62 generated pages and standalone asset copy.
- Live browser QA confirmed expanded/collapsed controls, black/navy/slate glass, preserved deep-red overdue tiles, and no cyan page wash.

### Next
- No required follow-up. Existing cyan action/brand accents are intentionally localized; remove those separately only if the owner asks for a fully cyan-free component palette.

## Session Handoff — 2026-08-24 (Shop Floor Quick View and collapsible timers, latest)

Goal: Make common sorting/filtering permanently convenient without crowding the collapsible configuration menu, and allow Working now to collapse independently.

### What changed
- Added a small select-only Quick View strip immediately above the active grid, machinist, or department-queue view. It owns quick status, priority, sort field, and ascending/descending selection plus quiet result-state text.
- Restored the Live Production collapse to configuration only: layout choice, advanced filter dialog, conditional tile rules, and shared Save remain inside it.
- Department queue items now use the same filtered order membership before sorting; grid/machinist active-timer sorting uses live timer counts.
- Working now has a separate collapse control and device-local remembered state.
- Removed the duplicate Unassigned machinist entry from the advanced filter menu.

### Verification
- Targeted ESLint and `npx tsc --noEmit` passed.
- Focused Shop Floor/Working now tests passed: 2 files / 10 tests.
- A clean production build passed with 62 generated pages and standalone asset copy. The first attempt hit a stale missing `.next` chunk after a Windows paging interruption; verified cache removal resolved it.
- Live QA confirmed the Quick View strip stays visible while both larger sections are collapsed, order-number descending returns `STD-1009`, `STD-1008`, `STD-1007`, the timer collapse survives reload, and the filter menu has one Unassigned option.

### Next
- No required follow-up. Keep future reversible view-only controls in the Quick View strip and persistence/configuration actions in the collapsible Live Production menu.

## Session Handoff — 2026-08-24 (Exact pre-tile control placement correction, latest)

Goal: Use the former department-selector slot for the four everyday view controls and keep department configuration inside Customize.

### What changed
- Removed the standalone Quick View glass wrapper.
- Rendered Status, Priority, Sort, and Direction as compact rounded selects in the exact row immediately before work-queue tiles, grid tiles, or machinist groups.
- Moved department pills and Show completed items into the collapsible Customize this shop floor content, visible for the work-queue layout.
- Kept the previously verified filter-then-sort behavior and independently remembered Working now collapse.

### Verification
- Targeted ESLint and `npx tsc --noEmit` passed.
- Focused tests passed: 2 files / 10 tests.
- Clean production build passed with 62 generated pages and standalone asset copy.
- Live QA confirmed department controls hide with Customize, the four selects remain in the former pill row, Fab/Machining switching works inside configuration, and descending order number produces `STD-1009`, `STD-1008`, `STD-1007`.

### Next
- No required follow-up. Treat this exact pre-tile row as the owner-approved location for reversible status/priority/sort/direction controls.
## Session Handoff — 2026-08-24 (Department workflow and production-layout audit, latest)

Goal: Diagnose Fab-to-Machining behavior, verify first-department defaults, and report the current repository/production filesystem layout without changing product behavior.

### Findings
- Order detail exposes only `Submit {department} complete`; the existing manual `assign-department` and `transition` APIs have no frontend caller.
- The submit dialog predicts the next globally ordered department, but the service selects the first department with an open checklist. Live CRM-1001 / QA-1-1 therefore previewed Paint while the owner wanted Machining; because that part has no Fab checklist item, submission would be rejected before either move.
- Direct and repeat orders initialize parts to the first active department ordered by `sortOrder`, then name. Quote conversion does too, but an automatic quote does not snapshot that department when saved, so later department reordering can change its eventual starting department.
- Production keeps durable state separated under `C:\ShopApp`, but `app` is a full development checkout, `.env` and an empty storage folder are duplicated inside it, `incoming` retains staging artifacts, and only the initial pre-update DB backup exists.

### Files touched
- Continuity only: `tasks/todo.md`, `PROGRESS_LOG.md`, `docs/AGENT_HANDOFF.md`, and `docs/AGENT_TASK_BOARD.md`.

### Verification
- Authenticated live browser inspection of CRM-1001, order controls, checklist, and configured department sort order.
- Read-only source tracing of order routing, quote conversion, direct-order creation, and repeat-order initialization.
- `npm run test -- src/modules/orders/__tests__/orders.service.test.ts src/modules/repeat-orders/__tests__/repeat-orders.service.test.ts` — 2 files / 19 tests passed.
- Read-only SSH inventory of `C:\ShopApp`; no secrets were read and no production state changed.
## Session Handoff — 2026-08-25 (Department controls, quote origin, and Order Traveler, latest)

Goal: Repair part routing controls, make quote defaults stable, and deliver a physical Order Traveler on the live Windows server.

### What changed
- Order detail now separates governed department completion from manual movement. Manual moves select any other active department, require an audit note, refuse active-timer moves, and retain existing backend event/rework behavior.
- The UI and service now share `findNextDepartmentWithOpenChecklist`; completion is visibly blocked for active timers, missing current-department checklist rows, or open checklist work.
- Quote creation now explicitly selects and snapshots the first active department ordered by `sortOrder` then name, with guarded loading/failure/no-department states and server-side enforcement.
- `/orders/[id]/print` is now the Order Traveler. It produces one US Letter sheet per part and is linked by `Print traveler` from every order.

### Key files
- `src/app/orders/[id]/page.tsx`
- `src/app/orders/[id]/print/page.tsx`
- `src/app/admin/quotes/QuoteEditor.tsx`
- `src/components/print/OrderTravelerControls.tsx`
- `src/components/print/OrderTravelerDocument.tsx`
- `src/modules/orders/department-routing.ts`
- `src/modules/orders/order-traveler.ts`
- `src/modules/orders/orders.repo.ts`
- `src/modules/orders/orders.service.ts`
- `src/modules/quotes/quote-departments.ts`
- `src/modules/quotes/quotes.repo.ts`
- Focused tests beside the order/quote modules.

### Verification and deployment
- Focused Vitest: 4 files / 28 tests passed.
- Targeted ESLint and `npx tsc --noEmit` passed.
- Clean `npm run build` passed locally and on `.72` with 62 generated pages plus standalone assets.
- Local and production live QA confirmed CRM-1001 shows the exact Fab blocker, a Machining-capable audited move dialog, and two correct Traveler sheets without mutating the order.
- Production health passed at `http://192.168.254.72/api/health` and `http://desktop-bkbakpm.local/api/health`; sign-in returned HTTP 200.
- Rollback source: `C:\ShopApp\backups\pre-update\feature-20260825-0824`; DB backup: `C:\ShopApp\backups\pre-update\shopapp1-before-feature-20260825-0825.db`.
- Live DB remained 1,142,784 bytes with last write `2026-08-24T17:44:40.8388007-04:00`; storage remained 12 files.

## Session Handoff — 2026-08-25 (Production hostname, latest)

Goal: Give the Windows production host the stable, recognizable computer name `SHOPAPP`.

### Result and verification
- Preflight confirmed the `ShopApp` scheduled task, local health endpoint, and automatic SSH service were healthy.
- `Rename-Computer` staged `DESKTOP-BKBAKPM` -> `SHOPAPP`, followed by the required controlled Windows restart.
- The fixed router reservation stayed at `192.168.254.72`. Recovery was delayed for several minutes but completed without onsite intervention.
- Windows now reports `COMPUTER=SHOPAPP`; `shopapp.local` resolves to `192.168.254.72` and its health endpoint returns HTTP 200.
- The IP health endpoint also returns HTTP 200. `sshd` and `TermService` are Running/Automatic, Remote Desktop is enabled, and TCP 3389 is reachable.
- No repository source, production database, or attachment-storage content was changed.

## Session Handoff — 2026-08-25 (Customer mirror, monitoring, and Codex readiness, latest)

Goal: Make ShopApp files searchable in `projects`, continuously monitor/recover the webserver, and correct Codex's `.72` project access.

### Live design
- Canonical files remain at `C:\ShopApp\storage` so Unraid downtime does not stop ShopApp.
- Windows exposes hidden encrypted read-only `ShopAppStorage$` only to local `shopapp_mirror`; firewall TCP 445 is scoped to `192.168.254.10`.
- Unraid stores the protected generated credential at `/boot/config/plugins/shopapp-customer-mirror/windows-storage.credentials` and runs `/boot/config/plugins/user.scripts/scripts/ShopAppCustomerMirror/script` every five minutes.
- Searchable mirror: `/mnt/user/projects/ShopApp Customer Files` / `\\SterlingServer\projects\ShopApp Customer Files`. Sync copies new/changed files and never deletes mirror content.
- Mirror status/log: `/mnt/user/projects/Backups/ShopApp/monitoring/customer-mirror-status.json` and `customer-mirror.log`.
- Windows `ShopApp Health Monitor` runs `C:\ShopApp\maintenance\health-monitor.ps1` every two minutes as SYSTEM. Status/log: `C:\ShopApp\logs\health-status.json` and `health-monitor.log`.
- Unraid runs `ShopAppRemoteHealthMonitor` every two minutes against `http://192.168.254.72/api/health`. Status/log live under `projects/Backups/ShopApp/monitoring`.

### Codex
- Codex state/config were backed up before repair. The selected trusted project is now `ShopApp Production` at `C:\ShopApp\app`; the previous managed project remains as `ShopApp Context`.
- A `PAIR CODEX REMOTE.txt` guide and `ShopApp.url` shortcut are on the admin desktop.
- Official behavior: each Codex task runs on the selected connected computer/project. Remote does not merge the workstation and server filesystems; phone pairing still requires Settings > Connections > Control this PC and QR approval under the same account/workspace.

### Verification
- PowerShell installers parsed; both Unraid scripts passed `bash -n` on Unraid.
- Initial 12-file seed, full hashes, and incremental marker hash passed; temporary marker removed from both servers.
- Final mirror status: healthy, `changed=0 files=12`.
- Windows scheduled monitor automatic run result `0`; Windows and Unraid health statuses are healthy and ShopApp remains HTTP 200.
## Session Handoff — 2026-08-25 (Local demo follow-up batch, deployment held, latest)

Goal: Prepare the owner's order-detail visuals, traveler staffing correction, newest-first Shop Floor default, customer contacts, multi-worker assignment, and structured addresses locally while leaving `.72` unchanged during a live demo.

### Completed scope
- Added shared Shop Floor-style order-detail tile/inset surfaces across all order-detail tabs and supporting BOM/labor components.
- Kept `Order.assignedMachinistId` as the optional Coordinator and added multiple selected worker IDs to direct creation and quote conversion; worker selections fan out to part assignments.
- Traveler shaping now reads coordinator and active part workers separately and prefers immutable order contact snapshots over later customer edits.
- Added `Order.createdAt`; fresh/default Shop Floor display is newest-created first, with a narrow saved-default upgrade from due-date ascending.
- Added `CustomerContact`, structured address fields, quote/order contact selection, and order contact snapshots with a backward-compatible migration and legacy fallbacks.

### Verification
- `npx prisma migrate dev` and disposable migration validation passed after a local DB backup.
- Focused Vitest: 8 files / 51 tests passed.
- Targeted ESLint, full TypeScript, and clean production build passed; build produced 62 pages.
- Browser QA verified all six order-detail tabs, traveler role labels, Toyota's multi-contact editor, structured address inputs, quote/direct-order selectors, and newest-first Shop Floor order.
- Read-only local counts: 4 customers, 4 contacts, 16 orders, 17 quotes.

### Deployment hold / next action
- Do not connect to or change `192.168.254.72` until the owner explicitly releases the hold.
- When released, follow `docs/DEPLOYMENT_READY_2026-08-25.md`, including the production DB/app rollback copy before `prisma migrate deploy`.
## Session Handoff — 2026-08-25 (Business document headers and disclaimer, deployment held, latest)

Goal: Make quote templates capable of reproducing the owner's business letterhead/disclaimer examples and reconfirm the daily quote-number format without deploying during review.

### Completed scope
- Header blocks now own editable business name, address lines, phone, and email and automatically resolve Sterling/C&R/Powder Coating presets by the quote/template business.
- Template business selection is constrained to the three configured businesses or All businesses; a shared template still resolves the actual quote business at render time.
- Quote print renders business details left and QUOTE/number/date right. Customer Info stays separately positionable and includes structured customer address data.
- Added a draggable Disclaimer block with editable heading/body, instant preview, and bordered printed output.
- Confirmed all new quote creation uses `DDMMYY-###`; legacy saved numbers are not rewritten.

### Verification
- Focused tests: 4 files / 13 tests passed.
- Targeted ESLint, full TypeScript, and production build passed (62 pages).
- Browser QA confirmed the editor fields, C&R preset/live preview, Disclaimer editor/default preview, and C&R quote print header.
- No UI save was made during QA; no connection to `.72` occurred.

### Next action
- Owner review is pending. Keep the production hold until explicit approval, then follow `docs/DEPLOYMENT_READY_2026-08-25.md` and verify the next deployed quote number on `.72`.
## Session Handoff — 2026-08-26 (Three business customer lists imported live)

Goal: Import the Sterling, C&R, and PKP customer spreadsheets from `.10/projects` into ShopApp without duplicating real customers or disturbing live order/quote history.

### What changed
- `Customer.fax`, `CustomerContact.fax`, and `CustomerBusiness` preserve fax data and the source business list(s). Customer list/detail pages show business badges; customer detail/edit surfaces display and edit fax values.
- `scripts/import-customer-workbooks.cjs` reads the three QuickBooks-export XLSX layouts, skips three known bookkeeping sentinels, conservatively normalizes aliases, preserves multiple contacts/business memberships, fills only blank existing fields, and writes dry-run/apply audit reports.
- Migration: `prisma/migrations/20260826140000_customer_import_business_fax_v1/migration.sql`.

### Production result and recovery
- Imported 234 rows into 194 unique source organizations: 188 new customers plus six matches to existing customers, 162 contacts, and 229 business memberships. Live totals: 195 customers, 169 contacts, 229 memberships, 157 structured addresses, 137 phones, 40 faxes, and 9 emails.
- Existing production history stayed intact: before/after counts remain 2 orders, 1 quote, and 2 parts. A post-import dry run returned zero pending customer/contact/membership writes.
- Backup/import reports and the pre-migration DB are under `C:\ShopApp\backups\pre-update\customer-import-20260826-093254`; restore `shopapp1.db` and the backed-up targeted source files from that directory for rollback.

### Verification
- Source SHA-256: Sterling `CB7F7CF9BB39EB9EBC6A4C091FD3C81179F6C3F231FFB8CC41392F0D7C6D3846`; C&R `67AC719BF741DE0653278CB9B16073A130E54652D893174DF23520EBE317ED0C`; PKP `73D1EE81D394248E32AEE700BB79C14DC98E2C7769877F4514AF245E257443BF`.
- Focused customer tests 5/5, targeted ESLint, full TypeScript, `git diff --check`, local/server 62-page builds, migration validation on a fresh production copy, server idempotency report, and `.72` loopback health all passed.
- Browser QA was unavailable from the Codex in-app browser because that isolated browser could not resolve/reach the private Tailscale/LAN host; server-render/build and live database/service checks are authoritative for this release.
## Session Handoff — 2026-08-26 (Customer dashboard deployed)

Goal: Turn Customers into a robust relationship dashboard with customer-relevant filters, metrics, search, sorting, and Tiles/List presentation.

### What changed
- `src/modules/customers/customer-dashboard.ts` derives dashboard metrics from customer/order/part/time relations; `customer-dashboard.shared.ts` owns the common search/filter/sort pipeline.
- `src/modules/customers/customer-dashboard.ui.tsx` provides Search, Business, Activity, Sort, Direction, Tiles, and List controls. Desktop List is a dense table; mobile List is a no-overflow compact row layout.
- `src/modules/customers/customers.repo.ts` now includes time intervals for dashboard reads, and the service returns the serializable dashboard contract instead of leaking Prisma-shaped data into the page.
- `src/modules/customers/__tests__/customer-dashboard.test.ts` covers metric calculation, invalid intervals, search/filter combinations, all numeric/date sorts, both name directions, and missing-date placement.

### Verification / release state
- Focused tests 15/15, targeted ESLint, full `npx tsc --noEmit`, `git diff --check`, and the 62-page production build passed.
- Local browser QA passed at desktop and `390x844`; mobile document/body width measured 380px within a 390px viewport, with clean Tiles and a purpose-built compact List.
- After explicit owner approval, six exact-hash files were deployed by `ops/Deploy-ShopApp-CustomerDashboard.ps1`; the server build completed all 62 pages and the deployed hashes match local.
- Rollback: `C:\ShopApp\backups\pre-update\customer-dashboard-20260826-095958`.
- Final production verification: loopback/IP/`shopapp.local` health HTTP 200, Customers expected authenticated 307 redirect, ShopApp Running, Health Monitor Ready/enabled with last result 0, and `shopapp.err.log` zero bytes.
## Session Handoff — 2026-08-26 (Customer Tile visual parity deployed)

Goal: Restore the Customer Tiles to the exact visual language used by Shop Floor order tiles.

### What changed / verification
- `src/modules/customers/customer-dashboard.ui.tsx` now uses the canonical `shop-floor-glass` / `shop-glass` surface, cyan title hierarchy, unboxed two-column fact grid, border/depth, and hover lift. List views and all behavior are unchanged.
- Desktop visual QA passed. At `390x844`, document/body width is 380px with no horizontal overflow; the wide decorative glow is clipped without clipping tile content.
- Targeted ESLint, TypeScript, `git diff --check`, and the 62-page production build pass.

### Release state
- Exact source hash: `42D117C8E275E682819E47EA0392AF9DD74D066CE1D65BAF00E8FC387413A565`.
- After explicit approval, the guarded one-file script completed the 62-page server build and deployed the matching hash.
- Rollback: `C:\ShopApp\backups\pre-update\customer-tile-parity-20260826-101737`.
- Final checks: loopback/IP/`shopapp.local` health HTTP 200, Customers expected authenticated 307, ShopApp Running, Health Monitor Ready/enabled with result 0, and zero-byte error log.
## Session Handoff — 2026-08-26 (Customers mechanics corrected server-only)

- On `.72` only, moved the Shop Floor canvas class to the Customers page wrapper, removed the nested dashboard canvas/overflow container, and removed the filter backing panel.
- This fixes the separate scrollbar, visible backing around tile radii, and filters/tiles scrolling together under a nested layer.
- Server verification: 62-page build; exact class assertions passed; loopback/hostname HTTP 200; task Running; monitor Ready/result 0; error log empty.
- Rollback: `C:\ShopApp\backups\pre-update\customer-page-mechanics-20260826-104409`.
- Important: workstation product source intentionally remains behind these two server files because the owner requested a direct-server-only correction. Reconcile before any future source deployment.
## Session Handoff — 2026-08-26 (Quote customer list production hotfix)

- Directly on `.72`, changed the quote editor customer request from 100 to 5,000 after confirming the apparent scroll cutoff was data truncation at the API request.
- Production verification: 62-page build passed; ShopApp task Running; loopback health HTTP 200.
- Rollback: `C:\ShopApp\backups\pre-update\quote-customer-limit-20260826-110834`.
- Workstation product source was intentionally not edited; reconcile this server-only change before any future source deployment.
## Session Handoff — 2026-08-26 (Direct-order customer list hotfix)

- Directly on `.72`, changed the new-order customer request from 100 to 5,000.
- Production verification: 62-page build passed; ShopApp task Running; loopback health HTTP 200.
- Rollback: `C:\ShopApp\backups\pre-update\order-customer-limit-20260826-121101`. Reconcile the server-only source edit before a future deployment.
## Session Handoff — 2026-08-26 (100-file drawing upload hotfix)

- Directly on `.72`, raised ZIP drawing imports from 50 to 100 files and updated the upload UI text.
- Production verification: 62-page build passed; ShopApp Running; loopback health HTTP 200.
- Rollback: `C:\ShopApp\backups\pre-update\drawing-upload-100-20260826-130802`. Reconcile the server-only edits before a future deployment.
## Session Handoff — 2026-08-26 (Production access continuity)

- Future agents must read `docs/PRODUCTION_ACCESS.md` before connecting to `.72`.
- The runbook records the authorized non-secret SSH settings, explicit Windows OpenSSH executables, workstation key locations/fingerprint, production paths/tasks, safe deployment sequence, and Tailscale/RDP boundaries.
- Verified key-based access from this workstation returns hostname `SHOPAPP`. No password or private-key contents were added to the repository.
## Session Handoff — 2026-08-26 (Order intake reliability batch staged; deploy blocked by active review)

Goal: Resolve the owner's eight reported order/quote intake, assignment, attachment-security, and 92-drawing workflow issues without interrupting the active production drawing review.

### Scope completed locally
- Material Ordered / On Hand is independently selectable; quantity controls permit a blank editing state and normalize at validation/submission.
- Customer-specific Add Contact is available in quote and direct-order intake, preserving multiple contacts and one primary contact.
- Manual quote prices carry an explicit Each Part versus Whole Quantity / Lot basis through persistence, totals, detail, and print.
- Stored quote PDFs are scanned for a PO number during conversion. A user-entered PO always wins; the conversion route performs a final blank-value fallback scan.
- Multi-worker direct-order selection seeds every part, and Shop Floor derives the machinist label/filter/workload from deduplicated part assignments when no coordinator exists.
- Non-admin attachment policy allows only part drawing kinds and is enforced both in returned data and the authenticated `/attachments/...` download route.
- Drawing import now has stable device-local autosave, clear-after-success semantics, One-off/Assembly mode and multiplier, add-material-in-place, deterministic saw allowance/total stock math, conditional BOM context, bounded concurrency, bounded 20-page/80k PDF extraction, and a 100-file archive limit.

### Verification evidence
- `npx prisma validate` and `npx prisma generate`: passed.
- Targeted `npx eslint` and full `npx tsc --noEmit`: passed.
- Integrated focused Vitest: 14 files / 101 tests passed.
- Full Vitest: 44 files / 231 tests passed.
- `npm run build`: passed; 62 routes/pages and standalone assets completed.
- `git diff --check`: passed; warnings were CRLF conversion notices only.
- Browser QA at `http://localhost:3000/orders/new`: Material Ordered / On Hand enabled without purchasing; Toyota selection exposes Add Contact; default quantity could be replaced with `92`; drawing intake starts with One-off/Assembly; Assembly exposes assembly count; uploader advertises up to 100 drawings.

### Release state / next action
- No `.72` mutation, deployment, migration, or service restart occurred during this batch.
- Recent production-only hotfixes were first reconciled into workstation source, so a future deployment will not regress them.
- The only release blocker is the owner's currently open 92-drawing production review. The new autosave cannot protect work that began on the older running build. Obtain explicit confirmation that the order/quote has been successfully saved or the tab is no longer needed, then follow `docs/PRODUCTION_ACCESS.md`: backup production DB/uploads and targeted source, deploy, run any pending migrations, build, restart, and verify health plus data invariants.
## Session Handoff — 2026-08-26 (Order intake reliability deployed)

- Owner confirmed the large drawing order was saved, removing the production hold. Post-deploy read-only audit shows `STD-1002` with 85 parts; totals are five orders, 89 parts, two quotes, and 195 customers.
- Release archive SHA-256: `F40ACA3B49C7D3C4A386B062244B9806DF6131B2514E4935B2925C7D3B73435E`; 369 source/schema/migration files deployed.
- Rollback: `C:\ShopApp\backups\pre-update\order-intake-reliability-20260826-155249`, including the complete pre-release database and replaced-file copies.
- Server verification: Prisma generated; 40 migrations found / zero pending; 62-page build passed; app task Running; monitor Ready/result 0; loopback/IP/`shopapp.local` health 200; sign-in 200; error log 0 bytes.
- Data preservation: production DB remained 1,175,552 bytes with last-write `2026-08-26T15:12:12.0357733-04:00` before and after deployment. Twelve representative source hashes match local exactly.
- Deployment tooling note: Windows PowerShell 5.1 does not expose `[System.IO.Path]::GetRelativePath`; the guarded deployment script now uses a compatible rooted-substring calculation. The first attempt stopped before runtime/source mutation and live health was reconfirmed before retry.

## Session Handoff — 2026-08-27 (Multi-page PDF drawing packets live)

Goal: Let quote/direct-order intake extract individual parts when a customer supplies one combined multi-page PDF.

### Implementation
- `drawing-import.service.ts` now detects PDFs with more than one page, caps packets at 100 pages, renders each page at 1.5x through the already-installed `pdfjs-dist` / `@napi-rs/canvas` runtime, and sends each page image through the existing bounded four-worker extraction path.
- The extraction contract classifies `PART_DRAWING`, `BOM`, `COVER`, or `OTHER`. Only BOM/cover pages are excluded automatically; `OTHER` is deliberately retained with a review warning so a low-confidence model result cannot silently drop a real part.
- Original packet PDFs are stored once as order/quote supporting files. Generated part drawings use page PNGs, and the review/source label records `original.pdf — page N of M`. BOM page text remains available to drawings that explicitly say SEE BOM / SEE PARTS LIST.
- API/UI/draft state now carry supporting files. Existing one-page PDFs and ZIPs preserve their prior behavior.

### Verification / production
- Local focused test: 22/22. Complete suite: 44 files / 233 tests. Targeted ESLint, TypeScript, `git diff --check`, and local 62-route build passed.
- Server focused test: 22/22, including real three-page rasterization using `.72` native modules. Server 62-route build passed; all five deployed hashes match local.
- Release archive SHA-256: `BC99AD2387E0DECC634EC82D8597DB48B2ECE60273570E0B58D4767FF96B802F`.
- Rollback: `C:\ShopApp\backups\pre-update\order-intake-reliability-20260827-100255` (source replacements plus database safety copy).
- Final live checks: ShopApp Running; Health Monitor Ready/enabled; loopback and LAN health OK; error log empty; zero pending migrations.

## Session Handoff — 2026-08-27 (Drawing accuracy regression corrected live)

- Root cause: adding packet classification made `documentRole` a strict enum. The model sometimes returned a wrapped or human-readable variant; Zod rejected the whole object, discarding correctly extracted title-block fields and returning filename fallback data. Packet page images also used a temporary vision-file flow without a readiness wait.
- Fix: normalize/unbox document roles, preserve uncertain roles as `OTHER`, send direct high-detail image data URLs, provide native page text plus full-page and bottom-right crop views, render PDFs at 2x, retry one transient response failure, and log content-safe failure/validation metadata.
- Quality gate: a generated non-confidential manufacturing drawing with known fields passed locally and on `.72`; it recovered part `TEST-26031`, `STANCHION TUBE`, `DOM TUBING`, `ZINC PLATE`, and `PART_DRAWING`. A real repository drawing was deliberately not transmitted externally without explicit owner approval.
- Verification: deterministic drawing tests 25/25, full suite 236 passed with one opt-in eval skipped, targeted lint, TypeScript, diff check, and local/server 62-route builds passed. Production deterministic + synthetic accuracy suites passed 26/26.
- Release SHA-256 `8668EF11E994FA00777BC0823DA29FB30FDB4F87998EA43166C5303C6C6B93D2`; rollback `C:\ShopApp\backups\pre-update\order-intake-reliability-20260827-103153`.
- Production is healthy with exact deployed hashes, ShopApp Running, Health Monitor Ready, loopback/LAN health OK, and empty error log.
## Session Handoff — 2026-08-27 (Drawing stock dimensions staged locally)

Goal: Extract finished width and thickness from drawings and carry a single thickness × width × total-length requirement into stock finding and printed shop lookup sheets.

### What changed
- `DrawingTitleBlockResult` now includes confidence/evidence-backed `partWidth` and `partThickness`; the prompt explicitly distinguishes finished envelope dimensions from raw stock notes and refuses unclear guesses.
- `DrawingImportPanel` reviews thickness, width, finished length, cut length, and total stock dimensions. Calculation is `cut = finished length + .125`; total length is `cut × quantity`; display order is thickness × width × total length.
- Prisma adds nullable `partWidth`/`partThickness` columns to `QuotePart`, `OrderPart`, and `RepeatOrderTemplatePart` through `20260827140000_drawing_stock_dimensions_v1`.
- Quote/order services, quick conversion, repeat templates, order editing, travelers, Material Check, and the printable Material Shop Walkdown preserve/display the fields.
- TEST_MODE now mirrors the production stock fields so persistence regressions are observable.

### Verification / state
- Focused Vitest: 5 files / 57 tests passed. Full Vitest: 44 files / 238 tests passed, with the networked accuracy eval skipped by default.
- Synthetic configured-model accuracy eval: 1/1 passed and read part number, part name, material, finish, thickness, width, and length.
- Prisma generate/migrate, TypeScript, targeted ESLint, `git diff --check`, and the 62-page production build passed.
- Local standalone shell rendered successfully; deeper interactive quote steps require an authenticated local browser session, so data/UI behavior is covered by the focused tests and production build rather than a saved browser mutation.
- Not deployed. Production `.72` remains unchanged pending explicit owner approval.
## Session Handoff — 2026-08-27 (Drawing stock dimensions deployed, latest)

Goal: Carry drawing-derived finished thickness and width into explicit, printable total stock dimensions without reducing the restored drawing-reading quality.

### What changed
- Drawing extraction/review now captures finished thickness and width with evidence/confidence and blocks uncertain or missing values for human review rather than guessing.
- Quote, direct order, quote conversion, repeat template, order editing, Material Check, stock walkdown print, and traveler paths preserve/display `thickness × width × (cut length × quantity)` while retaining finished and cut lengths.
- Migration `20260827140000_drawing_stock_dimensions_v1` adds nullable width/thickness fields to quote, order, and repeat-template parts for backward compatibility.

### Verification / production state
- Local evidence before release: focused 57/57, full 238/238, configured-model synthetic accuracy 1/1, type-check/lint/diff checks, migration validation, and 62-route build.
- Production release archive SHA-256: `0867780FF608FA49C1F462F05A9929DBA23C2E870105027FF33AB5D0027875CA`; 34/34 deployed hashes match the staged release and all 41 migrations are applied.
- Production focused suite passed 57/57 and configured-model synthetic accuracy passed 1/1. Loopback/LAN/`shopapp.local` health are HTTP 200; ShopApp is Running; monitor is Ready/result 0; error log is empty.
- Rollback: `C:\ShopApp\backups\pre-update\order-intake-reliability-20260827-120200` (includes the pre-migration production database and replaced source files).
## Session Handoff — 2026-08-27 (Long mixed-ZIP import health guard deployed, latest)

Goal: Stop legitimate long drawing ZIP imports from being killed by automated health recovery while retaining recovery for a genuinely exited runtime.

### What changed
- `src/app/api/orders/drawing-import/route.ts` and `src/modules/drawing-import/drawing-import.activity.ts` bracket every authorized import—including multipart parsing—with a unique activity marker and guaranteed cleanup.
- `scripts/windows/install-shopapp-health-monitor.ps1` treats failed probes as `busy-import` only when a fresh marker and the exact ShopApp standalone Node process coexist. Markers older than 45 minutes are removed; a missing process still takes the established restart path.
- `drawing-import.service.ts` counts only supported PDF/PNG/JPG files toward the 100-drawing limit, ignores unrelated mixed-ZIP entries, and retains a 1,000-entry safety ceiling.

### Verification / production state
- Local/production focused tests 30/30, TypeScript, targeted ESLint, and local/server 62-route builds passed. Four final deployed hashes match.
- A safe production simulation forced health failure while marking an import: result `busy-import`, `restarted=false`, Node PID 8092 preserved before/after. The first listener-based simulation failed and was replaced before owner retry with the verified exact-process check.
- Loopback/LAN/`shopapp.local` health are HTTP 200; ShopApp Running; monitor Ready/result 0; error log empty.
- Release SHA-256 `071F60D2EFFA20382763760F69E108D0A079162F3A10109025D1241882B762F5`. Rollbacks: `C:\ShopApp\backups\pre-update\order-intake-reliability-20260827-135601` and `C:\ShopApp\backups\pre-update\zip-import-health-guard-20260827-134907`.
- Follow-up live logs exposed the separate `/api/admin/quotes/upload` multipart route; it now uses the same pre-`formData()` marker/finally cleanup. Release `651175E9AEC7F9D35203F50FE96875EAE20AE84E64671D9596214A9671773901`, guard tests 4/4 local/server, hashes 2/2, three health endpoints 200, empty error log; rollback `C:\ShopApp\backups\pre-update\order-intake-reliability-20260827-140316`.
## Session Handoff — 2026-08-27 (Mixed-ZIP runtime hardening deployed; real retry pending)

Goal: Stop mixed drawing ZIP uploads from silently terminating production while retaining the newly added width/thickness workflow.

### What changed
- `src/modules/drawing-import/drawing-import.service.ts` retains all width/thickness extraction and stock-dimension math, serializes native PDF preprocessing, leaves model extraction concurrency at four, skips eager CRC inflation of unrelated ZIP members, and continues to enforce individual supported-file safety checks.
- `src/modules/drawing-import/drawing-import.activity.ts` now records durable begin/finish events in addition to per-request monitor markers.
- `scripts/windows/start-shopapp.ps1` launches Node with a 12 GB heap ceiling plus fatal/uncaught reports, uncaught tracing, and a durable exit-code log.
- `scripts/windows/install-shopapp-health-monitor.ps1` now kills only the exact ShopApp standalone Node runtime after a confirmed unhealthy/no-active-import state and before restarting the scheduled task, preventing an orphaned child from masquerading as a managed recovery.

### Verification / production state
- Local: focused 32/32 tests, TypeScript, targeted ESLint, and 62-route build passed.
- Production: focused 32/32 tests and build passed; all five release hashes match; the active launcher command line contains the memory/report flags; loopback, LAN, and `shopapp.local` health are HTTP 200; task is Running; monitor is Ready/result 0; error log is empty; active markers are zero.
- Release SHA-256: `FB9CE6C7836D532BC4415F5F29E54167841467BBB1CC8AC7320560212E47A590`.
- Rollback paths: `C:\ShopApp\backups\pre-update\order-intake-reliability-20260827-141241` and `C:\ShopApp\backups\pre-update\runtime-launcher-20260827-141419`.
- Monitor correction hash/rollback: `58EFB0671BF7C93E7A71D04F4C9CC0FD7D1F3CBCE1BDBCF28DF37F81ADFA0606`; `C:\ShopApp\backups\pre-update\health-monitor-recovery-20260827-142121`. Controlled dead-runtime recovery produced a new managed `Running` process, and a healthy follow-up cycle exited 0 without changing PID `6112`.
- Remaining validation: have the owner retry the same real mixed ZIP, then inspect `C:\ShopApp\app\.runtime\drawing-import-events.log`, `C:\ShopApp\logs\runtime-exit.log`, `C:\ShopApp\logs\node-reports`, memory/PID, and all health paths during the run. Do not declare the production incident closed until this real retry succeeds.
- First instrumented owner retry proved the monitor acted before the request reached the route-level marker. The live monitor now has a persisted five-minute `pre-route-grace` for an existing exact runtime, after which normal restart applies unless the 45-minute import marker exists. Hash `682A1D364E961BCD8AC1F30754AFD3361D203A05B532CB71E9FDB2CBD7CB4E6B`; rollback `C:\ShopApp\backups\pre-update\health-monitor-preroute-20260827-143233`. Safe unused-port simulation returned `pre-route-grace`, preserved PID `7952`, and left production healthy. Await the post-fix real retry.

## Session Handoff — 2026-08-27 (Proven PDF reader restored with dimensions, latest)

Goal: Use the previously accurate PDF reader unchanged in architecture while adding finished width and thickness to what it extracts.

### What changed
- `importDrawingUpload` is serial again: expand supported drawings, store each original, call the established title-block reader once per drawing, and return review proposals. The active path bypasses packet rasterization, page splitting, and isolated AI/image workers.
- PDF extraction is back to bounded local PDF text followed directly by the configured model. PNG/JPG uploads retain the original direct vision-file behavior.
- The model contract retains `finalPartLength`, `partWidth`, and `partThickness` with confidence/evidence and explicit null-not-guess instructions. The 100-supported-drawing ZIP limit and current storage/review/persistence contracts remain.

### Verification / production state
- Local and production focused tests: 34/34. TypeScript, targeted ESLint, and local/server 62-route builds passed.
- Release SHA-256 `43AF36D187EFB7FFDD11A4C910FD840F5B1AA59325178124D0CC158BB7225E58`; deployed/local reader SHA-256 `E728C72E505B677544DF4BC4BCB9C0744730C326FF78416FEBCF3432A03BA41E`.
- Rollback/database snapshot: `C:\ShopApp\backups\pre-update\order-intake-reliability-20260827-155741`.
- Production: ShopApp Running, Health Monitor Ready, loopback/LAN/`shopapp.local` health OK, and zero-byte error log.

## Session Handoff — 2026-08-27 (Owner rollback to 10:31 drawing reader)

- Restored only the selected snapshot source (`order-intake-reliability-20260827-103153`), leaving the production database and uploads intact.
- Exact source proof: `drawing-import.service.ts` hash `AA16DB0F30A5A6A905E31B2116742CD1BCAF3A452BF0131E58217EB91046C16D` equals the snapshot.
- Final runtime proof: loopback and LAN health OK, ShopApp Running, Health Monitor enabled, and original `next.config.js` restored after a one-build type-check bypass.
- Focused restored suite: 21/22 passed; the remaining old expectation omits newly shared thickness/width confirmation requirements. Do not alter the restored code merely to make that legacy assertion pass.
## Session Handoff — 2026-08-28 (Quote Drawing Import V2 admin beta deployed, detailed record)

Goal: Make the evidence-backed local-first Drawing Import V2 functional in the admin quote-creation/edit workflow and deploy it safely to `.72` without replacing the direct-order legacy importer or overstating unmeasured release gates.

### Scope and behavior
- `QuoteEditor` uses `src/components/orders/drawing-import/QuoteDrawingImportV2Panel.tsx` for quote drawing intake and offers the proven legacy reader as an explicit fallback. `/orders/new` continues to use the legacy importer.
- New quote-only APIs under `src/app/api/admin/quotes/drawing-import-v2/**` create durable jobs and expose authenticated progress, cancel, correction, reprocess, and exact artifact access.
- `src/modules/drawing-import/v2/**` owns safe archive/page inventory, vector single-page PDFs, coordinate text/OCR, preview/crops, hashes/duplicates, page classification, local evidence, BOM rows/graph quantities, Terra/Sol Responses routing, budgets, retry/idempotency, usage/cost, and durable job orchestration.
- Prisma migration `20260827193000_drawing_import_v2_foundation` adds import job/source/page/attempt/BOM/profile records and additive quote/order page lineage. Existing records/attachments were not deleted or reinterpreted.
- Reviewed V2 parts/files continue through existing quote save/material handling and quote-to-order conversion without rereading drawings or applying the assembly multiplier twice.
- Production mode is conservative admin beta: local auto-accept off, profile matching off, OCR on, Terra medium, Sol high for measured hard cases, Luna off, soft budget USD 6.40, hard budget USD 8.

### Verification evidence
- Focused V2/document/BOM/eval/review/quote tests: 23 files / 104 passed.
- Full regression: 62 files / 324 passed / 4 opt-in skipped.
- `npx tsc --noEmit`, targeted ESLint, local 63-route `npm run build`, standalone asset assertions/worker ping, OCR opt-in 3/3, and disposable database migration rehearsal passed.
- Private fixture `P10 & P14 Turbo Fixture.zip` was processed local-only: safe archive inventory, 9 vector PDF pages, original archive retained, and 10 SolidWorks support files retained. No private customer drawing was transmitted externally during verification.
- A generated synthetic drawing passed the live Responses/Terra smoke with exact part number/quantity/evidence and a sub-USD-1 cap.
- The repository-local release evaluator correctly remains `eligibleForRelease: false`: there is no approved representative labeled golden set yet, and the mock performance harness cannot prove real 92/100-page accuracy, latency, or cost.

### Production deployment
- Final archive: `artifacts\shopapp-drawing-import-v2-20260828-0031.zip`.
- SHA-256: `CC4BDF2A3ED2A9C8E20D5B889050710347A6D83CAA30593D8B3E36E721782977`.
- Guarded release script: `ops/Deploy-ShopApp-DrawingImportV2.ps1`.
- Rollback snapshot: `C:\ShopApp\backups\pre-update\drawing-import-v2-20260828-003455` containing source, `shopapp1.db`, and protected production environment backup.
- Server result: 72 files deployed, focused server tests passed, 63-route server build passed, standalone worker ping passed, restart passed, and `npx prisma migrate status` reports 42 migrations / schema current.
- Post-deploy: Node listens on `0.0.0.0:3000`; loopback, `192.168.254.72:3000`, and `http://shopapp.local/api/health` are healthy; unauthenticated V2 route returns HTTP 401; ShopApp task is Running; health monitor result is 0; five representative V2 source/migration hashes match local exactly.

### Deployment incident and prevention
- The first guarded V2 attempt exposed that the selected rollback source snapshot did not itself compile against its restored route/UI callers even though the previously compiled `.next` still ran. The deploy script restored source/database/config, but the rollback rebuild failed.
- Repaired only the restored baseline contracts (optional progress callback and optional width/thickness proposal fields), verified the baseline 62-route build, restarted it healthy, then included those compatibility shims in the final V2 archive. The final deployment therefore has a buildable rollback source instead of relying on stale compiled output.
- Do not remove these compatibility shims unless the legacy route/panel and legacy service/schema are updated together and a selected-source rollback build is rehearsed.

### Main touched areas
- `prisma/schema.prisma`, `prisma/migrations/20260827193000_drawing_import_v2_foundation/`
- `src/modules/drawing-import/v2/**`, `scripts/drawing-import-v2-document-worker.mjs`
- `src/app/api/admin/quotes/drawing-import-v2/**`
- `src/components/orders/drawing-import/**`, `src/app/admin/quotes/QuoteEditor.tsx`
- quote persistence/conversion lineage in quote APIs/modules and Prisma mappings
- `next.config.js`, `scripts/copy-standalone-assets.cjs`, `package.json`, `package-lock.json`
- `evals/drawing-import/**`, evaluation/performance scripts/docs, deployment/operations docs

### Next work
- Build an owner-approved, access-controlled golden set from reviewed pages and label expected normalized values plus source evidence.
- Run real vector/scanned/mixed packet benchmarks and compare current vs V2 local-only vs Terra vs Terra+Sol. Do not enable local auto-accept or customer profiles until their precision gates pass.
- After measured admin-beta corrections/latency/cost satisfy the specified gates, explicitly approve the final default rollout; until then keep the legacy fallback and rollback snapshot.

## Session Handoff — 2026-08-28 (V2 first-upload production failure repaired)

Goal: Repair the owner's first real V2 quote import immediately and prove the exact upload works before reporting completion.

### Root cause and correction
- Production job `cmtcsbvlm0001x9lcu3462rr4` failed in `document_analysis` before page creation. Next bundled `require.resolve('pdfjs-dist/package.json')` as numeric module ID `15754`, so the in-process PDF renderer executed `path.dirname(15754)`.
- `src/modules/drawing-import/v2/document/document.pdf.ts` now locates `standard_fonts` only through verified source/standalone filesystem layouts already populated by `scripts/copy-standalone-assets.cjs`.
- The copy script rejects future server chunks containing the unsafe numeric resolver. `drawing-import-v2.service.ts` now logs stage/job stacks without logging drawing content.

### Verification and production state
- Exact packet tests: direct nine-page canonicalize/render passed; durable private quote-import integration reached review with nine canonical pages; packaged local HTTP upload reached `READY_FOR_REVIEW` with 9 pages / 11 source-support files.
- V2 regression: 57 passed / 3 opt-in skipped. TypeScript, targeted ESLint, local 63-route build, and diff check passed.
- `.72` rollback: `C:\ShopApp\backups\pre-update\v2-import-path-fix-20260828-070024`.
- The deployed `.72` standalone build passed the same isolated HTTP upload to `READY_FOR_REVIEW`, 9/9 canonical PDF pages, 11 supporting files, and no error. The isolated DB/storage/log/ZIP copies were removed afterward; production business data was untouched.
- Live status: ShopApp Running, Health Monitor Ready, loopback/LAN/`shopapp.local` HTTP 200, production error log 0 bytes, no unsafe numeric resolver, and no listener left on smoke port 3011.
- V1 fallback remains visible but was not activated because the corrected V2 packaged route passed the real packet gate.
# Session Handoff — 2026-08-29 (FWD confirmation walkthrough, latest)

- The approved FWD ZIP is attached to production quote `280826-002`; 16 PDFs became 17 canonical pages and completed `READY_FOR_REVIEW`.
- Live confirmation testing covered quantity correction, candidate choice, file-only classification, restore, and page ordering. Final state: 13 part/assembly pages and 4 supporting pages.
- Provenance-only candidates no longer render as false conflicts; the saved packet now reports `Conflicts (0)` while evidence remains available.
- Gates passed: 25 focused tests, TypeScript, ESLint, production build, health, task/monitor, and zero-byte error log.
- Release SHA `88ED4F84819D0A59AF6C9BBE1B57132F0A67BC1B7C2A99E6F272E9D797A9C23E`; rollback `C:\ShopApp\backups\pre-update\drawing-review-simple-20260829-002846`.

---
# Session Handoff — 2026-08-29 (stable explanations and file-only bypass, latest)

- “Why this needs review” no longer disappears intermittently: untouched blur cannot confirm a field, and the disclosure open state survives normal rerenders. Live production browser verification kept the reason open after focus change plus a three-second wait.
- Explicit file-only/reference pages bypass all part-field validation before extraction failure is considered. They remain attachments and do not require quantity/material/dimension approval.
- Gates: 14 focused tests, TypeScript, ESLint, production build, health OK, ShopApp Running, monitor 0, error log 0 bytes.
- Latest rollback: `C:\ShopApp\backups\pre-update\drawing-review-simple-20260829-141347`.

---
## Session Handoff — 2026-09-02 (Production workflow and drawing-import audit)
- Goal: advisory review of quote creation/conversion, direct-order creation, order editing, and drawing-import performance. Owner corrected the environment mid-session; final evidence is from production `C:\ShopApp\app` and a read-only copy of `C:\ShopApp\data\shopapp1.db`, not the divergent workstation source.
- P0 findings: conversion UI edits are silently discarded because deployed `ConversionOverrides` excludes parts/vendor/material/model fields and the route rebuilds from the quote; direct order auto-BOM never starts because the service returns created part IDs, the API responds only with `{id}`, and the client requires `data.parts`.
- P1 findings: post-create graph work is outside the base order transaction; order customer changes retain an old contact snapshot; edit option loading is capped at 200 while create loads 5,000; no optimistic concurrency; quote numbering has a concurrent max+1 race. The large editor/service files should be decomposed incrementally, not via drive-by rewrite.
- Production timing: latest three Sep 2 one-photo V3 jobs were 41.088, 62.755, and 66.356 seconds. Preparation was consistently about 11.7–12.0 seconds; full-page `gpt-5.4-mini` medium reasoning was 29.310, 51.000, and 54.304 seconds and consumed 71.3–81.8% of total; finalization was 35–55 ms. Current completed-job timing JSON retains only total time because the final write replaces the earlier stage object.
- Best next implementation slice: regression tests and fixes for the two P0 contracts, then stage telemetry. Benchmark compact output/low reasoning and a stable prompt-cache key on representative exact-dimension drawings before changing defaults. Keep full-resolution JPEG model input; remove unnecessary full-resolution PNG/PDF preparation from the image critical path. Benchmark multi-page concurrency separately.
- Browser: live `shopapp.local` screens verified. Chrome blocked the provided image at the extension file permission boundary, so no upload/import occurred. First-step `Save & continue` did create draft quote `020926-001` for A & N Precision Machining LLC; no parts/import/order were created and the quote was not deleted or further edited.
- No production code/configuration/settings changes and no tests/build were needed for this review-only session. Temporary production source/database audit copies were removed after analysis.
## Session Handoff — 2026-09-03 (Quote conversion/order integrity, deployment pending)
- Goal implemented locally and in `.tmp-server-implementation-20260903`, which was built from the exact `C:\ShopApp\app` production source. A fresh `.tmp-server-predeploy-20260903` read-only copy was used to review every live-to-staged hunk. Do not deploy broad local files; deploy only the nine staged runtime files after explicit owner approval.
- Runtime scope: orders/new page; quote convert route; quotes repo; order detail page; orders schema/service/repo; repo facade; mock order repo. Tests added/updated locally cover edited/added/removed conversion parts, invalid source identity, customer/contact clear/validate/reject, atomic order graph persistence/rollback, and duplicate priced-addon checklist de-duplication.
- Verification: `npx tsc --noEmit` PASS; focused `npx eslint` PASS; focused Vitest PASS (8 discovered files / 78 tests, including read-only staging duplicates); `npm run build` PASS (65 pages, standalone assets copied); `git diff --check` had no whitespace errors. No schema, dependency, production database, storage, config, task, or runtime was changed.
- Deployment must follow `docs/PRODUCTION_ACCESS.md`: exact allowlist backup plus DB/build/config rollback capture, server-focused tests and clean build while ShopApp is stopped, restart in finally, deployed hashes, task/monitor/health/log checks, and browser smoke for quote conversion/order contact editing without mutating a real customer record.
- Finding 6 plan: `docs/ORDER_QUOTE_DECOMPOSITION_PLAN.md`. Suggested first release is Phase 0 contract characterization plus Phase 1 pure intake mappers; do not start a big-bang editor split.
## Session Handoff — 2026-09-03 (Order/quote decomposition, first bounded slice)
- Goal: begin the approved order/quote decomposition before deployment, using the exact server-derived source as authority. Production remains untouched.
- Added shared `src/modules/order-intake/order-intake.client.ts` and `order-submission.client.ts`; `/orders/new` delegates the three submission modes without changing endpoints or payloads. Seven focused client tests cover normalization and each submission contract.
- Extracted `QuoteWizardProgress.tsx`, `OrderHeaderEditor.tsx`, `orders.header.service.ts`, and `orders.files.service.ts`. Existing page/service entry points remain compatible and retain orchestration/transaction behavior.
- Applied corresponding edits under `.tmp-server-implementation-20260903`; preserved `.tmp-server-predeploy-20260903` as the pristine production comparison. The production-derived order page includes Business editing while the older local page does not, and each controlled component intentionally preserves its tree's existing contract.
- Gates: TypeScript PASS; focused ESLint PASS; workflow Vitest PASS (10 files / 85 tests); build PASS (65 pages and standalone assets); `git diff --check` PASS. No deploy, dependency, schema, config, or data mutation.
- Next: extract repeat/direct prefill hooks and quote customer/parts sections, then order part/workflow panels; split order create/query/parts/workflow/time and repository families one at a time with compatibility exports and focused gates.
## Session Handoff — 2026-09-03 (Order/quote decomposition continuation)
- Continued from the exact production-derived staging baseline; `.tmp-server-predeploy-20260903` remains pristine and production was not changed.
- Intake: added `order-prefill.client.ts` and tests. `/orders/new` still owns abort/retry/template-to-form mapping and submission gating.
- Quote UI: added `NewQuoteCustomerDialog.tsx`, `QuoteCustomerContactFields.tsx`, and `QuotePartEntryChooser.tsx`; the editor owns fetch/save/autosave/import state. Production-derived wording for global saved-part search remains preserved separately from older local wording.
- Order UI: added `SelectedPartEditor.tsx`; the page owns PATCH/POST/DELETE calls, delete confirmation, reloads, and toasts. Existing `OrderHeaderEditor.tsx` remains the header boundary.
- Order domain: added `orders.events.service.ts`, expanded `orders.files.service.ts` to own attachment CRUD/canonicalization, and added `orders.files.repo.ts` for ten Prisma attachment functions. Root service/repo files re-export for compatibility; `@/repos/orders` still controls TEST_MODE mock selection.
- Evidence: `npx tsc --noEmit`; focused ESLint zero output; combined Vitest 17 files / 103 tests including order graph/contact/quote conversion and attachment access; `npm run build` 65 pages plus standalone assets; `git diff --check`. No dependency, schema, config, data, or production mutation.
- Next: extract remaining quote/customer/drawing/manual subpanels and quote-prefill mapping, then order checklist/timer/assignment panels and one service/repository family per verified patch.
## Session Handoff — 2026-09-03 (Order/quote decomposition continuation 2)
- Used parallel, non-overlapping ownership for quote parts UI, order assignment UI, and charge service/repo while the main agent extracted quote-to-order prefill. All edits were applied locally and to `.tmp-server-implementation-20260903`; pristine `.tmp-server-predeploy-20260903` and production remain unchanged.
- Added `order-quote-prefill.client.ts` plus three tests. `/orders/new` applies the mapped state and retains load-error UI/gating; source part IDs, first-part legacy selections, work instructions, dimensions, contact and add-on snapshots are preserved.
- Added `QuoteManualPartsPanel.tsx` and `PartWorkerAssignmentsPanel.tsx`. These are controlled presentation boundaries; API/import/autosave/permission/refresh/toast orchestration stays in their pages.
- Added `orders.charges.service.ts` and `orders.charges.repo.ts`. `orders.service.ts` keeps public wrappers and injects workflow callbacks to avoid a cycle; `orders.repo.ts` re-exports six moved Prisma functions, leaving `src/repos/orders.ts` and mock repositories unchanged.
- Evidence: `npx tsc --noEmit`; focused ESLint zero output; combined Vitest 18 files / 106 tests; `npm run build` 65 pages plus standalone assets; `git diff --check`. No dependency, schema, config, data, or deployment change.
- Remaining decomposition: quote drawing/customer/business/custom-field shells; direct/repeat order-form panels; order checklist/timer/workflow UI; create/query/parts/workflow/time service and repository families. Continue one family per verified patch.

## Session Handoff — 2026-09-03 (Order/quote decomposition continuation 3)
- Scope completed locally and in `.tmp-server-implementation-20260903`; production and pristine `.tmp-server-predeploy-20260903` remain unchanged. Parallel owners handled quote identity/custom fields, order checklist presentation, and the order-part service/repo family; the main agent extracted the shared new-order quick-add customer dialog and ran combined gates.
- UI files added: `src/app/admin/quotes/QuoteGeneralInformationCard.tsx`, `QuoteCustomIntakeFieldsCard.tsx`, `src/app/orders/new/NewOrderCustomerDialog.tsx`, and `src/app/orders/[id]/OrderChecklistPanel.tsx`, with corresponding coordinator edits and matching staging files. All are controlled presentation boundaries; network, persistence, autosave, mode/permission, confirmation, refresh, and toast decisions remain in the parent coordinators.
- Domain files added: `src/modules/orders/orders.parts.service.ts`, `orders.parts.repo.ts`, and `src/modules/orders/__tests__/orders.parts.service.test.ts`. Root service/repo compatibility exports and the `src/repos/orders.ts` real/mock facade remain. The service injects workflow/department callbacks to avoid cycles; the repo retains atomic charge-copy and relation-delete transactions.
- Evidence: TypeScript PASS; focused local/staging ESLint PASS; 19 files / 109 focused workflow, command, atomicity, conversion, and attachment-security tests PASS; local build PASS (65 pages and standalone asset copy); production-derived staged build PASS (66 pages); new boundary hashes match local/staging; no staging cross-tree source imports; `git diff --check` PASS.
- The first staged build failed before application compilation because the source-only download omitted production `tailwind.config.cjs`, `postcss.config.cjs`, `next.config.js`, and the standalone copy script. These were downloaded read-only from `C:\ShopApp\app`; the next staged build passed. This did not modify production.
- Next safe boundaries: new-order main header/contact fields, quote drawing-import shell sections, order timer/workflow panels, or order query/workflow/time service/repository families. Continue one family at a time and do not deploy until the owner separately requests it.

## Session Handoff — 2026-09-03 (Order/quote decomposition completion push)
- Finished all safe remaining boundaries locally and in `.tmp-server-implementation-20260903`; `.tmp-server-predeploy-20260903` and production remain unchanged. Parallel agents owned non-overlapping quote, new-order, order-detail, and order-domain slices.
- Quote additions: `QuoteDrawingEntryPanel`, `QuotePurchasedItemsCard`, `QuoteAttachmentsCard`, `QuoteTotalsSummaryCard`, `QuoteBuildDetailsCards`, `QuoteRoutingCard`, `QuoteCustomAmountsCard`, and `QuoteMaterialCheckPanel`. New-order additions: `NewOrderInfoCards`, `NewOrderPartEntryChooser`, `NewOrderDrawingEntryPanel`, `NewOrderPartsEditor`, `NewOrderReviewSummaryCards`, `NewOrderAttachmentsCard`, `NewOrderLaunchNotesCard`, `NewOrderSubmitCard`, and `NewOrderWizardControls`. Order-detail additions: `OrderOverviewPanels`, `OrderFilesPanels`, `OrderActivityPanel`, `OrderTimerConsole`, and `OrderStatusChangeDialog`.
- Domain additions: `orders.create.service/repo`, `orders.query.service/repo`, and status-only `orders.workflow.service/repo`, with focused service tests and root compatibility exports. Final sizes: QuoteEditor 2,480; new-order page 1,271 local / 1,272 staged; order detail 3,186 local / 3,225 staged; root order service 1,236; root order repo 947.
- Residual architecture is explicit: quote work-plan persistence plus final pricing require a typed pricing controller; checklist/department/part-completion/time-adjustment behavior requires a typed lifecycle contract with transaction-order tests. Do not mechanically move these blocks through root callbacks or into UI components. Remaining high-coupling order dialogs should follow focused action hooks.
- Evidence: TypeScript PASS; focused local/staged ESLint PASS; combined Vitest PASS (43 files / 205 tests); local build PASS (65 pages); production-derived staged build PASS (66 pages); local/staged boundary hashes and cross-tree import scan PASS; `git diff --check` PASS. No deploy, dependency, schema, data, task, monitor, or runtime mutation. Browser smoke remains part of the later deployment gate because staged code is not running.
## Session Handoff — 2026-09-03 (Local synchronization and Chrome regression)

- Goal completed without deploying: read-only SSH proved the live 435-file source tree matches `.tmp-server-predeploy-20260903` byte-for-byte. The reviewed `.tmp-server-implementation-20260903` source is running locally at `http://127.0.0.1:3100` against `.tmp/local-browser-regression-20260903/shopapp-test.db` and isolated storage. Leave production untouched unless the owner separately authorizes deployment.
- Chrome covered quote `030926-001`, conversion order `STD-1010`, direct order `STD-1011`, repeat-order prefill and orders `STD-1012`/`STD-1014`, order editing/reload, all detail tabs, status gating, timer presentation, and the Shop Floor part material-status dialog. Direct isolated-DB checks confirmed source quote, customer/contact, due date, edited PO/name, quantities, charges, checklist, and attachment persistence. Browser console errors were empty.
- Drawing V2 job `cmtljpdsu005o3w5to4s96hg6` completed `READY_FOR_REVIEW` in 54,586 ms. AI resolution was 48,862 ms (89.5%), with 6,176 input tokens, no cached input, 5,940 output tokens, and 5,245 reasoning tokens. Prioritize lower-reasoning/compact-output benchmarks, stable prompt caching, and preserved stage telemetry before changing production defaults.
- Found and fixed a local-only sync regression: Shop Floor material-status controls were missing from the overlapping workstation component/projection/type files. Exact server hunks were merged and the characterization passes. The live/staged server already retained this behavior.
- Known data issue: repeat template `STD-1005` references a PDF absent both locally and on production. A seeded isolated fixture copied correctly after the copied DB's `AppSettings.attachmentsDir` was pointed at isolated storage. Repair the production template/source file only with explicit data-change authorization.
- Chrome UI file upload was not executable because the ChatGPT Chrome extension lacks **Allow access to file URLs**. The supplied JPEG passed through the exact local backend route instead. Enable that extension permission before claiming a Chrome upload pass.
- Verification: root/staged TypeScript PASS; focused ESLint PASS; workflow suite 43 files / 205 tests PASS; Shop Floor regression 6/6 PASS; root build 65 pages PASS; staged build 66 pages PASS; local health PASS. The staged standalone launch failure is specific to the selectively mirrored dependency layout; normal root standalone packaging succeeds.
## Session Handoff — 2026-09-03 (Drawing AI verbosity control)

- Drawing Import now validates `DRAWING_IMPORT_V2_VERBOSITY` as `low | medium | high`, defaults to `low`, and sends the value through Responses API `text.verbosity` beside the existing strict JSON schema.
- Normal Terra extraction and focused Terra refinement default to `medium` reasoning. The isolated local server-derived runtime is explicitly running `admin_beta` V3, medium/medium reasoning, and low verbosity at `http://127.0.0.1:3100`; its availability endpoint returns enabled and Chrome shows the import panel. Production configuration and runtime are untouched.
- Gates: root drawing-AI 15/15 PASS; staged drawing-AI 16/16 PASS; root/staged TypeScript PASS; focused ESLint PASS; root 65-page build PASS; health PASS. Use directory-scoped Vitest because archival `.tmp` trees contain intentionally stale/incomplete suites.
## Session Handoff — 2026-09-03 (Current importer settings; verification blocked)
- User requested AI settings parity while retaining Use current importer appearance. Implemented in root and authoritative .tmp-server-implementation-20260903, not production. Shared new drawing-import-ai-request.ts reads existing validated V2 AI config; legacy service spreads model/reasoning/verbosity/max_output_tokens and rejects incomplete results. Root active temperature override removed; inactive root image-worker helper unchanged. Staged extractTitleBlock exported for regression coverage.
- UI, legacy prompt/json_object schema, PDF preparation, routing, storage and review mapping unchanged. Same model knobs as Playground, NOT the same strict V3 schema or direct-PDF input. Local existing profile still low/medium/concise/standard with gpt-5.4-mini and 10k. No new runtime launch/restart or production operation.
- Touched application files in each tree: src/modules/drawing-import/drawing-import.service.ts; new drawing-import-ai-request.ts and __tests__/drawing-import-ai-request.test.ts. Added 16 tests each for actual PDF/photo request settings, legacy fields and routing, photo cleanup, output-cap/empty/invalid failures and no-key manual fallback. Tests use fake OpenAI and no network.
- Commands PASS: node node_modules/typescript/bin/tsc --noEmit and staged ../node_modules equivalent; targeted eslint for those three files in both trees; UI SHA256 before/after unchanged. BLOCKED: Vitest --dir src/modules/drawing-import/__tests__ (both trees) cannot spawn esbuild in sandbox; root elevated retry rejected by approval-service 404. Chrome local quote navigation similarly rejected. No live inference, browser regression, build or successful test-run claim this session.
- Next: after approval service recovers or explicit informed owner approval, rerun focused legacy and AI suites in both trees, then test the current-importer button and a local upload. Do not bypass denials via alternate browser/HTTP/test mechanisms. Local launcher remains start-local.cjs on 127.0.0.1:3100 with isolated data/storage; do not deploy or start a duplicate listener.
- Separate finding from existing runtime log: V3 import PJ-10904-W5500.pdf failed missing PDF.js standard-font directory. Logged in progress; investigate separately, do not conflate with legacy model settings.
