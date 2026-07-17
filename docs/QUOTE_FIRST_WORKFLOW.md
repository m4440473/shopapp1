# Quote-First Workflow

## Decision

A quote is the admin-only pre-production job package. An order is the production copy created after the customer approves the quote.

They intentionally remain separate records:

- Quotes contain customer-facing prices, estimating status, approval evidence, and resumable preparation checkpoints.
- Orders contain production status, departments, assignments, timers, checklists, and due-date execution.
- Quotes never appear in the Orders dashboard or production feeds.
- Conversion copies the complete non-pricing manufacturing package. It does not copy customer sale-price fields onto the order.

This avoids creating hidden or special-case Orders while still making quote-to-order conversion lossless.

## Operator Workflow

The quote editor uses five large, numbered checkpoints. Selecting **Save & continue** persists the entire draft before moving forward. **Save progress** is always available, and reopening a draft returns to the last saved checkpoint.

1. **Customer**
   - Choose an existing customer or add one.
   - Confirm business, contact, and basic requirements.
   - The first save creates the quote number, making printed sheets and stored files traceable immediately.
2. **Drawings & parts**
   - Choose **Read drawings for me** or **Type parts myself**.
   - Upload one drawing or a ZIP.
   - Review only neon-orange fields that need confirmation.
   - A detail drawing becomes a part drawing; an assembly drawing can be removed from the part list while remaining attached to the quote.
3. **Material check**
   - Review the on-screen material list before printing.
   - Add a short note beside each part name/number.
   - Print a shop walkdown sheet with large checkboxes and writing space.
   - After returning, mark each part **In stock**, **Need to order**, or **Not required**.
   - For in-stock material, record where it was found. For ordered material, select the vendor and add any purchasing note.
4. **Work details**
   - Assign operations, add-ons, labor units, part notes, and any supporting files.
   - Existing BOM/print analysis results are reused; they are not run again just because the draft was reopened.
5. **Pricing & finish**
   - Enter part/lot pricing, purchased-item cost and markup, and one-off amounts.
   - Review the customer-facing total.
   - Save the completed draft, then use the existing approval controls to send/approve/convert it.

## Persistent Checkpoints

- `Quote.workflowStep` stores the last saved editor checkpoint.
- `Quote.updatedAt` is the authoritative “saved at” time shown to the admin.
- Checkpoint navigation never relies on browser local storage as the source of truth.
- The quote is created after checkpoint 1, once a customer/company is known. Subsequent **Save & continue** actions update that same quote.
- A draft can be safely closed after any successful save and reopened from the Quotes list.
- Material-check completion requires every real part to have a decision; **Need to order** also requires a vendor.

## Manufacturing Package

Each quote part owns:

- part number and dedicated part name;
- quantity and piece count;
- matched material plus the exact material wording read from the drawing;
- stock size, cut length, and finish;
- part notes and work instructions;
- material decision (`UNREVIEWED`, `IN_STOCK`, `NEED_TO_ORDER`, `NOT_REQUIRED`);
- shop location, material/purchasing notes, and selected vendor;
- its own drawing attachments;
- selected operations/add-ons and their estimating inputs.

Assembly/overview drawings remain quote-level attachments. They are copied to order-level attachments during conversion.

## Printed Material Walkdown

The printout contains no pricing. It includes:

- business, quote number, customer, printed date, and preparer;
- one stable row/card per quote part;
- part number, part name, quantity, material, drawing wording, stock size, cut length, finish, and admin note;
- large handwritten checkboxes for **In stock**, **Need to order**, and **Not required**;
- blank lines for shop location, vendor, and additional notes.

The on-screen version mirrors the print order so handwritten findings are easy to enter later.

## Quote-to-Order Carryover

Conversion maps data as follows:

| Quote source | Order destination |
| --- | --- |
| customer, business | order customer, business |
| part number/name/quantity | order part number/name/quantity |
| material match and exact drawing wording | order part material fields |
| stock size, cut length, finish | order part manufacturing fields |
| part notes/work instructions | order part notes/work instructions |
| in-stock/order/not-required decision | order part material status |
| shop location, vendor, purchasing note | order part procurement fields |
| quote-part drawings | corresponding order-part attachments |
| assembly/overview files | order attachments |
| operations and checklist selections | order charges/checklist work definitions |
| quote custom fields that have active order equivalents | order custom-field values |

Customer sale price, part quote price, markup, and quote total remain on the quote. Operational work definitions can create zero/internal order charges where the current production workflow requires them, but the customer price snapshot is not copied into part/order display fields.

The quote metadata retains conversion time and order identity for audit and prevents duplicate conversion.

## Analysis Cost Controls

Use a local-first, API-fallback pipeline:

1. Hash each drawing and cache its analysis with an analyzer version.
2. Extract embedded PDF text locally first.
3. Use deterministic title-block/material alias rules when the result is sufficiently confident.
4. Make one structured model request only for missing or uncertain fields, instead of separate title-block and BOM requests.
5. Defer expensive machining-feature analysis until the estimate checkpoint or an explicit admin action.
6. Reuse cached results when reopening a quote and when converting it to an order.
7. Record request usage so real cost per quote can be measured before considering a local OCR/vision dependency.

Local OCR/vision remains a later option, not the first choice: CAD title blocks vary widely, and maintaining a lower-accuracy local vision stack can cost more operator time than selective API fallback. Embedded-text extraction, rules, caching, and fewer model passes provide the largest immediate savings without reducing reliability.

### Implemented in this slice

- The BOM analyzer now requires an authenticated user, closing the unauthenticated cost-exposure path.
- The BOM analyzer no longer makes one full-image call plus four unconditional corner calls. It uses the full-image result when tolerances are confident and makes one lower-right title-block fallback call only when needed.
- Quote drawing analysis is not rerun merely because the quote is reopened or converted.
- Part drawings and exact extracted drawing wording persist through quote-to-order conversion.

### Next measured optimization

Content-hash caching, analyzer-version keys, positioned local PDF parsing, and token/cost telemetry remain the next analyzer slice. They should be implemented before adding local OCR or changing models. The current title importer still makes one `gpt-4.1-mini` request per drawing when an API key is configured.

As of 2026-07-16, the official GPT-4.1 mini page lists $0.40 per million input tokens, $0.10 per million cached input tokens, and $1.60 per million output tokens. OpenAI's vision guide documents the GPT-4.1 mini high-detail patch budget, and its cost guide recommends reducing request count and tokens before moving to a larger local stack:

- https://developers.openai.com/api/docs/models/gpt-4.1-mini
- https://developers.openai.com/api/docs/guides/images-vision
- https://developers.openai.com/api/docs/guides/cost-optimization

That pricing indicates the normal drawing flow should be measured in cents for a typical quote rather than dollars, but the app should record real response usage before displaying or promising a per-quote cost.

## Permissions and Visibility

- Quote pages and quote APIs require admin access.
- Quote pricing is never returned through non-admin surfaces.
- Quotes remain absent from order list/dashboard queries because they are not Order records.
- Drawing previews and material-check print pages use the same admin guard.

## Future-Proofing

- Keep material walkdown separate from the machining-feature BOM analyzer; they answer different questions.
- Preserve stable quote-part ordering for printed sheets and conversion.
- Store exact drawing wording alongside normalized material IDs so better matching rules never erase source evidence.
- Never rerun analysis on conversion. The order inherits files/results from the approved quote package.
- If a converted order must be changed materially, update the order and log the change; do not silently rewrite the approved quote snapshot.
