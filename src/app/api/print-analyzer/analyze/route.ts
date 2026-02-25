import OpenAI from 'openai';
import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { collapseWhitespace } from '@/lib/printAnalyzer/normalize';
import {
  printAnalyzerResultSchema,
  titleBlockTolerancePassSchema,
  type PrintAnalyzerResult,
  type TitleBlockTolerancePassResult,
} from '@/lib/printAnalyzer/schema';
import { attachTapDrills } from '@/lib/printAnalyzer/tapDrills';

export const runtime = 'nodejs';

const RAW_MODEL_TEXT_LIMIT = 10_000;
const TITLE_BLOCK_CONFIDENCE_THRESHOLD = 0.55;
const PASS_ONE_MODEL = 'gpt-4.1-mini';
const PASS_TWO_MODEL = 'gpt-4.1-mini';

type ModelPayload = {
  rawText: string;
  jsonText: string;
  parsed: unknown;
};

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;

  const jsonFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (jsonFence?.[1]) return jsonFence[1].trim();

  const objectSlice = trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1).trim();
  return objectSlice || trimmed;
}

function decodeImageDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image data URL payload.');
  }

  const [, mimeType, base64Data] = match;
  return {
    mimeType,
    buffer: Buffer.from(base64Data, 'base64'),
  };
}

function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function uniqueWarnings(...warningSets: string[][]): string[] {
  const seen = new Map<string, string>();
  for (const warningSet of warningSets) {
    for (const warning of warningSet) {
      const trimmed = warning.trim();
      const key = trimmed.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.set(key, trimmed);
    }
  }
  return [...seen.values()];
}

function mergeGeneralTolerances(
  passOne: PrintAnalyzerResult['generalTolerances'],
  passTwo: TitleBlockTolerancePassResult['generalTolerances']
): PrintAnalyzerResult['generalTolerances'] {
  if (!passTwo.length) return passOne;

  const avgConfidence = passTwo.reduce((sum, item) => sum + item.confidence, 0) / passTwo.length;
  if (avgConfidence < TITLE_BLOCK_CONFIDENCE_THRESHOLD) return passOne;

  const normalizedPassTwoNotes = new Set(passTwo.map((item) => item.note.trim().toLowerCase()));
  const extrasFromPassOne = passOne.filter((item) => !normalizedPassTwoNotes.has(item.note.trim().toLowerCase()));

  return [...passTwo, ...extrasFromPassOne];
}

function computeEstimatedFlips(result: PrintAnalyzerResult): PrintAnalyzerResult {
  const estimatedSetups = Math.max(1, Math.trunc(result.setup.estimatedSetups));
  const estimatedFlips = Math.max(0, estimatedSetups - 1);

  return {
    ...result,
    setup: {
      ...result.setup,
      estimatedSetups,
      estimatedFlips,
      assumedMachine: result.setup.assumedMachine ?? '3-axis',
    },
  };
}

async function cropTitleBlock(imageBuffer: Buffer): Promise<string> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height || width < 2 || height < 2) {
    throw new Error('Unable to determine image dimensions for title block crop.');
  }

  const cropLeft = 0;
  const cropTop = Math.max(0, Math.floor(height * 0.55));
  const cropWidth = Math.max(1, Math.min(width - cropLeft, Math.floor(width * 0.55)));
  const cropHeight = Math.max(1, Math.min(height - cropTop, Math.floor(height * 0.45)));

  const zoomedCrop = await image
    .extract({
      left: cropLeft,
      top: cropTop,
      width: cropWidth,
      height: cropHeight,
    })
    .resize({
      width: Math.max(1600, cropWidth * 2),
      withoutEnlargement: false,
      fit: 'inside',
    })
    .png()
    .toBuffer();

  return toDataUrl(zoomedCrop, 'image/png');
}

