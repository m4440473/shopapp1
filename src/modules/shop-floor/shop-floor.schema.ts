import { z } from 'zod';

export const SHOP_FLOOR_SORT_FIELDS = [
  'createdAt',
  'dueDate',
  'daysPastDue',
  'receivedDate',
  'orderNumber',
  'business',
  'customer',
  'machinist',
  'department',
  'priority',
  'status',
  'quantity',
  'partCount',
  'openAddons',
  'activeTimers',
] as const;

export const SHOP_FLOOR_RULE_FIELDS = [
  'daysPastDue',
  'priority',
  'status',
  'business',
  'customer',
  'machinist',
  'department',
  'quantity',
  'partCount',
  'openAddons',
  'activeTimers',
] as const;

export const ShopFloorSortField = z.enum(SHOP_FLOOR_SORT_FIELDS);
export const ShopFloorRuleField = z.enum(SHOP_FLOOR_RULE_FIELDS);
export const ShopFloorRuleOperator = z.enum(['gte', 'lte', 'equals', 'contains']);

export const ShopFloorColorRule = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  field: ShopFloorRuleField,
  operator: ShopFloorRuleOperator,
  value: z.string().trim().max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color'),
  opacity: z.number().min(0.08).max(0.65),
  enabled: z.boolean(),
});

const ShopFloorDisplayOptionsFields = {
  layout: z.enum(['grid', 'machinist', 'workQueue']),
  sortField: ShopFloorSortField,
  sortDirection: z.enum(['asc', 'desc']),
  colorRules: z.array(ShopFloorColorRule).max(12),
};

export const LegacyShopFloorDisplayOptions = z.object({
  version: z.literal(1),
  ...ShopFloorDisplayOptionsFields,
});

export const ShopFloorDisplayOptions = z.object({
  version: z.literal(2),
  ...ShopFloorDisplayOptionsFields,
});

export type ShopFloorDisplayOptionsInput = z.infer<typeof ShopFloorDisplayOptions>;
export type ShopFloorColorRuleInput = z.infer<typeof ShopFloorColorRule>;
export type ShopFloorSortFieldInput = z.infer<typeof ShopFloorSortField>;
export type ShopFloorRuleFieldInput = z.infer<typeof ShopFloorRuleField>;

export const DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS: ShopFloorDisplayOptionsInput = {
  version: 2,
  layout: 'workQueue',
  sortField: 'createdAt',
  sortDirection: 'desc',
  colorRules: [
    {
      id: 'overdue-seven-days',
      label: '7+ days past due',
      field: 'daysPastDue',
      operator: 'gte',
      value: '7',
      color: '#7f1d1d',
      opacity: 0.28,
      enabled: true,
    },
  ],
};
