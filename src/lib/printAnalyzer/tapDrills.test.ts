import { describe, expect, it } from 'vitest';

import { attachTapDrills } from './tapDrills';
import type { PrintAnalyzerResult } from './schema';

function baseResult(): PrintAnalyzerResult {
  return {
    units: 'inch',
    holes: [],
    radii: [],
    generalTolerances: [],
    tappedHoles: [],
    setup: {
      estimatedSetups: 1,
      estimatedFlips: 0,
      assumedMachine: '3-axis',
      normals: [],
      reasoning: [],
      assumptions: [],
    },
    warnings: [],
  };
}

describe('attachTapDrills', () => {
  it('adds decimal inches for letter drill recommendations', () => {
    const result = attachTapDrills({
      ...baseResult(),
      tappedHoles: [{ thread: '5/16-18 UNC-2B', count: 2, confidence: 0.8 }],
    });

    expect(result.tappedHoles[0]?.recommendedTapDrill?.drill).toBe('F');
    expect(result.tappedHoles[0]?.recommendedTapDrill?.diameter).toBeCloseTo(0.257, 4);
  });
});
