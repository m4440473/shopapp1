import { describe, expect, it } from 'vitest';
import {
  calculateFeedsSpeeds,
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
});
