import { describe, expect, it, vi } from 'vitest';

import type { DrawingImportV2Config } from '../../drawing-import-v2.types';
import {
  buildDrawingImportAiCacheKey,
  buildDrawingImportAiIdempotencyKey,
  createDrawingImportAiAdapter,
  type DrawingImportAiPageContext,
  type DrawingImportResponsesPort,
} from '../drawing-import-ai.adapter';
import { getDrawingImportAiSettings } from '../drawing-import-ai.config';
import {
  calculateDrawingImportCostUsd,
  DrawingImportAiBudgetController,
  type DrawingImportPricingCatalog,
} from '../drawing-import-ai.pricing';
import { decideDrawingImportSolEscalation } from '../drawing-import-ai.router';
import type { DrawingImportAiExtraction } from '../drawing-import-ai.schema';

const settings = getDrawingImportAiSettings({});
const runtime: Pick<
  DrawingImportV2Config,
  'softBudgetUsd' | 'hardBudgetUsd' | 'perRequestTimeoutMs' | 'retryLimit' | 'solEscalationEnabled'
> = {
  softBudgetUsd: 0.4,
  hardBudgetUsd: 0.5,
  perRequestTimeoutMs: 20_000,
  retryLimit: 2,
  solEscalationEnabled: true,
};
const pricing: DrawingImportPricingCatalog = {
  schemaVersion: 'drawing-import-pricing-v1',
  pricingVersion: 'test-2026-08-27',
  effectiveDate: '2026-08-27',
  models: {
    'gpt-5.4-mini': {
      inputUsdPerMillionTokens: 2,
      cachedInputUsdPerMillionTokens: 0.2,
      cacheWriteUsdPerMillionTokens: 2.5,
      outputUsdPerMillionTokens: 8,
    },
    'gpt-5.6-luna': {
      inputUsdPerMillionTokens: 4,
      cachedInputUsdPerMillionTokens: 0.4,
      cacheWriteUsdPerMillionTokens: 5,
      outputUsdPerMillionTokens: 16,
    },
  },
};

function modelField<T extends string | number | boolean>(value: T | null, status: 'read' | 'not_present' | 'unreadable' | 'conflicting' = value === null ? 'not_present' : 'read') {
  return {
    value,
    rawText: value === null ? null : String(value),
    status,
    evidenceText: value === null ? null : String(value),
    sourceRegionIdentity: value === null ? null : 'title-block',
    warnings: [],
    diagnosticConfidence: value === null ? null : 0.9,
  };
}

function extraction(overrides: Partial<DrawingImportAiExtraction> = {}): DrawingImportAiExtraction {
  return {
    classification: 'part_drawing',
    classificationEvidenceText: 'DRAWING NO',
    partNumber: modelField('P-100'),
    partName: modelField('BRACKET'),
    drawingQuantity: modelField<number>(null),
    material: modelField('6061-T6'),
    finish: modelField<string>(null),
    stockSize: modelField<string>(null),
    cutLength: modelField<string>(null),
    finalLength: modelField('12'),
    partWidth: modelField('2.5'),
    partThickness: modelField('0.25'),
    revision: modelField('A'),
    assemblyStatus: modelField(false),
    manufacturingNotes: [],
    contradictions: [],
    warnings: [],
    ...overrides,
  };
}

function completedResponse(result = extraction(), model = 'gpt-5.4-mini') {
  return {
    id: 'resp-test',
    model,
    service_tier: 'default',
    status: 'completed',
    error: null,
    incomplete_details: null,
    output: [],
    output_parsed: result,
    usage: {
      input_tokens: 1_000,
      input_tokens_details: { cached_tokens: 200, cache_write_tokens: 100 },
      output_tokens: 250,
      output_tokens_details: { reasoning_tokens: 50 },
    },
  };
}

