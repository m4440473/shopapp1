import { describe, expect, it } from 'vitest';

import { canReadStoredAttachment, isDrawingPartAttachment } from '../attachment-visibility';

describe('attachment visibility', () => {
  it.each(['DWG', 'STEP', 'PDF', 'PRINT', 'IMAGE'])('allows non-admin part drawing kind %s', (kind) => {
    const attachment = { kind, label: 'Part drawing' };
    expect(isDrawingPartAttachment(attachment)).toBe(true);
    expect(canReadStoredAttachment({ isAdmin: false, scope: 'PART', attachment })).toBe(true);
  });

  it.each([
    { kind: 'PO', label: 'Customer document' },
    { kind: 'PDF', label: 'Customer PO.pdf' },
    { kind: 'OTHER', label: 'Setup notes' },
  ])('denies non-admin part admin document %#', (attachment) => {
    expect(canReadStoredAttachment({ isAdmin: false, scope: 'PART', attachment })).toBe(false);
  });

  it.each(['QUOTE', 'QUOTE_PART', 'ORDER'] as const)('denies non-admin files in %s scope', (scope) => {
    expect(canReadStoredAttachment({
      isAdmin: false,
      scope,
      attachment: { kind: 'PDF', label: 'drawing.pdf' },
    })).toBe(false);
  });

  it('allows admins to read every stored attachment scope and kind', () => {
    expect(canReadStoredAttachment({
      isAdmin: true,
      scope: 'ORDER',
      attachment: { kind: 'PO', label: 'Purchase order' },
    })).toBe(true);
  });
});
