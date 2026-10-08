import { describe, expect, it } from 'vitest';
import { groupProcurementParts } from '../procurement.service';
import type { ProcurementPartRow } from '../procurement.types';

function row(id: string, orderId: string, overrides: Partial<ProcurementPartRow> = {}): ProcurementPartRow {
  return {
    id, orderId, orderNumber: orderId.toUpperCase(), customerId: 'customer-1',
    dueDate: '2026-08-01T00:00:00.000Z', partNumber: id.toUpperCase(), quantity: 1,
    materialStatus: 'NEED_TO_ORDER', materialName: '4140 CR Rnd', drawingMaterialText: '4140 CR Rnd',
    stockSize: '2 x 2 x 14.125', cutLength: '14.125', finalPartLength: '14',
    partWidth: '2', partThickness: '2', ...overrides,
  };
}

describe('groupProcurementParts', () => {
  it('groups exact known round stock across orders and totals finished and cut lengths once', () => {
    const result = groupProcurementParts([
      row('a', 'order-a', { finalPartLength: '14', cutLength: '14.125', stockSize: '2 × 2 × 14.125' }),
      row('b', 'order-b', { finalPartLength: '27', cutLength: '27.125', stockSize: '2 × 2 × 27.125' }),
      row('c', 'order-c', { finalPartLength: '8', cutLength: '8.125', stockSize: '2 × 2 × 8.125' }),
    ]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({ status: 'compatible', orderCount: 3, partCount: 3, quantity: 3, totalFinishedLength: 49, totalCutLength: 49.375 });
  });

  it('reads all eligible rows beyond an old 25-row boundary', () => {
    const rows = Array.from({ length: 30 }, (_, index) => row(`p-${index}`, `order-${index}`));
    const result = groupProcurementParts(rows);
    expect(result.eligibleParts).toBe(30);
    expect(result.groups[0]).toMatchObject({ orderCount: 30, partCount: 30 });
  });

  it('requires distinct orders and keeps duplicate same-order parts ungrouped', () => {
    const result = groupProcurementParts([row('a', 'one'), row('b', 'one')]);
    expect(result.groups).toHaveLength(0);
    expect(result.ungrouped).toHaveLength(2);
  });

  it('normalizes fractions and metric equivalents to canonical inches', () => {
    const result = groupProcurementParts([
      row('a', 'one', { partWidth: '1/4 in', partThickness: '6.35 mm', stockSize: null, cutLength: '1', finalPartLength: '7/8' }),
      row('b', 'two', { partWidth: '.25', partThickness: '0.250', stockSize: null, cutLength: '1', finalPartLength: '.875' }),
    ]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].stock).toContain('1/4 in');
  });

  it('keeps generic equal dimensions out of explicit round compatibility', () => {
    const result = groupProcurementParts([
      row('round', 'one'),
      row('generic-a', 'two', { materialName: '4140', drawingMaterialText: '4140', partWidth: '2', partThickness: '2' }),
      row('generic-b', 'three', { materialName: '4140', drawingMaterialText: '4140', partWidth: '2', partThickness: '2' }),
    ]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({ status: 'needs_review', orderCount: 2 });
    expect(result.groups[0].reasons).toContain('Stock profile is not explicitly identified');
  });

  it('does not combine different grades or supplied conditions', () => {
    const result = groupProcurementParts([
      row('1018', 'one', { materialName: '1018 CRS', drawingMaterialText: '1018 CR Rnd' }),
      row('4140', 'two'),
      row('4140-hr', 'three', { materialName: '4140 HRS', drawingMaterialText: '4140 HR Rnd' }),
    ]);
    expect(result.groups).toHaveLength(0);
  });

  it('flags reused total stock length conflicts instead of multiplying it again', () => {
    const result = groupProcurementParts([
      row('dom-a', 'one', { quantity: 100, materialName: 'DOM Tube', drawingMaterialText: 'DOM Tube', stockSize: '0.25 × 2.500 × 128.1', cutLength: '1.281', finalPartLength: '1.156', partWidth: '2.5', partThickness: '.25' }),
      row('dom-b', 'two', { quantity: 50, materialName: 'DOM Tube', drawingMaterialText: 'DOM tubing', stockSize: '0.25 × 2.500 × 128.1', cutLength: '1.281', finalPartLength: null, partWidth: '2.5', partThickness: '.25' }),
    ]);
    expect(result.groups[0]).toMatchObject({ status: 'needs_review', totalCutLength: null });
    expect(result.groups[0].members[0].totalCutLength).toBe(128.1);
    expect(result.groups[0].members[1].totalCutLength).toBeNull();
    expect(result.groups[0].members[1].reasons).toContain('Stock total conflicts with cut length and quantity');
  });

  it('rejects invalid tube geometry and counts unreviewed rows separately', () => {
    const result = groupProcurementParts([
      row('bad', 'one', { materialName: 'DOM Tube', drawingMaterialText: 'DOM Tube', partWidth: '1', partThickness: '.6' }),
      row('unreviewed', 'two', { materialStatus: 'UNREVIEWED' }),
    ]);
    expect(result).toMatchObject({ eligibleParts: 1, eligibleOrders: 1, unreviewedParts: 1 });
    expect(result.groups).toHaveLength(0);
    expect(result.ungrouped[0].reason).toContain('Tube dimensions are missing, invalid, or conflicting');
  });

  it('parses fractional rectangular-tube geometry without treating the denominator as wall', () => {
    const result = groupProcurementParts([
      row('tube-a', 'one', { materialName: '1018 5 x 3 x 3/8 rectangular tube', drawingMaterialText: '1018 5 x 3 x 3/8 rectangular tube', partWidth: '5', partThickness: '.375' }),
      row('tube-b', 'two', { materialName: '1018 5 × 3 × 0.375 rectangular tubing', drawingMaterialText: '1018 5 × 3 × 0.375 rectangular tubing', partWidth: '5', partThickness: '.375' }),
    ]);
    expect(result.groups[0].stock).toContain('wall 3/8 in');
  });

  it('excludes terminal part rows', () => {
    expect(groupProcurementParts([row('done', 'one', { partStatus: 'COMPLETE' })]).eligibleParts).toBe(0);
  });

  it('does not treat a generic bar label as an explicit flat-bar profile', () => {
    const result = groupProcurementParts([
      row('bar-a', 'one', { materialName: '4140 bar', drawingMaterialText: '4140 bar', partWidth: '2', partThickness: '.5' }),
      row('bar-b', 'two', { materialName: '4140 bar', drawingMaterialText: '4140 bar', partWidth: '2', partThickness: '.5' }),
    ]);
    expect(result.groups[0]).toMatchObject({ status: 'needs_review' });
    expect(result.groups[0].stock).not.toContain('flat bar');
  });

  it('keeps explicitly round tubing separate from solid round stock', () => {
    const result = groupProcurementParts([
      row('tube-a', 'one', { materialName: '1018 CR round tube 2 OD .25 wall', drawingMaterialText: '1018 CR round tube 2 OD .25 wall', partWidth: '2', partThickness: '.25' }),
      row('solid', 'two', { materialName: '1018 CR round', drawingMaterialText: '1018 CR round', partWidth: '2', partThickness: '2' }),
    ]);
    expect(result.groups).toHaveLength(0);
  });

  it('does not merge different tempers, hardnesses, or tubing specifications', () => {
    const variants = ['6061 T4 CR Rnd', '6061 T5 CR Rnd', '6061 T6 CR Rnd', '6061 T651 CR Rnd', '4140 CR Rnd 28-34 HRC', '4140 CR Rnd 30-34 HRC', '4140 CR annealed Rnd', '4140 HR annealed Rnd', '1018 CR Rnd A513', '1018 CR Rnd A519'];
    const result = groupProcurementParts(variants.map((material, index) => row(`v${index}`, `o${index}`, { materialName: material, drawingMaterialText: material })));
    expect(result.groups).toHaveLength(0);
  });

  it('groups equivalent round-tube geometry whether ID is supplied or derived', () => {
    const result = groupProcurementParts([
      row('tube-id', 'one', { materialName: '1018 CR round tube 2 OD 1.5 ID .25 wall', drawingMaterialText: '1018 CR round tube 2 OD 1.5 ID .25 wall', partWidth: '2', partThickness: '.25' }),
      row('tube-derived', 'two', { materialName: '1018 CR round tube 2 OD .25 wall', drawingMaterialText: '1018 CR round tube 2 OD .25 wall', partWidth: '2', partThickness: '.25' }),
    ]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].stock).toContain('id 1 1/2 in');
  });

  it('rejects zero-denominator, negative, zero, and non-finite dimensions', () => {
    const invalid = ['1/0', '-1', '0', 'Infinity'];
    const result = groupProcurementParts(invalid.map((dimension, index) => row(`bad-${index}`, `order-${index}`, {
      partWidth: dimension, partThickness: dimension, stockSize: null,
    })));
    expect(result.groups).toHaveLength(0);
    expect(result.ungrouped).toHaveLength(invalid.length);
    expect(result.ungrouped.every(part => part.reason.includes('Cross-section dimensions are incomplete'))).toBe(true);
  });

  it('withholds an invalid cut total when cut length is shorter than finished length', () => {
    const result = groupProcurementParts([
      row('bad-a', 'one', { cutLength: '3', finalPartLength: '4', stockSize: null }),
      row('bad-b', 'two', { cutLength: '3', finalPartLength: '4', stockSize: null }),
    ]);
    expect(result.groups[0].totalCutLength).toBeNull();
    expect(result.groups[0].members[0].reasons).toContain('Cut length is shorter than finished length');
  });

  it('excludes terminal unreviewed parts and terminal-order rows from all counts', () => {
    const result = groupProcurementParts([
      row('unreviewed-done', 'one', { materialStatus: 'UNREVIEWED', partStatus: 'COMPLETE' }),
      row('closed-order', 'two', { orderStatus: 'CLOSED' }),
    ]);
    expect(result).toMatchObject({ eligibleParts: 0, eligibleOrders: 0, unreviewedParts: 0 });
  });

  it('applies overdue, customer, material, and explicit vendor filters only when supplied', () => {
    const rows = [
      row('a', 'one', { customerId: 'a', procurementVendorId: null, dueDate: '2026-01-01', materialName: '1018 CRS', drawingMaterialText: '1018 CR Rnd' }),
      row('b', 'two', { customerId: 'a', procurementVendorId: 'alro', dueDate: '2026-01-02', materialName: '1018 CRS', drawingMaterialText: '1018 CR Rnd' }),
      row('c', 'three', { customerId: 'b', procurementVendorId: 'alro', dueDate: '2027-01-01' }),
    ];
    expect(groupProcurementParts(rows, { customerId: 'a', material: '1018', overdue: true, asOf: new Date('2026-06-01') }).eligibleParts).toBe(2);
    expect(groupProcurementParts(rows, { vendorId: 'alro' }).eligibleParts).toBe(2);
  });
});
