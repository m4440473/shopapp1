import { createHash } from 'node:crypto';

import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';

import type {
  DrawingImportFieldName,
  DrawingImportRouteTier,
  DrawingImportUsage,
} from '../drawing-import-v2.types';
import { DRAWING_IMPORT_V2_PIPELINE_VERSION } from '../drawing-import-v2.types';

import type {
  DrawingImportAiRuntimeConfig,
  DrawingImportAiSettings,
  DrawingImportReasoningEffort,
} from './drawing-import-ai.config';

import {
  DRAWING_IMPORT_AI_DIMENSION_REFINEMENT_TASK,
  DRAWING_IMPORT_AI_ESCALATION_TASK,
  DRAWING_IMPORT_AI_FULL_PAGE_TASK,
  DRAWING_IMPORT_AI_INSTRUCTIONS,
  DRAWING_IMPORT_AI_PROMPT_VERSION,
  DRAWING_IMPORT_AI_TARGETED_TASK,
} from './drawing-import-ai.prompt';

import {
  calculateDrawingImportCostUsd,
  type DrawingImportAiBudgetController,
  type DrawingImportPricingCatalog,
} from './drawing-import-ai.pricing';

import {
  DrawingImportAiCompactExtraction,
  DrawingImportAiExtraction,
  type DrawingImportAiCompactExtraction as DrawingImportAiCompactExtractionType,
  type DrawingImportAiExtraction as DrawingImportAiExtractionType,
} from './drawing-import-ai.schema';

type ResponseRequest = Record<string, unknown>;

type ResponseOptions = {
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
};

export type DrawingImportResponsesPort = {
  parse: (
    body: ResponseRequest,
    options?: ResponseOptions,
  ) => Promise<unknown>;

  countInputTokens: (
    body: ResponseRequest,
    options?: ResponseOptions,
  ) => Promise<{ input_tokens: number }>;
};

export type DrawingImportAiPageContext = {
  jobId: string;
  attemptId: string;
  pageId: string;
  pageHash: string;
  profileVersion: string;
  sourceFilename: string;
  sourcePageNumber: number;
  unresolvedFields: DrawingImportFieldName[];
  coordinateAwareText: string;
  localCandidates: unknown[];
  bomCandidates: unknown[];
  knownRegionIds: string[];
  titleCropDataUrl?: string;
  titleCropId?: string;
  fullPageImageDataUrl?: string;
  canonicalPagePdf?: Buffer;
  escalationReasons?: string[];
};

export type DrawingImportAiResult = {
  extraction: DrawingImportAiExtractionType | null;
  usage: DrawingImportUsage;
  softBudgetWarning: boolean;
  errorCode:
    | 'budget_stopped'
    | 'refused'
    | 'incomplete'
    | 'invalid_output'
    | 'request_failed'
    | null;
};

type ParsedResponseShape = {
  id?: string;
  model?: string;
  service_tier?: string | null;
  status?: string;
  error?: unknown;
  incomplete_details?: unknown;
  output_parsed?: unknown;

  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
    }>;
  }>;

  usage?: {
    input_tokens?: number;

    input_tokens_details?: {
      cached_tokens?: number;
      cache_write_tokens?: number;
    };

    output_tokens?: number;

    output_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
};

type RouteSpec = {
  route: Exclude<DrawingImportRouteTier, 'local' | 'human'>;
  model: string;
  effort: DrawingImportReasoningEffort;
  task: string;
  content: Array<Record<string, unknown>>;
  compactOutput?: boolean;
};

export function createOpenAiDrawingImportResponsesPort(
  client: OpenAI,
): DrawingImportResponsesPort {
  return {
    parse: (body, options) =>
      client.responses.parse(body as never, options),

    countInputTokens: (body, options) =>
      client.responses.inputTokens.count(body as never, options),
  };
}

