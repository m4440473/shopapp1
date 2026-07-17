import fswizardDb from './data/fswizard-db.json';
import {
  calculateCornerRoundingEffectiveDiameter,
  calculateEffectiveCuttingDiameter as calculateSourceEffectiveCuttingDiameter,
  calculateMillingDeflection,
  calculateTurningDeflection,
  cornerRoundingArea,
  cornerRoundingDocForWoc,
  cornerRoundingWocForDoc,
  getDefaultCornerRadius,
  getDefaultFluteLength as getSourceDefaultFluteLength,
  getDefaultShankDiameter,
  getDefaultStickout as getSourceDefaultStickout,
  getDefaultToolLength,
  getEffectiveDiameter,
  getEffectiveDiameterMin,
  getFeedmillMaxFluteLength,
  getIdealSideDoc as getSourceIdealSideDoc,
  getIdealSideWoc as getSourceIdealSideWoc,
  getIdealSlotDoc as getSourceIdealSlotDoc,
} from './feeds-speeds.geometry';
import {
  HAAS_VF2SS_MACHINE,
  getFeedsSpeedsMachineProfile,
} from './feeds-speeds.machine';
import type {
  FeedsSpeedsInputs,
  FeedsSpeedsResult,
  FswizardChipload,
  FswizardMaterial,
  FswizardToolCoating,
  FswizardToolMaterial,
  FswizardToolType,
} from './feeds-speeds.types';

type FswizardDb = {
  material: FswizardMaterial[];
  tool_type: FswizardToolType[];
  tool_material: FswizardToolMaterial[];
  tool_coating: FswizardToolCoating[];
  chipload: FswizardChipload[];
};

const db = fswizardDb as FswizardDb;

export const fswizardMaterials = [...db.material].sort((a, b) => a.name.localeCompare(b.name));
export const fswizardToolTypes = [...db.tool_type].sort(
  (a, b) => (a.priority ?? 999) - (b.priority ?? 999) || a.name.localeCompare(b.name)
);
export const fswizardToolMaterials = [...db.tool_material].sort((a, b) => a.name.localeCompare(b.name));
export const fswizardToolCoatings = [...db.tool_coating].sort((a, b) => a.name.localeCompare(b.name));
export const fswizardChiploads = db.chipload;

const RPM_FACTOR = 12 / Math.PI;