async function runVisionPass({
  openai,
  model,
  prompt,
  imageDataUrl,
}: {
  openai: OpenAI;
  model: string;
  prompt: string;
  imageDataUrl: string;
}): Promise<ModelPayload | NextResponse> {
  const response = await openai.responses.create({
    model,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: prompt,
          },
          {
            type: 'input_image',
            image_url: imageDataUrl,
            detail: 'high',
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

  try {
    const parsed = JSON.parse(jsonText || '{}');
    return { rawText, jsonText, parsed };
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
}

function passOnePrompt(): string {
  return [
    'You are reading a manufacturing drawing/print image.',
    'Return a single JSON object with EXACTLY these top-level keys: units, holes, radii, generalTolerances, tappedHoles, setup, warnings (include empty arrays when none).',
    'Do not include markdown fences, commentary, or extra keys.',
    'All numeric fields must be numbers (no strings).',
    'JSON contract:',
    '{',
    '  "units": "inch" | "mm" | "unknown",',
    '  "holes": [{"diameter": number, "count": number, "notes"?: string, "tolerance"?: {"plus"?: number, "minus"?: number, "fit"?: string, "note"?: string}, "confidence": number}],',
    '  "radii": [{"radius": number, "count": number, "notes"?: string, "tolerance"?: {"plus"?: number, "minus"?: number, "note"?: string}, "confidence": number}],',
    '  "generalTolerances": [{"note": string, "confidence": number}],',
    '  "tappedHoles": [{"thread": string, "count": number, "classOrFit"?: string, "calloutNotes"?: string, "confidence": number}],',
    '  "setup": {',
    '     "estimatedSetups": number,',
    '     "estimatedFlips": number,',
    '     "assumedMachine": "3-axis" | "4-axis",',
    '     "normals": [{"label": string, "angleDegFromPrimary"?: number, "evidence": string}],',
    '     "reasoning": string[],',
    '     "assumptions": string[]',
    '  },',
    '  "warnings": string[]',
    '}',
    'Prefer declared units; otherwise infer inch/mm cautiously.',
    'Extract holes with diameters/counts and notes like THRU, DEPTH, CSK, CBORE.',
    'Extract radii with counts and notes like TYP/ALL AROUND.',
    'Extract tapped hole callouts with thread + class/fit + depth notes.',
    'Identify unique machining orientations for a 3-axis mill.',
    'List all unique planes/feature normals implied by the drawing (for example primary face and angled face at 20 degrees).',
    'Estimate setups as the number of unique machining normals for a 3-axis mill.',
    'If 4-axis would reduce setups, mention it in assumptions but do not assume 4-axis by default.',
    'Be conservative: if ambiguous, add a warning and lower confidence.',
  ].join('\n');
}

function passTwoPrompt(): string {
  return [
    'You are reading a zoomed title-block crop from a manufacturing print.',
    'Extract ONLY title-block/general tolerances and general notes relevant to dimensions/angles/hole patterns.',
    'Return JSON with EXACTLY these keys and NOTHING else: generalTolerances, warnings.',
    'Do not include markdown fences or commentary.',
    'Use this schema exactly:',
    '{',
    '  "generalTolerances": [{"note": string, "confidence": number}],',
    '  "warnings": string[]',
    '}',
    'If tolerance text is unreadable, include warning(s) and keep confidence low.',
  ].join('\n');
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
    const { buffer: imageBuffer, mimeType } = decodeImageDataUrl(dataUrl);
    const sanitizedFullImageDataUrl = toDataUrl(imageBuffer, mimeType);

    const passOneResult = await runVisionPass({
      openai,
      model: PASS_ONE_MODEL,
      prompt: passOnePrompt(),
      imageDataUrl: sanitizedFullImageDataUrl,
    });

    if (passOneResult instanceof NextResponse) {
      return passOneResult;
    }

    const passOneValidation = printAnalyzerResultSchema.safeParse(passOneResult.parsed);
    if (!passOneValidation.success) {
      return NextResponse.json(
        {
          error: 'Model output failed schema validation.',
          pass: 'pass1-full-image',
          validation: {
            error: {
              issues: passOneValidation.error.issues,
            },
          },
          rawParsed: passOneResult.parsed,
          rawModelText: passOneResult.rawText.slice(0, RAW_MODEL_TEXT_LIMIT),
        },
        { status: 502 }
      );
    }

    const titleBlockDataUrl = await cropTitleBlock(imageBuffer);
    const passTwoResult = await runVisionPass({
      openai,
      model: PASS_TWO_MODEL,
      prompt: passTwoPrompt(),
      imageDataUrl: titleBlockDataUrl,
    });

    if (passTwoResult instanceof NextResponse) {
      return passTwoResult;
    }

    const passTwoValidation = titleBlockTolerancePassSchema.safeParse(passTwoResult.parsed);
    if (!passTwoValidation.success) {
      return NextResponse.json(
        {
          error: 'Model output failed schema validation.',
          pass: 'pass2-title-block',
          validation: {
            error: {
              issues: passTwoValidation.error.issues,
            },
          },
          rawParsed: passTwoResult.parsed,
          rawModelText: passTwoResult.rawText.slice(0, RAW_MODEL_TEXT_LIMIT),
        },
        { status: 502 }
      );
    }

    const passOneData = passOneValidation.data;
    const passTwoData = passTwoValidation.data;

    const merged: PrintAnalyzerResult = {
      ...passOneData,
      generalTolerances: mergeGeneralTolerances(passOneData.generalTolerances, passTwoData.generalTolerances),
      warnings: uniqueWarnings(passOneData.warnings, passTwoData.warnings),
    };

    const withFlips = computeEstimatedFlips(merged);
    const enriched = attachTapDrills(withFlips);

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
