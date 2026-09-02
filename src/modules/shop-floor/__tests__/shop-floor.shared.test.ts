import { describe, expect, it } from 'vitest';

import { DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS } from '../shop-floor.schema';
import {
  compareShopFloorOrders,
  getMatchingShopFloorRule,
  matchesShopFloorBusiness,
  shopFloorRuleMatches,
  translucentRuleStyle,
} from '../shop-floor.shared';

const now = new Date('2026-08-24T12:00:00.000Z');

describe('Shop Floor business filtering', () => {
  it('shows every business for All and matches a selected code case-insensitively', () => {
    expect(matchesShopFloorBusiness('STD', 'all')).toBe(true);
    expect(matchesShopFloorBusiness('CRM', 'crm')).toBe(true);
    expect(matchesShopFloorBusiness('PC', 'CRM')).toBe(false);
    expect(matchesShopFloorBusiness(null, 'STD')).toBe(false);
  });
});

describe('Shop Floor display rules', () => {
  it('matches the default red rule only at seven or more days past due', () => {
    const rule = DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS.colorRules[0];
    expect(shopFloorRuleMatches(rule, { orderNumber: 'A', dueDate: '2026-08-17T11:59:59.000Z' }, now)).toBe(true);
    expect(shopFloorRuleMatches(rule, { orderNumber: 'B', dueDate: '2026-08-18T12:00:00.000Z' }, now)).toBe(false);
    expect(shopFloorRuleMatches(rule, { orderNumber: 'C', dueDate: null }, now)).toBe(false);
  });

  it('uses the first matching enabled rule', () => {
    const rules = [
      { ...DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS.colorRules[0], enabled: false },
      { ...DEFAULT_SHOP_FLOOR_DISPLAY_OPTIONS.colorRules[0], id: 'second', label: 'Second', color: '#112233' },
    ];
    expect(getMatchingShopFloorRule(rules, { orderNumber: 'A', dueDate: '2026-08-01' }, now)?.id).toBe('second');
  });

  it('supports text rules and creates a translucent tile style', () => {
    const rule = {
      id: 'hot', label: 'Hot work', field: 'priority' as const, operator: 'equals' as const,
      value: 'HOT', color: '#7f1d1d', opacity: 0.28, enabled: true,
    };
    expect(shopFloorRuleMatches(rule, { orderNumber: 'A', priority: 'hot' }, now)).toBe(true);
    expect(translucentRuleStyle(rule)).toEqual({
      backgroundColor: 'rgba(127, 29, 29, 0.28)',
      borderColor: 'rgba(127, 29, 29, 0.63)',
    });
  });
});

describe('Shop Floor sorting', () => {
  it('shows newly created work orders first with deterministic same-time ordering', () => {
    const older = { orderNumber: 'STD-100', createdAt: '2026-08-24T12:00:00.000Z' };
    const newer = { orderNumber: 'STD-101', createdAt: '2026-08-25T12:00:00.000Z' };
    const sameTimeHigherNumber = { orderNumber: 'STD-102', createdAt: newer.createdAt };
    const options = { sortField: 'createdAt' as const, sortDirection: 'desc' as const };

    expect(compareShopFloorOrders(newer, older, options, now)).toBeLessThan(0);
    expect(compareShopFloorOrders(sameTimeHigherNumber, newer, options, now)).toBeLessThan(0);
  });

  it('sorts natural order numbers and reverses direction', () => {
    const a = { orderNumber: 'STD-9' };
    const b = { orderNumber: 'STD-10' };
    expect(compareShopFloorOrders(a, b, { sortField: 'orderNumber', sortDirection: 'asc' }, now)).toBeLessThan(0);
    expect(compareShopFloorOrders(a, b, { sortField: 'orderNumber', sortDirection: 'desc' }, now)).toBeGreaterThan(0);
  });

  it('sorts priority in shop urgency order', () => {
    const hot = { orderNumber: 'A', priority: 'HOT' };
    const normal = { orderNumber: 'B', priority: 'NORMAL' };
    expect(compareShopFloorOrders(hot, normal, { sortField: 'priority', sortDirection: 'asc' }, now)).toBeLessThan(0);
  });

  it('sorts by current department text', () => {
    const machining = { orderNumber: 'A', department: 'Machining' };
    const shipping = { orderNumber: 'B', department: 'Shipping' };
    expect(compareShopFloorOrders(machining, shipping, { sortField: 'department', sortDirection: 'asc' }, now)).toBeLessThan(0);
  });
});
