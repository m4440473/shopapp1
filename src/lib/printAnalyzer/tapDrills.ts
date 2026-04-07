import type { PrintAnalyzerResult } from './schema';
import { normalizeThreadText, parseFiniteNumber } from './normalize';

const DRILL_DECIMAL_INCHES: Record<string, number> = {
  '#43': 0.089,
  '#36': 0.1065,
  '#29': 0.136,
  '#25': 0.1495,
  '#21': 0.159,
  '#7': 0.201,
  '#3': 0.213,
  F: 0.257,
  I: 0.272,
  Q: 0.332,
  U: 0.368,
};

const IMPERIAL_TAP_DRILLS: Record<string, { drill: string; diameter?: number }> = {
  '4-40': { drill: '#43', diameter: DRILL_DECIMAL_INCHES['#43'] },
  '6-32': { drill: '#36', diameter: DRILL_DECIMAL_INCHES['#36'] },
  '8-32': { drill: '#29', diameter: DRILL_DECIMAL_INCHES['#29'] },
  '10-24': { drill: '#25', diameter: DRILL_DECIMAL_INCHES['#25'] },
  '10-32': { drill: '#21', diameter: DRILL_DECIMAL_INCHES['#21'] },
  '1/4-20': { drill: '#7', diameter: DRILL_DECIMAL_INCHES['#7'] },
  '1/4-28': { drill: '#3', diameter: DRILL_DECIMAL_INCHES['#3'] },
  '5/16-18': { drill: 'F', diameter: DRILL_DECIMAL_INCHES.F },
  '5/16-24': { drill: 'I', diameter: DRILL_DECIMAL_INCHES.I },
  '3/8-16': { drill: '5/16', diameter: 0.3125 },
  '3/8-24': { drill: 'Q', diameter: DRILL_DECIMAL_INCHES.Q },
  '7/16-14': { drill: 'U', diameter: DRILL_DECIMAL_INCHES.U },
  '1/2-13': { drill: '27/64', diameter: 0.421875 },
};

const METRIC_TAP_DRILLS: Record<string, { drill: string; diameter?: number }> = {
  'M3X0.5': { drill: '2.5mm', diameter: 2.5 },
  'M4X0.7': { drill: '3.3mm', diameter: 3.3 },
  'M5X0.8': { drill: '4.2mm', diameter: 4.2 },
  'M6X1.0': { drill: '5.0mm', diameter: 5.0 },
  'M8X1.25': { drill: '6.8mm', diameter: 6.8 },
  'M10X1.5': { drill: '8.5mm', diameter: 8.5 },
  'M12X1.75': { drill: '10.2mm', diameter: 10.2 },
};

const METRIC_PITCH_FORMAT: Record<string, string> = {
  '0.5': '0.5',
  '0.7': '0.7',
  '0.8': '0.8',
  '1': '1.0',
  '1.25': '1.25',
  '1.5': '1.5',
  '1.75': '1.75',
};

export function normalizeThreadKey(thread: string): string {
  const normalized = normalizeThreadText(thread)
    .replace(/\b(UNC|UNF|UNEF|UNS|CLASS\s*[0-9A-Z]+|-?2A|-?2B|-?3A|-?3B|6H|6G|LH|RH)\b/g, ' ')
    .replace(/[×]/g, 'X')
    .replace(/\s*X\s*/g, 'X')
    .replace(/\s+/g, ' ')
    .trim();

  const metric = normalized.match(/M\s*(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)/);
  if (metric) {
    const major = parseFiniteNumber(metric[1]);
    const pitch = parseFiniteNumber(metric[2]);
    if (major !== undefined && pitch !== undefined) {
      const majorLabel = Number.isInteger(major) ? String(major) : String(major);
      const pitchBase = String(pitch).replace(/0+$/, '').replace(/\.$/, '');
      const pitchLabel = METRIC_PITCH_FORMAT[pitchBase] ?? pitchBase;
      return `M${majorLabel}X${pitchLabel}`;
    }
  }

  const imperial = normalized.match(/(\d+\/\d+|\d+)-\s*(\d+)/);
  if (imperial) return `${imperial[1]}-${imperial[2]}`;

  return normalized.replace(/\s+/g, '');
}

export function attachTapDrills(result: PrintAnalyzerResult): PrintAnalyzerResult {
  return {
    ...result,
    tappedHoles: result.tappedHoles.map((tap) => {
      const key = normalizeThreadKey(tap.thread);
      const imperial = IMPERIAL_TAP_DRILLS[key];
      if (imperial) {
        return {
          ...tap,
          recommendedTapDrill: {
            drill: imperial.drill,
            diameter: imperial.diameter,
            basis: 'common chart',
          },
        };
      }

      const metric = METRIC_TAP_DRILLS[key];
      if (metric) {
        return {
          ...tap,
          recommendedTapDrill: {
            drill: metric.drill,
            diameter: metric.diameter,
            basis: 'common metric tap-drill',
          },
        };
      }

      return tap;
    }),
  };
}
