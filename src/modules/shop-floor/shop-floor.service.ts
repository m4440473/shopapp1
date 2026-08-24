import {
  DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS,
  ShopFloorDisplayOptions,
  type ShopFloorDisplayOptionsInput,
} from './shop-floor.schema';
import { getShopFloorDisplayOptionsJson, saveShopFloorDisplayOptionsJson } from './shop-floor.repo';

function upgradeLegacyDisplayOptions(options: ShopFloorDisplayOptionsInput): ShopFloorDisplayOptionsInput {
  return {
    ...options,
    colorRules: options.colorRules.map((rule) => (
      rule.id === 'overdue-seven-days' && rule.color.toLowerCase() === '#dc2626' && rule.opacity === 0.28
        ? { ...rule, color: '#7f1d1d' }
        : rule
    )),
  };
}

export async function getShopFloorDisplayOptions(): Promise<ShopFloorDisplayOptionsInput> {
  const stored = await getShopFloorDisplayOptionsJson();
  if (!stored) return DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS;
  try {
    const parsed = ShopFloorDisplayOptions.safeParse(JSON.parse(stored));
    return parsed.success ? upgradeLegacyDisplayOptions(parsed.data) : DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS;
  } catch {
    return DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS;
  }
}

export async function updateShopFloorDisplayOptions(input: unknown) {
  const parsed = ShopFloorDisplayOptions.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.flatten() };
  await saveShopFloorDisplayOptionsJson(JSON.stringify(parsed.data));
  return { ok: true as const, data: parsed.data };
}