function pageContext(overrides: Partial<DrawingImportAiPageContext> = {}): DrawingImportAiPageContext {
  return {
    jobId: 'job-1',
    attemptId: 'attempt-1',
    pageId: 'page-1',
    pageHash: 'abc123',
    profileVersion: 'none',
    sourceFilename: 'packet-page-001.pdf',
    sourcePageNumber: 1,
    unresolvedFields: ['partNumber', 'material'],
    coordinateAwareText: 'DRAWING NO P-100 MATERIAL 6061-T6',
    localCandidates: [],
    bomCandidates: [],
    knownRegionIds: ['title-block'],
    titleCropId: 'title-block',
    titleCropDataUrl: 'data:image/png;base64,AA==',
    canonicalPagePdf: Buffer.from('%PDF-1.7 one page'),
    ...overrides,
  };
}

function fakePort(response: unknown = completedResponse()): DrawingImportResponsesPort & {
  parse: ReturnType<typeof vi.fn>;
  countInputTokens: ReturnType<typeof vi.fn>;
} {
  return {
    parse: vi.fn().mockResolvedValue(response),
    countInputTokens: vi.fn().mockResolvedValue({ input_tokens: 1_200 }),
  };
}

function adapter(port: DrawingImportResponsesPort, budget = new DrawingImportAiBudgetController(0.4, 0.5), overrides = {}) {
  return createDrawingImportAiAdapter({
    responses: port,
    settings,
    runtime,
    pricing,
    budget,
    now: (() => {
      let current = 1_000;
      return () => (current += 25);
    })(),
    random: () => 0.5,
    sleep: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });
}

