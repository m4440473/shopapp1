import { describe, expect, it } from 'vitest';
import {
  calculateFeedsSpeeds,
  fswizardChiploads,
  fswizardMaterials,
  fswizardToolCoatings,
  fswizardToolMaterials,
  fswizardToolTypes,
  getDefaultFeedsSpeedsInputs,
  getFeedsSpeedsInputsForTool,
  updateFeedsSpeedsDiameter,
} from '@/modules/feeds-speeds/feeds-speeds';

type NamedCase = {
  name: string;
  toolName: string;
  materialName: string;
  toolMaterialName: string;
  coatingName: string;
  diameter: number;
  fluteCount: number;
  doc: number;
  woc: number;
  workDiameter?: number;
  threadLead?: number;
};

function factorReduce(value: number, reduction?: number) {
  return (1 - (reduction ?? 0)) * (value - 1) + 1;
}

function runNamedCase(testCase: NamedCase) {
  const tool = fswizardToolTypes.find((item) => item.name === testCase.toolName);
  const material = fswizardMaterials.find((item) => item.name === testCase.materialName);
  const toolMaterial = fswizardToolMaterials.find((item) => item.name === testCase.toolMaterialName);
  const coating = fswizardToolCoatings.find((item) => item.name === testCase.coatingName);

  expect(tool, `Missing tool "${testCase.toolName}"`).toBeTruthy();
  expect(material, `Missing material "${testCase.materialName}"`).toBeTruthy();
  expect(toolMaterial, `Missing tool material "${testCase.toolMaterialName}"`).toBeTruthy();
  expect(coating, `Missing coating "${testCase.coatingName}"`).toBeTruthy();

  const result = calculateFeedsSpeeds({
    ...getDefaultFeedsSpeedsInputs(),
    toolTypeId: String(tool?.id),
    materialId: String(material?.id),
    toolMaterialId: String(toolMaterial?.id),
    coatingId: String(coating?.id),
    diameter: testCase.diameter,
    fluteCount: testCase.fluteCount,
    doc: testCase.doc,
    woc: testCase.woc,
    workDiameter: testCase.workDiameter ?? testCase.diameter,
    threadLead: testCase.threadLead ?? 0.05,
  });

  expect(result).not.toBeNull();
  return result!;
}

function getNamedEntities(testCase: NamedCase) {
  const tool = fswizardToolTypes.find((item) => item.name === testCase.toolName);
  const material = fswizardMaterials.find((item) => item.name === testCase.materialName);
  const toolMaterial = fswizardToolMaterials.find((item) => item.name === testCase.toolMaterialName);
  const coating = fswizardToolCoatings.find((item) => item.name === testCase.coatingName);

  expect(tool, `Missing tool "${testCase.toolName}"`).toBeTruthy();
  expect(material, `Missing material "${testCase.materialName}"`).toBeTruthy();
  expect(toolMaterial, `Missing tool material "${testCase.toolMaterialName}"`).toBeTruthy();
  expect(coating, `Missing coating "${testCase.coatingName}"`).toBeTruthy();

  return {
    tool: tool!,
    material: material!,
    toolMaterial: toolMaterial!,
    coating: coating!,
  };
}

function interpolateReferenceChipload(toolName: string, diameter: number) {
  const tool = fswizardToolTypes.find((item) => item.name === toolName);
  expect(tool, `Missing tool "${toolName}"`).toBeTruthy();

  const family =
    tool?.type === 'cornerrounding'
      ? 'chamfermill'
      : tool?.type === 'tap'
        ? 'drill'
        : tool?.type ?? 'endmill';
  const matching = fswizardChiploads.filter((entry) => entry.tool_type === family);
  let lowerDia = -1;
  let upperDia = -1;
  let lowerIpt = -1;
  let upperIpt = -1;

  for (const entry of matching) {
    if (diameter <= entry.dia && (upperDia > entry.dia || upperDia === -1)) {
      upperDia = entry.dia;
      upperIpt = entry.ipt;
    }
  }

  for (const entry of matching) {
    if (diameter >= entry.dia && (lowerDia < entry.dia || upperDia === -1)) {
      lowerDia = entry.dia;
      lowerIpt = entry.ipt;
    }
  }

  if (lowerDia === -1) {
    lowerDia = upperDia;
    lowerIpt = upperIpt;
  }
  if (upperDia === -1) {
    upperDia = lowerDia;
    upperIpt = lowerIpt;
  }
  if (lowerDia === upperDia) {
    return lowerIpt;
  }

  return lowerIpt + ((diameter - lowerDia) * (upperIpt - lowerIpt)) / (upperDia - lowerDia);
}

