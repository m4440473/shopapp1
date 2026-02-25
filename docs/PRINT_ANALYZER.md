# Print Analyzer

## Purpose
The Print Analyzer is an isolated internal page for extracting structured manufacturing-print data from an uploaded image using OpenAI vision analysis.

## Route paths
- UI: `/private/print-analyzer`
- API: `POST /api/print-analyzer/analyze`

## Required environment variable
- `OPENAI_API_KEY` (server-side only; never exposed to the browser)

## How to use
1. Start the app.
2. Navigate directly to `/private/print-analyzer`.
3. Upload a print image (`PNG`, `JPG`, `WEBP`, or any `image/*` MIME type).
4. Click **Analyze**.
5. Review extracted units, tolerances, holes/radii/tapped-hole tables, warnings, and raw JSON.

## Known limitations
- Blurry, low-resolution, cropped, or skewed prints may reduce extraction quality.
- Heavily stylized title blocks and handwritten notes can be misread.
- Tap-drill recommendations use a starter common chart and may not cover uncommon thread standards.
- Confidence scores are model-estimated and should be reviewed by an engineer before production use.
