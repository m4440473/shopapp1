import type { FswizardToolType } from './feeds-speeds.types';

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function safePositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getDefaultToolLength(tool: FswizardToolType, diameter: number) {
  if ((tool.tool_len ?? 0) < 0) return Math.abs(tool.tool_len as number);
  if ((tool.tool_len ?? 0) > 0) return diameter * (tool.tool_len as number);
  return diameter;
}

export function getDefaultFluteLength(tool: FswizardToolType, diameter: number) {
  const explicitDefault = Number(tool.default_flute_len);
  if (Number.isFinite(explicitDefault) && explicitDefault !== 0) {
    return Math.abs(explicitDefault);
  }
  if ((tool.flute_len ?? 0) < 0) return Math.abs(tool.flute_len as number);
  if ((tool.flute_len ?? 0) > 0) return diameter * (tool.flute_len as number);
  return diameter;
}

export function getDefaultStickout(tool: FswizardToolType, diameter: number) {
  const explicitDefault = Number(tool.default_len);
  if (Number.isFinite(explicitDefault) && explicitDefault !== 0) {
    return Math.abs(explicitDefault);
  }
  return getDefaultToolLength(tool, diameter);
}

export function getDefaultShankDiameter(tool: FswizardToolType, diameter: number) {
  const shank = Number(tool.shank_dia);
  if (!Number.isFinite(shank) || shank === 0) return diameter;
  return shank < 0 ? Math.abs(shank) : diameter * shank;
}

export function getDefaultCornerRadius(tool: FswizardToolType, diameter: number) {
  const radius = Number(tool.corner_radius);
  if (!Number.isFinite(radius) || radius === 0) return 0;
  if (tool.type === 'turn' || tool.type === 'groove') return Math.abs(radius);
  return diameter * Math.abs(radius);
}

export function getIdealSideWoc(tool: FswizardToolType, diameter: number) {
  const value = Number(tool.side_woc);
  if (!Number.isFinite(value) || value === 0) return 0;
  return value < 0 ? Math.abs(value) : diameter * value;
}

export function getIdealSideDoc(
  tool: FswizardToolType,
  diameter: number,
  fluteLength: number,
  cornerRadius = 0
) {
  const value = Number(tool.side_doc);
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return Math.abs(value);
  if (value === 0) return fluteLength;
  if (tool.type === 'cornerrounding') return cornerRadius * value;
  if (tool.type === 'chamfermill' && tool.subtype !== 'vbit') return fluteLength * value;
  return diameter * value;
}

export function getIdealSlotDoc(
  tool: FswizardToolType,
  diameter: number,
  cornerRadius = 0
) {
  const value = Number(tool.slot_doc);
  if (!Number.isFinite(value) || value === 0) return 0;
  if (value < 0) return Math.abs(value);
  if (tool.type === 'cornerrounding') return cornerRadius * value;
  return diameter * value;
}

export function getEffectiveDiameter(diameter: number, leadAngle: number, doc: number) {
  return leadAngle > 0
    ? diameter + Math.tan(degreesToRadians(90 - leadAngle)) * doc * 2
    : diameter;
}

export function getEffectiveDiameterMin(
  diameter: number,
  leadAngle: number,
  doc: number,
  woc: number
) {
  return Math.max(diameter, getEffectiveDiameter(diameter, leadAngle, doc) - 2 * woc);
}

export function getFeedmillMaxFluteLength(diameter: number, leadAngle: number) {
  return leadAngle > 0 && leadAngle < 90
    ? (diameter / 2) * Math.tan(degreesToRadians(leadAngle))
    : 9999;
}

export function getChordHeight(radius: number, chord: number) {
  return radius - Math.sqrt(Math.max(0, radius ** 2 - (chord / 2) ** 2));
}

export function calculateCornerRoundingEffectiveDiameter(
  diameter: number,
  cornerRadius: number,
  doc: number
) {
  const maximumDiameter = diameter + 2 * cornerRadius;
  if (doc < cornerRadius) {
    return Math.max(
      maximumDiameter - 2 * Math.sqrt(Math.max(0, cornerRadius ** 2 - doc ** 2)),
      diameter
    );
  }
  return maximumDiameter;
}

