import fswizardDb from './data/fswizard-db.json';
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
  if (!Number.isFinite(x1) || !Number.isFinite(x2) || x1 === x2) {
    return y2;
  }
  return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

function isCarbideLike(toolMaterial: FswizardToolMaterial) {
  const name = toolMaterial.name.toLowerCase();
  return name.includes('carbide') || name.includes('diamond') || name.includes('ceramic');
}

function getChiploadFamily(tool: FswizardToolType) {
  return CHIPLOAD_TYPE_MAP[tool.type] ?? 'endmill';
}

function interpolateChipload(tool: FswizardToolType, diameter: number) {
  const family = getChiploadFamily(tool);
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
  if (isCarbideLike(toolMaterial) && clampPositive(material.ipt_carbide) > 0) {
    return material.ipt_carbide as number;
  }
  return clampPositive(material.ipt, 0.001);
}

function getCornerRadius(tool: FswizardToolType, diameter: number) {
  return clampPositive(tool.corner_radius) * diameter;
}

function getDefaultStickout(tool: FswizardToolType, diameter: number) {
  const defaultLength = Number(tool.default_len);
  if (Number.isFinite(defaultLength) && defaultLength !== 0) {
    return Math.abs(defaultLength);
  }

  if ((tool.tool_len ?? 0) < 0) {
    return Math.abs(tool.tool_len as number);
  }

  if ((tool.tool_len ?? 0) > 0) {
    return diameter * clampPositive(tool.tool_len, 0);
  }

  return diameter;
}

function getDefaultFluteLength(tool: FswizardToolType, diameter: number) {
  const defaultFluteLength = Number(tool.default_flute_len);
  if (Number.isFinite(defaultFluteLength) && defaultFluteLength !== 0) {
    return Math.abs(defaultFluteLength);
  }

  if ((tool.flute_len ?? 0) < 0) {
    return Math.abs(tool.flute_len as number);
  }

  if ((tool.flute_len ?? 0) > 0) {
    return diameter * clampPositive(tool.flute_len, 0);
  }

  return diameter;
}

function getHelixFactor(tool: FswizardToolType) {
  const helix = Math.min(Math.max(clampPositive(tool.helix, 30), 0), 70);
  return 1 + 0.5 * (Math.sin(degToRad(helix)) - Math.sin(degToRad(30)));
}

function getIdealSideWoc(tool: FswizardToolType, diameter: number) {
  if ((tool.side_woc ?? 0) < 0) return Math.abs(tool.side_woc as number);
  return diameter * clampPositive(tool.side_woc, 0);
}

function getIdealSideDoc(tool: FswizardToolType, diameter: number, fluteLength: number) {
  if ((tool.side_doc ?? 0) < 0) return Math.abs(tool.side_doc as number);
  if ((tool.side_doc ?? 0) === 0) return fluteLength;
  return diameter * clampPositive(tool.side_doc, 0);
}

function getIdealSlotDoc(tool: FswizardToolType, diameter: number) {
  if ((tool.slot_doc ?? 0) < 0) return Math.abs(tool.slot_doc as number);
  return diameter * clampPositive(tool.slot_doc, 0);
}

function calculateEngagementDiameter(diameter: number, leadAngle: number, doc: number) {
  const safeDiameter = clampPositive(diameter, 0.001);
  const safeDoc = clampPositive(doc, 0);
  const safeLeadAngle = Math.min(Math.max(clampPositive(leadAngle, 90), 5), 175);

  if (safeDoc <= 0) return safeDiameter;
  if (safeLeadAngle >= 89.999) return safeDiameter;

  const engagement = 2 * safeDoc * Math.tan(degToRad(safeLeadAngle / 2));
  return Math.min(safeDiameter, clampPositive(engagement, safeDiameter));
}

