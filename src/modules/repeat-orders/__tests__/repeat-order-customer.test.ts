import { describe, expect, it } from 'vitest';
import { resolveRepeatOrderCustomer } from '../repeat-order-customer';
import { RepeatOrderTemplateCreateOrder } from '../repeat-orders.schema';

describe('repeat order customer wizard state', () => {
  it('keeps the template customer when a select remount emits an empty value', () => {
    expect(resolveRepeatOrderCustomer('', 'customer-source')).toBe('customer-source');
  });
  it('uses an explicit replacement including a newly added customer', () => {
    expect(resolveRepeatOrderCustomer('customer-new', 'customer-source')).toBe('customer-new');
    expect(RepeatOrderTemplateCreateOrder.parse({ customerId: 'customer-new' }).customerId).toBe('customer-new');
  });
  it('requires a selection when neither source nor selected customer exists', () => {
    expect(resolveRepeatOrderCustomer('', null)).toBe('');
    expect(RepeatOrderTemplateCreateOrder.safeParse({ customerId: '' }).success).toBe(false);
  });
});
