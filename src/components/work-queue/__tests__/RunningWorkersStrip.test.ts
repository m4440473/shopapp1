import { describe, expect, it } from 'vitest';

import { buildOrderPartHref, formatRunningDuration } from '../RunningWorkersStrip';

describe('RunningWorkersStrip helpers', () => {
  it('formats an active interval as an hours, minutes, and seconds clock', () => {
    const startedAt = new Date('2026-07-17T12:00:00.000Z');
    const nowMs = new Date('2026-07-17T14:03:09.000Z').getTime();

    expect(formatRunningDuration(startedAt, nowMs)).toBe('02:03:09');
  });

  it('clamps future and invalid start times to zero', () => {
    const nowMs = new Date('2026-07-17T12:00:00.000Z').getTime();

    expect(formatRunningDuration('2026-07-17T13:00:00.000Z', nowMs)).toBe('00:00:00');
    expect(formatRunningDuration('not-a-date', nowMs)).toBe('00:00:00');
  });

  it('builds a direct link to the selected part on order detail', () => {
    expect(buildOrderPartHref({ orderId: 'order/one', partId: 'part two' })).toBe(
      '/orders/order%2Fone?part=part%20two',
    );
  });

  it('falls back to order detail for a legacy timer without a part', () => {
    expect(buildOrderPartHref({ orderId: 'order-one', partId: null })).toBe('/orders/order-one');
  });
});