export function buildDrawingImportAiCacheKey(input: {
  pageHash: string;
  model: string;
  profileVersion: string;
  promptVersion?: string;
  pipelineVersion?: string;
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        pageHash: input.pageHash,
        model: input.model,
        profileVersion: input.profileVersion,
        promptVersion:
          input.promptVersion ?? DRAWING_IMPORT_AI_PROMPT_VERSION,
        pipelineVersion:
          input.pipelineVersion ?? DRAWING_IMPORT_V2_PIPELINE_VERSION,
      }),
    )
    .digest('hex');
}

export function buildDrawingImportAiIdempotencyKey(input: {
  jobId: string;
  pageId: string;
  stage: DrawingImportRouteTier;
  attemptId: string;
}) {
  return `drawing-import-${createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')}`;
}

function isRefusal(response: ParsedResponseShape) {
  return (
    response.output?.some(
      (item) =>
        item.type === 'message' &&
        item.content?.some((content) => content.type === 'refusal'),
    ) ?? false
  );
}

export function hasOnlyKnownRegionIdentities(
  extraction: DrawingImportAiExtractionType,
  knownRegionIds: readonly string[],
) {
  const known = new Set(knownRegionIds);

  const fields = [
    extraction.partNumber,
    extraction.partName,
    extraction.drawingQuantity,
    extraction.material,
    extraction.finish,
    extraction.stockSize,
    extraction.cutLength,
    extraction.finalLength,
    extraction.partWidth,
    extraction.partThickness,
    extraction.revision,
    extraction.assemblyStatus,
  ];

  return (
    fields.every(
      (field) =>
        field.sourceRegionIdentity === null ||
        known.has(field.sourceRegionIdentity),
    ) &&
    extraction.manufacturingNotes.every(
      (note) =>
        note.sourceRegionIdentity === null ||
        known.has(note.sourceRegionIdentity),
    )
  );
}

function isTransientError(error: unknown) {
  const candidate = error as {
    status?: number;
    name?: string;
    code?: string;
  } | null;

  const status = candidate?.status;

  if (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    (typeof status === 'number' && status >= 500)
  ) {
    return true;
  }

  return (
    [
      'APIConnectionError',
      'APIConnectionTimeoutError',
      'AbortError',
      'TimeoutError',
    ].includes(candidate?.name ?? '') ||
    ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(
      candidate?.code ?? '',
    )
  );
}

function boundedJson(value: unknown, limit: number) {
  const serialized = JSON.stringify(value);

  return serialized.length <= limit
    ? serialized
    : `${serialized.slice(0, limit)}…`;
}

