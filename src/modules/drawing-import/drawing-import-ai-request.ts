import type { Response, ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';

import { getDrawingImportAiSettings } from './v2/ai/drawing-import-ai.config';

/** Keep the current importer's review contract while sharing the configured AI profile. */
export function getCurrentDrawingImportAiOptions(
  environment: Record<string, string | undefined> = process.env,
) {
  const settings = getDrawingImportAiSettings(environment);
  return {
    model: settings.terraModel,
    reasoning: {
      effort: settings.terraReasoningEffort,
      context: 'current_turn',
      ...(settings.reasoningSummary ? { summary: settings.reasoningSummary } : {}),
      ...(settings.reasoningMode ? { mode: settings.reasoningMode } : {}),
    },
    text: { verbosity: settings.verbosity, format: { type: 'json_object' } },
    max_output_tokens: settings.maxOutputTokens,
  } satisfies Omit<ResponseCreateParamsNonStreaming, 'input'>;
}

export class DrawingImportResponseError extends Error {}

/** Never accept partial JSON from an incomplete response, even when it parses. */
export function requireDrawingImportOutput(
  response: Pick<Response, 'status' | 'output_text' | 'incomplete_details'>,
) {
  if (response.status === 'incomplete') {
    throw new DrawingImportResponseError(
      response.incomplete_details?.reason === 'max_output_tokens'
        ? 'The AI reached its output-token limit before finishing. Retry the drawing or enter the highlighted fields manually.'
        : 'The AI could not finish reading this drawing. Retry it or enter the highlighted fields manually.',
    );
  }
  if (response.status !== 'completed' || !response.output_text?.trim()) {
    throw new DrawingImportResponseError(
      'The AI returned no completed drawing result. Retry it or enter the highlighted fields manually.',
    );
  }
  return response.output_text;
}