export function calculateEndmillEffectiveDiameter(options: {
  subtype?: string;
  diameter: number;
  cornerRadius: number;
  leadAngle: number;
  doc: number;
  fluteLength: number;
}) {
  const { subtype, diameter, cornerRadius, leadAngle, doc, fluteLength } = options;

  if (doc < cornerRadius) {
    if (subtype === 'lensmill') {
      return Math.min(
        2 * Math.sqrt(Math.max(0, cornerRadius ** 2 - (cornerRadius - doc) ** 2)),
        diameter
      );
    }
    return Math.min(
      diameter -
        2 * cornerRadius +
        2 * Math.sqrt(Math.max(0, cornerRadius ** 2 - (cornerRadius - doc) ** 2)),
      diameter
    );
  }

  if (leadAngle > 0) {
    return subtype === 'feedmill'
      ? diameter -
          Math.tan(degreesToRadians(90 - leadAngle)) *
            Math.max(0, fluteLength - doc) *
            2
      : diameter + Math.tan(degreesToRadians(90 - leadAngle)) * doc * 2;
  }

  return diameter;
}

export function calculateEffectiveCuttingDiameter(options: {
  tool: FswizardToolType;
  diameter: number;
  cornerRadius: number;
  leadAngle: number;
  doc: number;
  fluteLength: number;
}) {
  const { tool, diameter, cornerRadius, leadAngle, doc, fluteLength } = options;
  if (tool.type === 'turn' && tool.subtype === 'profile') return diameter + 2 * doc;
  if (tool.type === 'chamfermill') {
    return diameter + Math.tan(degreesToRadians(90 - leadAngle)) * doc * 2;
  }
  if (tool.type === 'cornerrounding') {
    return calculateCornerRoundingEffectiveDiameter(diameter, cornerRadius, doc);
  }
  if (tool.type === 'endmill') {
    return calculateEndmillEffectiveDiameter({
      subtype: tool.subtype,
      diameter,
      cornerRadius,
      leadAngle,
      doc,
      fluteLength,
    });
  }
  return diameter;
}

function cornerX(radius: number, value: number) {
  return Math.sqrt(Math.max(0, radius ** 2 - value ** 2));
}

function cornerIntegral(radius: number, value: number) {
  const ratio = Math.min(1, Math.max(-1, value / radius));
  return 0.5 * (
    value * Math.sqrt(Math.max(0, radius ** 2 - value ** 2)) +
    radius ** 2 * Math.asin(ratio)
  );
}

export function cornerRoundingArea(radius: number, woc: number, doc: number) {
  if (!(radius > 0) || woc < 0 || woc > radius || doc < 0 || doc > radius) return 0;
  const start = cornerX(radius, doc);
  return woc <= start
    ? 0
    : doc * (woc - start) - (cornerIntegral(radius, woc) - cornerIntegral(radius, start));
}

function bisect(
  fn: (value: number) => number,
  low: number,
  high: number,
  tolerance = 1e-9
) {
  let lowValue = fn(low);
  let highValue = fn(high);
  if (lowValue === 0) return low;
  if (highValue === 0) return high;

  if (Math.sign(lowValue) === Math.sign(highValue)) {
    for (let step = 1; step <= 200; step += 1) {
      const candidate = low + ((high - low) * step) / 200;
      const candidateValue = fn(candidate);
      if (candidateValue === 0) return candidate;
      if (Math.sign(candidateValue) !== Math.sign(lowValue)) {
        high = candidate;
        highValue = candidateValue;
        break;
      }
      low = candidate;
      lowValue = candidateValue;
    }
  }

  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = 0.5 * (low + high);
    const middleValue = fn(middle);
    if (Math.abs(middleValue) < tolerance || Math.abs(high - low) < tolerance) return middle;
    if (Math.sign(middleValue) === Math.sign(lowValue)) {
      low = middle;
      lowValue = middleValue;
    } else {
      high = middle;
      highValue = middleValue;
    }
  }

  return 0.5 * (low + high);
}

export function cornerRoundingDocForWoc(
  radius: number,
  woc: number,
  targetArea = 0.05
) {
  if (!(radius > 0) || woc < 0 || woc > radius || targetArea < 0) return 0;
  const low = Math.min(radius, cornerX(radius, woc) + 1e-12);
  const high = radius;
  const maximumArea = cornerRoundingArea(radius, woc, high);
  if (targetArea <= 0) return low;
  if (targetArea >= maximumArea) return high;
  return bisect((doc) => cornerRoundingArea(radius, woc, doc) - targetArea, low, high);
}

