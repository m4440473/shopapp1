import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  create: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class {
    responses = { create: api.create };
    files = { create: api.upload, delete: api.remove };
  },
  toFile: vi.fn(async (buffer: Buffer, name: string) => ({ buffer, name })),
}));

import { getCurrentDrawingImportAiOptions, requireDrawingImportOutput } from '../drawing-import-ai-request';
import { extractTitleBlock } from '../drawing-import.service';

const profile = {
  DRAWING_IMPORT_V3_ENABLED: 'true',
  DRAWING_IMPORT_V2_TERRA_MODEL: 'gpt-5.4-mini',
  DRAWING_IMPORT_V2_TERRA_REASONING: 'low',
  DRAWING_IMPORT_V2_VERBOSITY: 'medium',
  DRAWING_IMPORT_V2_REASONING_MODE: 'standard',
  DRAWING_IMPORT_V2_REASONING_SUMMARY: 'concise',
  DRAWING_IMPORT_V2_MAX_OUTPUT_TOKENS: '10000',
};
const field = (value: string | null) => ({ value, confidence: value === null ? 0 : 0.95, evidence: value });
const drawing = {
  partNumber: field('25011-00-133-602'),
  partName: field('STANCHION TUBE'),
  quantity: { value: null, confidence: 0, evidence: null },
  material: field('DOM TUBING'),
  finish: field('ZINC PLATE'),
  stockSize: field(null),
  cutLength: field(null),
  finalPartLength: field('48.00'),
  partWidth: field('2.00'),
  partThickness: field('0.375'),
  revision: field(null),
  documentRole: 'PART_DRAWING',
  isAssembly: false,
  warnings: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('OPENAI_API_KEY', 'test-key-not-real');
  for (const [key, value] of Object.entries(profile)) vi.stubEnv(key, value);
  api.create.mockResolvedValue({ status: 'completed', output_text: JSON.stringify(drawing) });
  api.upload.mockResolvedValue({ id: 'file-test' });
  api.remove.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('current importer AI profile', () => {
  it('shares the approved Playground settings without changing the legacy JSON contract', () => {
    expect(getCurrentDrawingImportAiOptions(profile)).toEqual({
      model: 'gpt-5.4-mini',
      reasoning: { effort: 'low', context: 'current_turn', summary: 'concise', mode: 'standard' },
      text: { verbosity: 'medium', format: { type: 'json_object' } },
      max_output_tokens: 10000,
    });
    expect(getCurrentDrawingImportAiOptions(profile)).not.toHaveProperty('temperature');
  });

  it('uses validated shared defaults and allows later model/profile updates', () => {
    const defaults = getCurrentDrawingImportAiOptions({});
    expect(defaults.reasoning.effort).toBe('medium');
    expect(defaults.text.verbosity).toBe('low');
    expect(defaults.reasoning).not.toHaveProperty('summary');
    expect(defaults.reasoning).not.toHaveProperty('mode');
    expect(getCurrentDrawingImportAiOptions({
      ...profile,
      DRAWING_IMPORT_V2_TERRA_MODEL: 'configured-model',
      DRAWING_IMPORT_V2_VERBOSITY: 'invalid',
      DRAWING_IMPORT_V2_TERRA_REASONING: 'invalid',
    })).toMatchObject({
      model: 'configured-model', reasoning: { effort: 'medium' }, text: { verbosity: 'low' },
    });
  });
});

describe('current importer extraction compatibility', () => {
  it('keeps prepared PDF text, BOM context and reviewed legacy field values', async () => {
    const extracted = await extractTitleBlock(
      { filename: 'tube.pdf', mimeType: 'application/pdf', buffer: Buffer.from('test') },
      { text: 'STANCHION TUBE 48.00 DOM TUBING ZINC PLATE', pageCount: 1 },
      'Matching uploaded BOM',
    );
    expect(api.create).toHaveBeenCalledOnce();
    expect(api.create.mock.calls[0][0]).toMatchObject(getCurrentDrawingImportAiOptions(profile));
    const content = api.create.mock.calls[0][0].input[0].content;
    expect(content).toHaveLength(1);
    expect(content[0].text).toContain('DRAWING TEXT:');
    expect(content[0].text).toContain('STANCHION TUBE 48.00 DOM TUBING ZINC PLATE');
    expect(content[0].text).toContain('Matching uploaded BOM');
    expect(extracted).toMatchObject({
      pageCount: 1,
      result: {
        partNumber: drawing.partNumber, partName: drawing.partName, quantity: drawing.quantity,
        material: drawing.material, finish: drawing.finish, finalPartLength: drawing.finalPartLength,
        revision: drawing.revision, isAssembly: false, documentRole: 'PART_DRAWING', warnings: [],
      },
    });
    expect(api.upload).not.toHaveBeenCalled();
  });

  it('uses the same profile for photos, keeps high detail, and deletes the uploaded API file', async () => {
    const extracted = await extractTitleBlock({
      filename: 'drawing.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('test-photo'),
    });
    expect(extracted.result.partNumber.value).toBe(drawing.partNumber.value);
    expect(api.create.mock.calls[0][0]).toMatchObject({
      ...getCurrentDrawingImportAiOptions(profile),
      input: [{ role: 'user', content: [
        { type: 'input_text', text: expect.stringContaining('drawing.jpg') },
        { type: 'input_image', file_id: 'file-test', detail: 'high' },
      ] }],
    });
    expect(api.upload).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'vision' }));
    expect(api.remove).toHaveBeenCalledWith('file-test');
  });

  it.each(['BOM', 'COVER', 'OTHER'] as const)('preserves %s classification for downstream routing', async (documentRole) => {
    api.create.mockResolvedValue({ status: 'completed', output_text: JSON.stringify({ ...drawing, documentRole }) });
    const extracted = await extractTitleBlock(
      { filename: 'source.pdf', mimeType: 'application/pdf', buffer: Buffer.from('test') },
      { text: 'source', pageCount: 1 },
    );
    expect(extracted.result.documentRole).toBe(documentRole);
  });

  it('rejects token-limited responses even with valid-looking JSON and preserves photo cleanup', async () => {
    api.create.mockResolvedValue({
      status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' },
      output_text: JSON.stringify(drawing),
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const extracted = await extractTitleBlock({
      filename: 'manual-review.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('test'),
    });
    expect(extracted.result.documentRole).toBe('OTHER');
    expect(extracted.result.material.value).toBeNull();
    expect(extracted.result.warnings.join(' ')).toContain('output-token limit');
    expect(api.remove).toHaveBeenCalledWith('file-test');
    expect(api.create).toHaveBeenCalledOnce();
  });

  it.each(['', 'not JSON', '{}'])('retains manual review for empty or invalid output: %s', async (output_text) => {
    api.create.mockResolvedValue({ status: 'completed', output_text });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const extracted = await extractTitleBlock(
      { filename: 'manual-review.pdf', mimeType: 'application/pdf', buffer: Buffer.from('test') },
      { text: '', pageCount: 1 },
    );
    expect(extracted.result.documentRole).toBe('OTHER');
    expect(extracted.result.partName.value).toBeNull();
    expect(extracted.result.warnings.length).toBeGreaterThan(0);
  });

  it('retains no-key manual review without any API call', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const extracted = await extractTitleBlock({
      filename: 'manual-review.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('test'),
    });
    expect(extracted.result.documentRole).toBe('OTHER');
    expect(api.create).not.toHaveBeenCalled();
    expect(api.upload).not.toHaveBeenCalled();
  });

  it.each(['failed', 'cancelled', 'queued', 'in_progress'] as const)('rejects %s responses', (status) => {
    expect(() => requireDrawingImportOutput({
      status, output_text: JSON.stringify(drawing), incomplete_details: null,
    })).toThrow('no completed drawing result');
  });
});