function calculateEffectiveCuttingDiameter(
  tool: FswizardToolType,
  diameter: number,
  doc: number,
  fluteLength: number
) {
  const cornerRadius = getCornerRadius(tool, diameter);
  const safeDiameter = clampPositive(diameter, 0.001);
  const safeDoc = clampPositive(doc, 0);

  if (tool.subtype === 'profile') {
    return safeDiameter + 2 * safeDoc;
  }

  if (cornerRadius >= safeDiameter / 2 && safeDoc > 0 && safeDoc < safeDiameter / 2) {
    return Math.max(0.001, 2 * Math.sqrt(Math.max(0, safeDiameter * safeDoc - safeDoc * safeDoc)));
  }

  if (safeDoc > 0 && safeDoc < cornerRadius && cornerRadius > 0) {
    const ratio = Math.max(0, 1 - safeDoc / cornerRadius);
    const chipFactor = 1 / Math.sqrt(Math.max(1e-9, 1 - ratio * ratio));
    return Math.min(safeDiameter, safeDiameter / chipFactor);
  }

  return calculateEngagementDiameter(safeDiameter, clampPositive(tool.leadangle, 90), Math.min(safeDoc, fluteLength));
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

function isMillingStyleTool(tool: FswizardToolType) {
  return (
    tool.type === 'endmill' ||
    tool.type === 'threadmill' ||
    tool.type === 'chamfermill' ||
    tool.type === 'cornerrounding'
  );
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
  coating: FswizardToolCoating,
  diameter: number,
  helixFactor = 1,
  toolChiploadOverride?: number
) {
  const selectedMaterialIpt = getMaterialChipload(material, toolMaterial);
  const diameterReferenceIpt = toolChiploadOverride ?? interpolateChipload(tool, diameter);
  const halfInchReferenceIpt = interpolateChipload(tool, 0.5) || diameterReferenceIpt;
  const toolFactor = clampPositive(tool.ipt, 1);

  let result =
    diameterReferenceIpt *
    selectedMaterialIpt *
    helixFactor *
    toolFactor /
    Math.max(halfInchReferenceIpt, 1e-9);

  if (!isCarbideLike(toolMaterial) || clampPositive(material.ipt_carbide) <= 0) {
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

function getTorqueRisk(material: FswizardMaterial) {
  const hardness = clampPositive(material.hb);
  if (hardness >= 350) return 'high' as const;
  if (hardness >= 220) return 'medium' as const;
  return 'low' as const;
}

export function getDefaultFeedsSpeedsInputs(): FeedsSpeedsInputs {
  return {
    toolTypeId: String(fswizardToolTypes[0]?.id ?? ''),
    materialId: String(fswizardMaterials[0]?.id ?? ''),
    toolMaterialId: String(fswizardToolMaterials.find((item) => item.name === 'Carbide')?.id ?? fswizardToolMaterials[0]?.id ?? ''),
    coatingId: String(fswizardToolCoatings.find((item) => item.name === 'AlTiN')?.id ?? fswizardToolCoatings[0]?.id ?? ''),
    diameter: 0.5,
    fluteCount: 4,
    doc: 0.25,
    woc: 0.1,
    workDiameter: 1,
    threadLead: 0.05,
  };
}

export function calculateFeedsSpeeds(inputs: FeedsSpeedsInputs): FeedsSpeedsResult | null {
  const tool = fswizardToolTypes.find((item) => String(item.id) === inputs.toolTypeId);
  const material = fswizardMaterials.find((item) => String(item.id) === inputs.materialId);
  const toolMaterial = fswizardToolMaterials.find((item) => String(item.id) === inputs.toolMaterialId);
  const coating = fswizardToolCoatings.find((item) => String(item.id) === inputs.coatingId);

  if (!tool || !material || !toolMaterial || !coating) {
    return null;
  }

  const requestedDiameter = Number(inputs.diameter);
  const requestedFluteCount = Number(inputs.fluteCount);
  const diameter = clampPositive(requestedDiameter, clampPositive(tool.diameter, 0.5));
  const fluteCount = Math.max(1, Math.round(requestedFluteCount || tool.flutes || 1));
  const workDiameter = clampPositive(inputs.workDiameter, diameter);
  const stickout = getDefaultStickout(tool, diameter);
  const fluteLength = Math.min(getDefaultFluteLength(tool, diameter), stickout);
  const idealSideWoc = getIdealSideWoc(tool, diameter);
  const idealSideDoc = getIdealSideDoc(tool, diameter, fluteLength);
  const idealSlotDoc = getIdealSlotDoc(tool, diameter);
  const cornerRadius = getCornerRadius(tool, diameter);
  const enteredDoc = clampPositive(inputs.doc, 0);
  const enteredWoc = clampPositive(inputs.woc, 0);
  const slottingMode = (tool.side_doc ?? 0) === 0 && (tool.side_woc ?? 0) === 0;
  const idealDoc = slottingMode ? idealSlotDoc : idealSideDoc;
  const effectiveDoc = enteredDoc > 0 ? Math.min(enteredDoc, fluteLength || enteredDoc) : idealDoc;
  const effectiveDiameter = calculateEffectiveCuttingDiameter(tool, diameter, effectiveDoc, fluteLength);
  const effectiveWoc = enteredWoc > 0 ? Math.min(enteredWoc, effectiveDiameter) : slottingMode ? effectiveDiameter : idealSideWoc;
  const helixFactor = isMillingStyleTool(tool) || tool.type === 'drill' || tool.type === 'ream' ? getHelixFactor(tool) : 1;
  const chipThinningEnabled = Boolean(tool.default_chip_thinning);

  let radialChipThinningFactor = 1;
  let axialChipThinningFactor = 1;

  if (isMillingStyleTool(tool)) {
    if (effectiveDoc < cornerRadius && cornerRadius > 0) {
      const docRatio = Math.max(0, 1 - effectiveDoc / cornerRadius);
      axialChipThinningFactor = 1 / Math.sqrt(Math.max(1e-9, 1 - docRatio * docRatio));
    } else {
      axialChipThinningFactor = 1 / Math.sin(degToRad(Math.min(Math.max(clampPositive(tool.leadangle, 90), 5), 175)));
    }
    if (!Number.isFinite(axialChipThinningFactor) || axialChipThinningFactor <= 0) {
      axialChipThinningFactor = 1;
    }

    if (effectiveWoc < effectiveDiameter / 2) {
      radialChipThinningFactor =
        1 / Math.sqrt(Math.max(1e-9, 1 - Math.pow(1 - (2 * effectiveWoc) / Math.max(effectiveDiameter, 1e-9), 2)));
      if (!Number.isFinite(radialChipThinningFactor) || radialChipThinningFactor <= 0) {
        radialChipThinningFactor = 1;
      }
      if (radialChipThinningFactor > 3) {
        radialChipThinningFactor = 3;
      }
    }
  }

  const engagementReferenceDiameter = calculateEngagementDiameter(
    diameter,
    clampPositive(tool.leadangle, 90),
    effectiveDoc
  );
  const slotIptFactor = clampPositive(tool.slot_ipt_factor, 1);
  const slotSfmFactor = clampPositive(tool.slot_sfm_factor, 1);
  const toolChiploadBase = interpolateChipload(tool, tool.type === 'chamfermill' ? engagementReferenceDiameter : diameter);
  const toolChipload =
    isMillingStyleTool(tool)
      ? toolChiploadBase *
        lerpClamped(idealSideWoc || effectiveDiameter, engagementReferenceDiameter || effectiveDiameter, 1, slotIptFactor, effectiveWoc)
      : toolChiploadBase;

  let sfmMultiplier = 1;
  if (isMillingStyleTool(tool)) {
    sfmMultiplier *= lerpClamped(idealSideWoc || effectiveDiameter, engagementReferenceDiameter || effectiveDiameter, 1, slotSfmFactor, effectiveWoc);
  }

  const { sfm, sfmHigh } = computeSfm(material, tool, toolMaterial, coating);
  const finalSfmBase = sfm * sfmMultiplier;
  const finalSfmHigh = sfmHigh ? sfmHigh * sfmMultiplier : null;
  const rpmDiameter = tool.type === 'turn' || tool.type === 'groove' ? workDiameter : isMillingStyleTool(tool) ? effectiveDiameter : diameter;
  const rpm = clampPositive((finalSfmBase * RPM_FACTOR) / Math.max(rpmDiameter, 0.001));
  const chipOrIpr = computeChipOrIpr(material, tool, toolMaterial, coating, diameter, helixFactor, toolChipload);

  const idealArea =
    isMillingStyleTool(tool)
      ? clampPositive(idealSideWoc || effectiveDiameter, 0) * clampPositive(idealDoc, 0)
      : clampPositive(idealDoc, 0) * clampPositive(idealSideWoc || effectiveDiameter, 0);
  const materialDocAdjust = getFswizardMaterialDocAdjust(material, fluteCount);
  let slottingLoadAdjust = 1;
  if (slottingMode) {
    if (cornerRadius <= diameter / 2) {
      slottingLoadAdjust *= xYDelta(0, diameter / 2, 1, 0.5, cornerRadius);
    } else {
      slottingLoadAdjust *= xYDelta(diameter / 2, 2 * diameter, 0.5, 1, cornerRadius);
    }
  }
  const loadBudgetArea = idealArea * materialDocAdjust * slottingLoadAdjust;
  const loadFactor = isMillingStyleTool(tool)
    ? getRotaryLoadFactor(material, radialChipThinningFactor, loadBudgetArea, effectiveDoc, effectiveWoc)
    : 1;
  const chipRealThinningFactor =
    isMillingStyleTool(tool) && chipThinningEnabled
      ? radialChipThinningFactor * axialChipThinningFactor
      : 1;

  const adjustedChipOrIpr = isMillingStyleTool(tool) ? chipOrIpr * loadFactor * chipRealThinningFactor : chipOrIpr;
  const chipLoadPerTooth = tool.ipr_mode ? adjustedChipOrIpr / fluteCount : adjustedChipOrIpr;
  const ipr = tool.ipr_mode ? adjustedChipOrIpr : chipLoadPerTooth * fluteCount;
  const feedRate = tool.ipr_mode ? rpm * ipr : rpm * chipLoadPerTooth * fluteCount;
  const threadFeed =
    tool.type === 'tap'
      ? rpm * clampPositive(inputs.threadLead, 0)
      : tool.type === 'threadmill'
        ? rpm * chipLoadPerTooth * fluteCount
        : null;

  const rampFactor =
    clampPositive(tool.max_ramp_angle_feed) > 0
      ? tool.max_ramp_angle_feed
      : clampPositive(tool.ramp_angle_feed_factor, 0.4);
  const rampFeed = tool.type === 'endmill' || tool.type === 'chamfermill' || tool.type === 'threadmill'
    ? feedRate * rampFactor
    : null;
  const plungeFeed = tool.type === 'drill' || tool.type === 'ream' ? feedRate * 0.6 : null;

  const slotDoc = clampPositive(tool.slot_doc) > 0 ? diameter * clampPositive(tool.slot_doc) : null;
  const sideDoc = clampPositive(Math.abs(tool.side_doc ?? 0)) > 0 ? diameter * Math.abs(tool.side_doc ?? 0) : null;
  const sideWoc = clampPositive(tool.side_woc) > 0 ? diameter * clampPositive(tool.side_woc) : null;
  const peckDepth = clampPositive(tool.peck) > 0 ? diameter * clampPositive(tool.peck) : null;
  const pilotDiameter = clampPositive(tool.pilot_size) > 0 ? diameter * clampPositive(tool.pilot_size) : null;

  const warnings: string[] = [];
  if (!Number.isFinite(requestedDiameter) || requestedDiameter <= 0) {
    warnings.push('Tool diameter must be greater than zero; the calculator fell back to the tool default diameter.');
  }
  if (!Number.isFinite(requestedFluteCount) || requestedFluteCount < 1) {
    warnings.push('Flute count must be at least 1; the calculator fell back to a minimum valid flute count.');
  }
  if (finalSfmHigh && finalSfmBase > finalSfmHigh) {
    warnings.push('Selected tool/coating multipliers push the recommendation above the material high-SFM range.');
  }
  if (clampPositive(material.hb) >= 360 && !isCarbideLike(toolMaterial)) {
    warnings.push('This material is in a hardened range; carbide-like tooling will usually be safer than HSS for production work.');
  }
  if (tool.type === 'tap' && clampPositive(inputs.threadLead) <= 0) {
    warnings.push('Tap feed needs a thread lead input in inches per revolution.');
  }
  if (tool.type === 'threadmill' && clampPositive(inputs.threadLead) <= 0) {
    warnings.push('Thread lead is optional for thread milling here, but entering it helps compare the result against the thread pitch.');
  }
  if ((tool.type === 'turn' || tool.type === 'groove') && clampPositive(inputs.workDiameter) <= 0) {
    warnings.push('Turning tools need a work diameter to calculate spindle speed accurately.');
  }
  if (slotDoc && clampPositive(inputs.doc) > slotDoc * 1.35) {
    warnings.push('Requested DOC is above the tool default slotting DOC guideline from the FSWizard dataset.');
  }
  if (sideWoc && clampPositive(inputs.woc) > sideWoc * 1.35) {
    warnings.push('Requested WOC is above the tool default side-milling WOC guideline from the FSWizard dataset.');
  }
  if (tool.type === 'endmill' && diameter > 0.125 && chipLoadPerTooth < 0.0001) {
    warnings.push('Chipload is extremely low for this endmill diameter; re-check the selected tool/material stack because the feed may be unrealistically conservative.');
  }
  if (isMillingStyleTool(tool) && enteredDoc > 0 && enteredWoc > 0 && Math.abs(loadFactor - 1) > 0.05) {
    warnings.push('Planned DOC/WOC are actively scaling the programmed feed based on the FSWizard engagement/load model.');
  }
  if (
    (tool.type === 'endmill' ||
      tool.type === 'drill' ||
      tool.type === 'ream' ||
      tool.type === 'threadmill' ||
      tool.type === 'chamfermill' ||
      tool.type === 'cornerrounding') &&
    feedRate < 1
  ) {
    warnings.push('Feed rate is below 1 IPM for a normal rotary tool, which usually indicates either an extreme setup or bad math inputs.');
  }
  if (rpm > 0 && feedRate > 0 && feedRate < 1) {
    warnings.push('RPM is valid but the resulting feed collapsed to an unrealistic value; confirm the selected inputs if this does not match shop expectations.');
  }
  if (chipLoadPerTooth > 0 && round(chipLoadPerTooth, 4) === 0) {
    warnings.push('Chipload is positive but extremely small, so the display precision has been increased to avoid showing a misleading zero.');
  }
  if (tool.usage) {
    warnings.push(tool.usage.replace(/\s+/g, ' ').trim());
  }

  return {
    tool,
    material,
    toolMaterial,
    coating,
    sfm: round(finalSfmBase),
    sfmHigh: finalSfmHigh ? round(finalSfmHigh) : null,
    rpm: round(rpm, 0),
    chipLoadPerTooth: roundChipload(chipLoadPerTooth),
    ipr: roundChipload(ipr),
    feedRate: round(feedRate, 2),
    plungeFeed: plungeFeed ? round(plungeFeed, 2) : null,
    rampFeed: rampFeed ? round(rampFeed, 2) : null,
    slotDoc: slotDoc ? round(slotDoc, 3) : null,
    sideDoc: sideDoc ? round(sideDoc, 3) : null,
    sideWoc: sideWoc ? round(sideWoc, 3) : null,
    peckDepth: peckDepth ? round(peckDepth, 3) : null,
    pilotDiameter: pilotDiameter ? round(pilotDiameter, 3) : null,
    threadFeed: threadFeed ? round(threadFeed, 2) : null,
    torqueRisk: getTorqueRisk(material),
    warnings,
  };
}

export function getToolFamilyLabel(tool: FswizardToolType) {
  const subtype = tool.subtype ? ` - ${tool.subtype}` : '';
  const shortName = tool.short_name ? ` (${tool.short_name})` : '';
  return `${tool.name}${shortName}${subtype}`;
}
