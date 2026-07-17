import { describe, expect, it } from 'vitest';

import {
  calculateCornerRoundingEffectiveDiameter,
  calculateEndmillEffectiveDiameter,
  cornerRoundingArea,
  cornerRoundingDocForWoc,
  cornerRoundingWocForDoc,
  getEffectiveDiameter,
  getEffectiveDiameterMin,
} from '@/modules/feeds-speeds/feeds-speeds.geometry';

describe('FSWizard geometry helpers', () => {
  it('matches the source effective-diameter helpers', () => {
    expect(getEffectiveDiameter(0.5, 90, 0.25)).toBeCloseTo(0.5, 8);
    expect(getEffectiveDiameter(0.5, 45, 0.125)).toBeCloseTo(0.75, 8);
    expect(getEffectiveDiameterMin(0.5, 45, 0.125, 0.1)).toBeCloseTo(0.55, 8);
  });

  it('uses the feed-mill flute envelope instead of collapsing diameter', () => {
    expect(
      calculateEndmillEffectiveDiameter({
        subtype: 'feedmill',
        diameter: 1,
        cornerRadius: 0,
        leadAngle: 10,
        doc: 0.055,
        fluteLength: 0.055,
      })
    ).toBeCloseTo(1, 8);
  });

  it('matches corner-rounding effective diameter at partial and full depth', () => {
    expect(
      calculateCornerRoundingEffectiveDiameter(0.125, 0.125, 0)
    ).toBeCloseTo(0.125, 8);
    expect(
      calculateCornerRoundingEffectiveDiameter(0.125, 0.125, 0.125)
    ).toBeCloseTo(0.375, 8);
  });

  it('round-trips corner-rounding target area through DOC and WOC solvers', () => {
    const radius = 0.125;
    const woc = 0.1;
    const doc = 0.08;
    const area = cornerRoundingArea(radius, woc, doc);
    expect(area).toBeGreaterThan(0);
    expect(cornerRoundingDocForWoc(radius, woc, area)).toBeCloseTo(doc, 6);
    expect(cornerRoundingWocForDoc(radius, doc, area)).toBeCloseTo(woc, 6);
  });

  it('returns zero instead of non-finite geometry for invalid corner inputs', () => {
    expect(cornerRoundingArea(0, 0, 0)).toBe(0);
    expect(cornerRoundingDocForWoc(0.125, 0.2, 0.01)).toBe(0);
    expect(cornerRoundingWocForDoc(0.125, 0.2, 0.01)).toBe(0);
  });
});