function dynamicContext(
  context: DrawingImportAiPageContext,
  task: string,
) {
  return [
    task,

    `PAGE METADATA:
${boundedJson(
  {
    pageId: context.pageId,
    sourceFilename: context.sourceFilename,
    sourcePageNumber: context.sourcePageNumber,
    unresolvedFields: context.unresolvedFields,
    knownRegionIds: context.knownRegionIds,
  },
  8_000,
)}`,

    `COORDINATE-AWARE LOCAL TEXT:
${context.coordinateAwareText.slice(0, 16_000)}`,

    `LOCAL CANDIDATES:
${boundedJson(context.localCandidates, 10_000)}`,

    `BOM CANDIDATES:
${boundedJson(context.bomCandidates, 10_000)}`,

    context.escalationReasons?.length
      ? `ESCALATION REASONS:
${boundedJson(context.escalationReasons, 2_000)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function requestBody(
  spec: RouteSpec,
  context: DrawingImportAiPageContext,
  settings: DrawingImportAiSettings,
) {
  return {
    model: spec.model,

    reasoning: {
      effort: spec.effort,
      context: 'current_turn',
    },

    instructions: DRAWING_IMPORT_AI_INSTRUCTIONS,

    input: [
      {
        role: 'user',

        content: [
          {
            type: 'input_text',
            text: dynamicContext(context, spec.task),
          },

          ...spec.content,
        ],
      },
    ],

    text: {
      verbosity: 'low',

      format: spec.compactOutput
        ? zodTextFormat(
            DrawingImportAiCompactExtraction,
            'drawing_import_photo_compact_v1',
          )
        : zodTextFormat(
            DrawingImportAiExtraction,
            'drawing_import_page_v3',
          ),
    },

    max_output_tokens: settings.maxOutputTokens,

    prompt_cache_key: buildDrawingImportAiCacheKey({
      pageHash: context.pageHash,
      model: spec.model,
      profileVersion: context.profileVersion,
    }),

    metadata: {
      pipeline_version: DRAWING_IMPORT_V2_PIPELINE_VERSION,
      prompt_version: DRAWING_IMPORT_AI_PROMPT_VERSION,
      page_id: context.pageId,
      route: spec.route,
    },
  };
}

function compactField<T extends string | number | boolean>(
  value: T | null,
) {
  return {
    value,
    rawText: value === null ? null : String(value),
    status:
      value === null
        ? ('not_present' as const)
        : ('read' as const),
    evidenceText: value === null ? null : String(value),
    sourceRegionIdentity: null,
    warnings: [],
    diagnosticConfidence: null,
  };
}

function expandCompactExtraction(
  compact: DrawingImportAiCompactExtractionType,
): DrawingImportAiExtractionType {
  const hasPartEvidence = Object.values(compact).some(
    (value) => value !== null,
  );

  return {
    classification: hasPartEvidence
      ? 'part_drawing'
      : 'uncertain',

    classificationEvidenceText: null,

    partNumber: compactField(compact.partNumber),
    partName: compactField(compact.description),
    drawingQuantity: compactField(compact.drawingQuantity),
    material: compactField(compact.material),
    finish: compactField(compact.finish),

    stockSize: compactField<string>(null),
    cutLength: compactField<string>(null),

    finalLength: compactField(
      compact.finalLength === null
        ? null
        : String(compact.finalLength),
    ),

    partWidth: compactField(
      compact.partWidth === null
        ? null
        : String(compact.partWidth),
    ),

    partThickness: compactField(
      compact.partThickness === null
        ? null
        : String(compact.partThickness),
    ),

    revision: compactField(compact.revision),
    assemblyStatus: compactField<boolean>(null),

    manufacturingNotes: [],
    contradictions: [],
    warnings: [],
  };
}

function fullPageContent(
  context: DrawingImportAiPageContext,
) {
  if (context.fullPageImageDataUrl) {
    return [
      {
        type: 'input_image',
        image_url: context.fullPageImageDataUrl,
        detail: 'high',
      },
    ];
  }

  if (context.canonicalPagePdf?.length) {
    return [
      {
        type: 'input_file',
        filename: context.sourceFilename,
        file_data: `data:application/pdf;base64,${context.canonicalPagePdf.toString(
          'base64',
        )}`,
        detail: 'high',
      },
    ];
  }

  throw new Error(
    'Full-page extraction requires a source image or canonical page PDF.',
  );
}

function usageFromResponse(
  response: ParsedResponseShape,
  spec: RouteSpec,
  estimatedCostUsd: number,
  calculatedCostUsd: number,
  latencyMs: number,
  retryCount: number,
  status: DrawingImportUsage['status'],
): DrawingImportUsage {
  return {
    route: spec.route,
    requestedModel: spec.model,
    resolvedModel: response.model ?? null,
    reasoningEffort: spec.effort,
    serviceTier: response.service_tier ?? null,

    inputTokens:
      response.usage?.input_tokens ?? 0,

    cachedInputTokens:
      response.usage?.input_tokens_details?.cached_tokens ?? 0,

    cacheWriteTokens:
      response.usage?.input_tokens_details?.cache_write_tokens ??
      null,

    outputTokens:
      response.usage?.output_tokens ?? 0,

    reasoningTokens:
      response.usage?.output_tokens_details?.reasoning_tokens ?? 0,

    estimatedCostUsd,
    calculatedCostUsd,
    latencyMs,
    retryCount,
    status,

    responseId: response.id ?? null,
  };
}

function emptyUsage(
  spec: RouteSpec,
  estimatedCostUsd: number,
  status: DrawingImportUsage['status'],
): DrawingImportUsage {
  return {
    route: spec.route,
    requestedModel: spec.model,
    resolvedModel: null,
    reasoningEffort: spec.effort,
    serviceTier: null,

    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteTokens: null,
    outputTokens: 0,
    reasoningTokens: 0,

    estimatedCostUsd,
    calculatedCostUsd: 0,
    latencyMs: 0,
    retryCount: 0,
    status,

    responseId: null,
  };
}

export function createDrawingImportAiAdapter(dependencies: {
  responses: DrawingImportResponsesPort;
  settings: DrawingImportAiSettings;
  runtime: DrawingImportAiRuntimeConfig;
  pricing: DrawingImportPricingCatalog;
  budget: DrawingImportAiBudgetController;
  now?: () => number;
  random?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}) {
  const now = dependencies.now ?? Date.now;
  const random = dependencies.random ?? Math.random;

  const sleep =
    dependencies.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) =>
        setTimeout(resolve, milliseconds),
      ));

  async function run(
    spec: RouteSpec,
    context: DrawingImportAiPageContext,
  ): Promise<DrawingImportAiResult> {
    const body = requestBody(
      spec,
      context,
      dependencies.settings,
    );

    const options: ResponseOptions = {
      timeout: dependencies.runtime.perRequestTimeoutMs,
      maxRetries: 0,

      headers: {
        'Idempotency-Key':
          buildDrawingImportAiIdempotencyKey({
            jobId: context.jobId,
            pageId: context.pageId,
            stage: spec.route,
            attemptId: context.attemptId,
          }),
      },
    };

    let estimatedCostUsd =
      dependencies.settings.fallbackEstimatedCostPerRequestUsd;

    try {
      const tokenCount =
        await dependencies.responses.countInputTokens(
          body,
          options,
        );

      estimatedCostUsd =
        calculateDrawingImportCostUsd(
          spec.model,
          {
            inputTokens: tokenCount.input_tokens,
            cachedInputTokens: 0,
            cacheWriteTokens: 0,
            outputTokens:
              dependencies.settings.estimatedOutputTokens,
          },
          dependencies.pricing,
        ) ?? estimatedCostUsd;
    } catch {
      // Token counting is advisory.
      // The conservative historical estimate remains.
    }

    const reservation =
      dependencies.budget.reserve(estimatedCostUsd);

    if (!reservation.allowed) {
      return {
        extraction: null,

        usage: emptyUsage(
          spec,
          estimatedCostUsd,
          'budget_stopped',
        ),

        softBudgetWarning: reservation.softWarning,
        errorCode: 'budget_stopped',
      };
    }

    const startedAt = now();

    let retryCount = 0;
    let response: ParsedResponseShape;

    try {
      for (;;) {
        try {
          response =
            (await dependencies.responses.parse(
              body,
              options,
            )) as ParsedResponseShape;

          break;
        } catch (error) {
          if (
            !isTransientError(error) ||
            retryCount >= dependencies.runtime.retryLimit
          ) {
            throw error;
          }

          const delay =
            Math.min(
              5_000,
              250 * 2 ** retryCount,
            ) *
            (0.75 + random() * 0.5);

          retryCount += 1;

          await sleep(Math.round(delay));
        }
      }
    } catch (error) {
      /*
       * IMPORTANT:
       *
       * Do not throw away the OpenAI SDK error here.
       * This is especially important for image/photo imports,
       * because request validation failures otherwise collapse
       * into the useless generic "request_failed" status.
       */
      const apiError = error as {
        name?: string;
        message?: string;
        status?: number;
        code?: string;
        type?: string;
        param?: string;
        request_id?: string;
        requestID?: string;
        error?: unknown;
        headers?: unknown;
        stack?: string;
        cause?: unknown;
      };

      console.error(
        '[DrawingImportAI] OpenAI request failed',
        {
          route: spec.route,
          model: spec.model,

          jobId: context.jobId,
          pageId: context.pageId,
          sourceFilename: context.sourceFilename,
          sourcePageNumber: context.sourcePageNumber,

          hasImage:
            Boolean(context.fullPageImageDataUrl),

          imageDataLength:
            context.fullPageImageDataUrl?.length ?? 0,

          hasPdf:
            Boolean(context.canonicalPagePdf?.length),

          pdfByteLength:
            context.canonicalPagePdf?.length ?? 0,

          retryCount,

          status: apiError.status,
          code: apiError.code,
          type: apiError.type,
          param: apiError.param,

          requestId:
            apiError.request_id ??
            apiError.requestID ??
            null,

          name: apiError.name,
          message: apiError.message,
          error: apiError.error,
          cause: apiError.cause,
          stack: apiError.stack,
        },
      );

      dependencies.budget.release(
        reservation.reservationId,
      );

      const usage = emptyUsage(
        spec,
        estimatedCostUsd,
        'failed',
      );

      usage.latencyMs = Math.max(
        0,
        now() - startedAt,
      );

      usage.retryCount = retryCount;

      return {
        extraction: null,
        usage,
        softBudgetWarning:
          reservation.softWarning,
        errorCode: 'request_failed',
      };
    }

    const tokenUsage = {
      inputTokens:
        response.usage?.input_tokens ?? 0,

      cachedInputTokens:
        response.usage?.input_tokens_details
          ?.cached_tokens ?? 0,

      cacheWriteTokens:
        response.usage?.input_tokens_details
          ?.cache_write_tokens ?? 0,

      outputTokens:
        response.usage?.output_tokens ?? 0,
    };

    const calculatedCostUsd =
      calculateDrawingImportCostUsd(
        response.model ?? spec.model,
        tokenUsage,
        dependencies.pricing,
      ) ?? estimatedCostUsd;

    dependencies.budget.settle(
      reservation.reservationId,
      calculatedCostUsd,
    );

    const latencyMs = Math.max(
      0,
      now() - startedAt,
    );

    if (isRefusal(response)) {
      return {
        extraction: null,

        usage: usageFromResponse(
          response,
          spec,
          estimatedCostUsd,
          calculatedCostUsd,
          latencyMs,
          retryCount,
          'refused',
        ),

        softBudgetWarning:
          reservation.softWarning,

        errorCode: 'refused',
      };
    }

    if (
      response.status !== 'completed' ||
      response.error ||
      response.incomplete_details
    ) {
      console.error(
        '[DrawingImportAI] OpenAI response incomplete',
        {
          route: spec.route,
          model: spec.model,
          pageId: context.pageId,
          sourceFilename: context.sourceFilename,

          responseId:
            response.id ?? null,

          status:
            response.status ?? null,

          error:
            response.error ?? null,

          incompleteDetails:
            response.incomplete_details ?? null,
        },
      );

      return {
        extraction: null,

        usage: usageFromResponse(
          response,
          spec,
          estimatedCostUsd,
          calculatedCostUsd,
          latencyMs,
          retryCount,
          'unresolved',
        ),

        softBudgetWarning:
          reservation.softWarning,

        errorCode: 'incomplete',
      };
    }

    const parsedExtraction =
      spec.compactOutput
        ? DrawingImportAiCompactExtraction.safeParse(
            response.output_parsed,
          )
        : DrawingImportAiExtraction.safeParse(
            response.output_parsed,
          );

    const extraction =
      parsedExtraction.success
        ? spec.compactOutput
          ? expandCompactExtraction(
              parsedExtraction.data as DrawingImportAiCompactExtractionType,
            )
          : (parsedExtraction.data as DrawingImportAiExtractionType)
        : null;

    if (
      !extraction ||
      !hasOnlyKnownRegionIdentities(
        extraction,
        context.knownRegionIds,
      )
    ) {
      if (!parsedExtraction.success) {
        console.error(
          '[DrawingImportAI] Structured output validation failed',
          {
            route: spec.route,
            model: spec.model,
            pageId: context.pageId,
            sourceFilename:
              context.sourceFilename,
            compactOutput:
              Boolean(spec.compactOutput),
            issues:
              parsedExtraction.error.issues,
          },
        );
      } else {
        console.error(
          '[DrawingImportAI] Extraction contained unknown region identities',
          {
            route: spec.route,
            model: spec.model,
            pageId: context.pageId,
            sourceFilename:
              context.sourceFilename,
            knownRegionIds:
              context.knownRegionIds,
          },
        );
      }

      return {
        extraction: null,

        usage: usageFromResponse(
          response,
          spec,
          estimatedCostUsd,
          calculatedCostUsd,
          latencyMs,
          retryCount,
          'unresolved',
        ),

        softBudgetWarning:
          reservation.softWarning,

        errorCode: 'invalid_output',
      };
    }

    return {
      extraction,

      usage: usageFromResponse(
        response,
        spec,
        estimatedCostUsd,
        calculatedCostUsd,
        latencyMs,
        retryCount,
        'completed',
      ),

      softBudgetWarning:
        reservation.softWarning,

      errorCode: null,
    };
  }

  return {
    runTerraTargeted(
      context: DrawingImportAiPageContext,
    ) {
      if (!context.titleCropDataUrl) {
        throw new Error(
          'Targeted extraction requires a known crop.',
        );
      }

      return run(
        {
          route: 'terra_targeted',

          model:
            dependencies.settings.terraModel,

          effort:
            dependencies.settings
              .terraReasoningEffort,

          task:
            DRAWING_IMPORT_AI_TARGETED_TASK,

          content: [
            {
              type: 'input_text',

              text: `TARGET CROP REGION ID: ${
                context.titleCropId ??
                'unspecified'
              }`,
            },

            {
              type: 'input_image',
              image_url:
                context.titleCropDataUrl,
              detail: 'high',
            },
          ],
        },

        context,
      );
    },

    runTerraFullPage(
      context: DrawingImportAiPageContext,
    ) {
      return run(
        {
          route: 'terra_full_page',

          model:
            dependencies.settings.terraModel,

          effort:
            dependencies.settings
              .terraReasoningEffort,

          task:
            DRAWING_IMPORT_AI_FULL_PAGE_TASK,

          content:
            fullPageContent(context),

          compactOutput:
            Boolean(
              context.fullPageImageDataUrl,
            ),
        },

        context,
      );
    },

    runTerraDimensionRefinement(
      context: DrawingImportAiPageContext,
    ) {
      if (
        !context.escalationReasons?.length
      ) {
        throw new Error(
          'Terra dimension refinement requires explicit unresolved fields.',
        );
      }

      return run(
        {
          route: 'terra_refinement',

          model:
            dependencies.settings.terraModel,

          effort:
            dependencies.settings
              .terraRefinementReasoningEffort,

          task:
            DRAWING_IMPORT_AI_DIMENSION_REFINEMENT_TASK,

          content:
            fullPageContent(context),

          compactOutput:
            Boolean(
              context.fullPageImageDataUrl,
            ),
        },

        context,
      );
    },

    runSolEscalation(
      context: DrawingImportAiPageContext,
    ) {
      if (
        !dependencies.runtime
          .solEscalationEnabled
      ) {
        throw new Error(
          'Luna fallback is disabled.',
        );
      }

      if (
        !context.escalationReasons?.length
      ) {
        throw new Error(
          'Luna fallback requires explicit reasons.',
        );
      }

      return run(
        {
          route: 'sol_escalation',

          model:
            dependencies.settings.solModel,

          effort:
            dependencies.settings
              .solReasoningEffort,

          task:
            DRAWING_IMPORT_AI_ESCALATION_TASK,

          content:
            fullPageContent(context),

          compactOutput:
            Boolean(
              context.fullPageImageDataUrl,
            ),
        },

        context,
      );
    },
  };
}