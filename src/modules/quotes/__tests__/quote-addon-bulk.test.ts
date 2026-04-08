import { describe, expect, it } from 'vitest';

import {
  buildPresetFromSelections,
  dedupePresetItems,
  mergeSelectionsWithoutDuplicates,
} from '@/modules/quotes/quote-addon-bulk';

describe('quote-addon-bulk helpers', () => {
  it('merges incoming selections without duplicate addonIds', () => {
    const result = mergeSelectionsWithoutDuplicates({
      existing: [
        { key: 'a', addonId: 'ADDON-1', units: '1.0', notes: '' },
        { key: 'b', addonId: 'ADDON-2', units: '2.0', notes: '' },
      ],
      incoming: [
        { addonId: 'ADDON-2', units: '3.0', notes: 'dup should skip' },
        { addonId: 'ADDON-3', units: '1.5', notes: 'new' },
      ],
      createKey: () => 'new-key',
    });

    expect(result).toHaveLength(3);
    expect(result[2]).toMatchObject({ addonId: 'ADDON-3', units: '1.5', notes: 'new' });
  });

  it('builds preset from selected assignment keys only', () => {
    const presetItems = buildPresetFromSelections({
      selections: [
        { key: 'sel-1', addonId: 'ADDON-1', units: '1.0', notes: 'first' },
        { key: 'sel-2', addonId: 'ADDON-2', units: '2.0', notes: 'second' },
      ],
      selectedKeys: ['sel-2'],
    });

    expect(presetItems).toEqual([{ addonId: 'ADDON-2', units: '2.0', notes: 'second' }]);
  });

  it('dedupes preset items by addonId preserving first seen values', () => {
    const deduped = dedupePresetItems([
      { addonId: 'ADDON-1', units: '1.0', notes: 'first' },
      { addonId: 'ADDON-1', units: '9.0', notes: 'duplicate' },
      { addonId: 'ADDON-2', units: '2.0', notes: '' },
    ]);

    expect(deduped).toEqual([
      { addonId: 'ADDON-1', units: '1.0', notes: 'first' },
      { addonId: 'ADDON-2', units: '2.0', notes: '' },
    ]);
  });
});
