# Print Analyzer

## Purpose
The Print Analyzer is an isolated internal page for extracting structured manufacturing-print data from an uploaded image or PDF using OpenAI vision analysis.

## Route paths
- UI: `/private/print-analyzer`
- API: `POST /api/print-analyzer/analyze`

## Required environment variable
- `OPENAI_API_KEY` (server-side only; never exposed to the browser)

## How it works (two-pass vision)
1. **Pass 1 (full image, high detail)** analyzes the full drawing for:
   - units
   - holes and radii (+ tolerances)
   - tapped holes
   - setup estimation evidence (`setup.normals`, `setup.reasoning`, `setup.assumptions`)
2. **Pass 2 (title-block crop, high detail)** uses a zoomed crop dedicated to small text extraction:
   - crop heuristic: bottom-left title-block region
     - `left = 0`
     - `top = floor(height * 0.55)`
     - `width = floor(width * 0.55)`
     - `height = floor(height * 0.45)`
   - crop is upscaled (2x / minimum width ~1600) and re-analyzed for **only** `generalTolerances` + `warnings`.
3. **Merge behavior**:
   - Pass 2 general tolerances are preferred when confidence is decent (thresholded) and are combined with non-duplicate pass-1 notes.
   - Warnings from both passes are concatenated uniquely.

## Setup / flips estimation logic
- Default machine assumption is **3-axis**.
- The model lists unique machining normals/planes implied by the print.
- `setup.estimatedSetups` is interpreted as required setups under 3-axis assumptions.
- Server computes `setup.estimatedFlips = max(0, estimatedSetups - 1)` deterministically.
- If 4-axis could reduce setups, the model may mention it in assumptions, but does not assume 4-axis by default.

## How to use
1. Start the app.
2. Navigate directly to `/private/print-analyzer`.
3. Upload a print image (`PNG`, `JPG`, `WEBP`, or any `image/*` MIME type) or a `PDF`.
4. Click **Analyze**.
5. Review extracted units, tolerances, setup/flips analysis, holes/radii/tapped-hole tables, warnings, and raw JSON.

## PDF behavior
- PDFs are rasterized server-side before analysis.
- Current behavior uses the first page only.
- Very large or low-resolution PDFs may still produce weak OCR results after rasterization.

## Known limitations
- Blurry, low-resolution, skewed, or partially cropped prints reduce extraction quality.
- Title blocks outside the heuristic crop region may still be partially missed.
- Ambiguous side views can under/over-estimate setup normals and setup count.
- Heavily stylized title blocks and handwritten notes can be misread.
- Tap-drill recommendations use a starter common chart and may not cover uncommon thread standards.
- Confidence scores are model-estimated and should be reviewed by an engineer before production use.


## Integration note
- BOM tab integrated into Order Part detail (`/orders/[id]` → Part tabs → `BOM`) using existing `POST /api/print-analyzer/analyze`.
