# Drawing-to-Order Import Workflow

## Goal

Let an office user create an order from one drawing or a ZIP of drawings without retyping title-block and stock information, while making uncertain values obvious and easy to correct before the order is created.

## Operator Workflow

### 1. Order details

Keep the current first step for business, customer, dates, priority, PO, vendor, machinist, and order notes. Do not ask for part details yet.

At the bottom, show two large choices:

- **Read drawings for me** — recommended; upload a PDF/image or ZIP.
- **Type parts myself** — continue to the current parts editor.

Remember the choice for this draft, but always provide a visible **Switch method** action.

### 2. Upload drawings

Use one large drop area with the instruction: **Drop drawings or a ZIP here**. Accept a single PDF/image or a ZIP containing supported drawing files. Show filenames immediately and reject unsupported/encrypted/unsafe entries individually without discarding valid files.

For a ZIP, unpack server-side with limits on entry count, total expanded size, compression ratio, nested archives, and path traversal. Ignore operating-system metadata files. Preserve the original ZIP as an order-level source attachment only if the operator chooses to keep it.

### 3. Read and organize

Show a simple progress list, one row per drawing:

- Waiting
- Reading drawing
- Part found
- Needs your help
- Could not read

Extract the drawing number/part number, part name, quantity, material, stock size, cut length, drawing revision, and confidence/evidence for every field. Run the existing BOM analyzer in the same background job, but keep its machining analysis separate from order-header extraction.

Do not block the entire import when one file fails. Successful files remain reviewable and failed files offer **Try again**, **Enter this part myself**, and **Remove**.

### 4. Review imported parts

Default to a compact card per proposed part. Each card shows:

- Part number and part name as the heading
- Quantity, material, stock size, and cut length
- The attached source drawing filename and page count
- A small drawing preview/open action
- BOM status: Ready, Still analyzing, or Needs attention

Use three confidence treatments:

- **Confirmed** — high-confidence extraction; normal display.
- **Please check** — value is present but uncertain; yellow highlight and one-click edit.
- **Missing** — no reliable value; empty required field with a plain explanation.

Never silently guess. Quantity defaults to `1` only when the UI explicitly says **Not shown on drawing — using 1**. Material matching must resolve extracted text to an existing Material record; ambiguous or missing matches require a dropdown selection. Preserve the raw extracted wording beside the selected normalized material.

Provide **Approve all clear parts** and per-card **Edit**. Do not force the operator through every field. Keep corrections inline and save the import draft automatically so the user can leave and return.

### 5. Assembly and duplicate handling

Treat a multi-page PDF as one drawing unless its title blocks clearly identify different drawing numbers. When an assembly drawing contains a parts list, show a banner: **This drawing includes a parts list. Import its listed components?** Let the user choose:

- Assembly only
- Listed components only
- Both

Do not invent separate component drawing attachments when only the assembly PDF exists. Attach that PDF to the assembly; listed component rows may reference the assembly page as their source until individual drawings are supplied.

When two files produce the same part number, do not merge automatically. Show them together and offer **Same part/revision**, **Different revisions**, or **Keep separate**. Filename and title-block disagreements must be highlighted, with title-block data preferred only after confirmation.

### 6. Final review and creation

Reuse the current review page, prefilling imported parts alongside any manually added parts. Show a short readiness summary:

- `16 parts ready`
- `2 fields need confirmation`
- `1 BOM analysis still running`

Block creation only for required order/part fields, not for BOM completion. The main button should say **Create order with 16 parts**. After creation:

- Create each `OrderPart` from the approved import row.
- Attach each drawing to its matching part as `PRINT`/`PDF`.
- Store files in the canonical order folder.
- Persist each completed BOM result to that part.
- Continue/retry unfinished BOM jobs without duplicating parts or attachments.
- Record an audit event containing the source filename and operator corrections.

The success page should offer **Open order**, with a secondary summary of any BOM analyses still running or needing attention.

## Sample ZIP Findings

`fwdfiles.zip` contains 16 PDF drawings. Filenames are drawing-number-like and extracted title blocks reliably expose drawing number, part name, material, and finish. Most files are single-page standalone part drawings. At least one (`25011-00-132-601.pdf`) is a two-page assembly drawing whose first page contains a parts list with quantities and raw stock descriptions.

Examples found:

- `25011-00-133-602` — `STANCHION TUBE` — `DOM TUBING`
- `25011-00-133-607` — `VERTICAL RAIL MOUNT` — `6061 ALUMINUM`
- `25011-00-132-601` — `BEARING MOUNT` — material shown as `SEE PARTS LIST`, with three stock descriptions and quantity `2` for each listed item

This confirms that title-block extraction can prefill most identity fields, but quantity and stock require assembly/parts-list-aware handling and visible operator confirmation.

## Recommended Technical Shape

Add a dedicated drawing-import module rather than placing parsing/business rules in the order page or API route. Use a persisted import draft with import-file and proposed-part children so uploads, extraction results, confidence/evidence, corrections, attachment mapping, and job status survive refreshes.

The current `OrderPart` contract has `partNumber`, quantity, material, stock size, cut length, and notes, but no separate part-name field. Before implementation, make an explicit product decision to add `partName` to the Orders domain (recommended) rather than burying the extracted name in notes. The current BOM analyzer also extracts machining features rather than title-block/order fields, so title-block extraction needs its own validated result contract even if both analyses share the same PDF rendering and job infrastructure.

Suggested boundaries:

- `drawing-import.repo.ts`: import draft, file, proposed-part, and job persistence only.
- `drawing-import.service.ts`: ZIP safety, file classification, extraction orchestration, material matching, duplicate/assembly rules, approval, and conversion to the Orders service contract.
- `drawing-import.schema.ts`: upload limits, extracted field contract, correction payloads, approval/finalize validation.
- Drawing import UI components: upload, progress, review cards, and final readiness summary.

Extend the analyzer through a shared drawing-processing service. Do not make the browser call the current analyzer route once per file; bulk imports need server-side orchestration, bounded concurrency, retries, idempotency, and resumable status.

## Delivery Slices

1. Single PDF/image import with title-block extraction, review, part attachment, and background BOM persistence.
2. ZIP import with safe expansion, progress, partial failure, and one-file-to-one-part mapping.
3. Assembly parts-list detection, duplicate/revision handling, and saved resumable drafts.
4. Operational polish: previews, retry dashboard, audit history, metrics, and import test fixtures based on sanitized drawings.

## Acceptance Criteria for the First Useful Release

- A user can choose a customer, upload one PDF, confirm highlighted fields, and create an order without retyping confidently extracted part data.
- The PDF is attached to the created part and its BOM analysis starts automatically.
- Missing/uncertain quantity or material cannot be mistaken for confirmed data.
- Refreshing during extraction does not lose the import draft.
- Analyzer failure does not lose the uploaded drawing or block manual correction/order creation.

## Implementation Status — 2026-07-16

The first useful release is implemented: manual-vs-drawing choice, PDF/image/ZIP upload, per-file title-block proposals, confidence-aware correction, material confirmation, dedicated part name, per-part attachments, canonical storage normalization, and automatic BOM startup after order creation. Persisted/resumable import drafts and assembly component expansion remain later delivery slices; assembly drawings are currently identified and explicitly flagged for operator review rather than being silently split.
