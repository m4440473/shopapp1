import { describe, expect, it } from 'vitest';

import type { AssemblyGraphEdge, AssemblyGraphNode } from '../bom.types';
import { calculateAssemblyQuantities } from '../quantity-graph';

const nodes = (...ids: string[]): AssemblyGraphNode[] => ids.map((id) => ({ id, pageId: `page-${id}`, partNumber: id }));

function edge(id: string, parentNodeId: string, childNodeId: string | null, quantityPerParent: number | null, fingerprint = id): AssemblyGraphEdge {
  return {
    id,
    bomRowId: `row-${id}`,
    parentNodeId,
    childNodeId,
    quantityPerParent,
    sourcePageId: `bom-${parentNodeId}`,
    sourceRegion: [0.1, 0.1, 0.9, 0.2],
    sourceFingerprint: fingerprint,
  };
}

function quantities(result: ReturnType<typeof calculateAssemblyQuantities>) {
  return Object.fromEntries(result.resolutions.map((resolution) => [resolution.nodeId, resolution.quantity.value]));
}

describe('assembly quantity graph', () => {
  it('applies the root multiplier once through nested assemblies', () => {
    const result = calculateAssemblyQuantities({
      mode: 'ASSEMBLY',
      nodes: nodes('A', 'B', 'C'),
      roots: [{ nodeId: 'A', quantity: 2 }],
      edges: [edge('ab', 'A', 'B', 3), edge('bc', 'B', 'C', 4)],
    });
    expect(result.valid).toBe(true);
    expect(quantities(result)).toEqual({ A: 2, B: 6, C: 24 });
    expect(result.resolutions.find((entry) => entry.nodeId === 'C')?.quantity.status).toBe('derived_from_bom');
  });

  it('sums repeated children across multiple valid paths and roots', () => {
    const result = calculateAssemblyQuantities({
      mode: 'ASSEMBLY',
      nodes: nodes('A', 'X', 'B', 'C', 'D'),
      roots: [{ nodeId: 'A', quantity: 1 }, { nodeId: 'X', quantity: 4 }],
      edges: [
        edge('ab', 'A', 'B', 2),
        edge('ac', 'A', 'C', 3),
        edge('bd', 'B', 'D', 5),
        edge('cd', 'C', 'D', 7),
        edge('xd', 'X', 'D', 2),
      ],
    });
    expect(quantities(result).D).toBe(39);
    expect(result.resolutions.find((entry) => entry.nodeId === 'D')?.contributions).toEqual([
      { rootNodeId: 'A', quantity: 31 },
      { rootNodeId: 'X', quantity: 8 },
    ]);
  });

  it('suppresses exact source-row duplicates but preserves legitimate repeated rows', () => {
    const result = calculateAssemblyQuantities({
      mode: 'ASSEMBLY',
      nodes: nodes('A', 'B'),
      roots: [{ nodeId: 'A', quantity: 1 }],
      edges: [
        edge('row-1', 'A', 'B', 2, 'page:region:row-1'),
        edge('row-1-repeat-parse', 'A', 'B', 2, 'page:region:row-1'),
        edge('row-2', 'A', 'B', 3, 'page:region:row-2'),
      ],
    });
    expect(quantities(result).B).toBe(5);
    expect(result.duplicateEdgeIds).toEqual(['row-1-repeat-parse']);
  });

  it('keeps missing children and invalid quantities explicit', () => {
    const result = calculateAssemblyQuantities({
      mode: 'ASSEMBLY',
      nodes: nodes('A'),
      roots: [{ nodeId: 'A', quantity: 1 }],
      edges: [edge('missing', 'A', null, 2), edge('invalid', 'A', 'A', 0)],
    });
    expect(result.valid).toBe(false);
    expect(result.missingChildEdgeIds).toEqual(['missing']);
    expect(result.invalidEdgeIds).toEqual(['invalid']);
  });

  it('detects cycles and keeps affected quantities unresolved', () => {
    const result = calculateAssemblyQuantities({
      mode: 'ASSEMBLY',
      nodes: nodes('A', 'B', 'C'),
      roots: [{ nodeId: 'A', quantity: 1 }],
      edges: [edge('ab', 'A', 'B', 2), edge('ba', 'B', 'A', 3), edge('bc', 'B', 'C', 4)],
    });
    expect(result.valid).toBe(false);
    expect(result.cycles).toHaveLength(1);
    expect(quantities(result)).toEqual({ A: null, B: null, C: null });
  });

  it('does not let a disconnected cycle erase quantities for an unrelated requested root', () => {
    const result = calculateAssemblyQuantities({
      mode: 'ASSEMBLY',
      nodes: nodes('A', 'B', 'X', 'Y'),
      roots: [{ nodeId: 'A', quantity: 2 }],
      edges: [edge('ab', 'A', 'B', 3), edge('xy', 'X', 'Y', 2), edge('yx', 'Y', 'X', 2)],
    });
    expect(result.valid).toBe(false);
    expect(quantities(result)).toEqual({ A: 2, B: 6, X: null, Y: null });
  });

  it('marks overflow and descendants unresolved', () => {
    const result = calculateAssemblyQuantities({
      mode: 'ASSEMBLY',
      nodes: nodes('A', 'B', 'C'),
      roots: [{ nodeId: 'A', quantity: Number.MAX_SAFE_INTEGER }],
      edges: [edge('ab', 'A', 'B', 2), edge('bc', 'B', 'C', 2)],
    });
    expect(result.valid).toBe(false);
    expect(result.overflowNodeIds).toEqual(['B', 'C']);
    expect(quantities(result)).toEqual({ A: Number.MAX_SAFE_INTEGER, B: null, C: null });
  });

  it('uses a human correction as the effective assembly quantity with provenance', () => {
    const result = calculateAssemblyQuantities({
      mode: 'ASSEMBLY',
      nodes: nodes('A', 'B', 'C'),
      roots: [{ nodeId: 'A', quantity: 2 }],
      edges: [edge('ab', 'A', 'B', 3), edge('bc', 'B', 'C', 4)],
      humanOverrides: [{ nodeId: 'B', quantity: 5 }],
    });
    expect(quantities(result)).toEqual({ A: 2, B: 5, C: 20 });
    expect(result.resolutions.find((entry) => entry.nodeId === 'B')?.quantity).toMatchObject({
      status: 'human_corrected',
      evidence: [{ sourceType: 'human' }],
    });
  });

  it('preserves one-off reviewed quantity and ignores assembly edges', () => {
    const result = calculateAssemblyQuantities({
      mode: 'ONE_OFF',
      nodes: nodes('A', 'B'),
      edges: [edge('ab', 'A', 'B', 99)],
      roots: [{ nodeId: 'A', quantity: 50 }],
      oneOffQuantities: [{
        nodeId: 'B',
        quantity: { value: 7, rawText: '7', status: 'read', evidence: [], candidates: [], warnings: [], diagnosticConfidence: null },
      }],
    });
    expect(quantities(result)).toEqual({ A: null, B: 7 });
  });
});
