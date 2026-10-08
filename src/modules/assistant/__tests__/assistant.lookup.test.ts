import { describe, expect, it } from 'vitest';
import { compactResult, directLookup } from '../assistant.lookup';

describe('deterministic shop lookup intent', () => {
  it('routes the original Alro question and clarification to grouping without supplier filters', () => {
    for (const message of [
      'Are there any orders with similar stock dimensions that need ordering? That way I combine my orders from Alro',
      'I mean are there any parts across different orders that have similar stock dimensions and material? That way I can place one big order from my supplier',
    ]) expect(directLookup(message)).toEqual({ name: 'find_procurement_groups', args: {} });
  });
  it('filters vendor only with explicit assignment language', () => {
    expect(directLookup('Group similar stock across orders assigned to Alro.')).toEqual({ name: 'find_procurement_groups', args: { vendor: 'Alro' } });
    expect(directLookup('Group similar stock assigned to Alro across orders.')).toEqual({ name: 'find_procurement_groups', args: { vendor: 'Alro' } });
    expect(directLookup('Can I combine DOM stock purchases from Alro across orders?')).toEqual({ name: 'find_procurement_groups', args: { material: 'DOM' } });
  });
  it('preserves group filters for followups and resets on show all', () => {
    const context = { name: 'find_procurement_groups' as const, args: { material: 'DOM' } };
    expect(directLookup('Only the overdue ones.', context)?.args).toEqual({ material: 'DOM', overdue: true });
    expect(directLookup('Show the 4140 groups.', context)?.args).toEqual({ material: '4140' });
    expect(directLookup('Show all groups again.', context)?.args).toEqual({});
  });
  it('routes common requests from the owner without a model roundtrip', () => {
    expect(directLookup('Which orders need parts or material ordered?')?.args).toEqual({ mode: 'procurement' });
    expect(directLookup('How many customers do I have that have quotes but haven’t converted to orders?')?.args).toEqual({ mode: 'quotes', conversion: 'unconverted' });
    expect(directLookup('Find me the drawings for part number pj1407.')?.args).toEqual({ mode: 'files', partNumber: 'pj1407' });
    expect(directLookup('Find the 4140 parts that were hardened.')?.args).toEqual({ mode: 'orders', material: '4140', finish: 'harden' });
  });
  it('leaves conversation, mutations and unsupported filters to the conversational path', () => {
    for (const message of ['How should I organize my workday?', 'Order these similar stock parts from Alro', 'Find similar stock across orders before 2020', 'Find similar stock across orders only for Jones', 'Find the latest drawing for part number pj1407', 'Show orders with similar 2 inch stock']) expect(directLookup(message)).toBeUndefined();
  });
  it('sends a small evidence subset rather than raw UI records or notes', () => {
    const full = { summary: '27 parts across 21 orders', total: 27, offset: 0, sources: [], rows: Array.from({ length: 25 }, (_, i) => ({ id: `p${i}`, order: `CRM-${i}`, partNumber: 'PART', notes: 'private note '.repeat(100), stockSize: '1 x 2 x 30', partQuantity: 12 })) };
    const compact = compactResult(full);
    expect(compact).not.toContain('private note'); expect(compact).not.toContain('stockSize');
    expect(JSON.parse(compact).rows).toHaveLength(5); expect(JSON.parse(compact).total).toBe(27);
    expect(full.rows).toHaveLength(25);
  });
});