export function cornerRoundingWocForDoc(
  radius: number,
  doc: number,
  targetArea = 0.05
) {
  if (!(radius > 0) || doc < 0 || doc > radius || targetArea < 0) return 0;
  const low = Math.min(radius, cornerX(radius, doc) + 1e-12);
  const high = radius;
  const maximumArea = cornerRoundingArea(radius, high, doc);
  if (targetArea <= 0) return low;
  if (targetArea >= maximumArea) return high;
  return bisect((woc) => cornerRoundingArea(radius, woc, doc) - targetArea, low, high);
}

function pointLoadDeflection(force: number, length: number, elasticModulus: number, inertia: number) {
  return (force * length ** 3) / (3 * elasticModulus * inertia);
}

function pointLoadRotation(force: number, length: number, elasticModulus: number, inertia: number) {
  return (force * length ** 2) / (2 * elasticModulus * inertia);
}

function momentRotation(moment: number, length: number, elasticModulus: number, inertia: number) {
  return (moment * length) / (elasticModulus * inertia);
}

function momentDeflection(moment: number, length: number, elasticModulus: number, inertia: number) {
  return (moment * length ** 2) / (2 * elasticModulus * inertia);
}

export function calculateMillingDeflection(options: {
  stickout: number;
  fluteLength: number;
  cuttingLength: number;
  shankDiameter: number;
  fluteCount: number;
  leadAngle: number;
  diameter: number;
  cuttingDiameter: number;
  radialWoc: number;
  forcePerLength: number;
  rigidity: number;
}) {
  const {
    stickout,
    fluteLength,
    cuttingLength,
    shankDiameter,
    fluteCount,
    leadAngle,
    diameter,
    cuttingDiameter,
    radialWoc,
    forcePerLength,
  } = options;
  const rigidity = safePositive(options.rigidity, 30_000_000);
  const averageCuttingDiameter =
    (diameter +
      fluteLength * Math.tan(degreesToRadians(90 - leadAngle)) * 2 +
      diameter) /
    2;
  const averageShankDiameter = shankDiameter;
  const fluteSegment = fluteLength;
  const transitionSegment = Math.max(0, cuttingLength - fluteLength);
  const shankSegment = Math.max(0, stickout - cuttingLength);
  const force = forcePerLength * (transitionSegment + fluteSegment);
  const fluteForce = forcePerLength * fluteSegment;
  const fluteInertia = (Math.PI * (0.8 * averageCuttingDiameter) ** 4) / 64;
  const transitionInertia = (Math.PI * averageShankDiameter ** 4) / 64;
  const shankInertia = (Math.PI * cuttingDiameter ** 4) / 64;
  const angledForce = forcePerLength * Math.sin(degreesToRadians(leadAngle));
  const shankPoint = pointLoadDeflection(angledForce, shankSegment, rigidity, shankInertia);
  const shankMoment = momentDeflection(force, shankSegment, rigidity, shankInertia);
  const fluteDistributed = (() => {
    const remaining = fluteLength - radialWoc;
    return (
      (angledForce / Math.max(radialWoc, 1e-9)) *
      (3 * fluteLength ** 4 -
        4 * remaining ** 3 * fluteLength +
        remaining ** 4) /
      (24 * rigidity * Math.max(fluteInertia, 1e-12))
    );
  })();

  return (
    shankPoint +
    shankMoment +
    fluteDistributed +
    pointLoadRotation(angledForce, shankSegment, rigidity, shankInertia) *
      (transitionSegment + fluteSegment) +
    momentRotation(force, shankSegment, rigidity, shankInertia) *
      (transitionSegment + fluteSegment) +
    pointLoadDeflection(angledForce, transitionSegment, rigidity, transitionInertia) +
    momentDeflection(fluteForce, transitionSegment, rigidity, transitionInertia) +
    pointLoadRotation(angledForce, transitionSegment, rigidity, transitionInertia) *
      fluteSegment +
    momentRotation(fluteForce, transitionSegment, rigidity, transitionInertia) *
      fluteSegment
  );
}

export function calculateTurningDeflection(options: {
  stickout: number;
  shankWidth: number;
  shankHeight: number;
  force: number;
  rigidity: number;
}) {
  const inertia = (options.shankWidth * options.shankHeight ** 3) / 12;
  return (
    (options.force * options.stickout ** 3) /
    (3 * safePositive(options.rigidity, 30_000_000) * Math.max(inertia, 1e-12))
  );
}
