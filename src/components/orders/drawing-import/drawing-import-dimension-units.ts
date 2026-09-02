import { parseInchMeasurement } from '@/modules/drawing-import/drawing-import.materials';

export type DrawingDimensionUnit = 'in' | 'mm';

function format(value: number) {
  return String(Number(value.toFixed(9)));
}

/** Stored review/save measurements remain inches; toggling never rewrites them. */
export function displayDrawingDimension(value: string | null, unit: DrawingDimensionUnit): string {
  if (!value || unit === 'in') return value ?? '';
  const inches = parseInchMeasurement(value);
  return inches === null ? value : format(inches * 25.4);
}

/** Explicit suffix wins over the selected unit; unknown/malformed values stay unresolved. */
export function parseDrawingDimensionInput(value: string, unit: DrawingDimensionUnit): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const metric = /\s*mm$/i.test(raw);
  const imperial = /(?:["″]|\bin(?:ch(?:es)?)?\.?)$/i.test(raw);
  const number = parseInchMeasurement(metric ? raw.replace(/\s*mm$/i, '') : raw);
  if (number === null || number < 0) return null;
  const inches = metric || (!imperial && unit === 'mm') ? number / 25.4 : number;
  return format(inches);
}
