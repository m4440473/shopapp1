import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getStored, saveStored } = vi.hoisted(() => ({
  getStored: vi.fn(),
  saveStored: vi.fn(),
}));

vi.mock('../shop-floor.repo', () => ({
  getShopFloorDisplayOptionsJson: getStored,
  saveShopFloorDisplayOptionsJson: saveStored,
}));

import { DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS } from '../shop-floor.schema';
import { getShopFloorDisplayOptions, updateShopFloorDisplayOptions } from '../shop-floor.service';

describe('Shop Floor display settings service', () => {
  beforeEach(() => {
    getStored.mockReset();
    saveStored.mockReset();
  });

  it('returns safe defaults when nothing valid is stored', async () => {
    getStored.mockResolvedValue('{not-json');
    await expect(getShopFloorDisplayOptions()).resolves.toEqual(DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS);
  });

  it('validates and serializes a saved display profile', async () => {
    saveStored.mockResolvedValue({});
    const input = { ...DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS, sortField: 'customer' as const };
    const result = await updateShopFloorDisplayOptions(input);
    expect(result).toEqual({ ok: true, data: input });
    expect(saveStored).toHaveBeenCalledWith(JSON.stringify(input));
  });

  it('promotes only the untouched legacy overdue red to the deeper default', async () => {
    getStored.mockResolvedValue(JSON.stringify({
      ...DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS,
      colorRules: [{
        ...DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS.colorRules[0],
        color: '#dc2626',
      }],
    }));
    const result = await getShopFloorDisplayOptions();
    expect(result.colorRules[0].color).toBe('#7f1d1d');
  });

  it('rejects invalid colors and does not write them', async () => {
    const input = {
      ...DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS,
      colorRules: [{ ...DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS.colorRules[0], color: 'red' }],
    };
    expect((await updateShopFloorDisplayOptions(input)).ok).toBe(false);
    expect(saveStored).not.toHaveBeenCalled();
  });
});
