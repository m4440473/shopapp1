import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindStoredAttachmentsByPath = vi.fn();

vi.mock('../attachment-access.repo', () => ({
  findStoredAttachmentsByPath: mockFindStoredAttachmentsByPath,
}));

describe('resolveStoredAttachmentAccess', () => {
  beforeEach(() => vi.resetAllMocks());

  it('prefers a permitted part drawing when a converted quote retains the same storage path', async () => {
    mockFindStoredAttachmentsByPath.mockResolvedValue([
      { scope: 'QUOTE', kind: null, label: 'Original quote drawing', mimeType: 'application/pdf' },
      { scope: 'PART', kind: 'PDF', label: 'Part 100 drawing.pdf', mimeType: 'application/pdf' },
    ]);

    const { resolveStoredAttachmentAccess } = await import('../attachment-access.service');
    const result = await resolveStoredAttachmentAccess('shared/drawing.pdf', false);

    expect(result).toMatchObject({
      ok: true,
      attachment: { scope: 'PART', kind: 'PDF', label: 'Part 100 drawing.pdf' },
    });
  });

  it.each([
    { scope: 'PART', kind: 'PO', label: 'Customer PO.pdf' },
    { scope: 'PART', kind: 'OTHER', label: 'Administrative notes' },
  ])('does not use a restricted part duplicate to bypass quote protection: %#', async (restrictedPart) => {
    mockFindStoredAttachmentsByPath.mockResolvedValue([
      { scope: 'QUOTE', kind: null, label: 'Quote document', mimeType: 'application/pdf' },
      { ...restrictedPart, mimeType: 'application/pdf' },
    ]);

    const { resolveStoredAttachmentAccess } = await import('../attachment-access.service');
    const result = await resolveStoredAttachmentAccess('shared/restricted.pdf', false);

    expect(result).toEqual({ ok: false, status: 403, error: 'Forbidden' });
  });
});