describe('feeds-speeds FSWizard parity cases', () => {
  it('keeps the 4140 carbide endmill baseline in a stable range', () => {
    const result = runNamedCase({
      name: '4140 baseline',
      toolName: 'Solid End Mill',
      materialName: '4140PH Alloy Steel 300 HB',
      toolMaterialName: 'Carbide',
      coatingName: 'AlTiN',
      diameter: 0.5,
      fluteCount: 4,
      doc: 0.25,
      woc: 0.1,
    });

    expect(result.sfm).toBeGreaterThan(200);
    expect(result.sfm).toBeLessThan(400);
    expect(result.rpm).toBeGreaterThan(1500);
    expect(result.rpm).toBeLessThan(3000);
    expect(result.feedRate).toBeGreaterThan(10);
    expect(result.feedRate).toBeLessThan(40);
  });

  it('reduces feed when the same cut goes from side milling toward slotting', () => {
    const sideMilling = runNamedCase({
      name: '4140 side milling',
      toolName: 'Solid End Mill',
      materialName: '4140PH Alloy Steel 300 HB',
      toolMaterialName: 'Carbide',
      coatingName: 'AlTiN',
      diameter: 0.5,
      fluteCount: 4,
      doc: 0.25,
      woc: 0.1,
    });

    const slotLike = runNamedCase({
      name: '4140 slot-like',
      toolName: 'Solid End Mill',
      materialName: '4140PH Alloy Steel 300 HB',
      toolMaterialName: 'Carbide',
      coatingName: 'AlTiN',
      diameter: 0.5,
      fluteCount: 4,
      doc: 0.25,
      woc: 0.5,
    });

    expect(slotLike.sfm).toBeLessThan(sideMilling.sfm);
    expect(slotLike.feedRate).toBeLessThan(sideMilling.feedRate);
  });

  it('matches the manually verified FSWizard 4140 endmill cases', () => {
    const cases: Array<NamedCase & {
      expected: {
        sfm: number;
        rpm: number;
        chipLoadPerTooth: number;
        feedRate: number;
      };
    }> = [
      {
        name: '4140 baseline',
        toolName: 'Solid End Mill',
        materialName: '4140PH Alloy Steel 300 HB',
        toolMaterialName: 'Carbide',
        coatingName: 'AlTiN',
        diameter: 0.5,
        fluteCount: 4,
        doc: 0.25,
        woc: 0.1,
        expected: {
          sfm: 340.16,
          rpm: 2599,
          chipLoadPerTooth: 0.0034,
          feedRate: 35.39,
        },
      },
      {
        name: '4140 heavier WOC',
        toolName: 'Solid End Mill',
        materialName: '4140PH Alloy Steel 300 HB',
        toolMaterialName: 'Carbide',
        coatingName: 'AlTiN',
        diameter: 0.5,
        fluteCount: 4,
        doc: 0.25,
        woc: 0.25,
        expected: {
          sfm: 320.72,
          rpm: 2450,
          chipLoadPerTooth: 0.0032,
          feedRate: 31.46,
        },
      },
      {
        name: '4140 shallow DOC',
        toolName: 'Solid End Mill',
        materialName: '4140PH Alloy Steel 300 HB',
        toolMaterialName: 'Carbide',
        coatingName: 'AlTiN',
        diameter: 0.5,
        fluteCount: 4,
        doc: 0.1,
        woc: 0.1,
        expected: {
          sfm: 340.16,
          rpm: 2599,
          chipLoadPerTooth: 0.0034,
          feedRate: 35.39,
        },
      },
    ];

    for (const testCase of cases) {
      const result = runNamedCase(testCase);

      expect({
        sfm: result.sfm,
        rpm: result.rpm,
        chipLoadPerTooth: result.chipLoadPerTooth,
        feedRate: result.feedRate,
      }).toEqual(testCase.expected);
    }
  });

  it('matches the pitch-driven tap feed path from the FSWizard source', () => {
    const testCase: NamedCase = {
      name: '4140 tap baseline',
      toolName: 'Tap',
      materialName: '4140PH Alloy Steel 300 HB',
      toolMaterialName: 'HSS',
      coatingName: 'None',
      diameter: 0.5,
      fluteCount: 1,
      doc: 0.75,
      woc: 0,
      threadLead: 0.05,
    };
    const { tool, material, toolMaterial, coating } = getNamedEntities(testCase);
    const result = runNamedCase(testCase);
    const sfm =
      material.sfm *
      tool.sfm *
      factorReduce(toolMaterial.sfm, material.material_reduction) *
      factorReduce(coating.sfm, material.coating_reduction);
    const rpm = (sfm * 12) / Math.PI / testCase.diameter;
    const expectedFeed = rpm * (testCase.threadLead ?? 0) * testCase.fluteCount;

    expect(result.ipr).toBeCloseTo(testCase.threadLead ?? 0, 6);
    expect(result.threadFeed).toBeCloseTo(expectedFeed, 2);
    expect(result.feedRate).toBeCloseTo(expectedFeed, 2);
  });

  it('matches the drill helix-factor path from the FSWizard source', () => {
    const testCase: NamedCase = {
      name: '4140 drill baseline',
      toolName: 'Jobber twist Drill',
      materialName: '4140PH Alloy Steel 300 HB',
      toolMaterialName: 'HSS',
      coatingName: 'None',
      diameter: 0.5,
      fluteCount: 2,
      doc: 1,
      woc: 0,
    };
    const { tool, material, toolMaterial, coating } = getNamedEntities(testCase);
    const result = runNamedCase(testCase);
    const toolChipload = interpolateReferenceChipload(testCase.toolName, testCase.diameter);
    const tool05Chipload = interpolateReferenceChipload(testCase.toolName, 0.5);
    const helix = Math.min(Math.max(tool.helix ?? 0, 0), 60);
    const helixFactor = 1 + 0.75 * (Math.sin((helix * Math.PI) / 180) - Math.sin((15 * Math.PI) / 180));
    const sfm =
      material.sfm *
      tool.sfm *
      factorReduce(toolMaterial.sfm, material.material_reduction) *
      factorReduce(coating.sfm, material.coating_reduction);
    const expectedChipPerTooth =
      (toolChipload *
        (material.ipt ?? 0) *
        factorReduce(toolMaterial.ipt, material.material_ipt_reduction) *
        helixFactor *
        tool.ipt) /
      tool05Chipload;
    const expectedIpr = expectedChipPerTooth * testCase.fluteCount;
    const expectedRpm = (sfm * 12) / Math.PI / testCase.diameter;
    const expectedFeed = expectedRpm * expectedIpr;

    expect(result.ipr).toBeCloseTo(expectedIpr, 4);
    expect(result.rpm).toBeCloseTo(expectedRpm, 0);
    expect(result.feedRate).toBeCloseTo(expectedFeed, 2);
  });

  it('keeps DOC-only endmill cases finite and reduces feed as engagement deepens', () => {
    const cases: NamedCase[] = [
      {
        name: '4140 doc only shallow',
        toolName: 'Solid End Mill',
        materialName: '4140PH Alloy Steel 300 HB',
        toolMaterialName: 'Carbide',
        coatingName: 'AlTiN',
        diameter: 0.5,
        fluteCount: 4,
        doc: 0.1,
        woc: 0,
      },
      {
        name: '4140 doc only deeper',
        toolName: 'Solid End Mill',
        materialName: '4140PH Alloy Steel 300 HB',
        toolMaterialName: 'Carbide',
        coatingName: 'AlTiN',
        diameter: 0.5,
        fluteCount: 4,
        doc: 0.25,
        woc: 0,
      },
    ];

    const [shallow, deeper] = cases.map(runNamedCase);
    expect(shallow.sfm).toBeGreaterThan(0);
    expect(shallow.rpm).toBeGreaterThan(0);
    expect(shallow.feedRate).toBeGreaterThan(0);
    expect(deeper.feedRate).toBeLessThan(shallow.feedRate);
  });

  it('loads tool-family defaults instead of retaining unrelated cutter values', () => {
    const initial = getDefaultFeedsSpeedsInputs();
    expect(initial.fluteCount).toBe(2);
    expect(initial.doc).toBe(0);
    expect(initial.woc).toBe(0);
    expect(initial.threadLead).toBe(0);
    expect(initial.machineProfileId).toBe('haas-vf2ss');

    const drill = fswizardToolTypes.find((tool) => tool.name === 'Jobber twist Drill');
    expect(drill).toBeTruthy();
    const drillInputs = getFeedsSpeedsInputsForTool(String(drill?.id), {
      ...initial,
      fluteCount: 9,
      diameter: 3,
      doc: 2,
      woc: 1,
    });

    expect(drillInputs.fluteCount).toBe(2);
    expect(drillInputs.diameter).toBe(0.5);
    expect(drillInputs.doc).toBe(0);
    expect(drillInputs.woc).toBe(0);
    expect(drillInputs.stickout).toBe(5);
    expect(drillInputs.fluteLength).toBe(5);
  });

  it('rescales default geometry with diameter but preserves operator overrides', () => {
    const initial = getDefaultFeedsSpeedsInputs();
    const resized = updateFeedsSpeedsDiameter(initial, 1);
    expect(resized.stickout).toBe(2.5);
    expect(resized.fluteLength).toBe(2);
    expect(resized.shankDiameter).toBe(1);

    const overridden = updateFeedsSpeedsDiameter(
      { ...initial, stickout: 3.25 },
      1
    );
    expect(overridden.stickout).toBe(3.25);
    expect(overridden.fluteLength).toBe(2);
  });

  it('requires a tap lead instead of silently assuming 20 TPI', () => {
    const tap = fswizardToolTypes.find((tool) => tool.name === 'Tap');
    expect(tap).toBeTruthy();
    const inputs = getFeedsSpeedsInputsForTool(
      String(tap?.id),
      getDefaultFeedsSpeedsInputs()
    );
    const result = calculateFeedsSpeeds(inputs);
    expect(result?.errors).toContain(
      'Enter the tap lead in inches per revolution before using this recommendation.'
    );
    expect(result?.threadFeed).toBeNull();
  });

  it('caps programmed speed and feed to the Haas VF-2SS envelope', () => {
    const vbit = fswizardToolTypes.find((tool) => tool.name === 'V-bit Engraver');
    expect(vbit).toBeTruthy();
    const speedLimited = calculateFeedsSpeeds(
      getFeedsSpeedsInputsForTool(
        String(vbit?.id),
        getDefaultFeedsSpeedsInputs()
      )
    );
    expect(speedLimited?.rawRpm).toBeGreaterThan(12_000);
    expect(speedLimited?.rpm).toBe(12_000);
    expect(speedLimited?.rpmLimitApplied).toBe(true);

    const feedLimited = calculateFeedsSpeeds({
      ...getDefaultFeedsSpeedsInputs(),
      fluteCount: 1000,
      doc: 0.25,
      woc: 0.1,
    });
    expect(feedLimited?.rawFeedRate).toBeGreaterThan(833);
    expect(feedLimited?.feedRate).toBe(833);
    expect(feedLimited?.feedLimitApplied).toBe(true);
  });

  it('uses thread-circle compensation and rejects impossible internal geometry', () => {
    const threadMill = fswizardToolTypes.find((tool) => tool.name === 'Thread Mill');
    expect(threadMill).toBeTruthy();
    const base = getFeedsSpeedsInputsForTool(
      String(threadMill?.id),
      getDefaultFeedsSpeedsInputs()
    );
    const invalid = calculateFeedsSpeeds({
      ...base,
      threadDiameter: base.diameter,
      threadExternal: false,
    });
    expect(invalid?.errors).toContain(
      'Internal thread diameter must be larger than the thread mill.'
    );

    const internal = calculateFeedsSpeeds({
      ...base,
      threadDiameter: 0.5,
      threadExternal: false,
    });
    const external = calculateFeedsSpeeds({
      ...base,
      threadDiameter: 0.5,
      threadExternal: true,
    });
    expect(internal?.pilotDiameter).toBeCloseTo(0.402, 3);
    expect(external?.feedRate).toBeCloseTo((internal?.feedRate ?? 0) * 3, 1);
  });

  it('keeps absolute turning DOC defaults absolute when diameter changes', () => {
    const turning = fswizardToolTypes.find(
      (tool) => tool.name === 'Turning-Profiling'
    );
    expect(turning).toBeTruthy();
    const result = calculateFeedsSpeeds({
      ...getFeedsSpeedsInputsForTool(
        String(turning?.id),
        getDefaultFeedsSpeedsInputs()
      ),
      diameter: 0.5,
      shankDiameter: 0.5,
    });
    expect(result?.sideDoc).toBe(0.2);
  });

  it('runs every bundled tool family without exceeding machine limits', () => {
    const base = getDefaultFeedsSpeedsInputs();
    for (const tool of fswizardToolTypes) {
      const inputs = getFeedsSpeedsInputsForTool(String(tool.id), base);
      if (tool.type === 'tap') inputs.threadLead = 0.05;
      const result = calculateFeedsSpeeds(inputs);
      expect(result, tool.name).not.toBeNull();
      expect(result?.errors, tool.name).toEqual([]);
      expect(Number.isFinite(result?.rpm), tool.name).toBe(true);
      expect(Number.isFinite(result?.feedRate), tool.name).toBe(true);
      expect(result?.rpm, tool.name).toBeLessThanOrEqual(12_000);
      expect(result?.feedRate, tool.name).toBeLessThanOrEqual(833);
      expect(result?.rampFeed, tool.name).toBeNull();
      expect(result?.plungeFeed, tool.name).toBeNull();
    }
  });

  it('keeps source-derived representative outputs stable across every operation branch', () => {
    const base = getDefaultFeedsSpeedsInputs();
    const cases = [
      { tool: 'High Feed Mill', rpm: 1949, feed: 21.13 },
      { tool: 'Corner Rounding Mill', rpm: 9174, feed: 35.63 },
      { tool: 'Thread Mill', rpm: 4678, feed: 8.96 },
      { tool: 'Turning-Profiling', rpm: 1949, feed: 13.27 },
      { tool: 'Reamer', rpm: 780, feed: 8.56 },
      { tool: 'V-bit Engraver', rpm: 12_000, feed: 6.27 },
    ];

    for (const testCase of cases) {
      const tool = fswizardToolTypes.find(
        (candidate) => candidate.name === testCase.tool
      );
      expect(tool, testCase.tool).toBeTruthy();
      const result = calculateFeedsSpeeds(
        getFeedsSpeedsInputsForTool(String(tool?.id), base)
      );
      expect(result?.errors, testCase.tool).toEqual([]);
      expect(result?.rpm, testCase.tool).toBe(testCase.rpm);
      expect(result?.feedRate, testCase.tool).toBe(testCase.feed);
    }
  });
});
