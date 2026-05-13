import { describe, expect, it } from 'vitest';
import {
  calculateFeedsSpeeds,
  fswizardChiploads,
  fswizardMaterials,
  fswizardToolCoatings,
  fswizardToolMaterials,
  fswizardToolTypes,
  getDefaultFeedsSpeedsInputs,
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

  it('keeps manual parity-case outputs stable', () => {
    const cases: NamedCase[] = [
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
      },
    ];

    for (const testCase of cases) {
      const result = runNamedCase(testCase);

      expect({
        name: testCase.name,
        sfm: result.sfm,
        rpm: result.rpm,
        chipLoadPerTooth: result.chipLoadPerTooth,
        feedRate: result.feedRate,
      }).toMatchSnapshot();
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

  it('keeps DOC-only endmill cases stable when WOC is left at default-off', () => {
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

    for (const testCase of cases) {
      const result = runNamedCase(testCase);

      expect({
        name: testCase.name,
        sfm: result.sfm,
        rpm: result.rpm,
        chipLoadPerTooth: result.chipLoadPerTooth,
        feedRate: result.feedRate,
      }).toMatchSnapshot();
    }
  });
});