describe('drawing import V2 OpenAI adapter', () => {
  it('keeps summary and mode opt-in and accepts only supported settings', () => {
    expect(getDrawingImportAiSettings({})).toMatchObject({
      reasoningSummary: undefined,
      reasoningMode: undefined,
      terraReasoningEffort: 'medium',
      verbosity: 'low',
    });
    expect(getDrawingImportAiSettings({
      DRAWING_IMPORT_V2_REASONING_SUMMARY: ' CONCISE ',
      DRAWING_IMPORT_V2_REASONING_MODE: ' STANDARD ',
    })).toMatchObject({ reasoningSummary: 'concise', reasoningMode: 'standard' });
    expect(getDrawingImportAiSettings({
      DRAWING_IMPORT_V2_REASONING_SUMMARY: 'invalid',
      DRAWING_IMPORT_V2_REASONING_MODE: 'invalid',
    })).toMatchObject({ reasoningSummary: undefined, reasoningMode: undefined });
  });

  it('omits summary and mode from requests unless configured', async () => {
    const port = fakePort();
    await adapter(port).runTerraFullPage(pageContext());
    expect(port.parse.mock.calls[0][0].reasoning).toEqual({ effort: 'medium', context: 'current_turn' });
  });

  it('applies the local Playground profile to full-page and dimension refinement requests', async () => {
    const port = fakePort();
    const playgroundSettings = getDrawingImportAiSettings({
      DRAWING_IMPORT_V3_ENABLED: 'true',
      DRAWING_IMPORT_V2_TERRA_MODEL: 'gpt-5.4-mini',
      DRAWING_IMPORT_V2_TERRA_REASONING: 'low',
      DRAWING_IMPORT_V3_TERRA_REFINEMENT_REASONING: 'low',
      DRAWING_IMPORT_V2_VERBOSITY: 'medium',
      DRAWING_IMPORT_V2_REASONING_SUMMARY: 'concise',
      DRAWING_IMPORT_V2_REASONING_MODE: 'standard',
      DRAWING_IMPORT_V2_MAX_OUTPUT_TOKENS: '10000',
    });
    const configured = adapter(port, undefined, { settings: playgroundSettings });
    await configured.runTerraFullPage(pageContext());
    await configured.runTerraDimensionRefinement(pageContext({
      unresolvedFields: ['finalLength'],
      escalationReasons: ['finalLength is unresolved'],
    }));
    for (const [body] of port.parse.mock.calls) {
      expect(body).toMatchObject({
        model: 'gpt-5.4-mini',
        reasoning: { effort: 'low', context: 'current_turn', mode: 'standard', summary: 'concise' },
        text: { verbosity: 'medium', format: { type: 'json_schema', name: 'drawing_import_page_v3', strict: true } },
        max_output_tokens: 10000,
      });
      expect(body.input[0].content.at(-1).file_data).toMatch(/^data:application\/pdf;base64,/);
    }
  });

  it('defaults response verbosity to low and accepts supported overrides only', () => {
    expect(getDrawingImportAiSettings({}).verbosity).toBe('low');
    expect(getDrawingImportAiSettings({ DRAWING_IMPORT_V2_VERBOSITY: 'HIGH' }).verbosity).toBe('high');
    expect(getDrawingImportAiSettings({ DRAWING_IMPORT_V2_VERBOSITY: 'verbose' }).verbosity).toBe('low');
  });

  it('builds a strict Terra targeted request with stable prompt prefix and high-detail crop', async () => {
    const port = fakePort();
    const result = await adapter(port).runTerraTargeted(pageContext());

    expect(result.errorCode).toBeNull();
    expect(result.extraction?.partNumber.value).toBe('P-100');
    const body = port.parse.mock.calls[0][0];
    expect(body).toMatchObject({
      model: 'gpt-5.4-mini',
      reasoning: { effort: 'medium', context: 'current_turn' },
      max_output_tokens: 4_000,
      metadata: { route: 'terra_targeted' },
    });
    expect(body.instructions).toContain('Never guess');
    expect(body.instructions).toContain('outside diameter');
    expect(body.text.verbosity).toBe('low');
    expect(body.text.format).toMatchObject({ type: 'json_schema', strict: true });
    expect(body.input[0].content.at(-1)).toEqual({
      type: 'input_image',
      image_url: 'data:image/png;base64,AA==',
      detail: 'high',
    });
    expect(port.countInputTokens).toHaveBeenCalledWith(body, expect.objectContaining({ maxRetries: 0 }));
  });

  it('sends one canonical page PDF to Terra with input_file detail high', async () => {
    const port = fakePort();
    await adapter(port).runTerraFullPage(pageContext());

    const body = port.parse.mock.calls[0][0];
    expect(body.metadata.route).toBe('terra_full_page');
    expect(body.input[0].content[0].text).toContain('Resolve finalLength, partWidth, and partThickness independently');
    expect(body.input[0].content.at(-1)).toMatchObject({
      type: 'input_file',
      filename: 'packet-page-001.pdf',
      detail: 'high',
    });
    expect(body.input[0].content.at(-1).file_data).toMatch(/^data:application\/pdf;base64,/);
  });

  it('sends an original phone photo as an image instead of expanding it into a PDF request', async () => {
    const port = fakePort(completedResponse(extraction({
      partNumber: modelField('H1-040-2204'),
      partName: modelField('Big Bite Pin Retaining Collar'),
      drawingQuantity: modelField(1),
      material: modelField('4.13Ø x .5W DOM Tb'),
      finish: modelField('125'),
      finalLength: modelField('2'),
      partWidth: modelField('4.06'),
      partThickness: modelField('0.5'),
      revision: modelField<string>(null),
      manufacturingNotes: [{
        text: 'PREHEAT TO 600-700F',
        category: 'preheat_heat_treat',
        evidenceText: 'PREHEAT TO 600-700F',
        sourceRegionIdentity: null,
        warnings: [],
        diagnosticConfidence: 0.95,
      }],
    })));
    const result = await adapter(port).runTerraFullPage(pageContext({
      sourceFilename: 'phone-photo.jpg',
      fullPageImageDataUrl: 'data:image/jpeg;base64,AA==',
    }));

    const body = port.parse.mock.calls[0][0];
    expect(body.input[0].content.at(-1)).toEqual({
      type: 'input_image',
      image_url: 'data:image/jpeg;base64,AA==',
      detail: 'high',
    });
    expect(body.text.format.name).toBe('drawing_import_page_v3');
    expect(result.extraction).toMatchObject({
      partNumber: { value: 'H1-040-2204' },
      partName: { value: 'Big Bite Pin Retaining Collar' },
      finalLength: { value: '2' },
      partWidth: { value: '4.06' },
      partThickness: { value: '0.5' },
      manufacturingNotes: [{ text: 'PREHEAT TO 600-700F' }],
    });
  });

  it('uses the configured focused Terra pass for unresolved manufacturing dimensions', async () => {
    const port = fakePort();
    const result = await adapter(port).runTerraDimensionRefinement(pageContext({
      unresolvedFields: ['finalLength'],
      escalationReasons: ['manufacturing_dimensions_unresolved:finalLength'],
    }));

    expect(result.usage.route).toBe('terra_refinement');
    const body = port.parse.mock.calls[0][0];
    expect(body).toMatchObject({
      model: 'gpt-5.4-mini',
      reasoning: { effort: 'medium', context: 'current_turn' },
      metadata: { route: 'terra_refinement' },
    });
    expect(body.input[0].content[0].text).toContain('physical part outline from end face to end face');
    expect(body.input[0].content.at(-1)).toMatchObject({ type: 'input_file', detail: 'high' });
  });

  it('uses Luna high only when escalation is enabled and explicit reasons are present', async () => {
    const port = fakePort(completedResponse(extraction(), 'gpt-5.6-luna'));
    const result = await adapter(port).runSolEscalation(pageContext({ escalationReasons: ['partNumber:conflicting'] }));

    expect(result.usage.route).toBe('sol_escalation');
    expect(port.parse.mock.calls[0][0]).toMatchObject({
      model: 'gpt-5.6-luna',
      reasoning: { effort: 'high', context: 'current_turn' },
    });
    expect(() => adapter(port).runSolEscalation(pageContext({ escalationReasons: [] }))).toThrow('explicit reasons');
  });

  it('retries transient failures with one stable idempotency key and records retry count', async () => {
    const port = fakePort();
    port.parse.mockRejectedValueOnce(Object.assign(new Error('rate limit'), { status: 429 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await adapter(port, undefined, { sleep }).runTerraTargeted(pageContext());

    expect(result.usage.retryCount).toBe(1);
    expect(port.parse).toHaveBeenCalledTimes(2);
    expect(port.parse.mock.calls[0][1].headers['Idempotency-Key']).toBe(port.parse.mock.calls[1][1].headers['Idempotency-Key']);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it('does not retry permanent errors and never returns sensitive error content', async () => {
    const port = fakePort();
    port.parse.mockRejectedValue(Object.assign(new Error('secret drawing content'), { status: 400 }));
    const result = await adapter(port).runTerraTargeted(pageContext());

    expect(port.parse).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ extraction: null, errorCode: 'request_failed' });
    expect(JSON.stringify(result)).not.toContain('secret drawing content');
  });

  it.each([
    [{ ...completedResponse(), output: [{ type: 'message', content: [{ type: 'refusal' }] }] }, 'refused', 'refused'],
    [{ ...completedResponse(), status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }, 'incomplete', 'unresolved'],
    [{ ...completedResponse(), output_parsed: null }, 'invalid_output', 'unresolved'],
  ])('keeps refusal, incomplete, and null parsed output unresolved', async (response, errorCode, usageStatus) => {
    const result = await adapter(fakePort(response)).runTerraTargeted(pageContext());
    expect(result).toMatchObject({ extraction: null, errorCode, usage: { status: usageStatus } });
  });

  it('rejects a model-invented source region instead of treating it as evidence', async () => {
    const invented = extraction({
      partNumber: { ...modelField('P-100'), sourceRegionIdentity: 'invented-box' },
    });
    const result = await adapter(fakePort(completedResponse(invented))).runTerraTargeted(pageContext());

    expect(result).toMatchObject({ extraction: null, errorCode: 'invalid_output', usage: { status: 'unresolved' } });
  });

  it('falls back when token counting fails and stops before a request at the hard budget', async () => {
    const port = fakePort();
    port.countInputTokens.mockRejectedValue(new Error('count unavailable'));
    const budget = new DrawingImportAiBudgetController(0.04, 0.05);
    const result = await adapter(port, budget).runTerraTargeted(pageContext());

    expect(result).toMatchObject({ errorCode: 'budget_stopped', usage: { status: 'budget_stopped', estimatedCostUsd: 0.08 } });
    expect(port.parse).not.toHaveBeenCalled();
  });

  it('normalizes usage and calculates cost without double-counting reasoning tokens', async () => {
    const port = fakePort();
    const result = await adapter(port).runTerraTargeted(pageContext());

    expect(result.usage).toMatchObject({
      requestedModel: 'gpt-5.4-mini',
      resolvedModel: 'gpt-5.4-mini',
      serviceTier: 'default',
      inputTokens: 1_000,
      cachedInputTokens: 200,
      cacheWriteTokens: 100,
      outputTokens: 250,
      reasoningTokens: 50,
      retryCount: 0,
      status: 'completed',
    });
    expect(result.usage.calculatedCostUsd).toBe(calculateDrawingImportCostUsd('gpt-5.4-mini', {
      inputTokens: 1_000,
      cachedInputTokens: 200,
      cacheWriteTokens: 100,
      outputTokens: 250,
    }, pricing));
  });

  it('builds stable versioned cache keys and attempt-scoped idempotency keys', () => {
    const cacheInput = { pageHash: 'hash', model: 'gpt-5.4-mini', profileVersion: 'profile-2' };
    expect(buildDrawingImportAiCacheKey(cacheInput)).toBe(buildDrawingImportAiCacheKey(cacheInput));
    expect(buildDrawingImportAiCacheKey(cacheInput)).not.toBe(buildDrawingImportAiCacheKey({ ...cacheInput, profileVersion: 'profile-3' }));
    const idempotencyInput = { jobId: 'job', pageId: 'page', stage: 'terra_targeted' as const, attemptId: 'attempt-1' };
    expect(buildDrawingImportAiIdempotencyKey(idempotencyInput)).toBe(buildDrawingImportAiIdempotencyKey(idempotencyInput));
    expect(buildDrawingImportAiIdempotencyKey(idempotencyInput)).not.toBe(buildDrawingImportAiIdempotencyKey({ ...idempotencyInput, attemptId: 'attempt-2' }));
  });
});

describe('drawing import V2 Luna escalation policy', () => {
  it('escalates only explicit hard cases and leaves ordinary missing fields with Terra/human review', () => {
    expect(decideDrawingImportSolEscalation({
      terraResult: extraction({ partName: modelField<string>(null, 'not_present') }),
      solEscalationEnabled: true,
      contradictsStrongLocalEvidence: false,
      ambiguousBomMatches: false,
      poorOrUnusualPage: false,
    })).toEqual({ escalate: false, reasons: [] });

    expect(decideDrawingImportSolEscalation({
      terraResult: extraction({ partNumber: modelField<string>(null, 'conflicting') }),
      solEscalationEnabled: true,
      contradictsStrongLocalEvidence: true,
      ambiguousBomMatches: false,
      poorOrUnusualPage: false,
    })).toEqual({
      escalate: true,
      reasons: ['partNumber:conflicting', 'strong_local_evidence_contradiction'],
    });

    expect(decideDrawingImportSolEscalation({
      terraResult: extraction({
        finalLength: modelField<string>(null, 'not_present'),
        partWidth: modelField<string>(null, 'not_present'),
        partThickness: modelField<string>(null, 'not_present'),
      }),
      solEscalationEnabled: true,
      contradictsStrongLocalEvidence: false,
      ambiguousBomMatches: false,
      poorOrUnusualPage: false,
    })).toEqual({ escalate: false, reasons: [] });
  });
});
