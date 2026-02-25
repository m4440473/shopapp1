import OpenAI from 'openai';
import { NextResponse } from 'next/server';

import { collapseWhitespace } from '@/lib/printAnalyzer/normalize';
import { printAnalyzerResultSchema } from '@/lib/printAnalyzer/schema';
import { attachTapDrills } from '@/lib/printAnalyzer/tapDrills';

export const runtime = 'nodejs';

const RAW_MODEL_TEXT_LIMIT = 10_000;

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;

  const jsonFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (jsonFence?.[1]) return jsonFence[1].trim();

  const objectSlice = trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1).trim();
  return objectSlice || trimmed;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { dataUrl?: string } | null;
  const dataUrl = body?.dataUrl;

  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Invalid request body. Expected { dataUrl: "data:image/..." }.' }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not configured on the server.' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'You are reading a manufacturing drawing/print image.',
                'Return a single JSON object with EXACTLY these top-level keys: units, holes, radii, generalTolerances, tappedHoles, warnings (include empty arrays when none).',
                'Do not include markdown fences, commentary, or extra keys.',
                'All numeric fields must be numbers (no strings).',
                'JSON contract:',
                '{',
                '  "units": "inch" | "mm" | "unknown",',
                '  "holes": [{"diameter": number, "count": number, "notes"?: string, "tolerance"?: {"plus"?: number, "minus"?: number, "fit"?: string, "note"?: string}, "confidence": number}],',
                '  "radii": [{"radius": number, "count": number, "notes"?: string, "tolerance"?: {"plus"?: number, "minus"?: number, "note"?: string}, "confidence": number}],',
                '  "generalTolerances": [{"note": string, "confidence": number}],',
                '  "tappedHoles": [{"thread": string, "count": number, "classOrFit"?: string, "calloutNotes"?: string, "confidence": number}],',
                '  "warnings": string[]',
                '}',
                'Prefer declared units; otherwise infer inch/mm cautiously.',
                'Extract holes with diameters/counts and notes like THRU, DEPTH, CSK, CBORE.',
                'Extract radii with counts and notes like TYP/ALL AROUND.',
                'Extract general tolerances from the title block and feature-specific tolerances, especially hole tolerances.',
                'Extract tapped hole callouts with thread + class/fit + depth notes.',
                'If uncertain, include a warning and lower confidence.',
              ].join('\n'),
            },
            {
              type: 'input_image',
              image_url: dataUrl,
              detail: 'auto',
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_object',
        },
      },
    });

    const rawText = response.output_text ?? '';
    const jsonText = extractJsonText(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText || '{}');
    } catch {
      return NextResponse.json(
        {
          error: 'Model output was not valid JSON.',
          rawModelText: rawText.slice(0, RAW_MODEL_TEXT_LIMIT),
          extractedJsonText: jsonText.slice(0, RAW_MODEL_TEXT_LIMIT),
        },
        { status: 502 }
      );
    }

    const validation = printAnalyzerResultSchema.safeParse(parsed);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Model output failed schema validation.',
          issues: validation.error.issues,
          rawParsed: parsed,
          rawModelText: rawText.slice(0, RAW_MODEL_TEXT_LIMIT),
        },
        { status: 502 }
      );
    }

    const enriched = attachTapDrills(validation.data);
    return NextResponse.json(enriched, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? collapseWhitespace(error.message) : 'Unexpected analysis error';
    return NextResponse.json(
      {
        error: 'Failed to analyze drawing image.',
        detail: message,
      },
      { status: 502 }
    );
  }
}