const CHIPLOAD_TYPE_MAP: Record<string, string> = {
  chamfermill: 'chamfermill',
  cornerrounding: 'chamfermill',
  drill: 'drill',
  endmill: 'endmill',
  groove: 'groove',
  ream: 'ream',
  tap: 'drill',
  threadmill: 'threadmill',
  turn: 'turn',
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clampPositive(value: number, fallback = 0) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function factorReduce(value: number, reduction?: number) {
  const safeValue = clampPositive(value, 1);
  const safeReduction = Number.isFinite(reduction) ? Math.min(Math.max(reduction as number, 0), 1) : 0;
  return (1 - safeReduction) * (safeValue - 1) + 1;
}

function degToRad(value: number) {
  return (value * Math.PI) / 180;
}

function lerpClamped(x1: number, x2: number, y1: number, y2: number, x: number) {
  if (!Number.isFinite(x1) || !Number.isFinite(x2) || x1 === x2) {
    return y2;
  }
  const min = Math.min(x1, x2);
  const max = Math.max(x1, x2);
  const clampedX = Math.min(Math.max(x, min), max);
  const progress = (clampedX - x1) / (x2 - x1);
  return y1 + (y2 - y1) * progress;
}

function xYDelta(x1: number, x2: number, y1: number, y2: number, x: number) {
  return lerpClamped(x1, x2, y1, y2, x);
}

function isCarbideLike(toolMaterial: FswizardToolMaterial) {
  const name = toolMaterial.name.toLowerCase();
  return name.includes('carbide') || name.includes('diamond') || name.includes('ceramic');
}

function usesCarbideChiploadBaseline(toolMaterial: FswizardToolMaterial) {
  return toolMaterial.name.trim().toLowerCase() === 'carbide';
}

function getChiploadFamily(tool: FswizardToolType) {
  return CHIPLOAD_TYPE_MAP[tool.type] ?? 'endmill';
}

function interpolateChipload(tool: FswizardToolType, diameter: number) {
  return interpolateChiploadFamily(getChiploadFamily(tool), diameter);
}

function interpolateChiploadFamily(family: string, diameter: number) {
  const entries = fswizardChiploads
    .filter((entry) => entry.tool_type === family)
    .sort((a, b) => a.dia - b.dia);

  if (!entries.length) {
    return 0;
  }

  if (diameter <= entries[0].dia) {
    return entries[0].ipt;
  }

  const last = entries[entries.length - 1];
  if (diameter >= last.dia) {
    return last.ipt;
  }

  for (let index = 1; index < entries.length; index += 1) {
    const next = entries[index];
    const prev = entries[index - 1];
    if (diameter <= next.dia) {
      const span = next.dia - prev.dia || 1;
      const progress = (diameter - prev.dia) / span;
      return prev.ipt + (next.ipt - prev.ipt) * progress;
    }
  }

  return last.ipt;
}

function getMaterialChipload(material: FswizardMaterial, toolMaterial: FswizardToolMaterial) {
  if (usesCarbideChiploadBaseline(toolMaterial) && clampPositive(material.ipt_carbide) > 0) {
    return material.ipt_carbide as number;
  }
  return clampPositive(material.ipt, 0.001);
}

function getHelixFactor(tool: FswizardToolType) {
  const rawHelix = Number.isFinite(tool.helix) ? (tool.helix as number) : 0;

  if (tool.type === 'cornerrounding') {
    return 1;
  }

  if (tool.type === 'drill' || tool.type === 'ream') {
    const helix = Math.min(Math.max(rawHelix, 0), 60);
    return 1 + 0.75 * (Math.sin(degToRad(helix)) - Math.sin(degToRad(15)));
  }

  if (tool.type === 'tap') {
    const helix = Math.min(Math.max(rawHelix, 0), 60);
    return 1 + 0.5 * (Math.sin(degToRad(helix)) - Math.sin(degToRad(15)));
  }

  const helix = Math.min(Math.max(rawHelix, 0), 70);
  return 1 + 0.5 * (Math.sin(degToRad(helix)) - Math.sin(degToRad(30)));
}

function getRotaryLoadFactor(
  material: FswizardMaterial,
  radialChipThinningFactor: number,
  idealArea: number,
  doc: number,
  woc: number
) {
  const actualArea = clampPositive(doc, 0) * clampPositive(woc, 0);
  if (idealArea <= 0 || actualArea <= 0) return 1;

  let loadFactor = 1 / (actualArea / idealArea);
  let loadCeiling = (1 / clampPositive(material.kp, 1)) * 1.5;
  loadCeiling *= lerpClamped(3, 1, 3, 1, radialChipThinningFactor);

  if (loadCeiling < 1) loadCeiling = 1;
  if (loadCeiling > 1.5) loadCeiling = 1.5;
  if (loadFactor > loadCeiling) loadFactor = loadCeiling;
  if (loadFactor < 0.5) loadFactor = 0.5;

  return loadFactor;
}

function getFswizardMaterialDocAdjust(material: FswizardMaterial, fluteCount: number) {
  const kp = clampPositive(material.kp, 0);
  if (kp <= 0) {
    return 1;
  }

  let result = 1;

  if (kp <= 0.1) {
    result = xYDelta(0, 0.1, 2, 1.5, kp);
    if (fluteCount === 1) result *= 1.5;
    if (fluteCount === 2) result *= 1.25;
    if (fluteCount === 4) result *= 0.25;
    if (fluteCount === 5) result *= 0.125;
    if (fluteCount >= 6) result = 0.0625 * result * xYDelta(6, 100, 1, 0.01, fluteCount);
    return result;
  }

  if (kp <= 0.5) {
    result = xYDelta(0.1, 0.5, 1.5, 1, kp);
    if (fluteCount === 1) result *= 1.375;
    if (fluteCount === 2) result *= 1.25;
    if (fluteCount === 3) result *= 1.125;
    if (fluteCount === 4) result *= 0.5;
    if (fluteCount === 5) result *= 0.25;
    if (fluteCount >= 6) result = 0.1875 * result * xYDelta(6, 100, 1, 0.01, fluteCount);
    return result;
  }

  if (kp <= 0.8) {
    result = xYDelta(0.5, 0.8, 1, 0.75, kp);
    if (fluteCount === 2) result *= 1.1;
    if (fluteCount === 3) result *= 1.125;
    if (fluteCount >= 5) result *= 0.75;
    if (fluteCount >= 6) result = 0.625 * result * xYDelta(6, 20, 1, 0.01, fluteCount);
    return result;
  }

  if (kp <= 3) {
    result = xYDelta(0.8, 3, 1, 0.125, kp);
    if (fluteCount === 1 || fluteCount === 2) result *= 0.5;
    if (fluteCount === 3 || fluteCount === 4) result *= 0.75;
    if (fluteCount === 5) result *= 0.625;
    if (fluteCount >= 6) result = 0.5 * result * xYDelta(6, 20, 1, 0.01, fluteCount);
  }

  return result;
}

function computeSfm(
  material: FswizardMaterial,
  tool: FswizardToolType,
  toolMaterial: FswizardToolMaterial,
  coating: FswizardToolCoating
) {
  const base = clampPositive(material.sfm, 1);
  const toolMaterialFactor = factorReduce(toolMaterial.sfm, material.material_reduction);
  const coatingFactor = factorReduce(coating.sfm, material.coating_reduction);
  const sfm = base * clampPositive(tool.sfm, 1) * toolMaterialFactor * coatingFactor;
  const sfmHigh =
    clampPositive(material.max_sfm) > 0
      ? clampPositive(material.max_sfm, base) *
        clampPositive(tool.sfm, 1) *
        toolMaterialFactor *
        coatingFactor
      : null;

  return {
    sfm,
    sfmHigh,
  };
}

function computeChipOrIpr(
  material: FswizardMaterial,
  tool: FswizardToolType,
  toolMaterial: FswizardToolMaterial,
  diameter: number,
  helixFactor = 1,
  options?: {
    family?: string;
    toolChipload?: number;
    halfInchChipload?: number;
  }
) {
  const selectedMaterialIpt = getMaterialChipload(material, toolMaterial);
  const family = options?.family ?? getChiploadFamily(tool);
  const diameterReferenceIpt =
    options?.toolChipload ?? interpolateChiploadFamily(family, diameter);
  const halfInchReferenceIpt =
    options?.halfInchChipload ??
    interpolateChiploadFamily(family, 0.5) ??
    diameterReferenceIpt;
  const toolFactor = clampPositive(tool.ipt, 1);

  let result =
    diameterReferenceIpt *
    selectedMaterialIpt *
    helixFactor *
    toolFactor /
    Math.max(halfInchReferenceIpt, 1e-9);

  if (!usesCarbideChiploadBaseline(toolMaterial) || clampPositive(material.ipt_carbide) <= 0) {
    result *= factorReduce(toolMaterial.ipt ?? 1, material.material_ipt_reduction);
  }

  if (clampPositive(material.max_ipt) > 0 && result > clampPositive(material.max_ipt)) {
    result = clampPositive(material.max_ipt);
  }

  return result;
}

function roundChipload(value: number) {
  if (value <= 0) return 0;
  if (value < 0.0001) return round(value, 6);
  if (value < 0.001) return round(value, 5);
  return round(value, 4);
}

function getToolDependentDefaults(
  tool: FswizardToolType,
  requestedDiameter?: number
) {
  const diameter = clampPositive(
    requestedDiameter ?? 0,
    clampPositive(tool.diameter, 0.5)
  );
  const stickout = getSourceDefaultStickout(tool, diameter);
  const fluteLength = Math.min(getSourceDefaultFluteLength(tool, diameter), stickout);
  const shankDiameter = getDefaultShankDiameter(tool, diameter);

  return {
    diameter,
    fluteCount: Math.max(1, Math.round(tool.flutes ?? 1)),
    doc: 0,
    woc: 0,
    workDiameter: tool.type === 'turn' || tool.type === 'groove' ? 1 : diameter,
    threadLead: 0,
    stickout,
    fluteLength,
    shankDiameter,
    leadAngle: clampPositive(tool.leadangle, 90),
    cornerRadius: getDefaultCornerRadius(tool, diameter),
    threadDiameter: Math.max(0.5, diameter * 2),
    threadExternal: false,
    slotting: (tool.side_doc ?? 0) === 0 && (tool.side_woc ?? 0) === 0,
  };
}

export function getFeedsSpeedsInputsForTool(
  toolTypeId: string,
  current?: FeedsSpeedsInputs
): FeedsSpeedsInputs {
  const tool =
    fswizardToolTypes.find((item) => String(item.id) === toolTypeId) ??
    fswizardToolTypes[0];
  const defaults = getToolDependentDefaults(tool);

  return {
    machineProfileId: current?.machineProfileId ?? HAAS_VF2SS_MACHINE.id,
    toolTypeId: String(tool.id),
    materialId: current?.materialId ?? String(fswizardMaterials[0]?.id ?? ''),
    toolMaterialId:
      current?.toolMaterialId ??
      String(
        fswizardToolMaterials.find((item) => item.name === 'Carbide')?.id ??
          fswizardToolMaterials[0]?.id ??
          ''
      ),
    coatingId:
      current?.coatingId ??
      String(
        fswizardToolCoatings.find((item) => item.name === 'AlTiN')?.id ??
          fswizardToolCoatings[0]?.id ??
          ''
      ),
    ...defaults,
  };
}

export function getDefaultFeedsSpeedsInputs(): FeedsSpeedsInputs {
  return getFeedsSpeedsInputsForTool(String(fswizardToolTypes[0]?.id ?? ''));
}

export function updateFeedsSpeedsDiameter(
  current: FeedsSpeedsInputs,
  requestedDiameter: number
): FeedsSpeedsInputs {
  const tool =
    fswizardToolTypes.find((item) => String(item.id) === current.toolTypeId) ??
    fswizardToolTypes[0];
  const oldDefaults = getToolDependentDefaults(tool, current.diameter);
  const nextDefaults = getToolDependentDefaults(tool, requestedDiameter);
  const followsDefault = (currentValue: number, defaultValue: number) =>
    Math.abs(currentValue - defaultValue) < 1e-9;

  return {
    ...current,
    diameter: requestedDiameter,
    stickout: followsDefault(current.stickout, oldDefaults.stickout)
      ? nextDefaults.stickout
      : current.stickout,
    fluteLength: followsDefault(current.fluteLength, oldDefaults.fluteLength)
      ? nextDefaults.fluteLength
      : current.fluteLength,
    shankDiameter: followsDefault(
      current.shankDiameter,
      oldDefaults.shankDiameter
    )
      ? nextDefaults.shankDiameter
      : current.shankDiameter,
    cornerRadius: followsDefault(
      current.cornerRadius,
      oldDefaults.cornerRadius
    )
      ? nextDefaults.cornerRadius
      : current.cornerRadius,
    threadDiameter: followsDefault(
      current.threadDiameter,
      oldDefaults.threadDiameter
    )
      ? nextDefaults.threadDiameter
      : current.threadDiameter,
  };
}

function resolveSourceMillingGeometry(options: {
  tool: FswizardToolType;
  diameter: number;
  fluteLength: number;
  leadAngle: number;
  enteredDoc: number;
  enteredWoc: number;
  idealSideDoc: number;
  idealSideWoc: number;
  idealSlotDoc: number;
  slotArea: number;
  sideArea: number;
  slotting: boolean;
}) {
  const {
    tool,
    diameter,
    fluteLength,
    leadAngle,
    enteredDoc,
    enteredWoc,
    idealSideDoc,
    idealSideWoc,
    idealSlotDoc,
    slotArea,
    sideArea,
    slotting,
  } = options;
  const clampedDoc = enteredDoc > 0 ? Math.min(enteredDoc, fluteLength) : 0;
  let idealDoc = Math.min(idealSideDoc, fluteLength);
  let idealWoc = idealSideWoc;

  if (slotting) {
    idealDoc = idealSlotDoc;
    idealWoc = getEffectiveDiameter(diameter, leadAngle, idealDoc);
  } else if (enteredWoc <= 0 && clampedDoc <= 0) {
    idealDoc = Math.min(idealSideDoc, fluteLength);
    idealWoc =
      xYDelta(idealSideDoc, idealSlotDoc, sideArea, slotArea, idealDoc) /
      Math.max(idealDoc, 1e-9);
  } else if (enteredWoc <= 0 && clampedDoc > 0) {
    const effectiveFromDoc = getEffectiveDiameter(diameter, leadAngle, clampedDoc);
    const solvedWoc = xYDelta(
      idealSlotDoc,
      idealSideDoc,
      effectiveFromDoc,
      idealSideWoc,
      clampedDoc
    );
    idealDoc =
      idealSideWoc < effectiveFromDoc
        ? xYDelta(idealSideWoc, effectiveFromDoc, sideArea, slotArea, solvedWoc) /
          Math.max(solvedWoc, 1e-9)
        : idealSlotDoc;
    idealWoc = solvedWoc;
  } else if (enteredWoc > 0 && clampedDoc <= 0 && tool.type !== 'chamfermill') {
    const solvedDoc = xYDelta(
      idealSideWoc,
      diameter,
      idealSideDoc,
      idealSlotDoc,
      enteredWoc
    );
    idealWoc =
      xYDelta(idealSideDoc, idealSlotDoc, sideArea, slotArea, solvedDoc) /
      Math.max(solvedDoc, 1e-9);
    idealDoc = solvedDoc;
  } else if (enteredWoc > 0 && clampedDoc > 0) {
    const solvedDoc = xYDelta(
      idealSideWoc,
      diameter,
      idealSideDoc,
      idealSlotDoc,
      enteredWoc
    );
    idealWoc =
      xYDelta(idealSideDoc, idealSlotDoc, sideArea, slotArea, solvedDoc) /
      Math.max(solvedDoc, 1e-9);
    idealDoc = solvedDoc;
  }

  return {
    clampedDoc,
    idealDoc: Math.min(idealDoc, fluteLength),
    idealWoc,
  };
}

function getMillingDeflectionScale(options: {
  tool: FswizardToolType;
  toolMaterial: FswizardToolMaterial;
  diameter: number;
  idealLength: number;
  idealFluteLength: number;
  stickout: number;
  fluteLength: number;
  shankDiameter: number;
  fluteCount: number;
  leadAngle: number;
}) {
  const {
    toolMaterial,
    diameter,
    idealLength,
    idealFluteLength,
    stickout,
    fluteLength,
    shankDiameter,
    fluteCount,
    leadAngle,
  } = options;
  const rigidity = clampPositive(toolMaterial.rigid, 30_000_000);
  const idealDeflection = calculateMillingDeflection({
    stickout: idealLength,
    fluteLength: idealFluteLength,
    cuttingLength: idealFluteLength,
    shankDiameter: diameter,
    fluteCount,
    leadAngle: 90,
    diameter,
    cuttingDiameter: diameter,
    radialWoc: 0.5 * diameter,
    forcePerLength: 10 * diameter,
    rigidity,
  });
  const actualDeflection = calculateMillingDeflection({
    stickout,
    fluteLength,
    cuttingLength: fluteLength,
    shankDiameter,
    fluteCount,
    leadAngle,
    diameter,
    cuttingDiameter: shankDiameter,
    radialWoc: 0.5 * diameter,
    forcePerLength: 10 * diameter,
    rigidity,
  });

  if (
    Number.isFinite(idealDeflection) &&
    Number.isFinite(actualDeflection) &&
    idealDeflection > 0 &&
    actualDeflection > idealDeflection
  ) {
    return Math.pow(idealDeflection / actualDeflection, 0.25);
  }
  return 1;
}

function getLoadFactorFromAreas(
  material: FswizardMaterial,
  targetArea: number,
  actualArea: number
) {
  if (targetArea <= 0 || actualArea <= 0) return 1;
  let factor = targetArea / actualArea;
  let ceiling = (1 / clampPositive(material.kp, 1)) * 1.5;
  if (ceiling < 1) ceiling = 1;
  if (ceiling > 1.5) ceiling = 1.5;
  if (factor > ceiling) factor = ceiling;
  if (factor < 0.5) factor = 0.5;
  return factor;
}

function getToolLengthRpmLimit(diameter: number, stickout: number) {
  if (diameter <= 0 || stickout <= 0) return Number.POSITIVE_INFINITY;
  return (4.76 * 10 ** 6 * diameter * 0.25) / (2 * stickout ** 2);
}

export function calculateFeedsSpeeds(inputs: FeedsSpeedsInputs): FeedsSpeedsResult | null {
  const tool = fswizardToolTypes.find((item) => String(item.id) === inputs.toolTypeId);
  const material = fswizardMaterials.find((item) => String(item.id) === inputs.materialId);
  const toolMaterial = fswizardToolMaterials.find(
    (item) => String(item.id) === inputs.toolMaterialId
  );
  const coating = fswizardToolCoatings.find(
    (item) => String(item.id) === inputs.coatingId
  );

  if (!tool || !material || !toolMaterial || !coating) return null;

  const machine = getFeedsSpeedsMachineProfile(inputs.machineProfileId);
  const requestedDiameter = Number(inputs.diameter);
  const requestedFluteCount = Number(inputs.fluteCount);
  const diameter = clampPositive(requestedDiameter, clampPositive(tool.diameter, 0.5));
  const fluteCount = Math.max(
    1,
    Math.round(requestedFluteCount || tool.flutes || 1)
  );
  const workDiameter = clampPositive(inputs.workDiameter, diameter);
  const idealLength = getDefaultToolLength(tool, diameter);
  const idealFluteLength = getSourceDefaultFluteLength(tool, diameter);
  const stickout = clampPositive(
    inputs.stickout,
    getSourceDefaultStickout(tool, diameter)
  );
  let fluteLength = Math.min(
    clampPositive(inputs.fluteLength, idealFluteLength),
    stickout
  );
  const shankDiameter = clampPositive(
    inputs.shankDiameter,
    getDefaultShankDiameter(tool, diameter)
  );
  const leadAngle =
    tool.type === 'turn' || tool.type === 'groove'
      ? Math.min(Math.max(clampPositive(inputs.leadAngle, tool.leadangle ?? 90), 5), 90)
      : Math.min(
          Math.max(clampPositive(inputs.leadAngle, tool.leadangle ?? 90), 5),
          175
        );
  const cornerRadius = clampPositive(
    inputs.cornerRadius,
    getDefaultCornerRadius(tool, diameter)
  );
  const enteredDoc = clampPositive(inputs.doc, 0);
  const enteredWoc = clampPositive(inputs.woc, 0);
  const slotting =
    Boolean(inputs.slotting) ||
    ((tool.side_doc ?? 0) === 0 && (tool.side_woc ?? 0) === 0);
  const isMilling =
    tool.type === 'endmill' ||
    tool.type === 'threadmill' ||
    tool.type === 'chamfermill';
  const isCornerRounding = tool.type === 'cornerrounding';
  const isTurning = tool.type === 'turn' || tool.type === 'groove';
  const isDrilling = tool.type === 'drill' || tool.type === 'ream';
  const helixFactor =
    isMilling || isCornerRounding || isDrilling || tool.type === 'tap'
      ? getHelixFactor(tool)
      : 1;
  const errors: string[] = [];
  const warnings: string[] = [];

  let effectiveDiameter = isTurning ? workDiameter : diameter;
  let effectiveDoc: number | null = null;
  let effectiveWoc: number | null = null;
  let loadFactor = 1;
  let radialChipThinningFactor = 1;
  let axialChipThinningFactor = 1;
  let chipThinningFactor = 1;
  let chipFamily = getChiploadFamily(tool);
  let chipDiameter = diameter;
  let toolChiploadOverride: number | undefined;
  let halfInchChiploadOverride: number | undefined;
  let sfmMultiplier = 1;
  let threadGeometryFactor = 1;
  let pilotDiameter: number | null = null;
  let loadBudgetArea = 0;

  if (tool.subtype === 'feedmill') {
    fluteLength = Math.min(fluteLength, getFeedmillMaxFluteLength(diameter, leadAngle));
  }

  if (isMilling) {
    let idealSideWoc = getSourceIdealSideWoc(tool, diameter);
    const idealSideDoc = getSourceIdealSideDoc(
      tool,
      diameter,
      fluteLength,
      cornerRadius
    );
    const idealSlotDoc = getSourceIdealSlotDoc(tool, diameter, cornerRadius);
    let sideArea = idealSideDoc * idealSideWoc;
    let slotArea = idealSlotDoc * diameter;

    if (tool.type === 'chamfermill' && tool.subtype !== 'vbit') {
      const fluteEnvelope =
        diameter +
        fluteLength /
          Math.max(Math.tan(degToRad(leadAngle)) / 2, 1e-9);
      idealSideWoc =
        (tool.side_woc ?? 0) < 0
          ? Math.abs(tool.side_woc as number)
          : fluteEnvelope * clampPositive(tool.side_woc, 0);
      sideArea = idealSideDoc * idealSideWoc;
      slotArea =
        idealSlotDoc *
        getEffectiveDiameter(diameter, leadAngle, idealSlotDoc) /
        2;
    }

    const geometry = resolveSourceMillingGeometry({
      tool,
      diameter,
      fluteLength,
      leadAngle,
      enteredDoc,
      enteredWoc,
      idealSideDoc,
      idealSideWoc,
      idealSlotDoc,
      slotArea,
      sideArea,
      slotting,
    });
    let idealDoc = geometry.idealDoc;
    let idealWoc = geometry.idealWoc;
    const deflectionScale = getMillingDeflectionScale({
      tool,
      toolMaterial,
      diameter,
      idealLength,
      idealFluteLength,
      stickout,
      fluteLength,
      shankDiameter,
      fluteCount,
      leadAngle,
    });
    if (slotting) idealDoc *= deflectionScale;
    else idealWoc *= deflectionScale;

    let slottingLoadAdjust = 1;
    if (slotting) {
      slottingLoadAdjust =
        cornerRadius <= diameter / 2
          ? xYDelta(0, diameter / 2, 1, 0.5, cornerRadius)
          : xYDelta(diameter / 2, 2 * diameter, 0.5, 1, cornerRadius);
    }
    loadBudgetArea =
      idealWoc *
      idealDoc *
      getFswizardMaterialDocAdjust(material, fluteCount) *
      slottingLoadAdjust;

    if (geometry.clampedDoc > 0 && !slotting) {
      idealWoc = loadBudgetArea / geometry.clampedDoc;
    }
    if (enteredWoc > 0 && (!slotting || tool.type !== 'chamfermill')) {
      idealDoc = loadBudgetArea / enteredWoc;
    }
    if (enteredWoc <= 0 && enteredDoc <= 0) {
      if (slotting) {
        idealDoc =
          tool.type === 'chamfermill'
            ? loadBudgetArea / Math.max(idealSideWoc, 1e-9)
            : loadBudgetArea / Math.max(diameter, 1e-9);
      } else {
        idealWoc = loadBudgetArea / Math.max(idealDoc, 1e-9);
      }
    }

    idealDoc = Math.min(idealDoc, fluteLength);
    effectiveDoc =
      geometry.clampedDoc > 0 ? geometry.clampedDoc : Math.max(idealDoc, 0);
    effectiveDiameter = calculateSourceEffectiveCuttingDiameter({
      tool,
      diameter,
      cornerRadius,
      leadAngle,
      doc: effectiveDoc,
      fluteLength,
    });
    idealWoc = Math.min(idealWoc, effectiveDiameter);
    effectiveWoc =
      enteredWoc > 0
        ? Math.min(enteredWoc, effectiveDiameter)
        : slotting
          ? effectiveDiameter
          : idealWoc;

    if (effectiveDoc < cornerRadius && cornerRadius > 0) {
      axialChipThinningFactor =
        effectiveDiameter < diameter
          ? 1 /
            Math.sqrt(
              Math.max(
                1e-9,
                1 - Math.pow(1 - effectiveDoc / cornerRadius, 2)
              )
            )
          : 1;
    } else {
      axialChipThinningFactor =
        1 / Math.sin(degToRad(Math.min(Math.max(leadAngle, 5), 175)));
    }
    if (!Number.isFinite(axialChipThinningFactor) || axialChipThinningFactor <= 0) {
      axialChipThinningFactor = 1;
    }

    if (effectiveWoc < effectiveDiameter / 2) {
      radialChipThinningFactor =
        1 /
        Math.sqrt(
          Math.max(
            1e-9,
            1 -
              Math.pow(
                1 - (2 * effectiveWoc) / Math.max(effectiveDiameter, 1e-9),
                2
              )
          )
        );
      radialChipThinningFactor = Math.min(
        Math.max(radialChipThinningFactor, 1),
        3
      );
    }

    const engagementDiameter = getEffectiveDiameterMin(
      diameter,
      leadAngle,
      effectiveDoc,
      effectiveWoc
    );
    const slotIptFactor = clampPositive(tool.slot_ipt_factor, 1);
    const slotSfmFactor = clampPositive(tool.slot_sfm_factor, 1);
    const baseChipDiameter =
      tool.type === 'chamfermill' ? engagementDiameter : diameter;
    toolChiploadOverride =
      interpolateChiploadFamily(chipFamily, baseChipDiameter) *
      xYDelta(
        idealSideWoc,
        engagementDiameter,
        1,
        slotIptFactor,
        effectiveWoc
      );
    sfmMultiplier = xYDelta(
      idealSideWoc,
      engagementDiameter,
      1,
      slotSfmFactor,
      effectiveWoc
    );
    loadFactor = getRotaryLoadFactor(
      material,
      radialChipThinningFactor,
      loadBudgetArea,
      effectiveDoc,
      effectiveWoc
    );
    if (Boolean(tool.default_chip_thinning)) {
      chipThinningFactor =
        radialChipThinningFactor * axialChipThinningFactor;
    }

    if (tool.type === 'threadmill') {
      const threadDiameter = clampPositive(inputs.threadDiameter, 0);
      if (threadDiameter <= 0) {
        errors.push('Thread diameter is required for thread milling.');
      } else if (!inputs.threadExternal && threadDiameter <= diameter) {
        errors.push('Internal thread diameter must be larger than the thread mill.');
      } else {
        threadGeometryFactor = inputs.threadExternal
          ? (threadDiameter + diameter) / threadDiameter
          : (threadDiameter - diameter) / threadDiameter;
        pilotDiameter = threadDiameter * clampPositive(tool.pilot_size, 0);
      }
    }
  } else if (isCornerRounding) {
    const materialAdjust = getFswizardMaterialDocAdjust(material, fluteCount);
    const deflectionScale = getMillingDeflectionScale({
      tool,
      toolMaterial,
      diameter,
      idealLength,
      idealFluteLength,
      stickout,
      fluteLength,
      shankDiameter,
      fluteCount,
      leadAngle,
    });
    const idealSideWoc = cornerRadius * clampPositive(tool.side_woc, 0);
    const idealSideDoc = getSourceIdealSideDoc(
      tool,
      diameter,
      fluteLength,
      cornerRadius
    );
    const idealSlotDoc = getSourceIdealSlotDoc(tool, diameter, cornerRadius);
    const sideAreaTarget =
      cornerRoundingArea(cornerRadius, idealSideWoc, idealSideDoc) *
      materialAdjust *
      deflectionScale;
    const slotAreaTarget =
      cornerRoundingArea(cornerRadius, cornerRadius, idealSlotDoc) *
      materialAdjust *
      deflectionScale;

    if (slotting) {
      effectiveDoc = Math.min(
        enteredDoc > 0 ? enteredDoc : idealSlotDoc,
        cornerRadius
      );
      effectiveWoc = Math.min(
        enteredWoc > 0 ? enteredWoc : cornerRadius,
        cornerRadius
      );
      loadBudgetArea = slotAreaTarget;
    } else if (enteredDoc <= 0 && enteredWoc <= 0) {
      effectiveWoc = Math.min(idealSideWoc, cornerRadius);
      effectiveDoc = cornerRoundingDocForWoc(
        cornerRadius,
        effectiveWoc,
        sideAreaTarget
      );
      loadBudgetArea = sideAreaTarget;
    } else if (enteredDoc > 0 && enteredWoc <= 0) {
      effectiveDoc = Math.min(enteredDoc, cornerRadius);
      effectiveWoc = cornerRoundingWocForDoc(
        cornerRadius,
        effectiveDoc,
        sideAreaTarget
      );
      loadBudgetArea = sideAreaTarget;
    } else if (enteredDoc <= 0 && enteredWoc > 0) {
      effectiveWoc = Math.min(enteredWoc, cornerRadius);
      effectiveDoc = cornerRoundingDocForWoc(
        cornerRadius,
        effectiveWoc,
        sideAreaTarget
      );
      loadBudgetArea = sideAreaTarget;
    } else {
      effectiveDoc = Math.min(enteredDoc, cornerRadius);
      effectiveWoc = Math.min(enteredWoc, cornerRadius);
      loadBudgetArea = sideAreaTarget;
    }

    const actualArea = cornerRoundingArea(
      cornerRadius,
      effectiveWoc,
      effectiveDoc
    );
    loadFactor = getLoadFactorFromAreas(material, loadBudgetArea, actualArea);
    effectiveDiameter = calculateCornerRoundingEffectiveDiameter(
      diameter,
      cornerRadius,
      effectiveDoc
    );
    const chipReferenceDiameter = calculateCornerRoundingEffectiveDiameter(
      diameter,
      cornerRadius,
      cornerRadius / 2
    );
    chipFamily = 'endmill';
    chipDiameter = chipReferenceDiameter;
    toolChiploadOverride = interpolateChiploadFamily(
      chipFamily,
      chipReferenceDiameter
    );
    halfInchChiploadOverride = interpolateChiploadFamily(chipFamily, 0.5);
  } else if (isTurning) {
    let idealDoc =
      (tool.side_doc ?? 0) < 0
        ? Math.abs(tool.side_doc as number)
        : shankDiameter * clampPositive(tool.side_doc, 0);
    const toolRigidity = clampPositive(tool.rigid, clampPositive(toolMaterial.rigid, 30_000_000));
    const idealDeflection = calculateTurningDeflection({
      stickout: idealLength,
      shankWidth: shankDiameter,
      shankHeight: shankDiameter,
      force: 10 * shankDiameter,
      rigidity: toolRigidity,
    });
    const actualDeflection = calculateTurningDeflection({
      stickout,
      shankWidth: shankDiameter,
      shankHeight: shankDiameter,
      force: 10 * shankDiameter,
      rigidity: toolRigidity,
    });
    if (
      idealDeflection > 0 &&
      actualDeflection > idealDeflection &&
      Number.isFinite(actualDeflection)
    ) {
      idealDoc *= Math.pow(idealDeflection / actualDeflection, 0.25);
    }
    idealDoc /= Math.max(clampPositive(material.kp, 0.8) / 0.8, 1);
    idealDoc = Math.min(idealDoc, fluteLength);
    effectiveDoc = Math.min(enteredDoc > 0 ? enteredDoc : idealDoc, fluteLength);
    const baseIdealDoc = Math.max(idealDoc, 1e-9);
    let turningLoadFactor = 1 / Math.max(effectiveDoc / baseIdealDoc, 1e-9);
    let turningLoadCeiling = (1 / clampPositive(material.kp, 1)) * 1.5;
    turningLoadCeiling = Math.min(turningLoadCeiling, 1.5);
    turningLoadFactor = Math.min(turningLoadFactor, turningLoadCeiling);
    loadFactor = Math.max(turningLoadFactor, 0.5);
    effectiveDiameter =
      tool.subtype === 'profile'
        ? workDiameter + 2 * effectiveDoc
        : workDiameter;
    chipDiameter = shankDiameter;
  } else if (isDrilling) {
    pilotDiameter = diameter * clampPositive(tool.pilot_size, 0);
  } else if (tool.type === 'tap') {
    if (clampPositive(inputs.threadLead, 0) <= 0) {
      errors.push('Enter the tap lead in inches per revolution before using this recommendation.');
    }
    warnings.push(
      'Tap output calculates speed and pitch feed only; verify tap-drill size and thread engagement separately.'
    );
  }

  const chipOrIpr =
    tool.type === 'tap'
      ? clampPositive(inputs.threadLead, 0)
      : computeChipOrIpr(
          material,
          tool,
          toolMaterial,
          chipDiameter,
          helixFactor,
          {
            family: chipFamily,
            toolChipload: toolChiploadOverride,
            halfInchChipload: halfInchChiploadOverride,
          }
        );
  const adjustedChipOrIpr =
    tool.type === 'tap'
      ? chipOrIpr
      : chipOrIpr * loadFactor * chipThinningFactor * threadGeometryFactor;
  const chipLoadPerTooth =
    tool.type === 'tap'
      ? adjustedChipOrIpr / fluteCount
      : adjustedChipOrIpr;
  const ipr =
    tool.type === 'tap'
      ? adjustedChipOrIpr
      : adjustedChipOrIpr * fluteCount;

  const { sfm, sfmHigh } = computeSfm(
    material,
    tool,
    toolMaterial,
    coating
  );
  const targetSfm = sfm * sfmMultiplier;
  const targetSfmHigh = sfmHigh ? sfmHigh * sfmMultiplier : null;
  const rpmDiameter = isTurning ? workDiameter : effectiveDiameter;
  const formulaRpm =
    (targetSfm * RPM_FACTOR) / Math.max(rpmDiameter, 0.001);
  const rpmLimitDiameter = Math.max(
    isTurning ? workDiameter : diameter,
    shankDiameter
  );
  const lengthRpmLimit = getToolLengthRpmLimit(rpmLimitDiameter, stickout);
  const sourceLimitedRpm = Math.min(formulaRpm, lengthRpmLimit);
  const rawRpm = sourceLimitedRpm;
  const rpm = Math.min(rawRpm, machine.maxRpm);
  const rpmLimitApplied = rpm < rawRpm - 0.5;
  const programmedSfm =
    targetSfm * (rpm / Math.max(formulaRpm, 1e-9));
  const calculatedFeed =
    tool.type === 'tap'
      ? rpm * ipr
      : tool.ipr_mode
        ? rpm * ipr
        : rpm * chipLoadPerTooth * fluteCount;
  const rawFeedRate = calculatedFeed;
  const feedRate = Math.min(calculatedFeed, machine.maxCuttingFeedIpm);
  const feedLimitApplied = feedRate < calculatedFeed - 0.005;
  const threadFeed =
    tool.type === 'tap' || tool.type === 'threadmill'
      ? feedRate
      : null;

  let materialRemovalRate: number | null = null;
  let spindleHorsepower: number | null = null;
  let spindleTorqueFtLb: number | null = null;
  if (isMilling || isCornerRounding) {
    materialRemovalRate =
      clampPositive(effectiveDoc ?? 0, 0) *
      clampPositive(effectiveWoc ?? 0, 0) *
      feedRate;
    spindleHorsepower =
      materialRemovalRate * clampPositive(material.kp, 0) /
      Math.max(helixFactor, 1e-9);
  } else if (isDrilling) {
    const pilot = clampPositive(pilotDiameter ?? 0, 0);
    materialRemovalRate =
      (Math.PI * diameter ** 2 - Math.PI * pilot ** 2) *
      feedRate /
      4;
    spindleHorsepower =
      materialRemovalRate * clampPositive(material.kp, 0) /
      Math.max(helixFactor, 1e-9);
  } else if (isTurning && effectiveDoc) {
    materialRemovalRate =
      (Math.PI * (workDiameter + effectiveDoc / 2) ** 2 -
        Math.PI * workDiameter ** 2) *
      feedRate;
    spindleHorsepower =
      materialRemovalRate * clampPositive(material.kp, 0);
  }
  if (spindleHorsepower !== null && rpm > 0) {
    spindleTorqueFtLb = (spindleHorsepower * 5252) / rpm;
  }
  const spindleHorsepowerPercent =
    spindleHorsepower === null
      ? null
      : (spindleHorsepower / machine.maxSpindleHorsepower) * 100;
  const spindleTorquePercent =
    spindleTorqueFtLb === null
      ? null
      : (spindleTorqueFtLb / machine.maxSpindleTorqueFtLb) * 100;

  if (!Number.isFinite(requestedDiameter) || requestedDiameter <= 0) {
    warnings.push(
      'Tool diameter was invalid, so the bundled tool-family diameter was used.'
    );
  }
  if (!Number.isFinite(requestedFluteCount) || requestedFluteCount < 1) {
    warnings.push(
      'Flute count was invalid, so the bundled tool-family flute count was used.'
    );
  }
  if (requestedFluteCount > 0 && requestedFluteCount !== tool.flutes) {
    warnings.push(
      `This tool family defaults to ${tool.flutes ?? 1} flute${tool.flutes === 1 ? '' : 's'}; the entered ${fluteCount}-flute cutter is being used.`
    );
  }
  if (lengthRpmLimit < formulaRpm) {
    warnings.push(
      'RPM was reduced by the FSWizard stickout/rigidity speed limit before applying the machine ceiling.'
    );
  }
  if (rpmLimitApplied) {
    warnings.push(
      `RPM was capped at the ${machine.name} maximum of ${machine.maxRpm.toLocaleString()} RPM.`
    );
  }
  if (feedLimitApplied) {
    warnings.push(
      `Feed was capped at the ${machine.name} maximum cutting feed of ${machine.maxCuttingFeedIpm} IPM; actual chipload will be below the target value.`
    );
  }
  if (spindleHorsepowerPercent !== null && spindleHorsepowerPercent > 100) {
    warnings.push(
      `Estimated spindle load exceeds the ${machine.maxSpindleHorsepower} hp machine rating; reduce DOC, WOC, or feed.`
    );
  }
  if (spindleTorquePercent !== null && spindleTorquePercent > 100) {
    warnings.push(
      `Estimated spindle torque exceeds the ${machine.maxSpindleTorqueFtLb} ft-lb reference rating; reduce the cut and verify against the Haas torque chart.`
    );
  }
  if (targetSfmHigh && targetSfm > targetSfmHigh) {
    warnings.push(
      'Selected tool/coating multipliers push the target above the material high-SFM range.'
    );
  }
  if (clampPositive(material.hb) >= 360 && !isCarbideLike(toolMaterial)) {
    warnings.push(
      'This hardened material will usually require carbide-like tooling for production work.'
    );
  }
  if (isTurning && clampPositive(inputs.workDiameter, 0) <= 0) {
    warnings.push(
      'Work diameter was invalid, so tool diameter was used for the turning RPM calculation.'
    );
  }
  if ((isMilling || isCornerRounding) && enteredDoc > fluteLength) {
    warnings.push('Planned DOC was limited to the entered flute length.');
  }
  if (
    (isMilling || isCornerRounding) &&
    effectiveDoc !== null &&
    effectiveWoc !== null &&
    Math.abs(loadFactor - 1) > 0.05
  ) {
    warnings.push(
      'DOC/WOC are scaling feed through the FSWizard engagement/load model.'
    );
  }
  if (rpm > 0 && feedRate > 0 && feedRate < 1) {
    warnings.push(
      'The resulting feed is below 1 IPM; confirm the setup and tool selection.'
    );
  }
  if (tool.usage) warnings.push(tool.usage.replace(/\s+/g, ' ').trim());

  const slotDoc =
    isMilling || isCornerRounding
      ? getSourceIdealSlotDoc(tool, diameter, cornerRadius)
      : null;
  const sideDoc =
    isMilling || isCornerRounding || isTurning
      ? isTurning
        ? (tool.side_doc ?? 0) < 0
          ? Math.abs(tool.side_doc as number)
          : shankDiameter * clampPositive(tool.side_doc, 0)
        : getSourceIdealSideDoc(tool, diameter, fluteLength, cornerRadius)
      : null;
  const sideWoc =
    isMilling || isCornerRounding
      ? isCornerRounding
        ? cornerRadius * clampPositive(tool.side_woc, 0)
        : getSourceIdealSideWoc(tool, diameter)
      : null;
  const peckDepth =
    isDrilling && clampPositive(tool.peck, 0) > 0
      ? diameter * clampPositive(tool.peck, 0)
      : null;

  return {
    machine,
    tool,
    material,
    toolMaterial,
    coating,
    sfm: round(programmedSfm),
    sfmHigh: targetSfmHigh ? round(targetSfmHigh) : null,
    rawRpm: round(rawRpm, 0),
    rpm: round(rpm, 0),
    rpmLimitApplied,
    feedLimitApplied,
    rawFeedRate: round(rawFeedRate, 2),
    chipLoadPerTooth: roundChipload(chipLoadPerTooth),
    ipr: roundChipload(ipr),
    feedRate: round(feedRate, 2),
    plungeFeed: null,
    rampFeed: null,
    slotDoc: slotDoc ? round(slotDoc, 3) : null,
    sideDoc: sideDoc ? round(sideDoc, 3) : null,
    sideWoc: sideWoc ? round(sideWoc, 3) : null,
    peckDepth: peckDepth ? round(peckDepth, 3) : null,
    pilotDiameter: pilotDiameter ? round(pilotDiameter, 3) : null,
    threadFeed: threadFeed ? round(threadFeed, 2) : null,
    effectiveDiameter: round(effectiveDiameter, 4),
    effectiveDoc:
      effectiveDoc === null ? null : round(effectiveDoc, 4),
    effectiveWoc:
      effectiveWoc === null ? null : round(effectiveWoc, 4),
    materialRemovalRate:
      materialRemovalRate === null ? null : round(materialRemovalRate, 3),
    spindleHorsepower:
      spindleHorsepower === null ? null : round(spindleHorsepower, 2),
    spindleTorqueFtLb:
      spindleTorqueFtLb === null ? null : round(spindleTorqueFtLb, 2),
    spindleHorsepowerPercent:
      spindleHorsepowerPercent === null
        ? null
        : round(spindleHorsepowerPercent, 0),
    spindleTorquePercent:
      spindleTorquePercent === null
        ? null
        : round(spindleTorquePercent, 0),
    errors,
    warnings,
  };
}

export function getToolFamilyLabel(tool: FswizardToolType) {
  const subtype = tool.subtype ? ` - ${tool.subtype}` : '';
  const shortName = tool.short_name ? ` (${tool.short_name})` : '';
  return `${tool.name}${shortName}${subtype}`;
}
