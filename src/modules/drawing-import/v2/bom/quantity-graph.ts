import { emptyDrawingField, type DrawingImportEvidence, type DrawingImportFieldValue } from '../drawing-import-v2.types';
import type {
  AssemblyGraphEdge,
  AssemblyGraphNode,
  AssemblyQuantityOverride,
  AssemblyQuantityResolution,
  AssemblyQuantityResult,
  AssemblyRootRequest,
  OneOffQuantity,
} from './bom.types';

export type CalculateAssemblyQuantitiesInput = {
  mode: 'ONE_OFF' | 'ASSEMBLY';
  nodes: AssemblyGraphNode[];
  edges: AssemblyGraphEdge[];
  roots?: AssemblyRootRequest[];
  oneOffQuantities?: OneOffQuantity[];
  humanOverrides?: AssemblyQuantityOverride[];
};

const MAX_SAFE_QUANTITY = Number.MAX_SAFE_INTEGER;

function positiveSafeInteger(value: number) {
  return Number.isSafeInteger(value) && value >= 1;
}

function humanField(node: AssemblyGraphNode, override: AssemblyQuantityOverride): DrawingImportFieldValue<number> {
  const evidence = override.evidence?.length ? override.evidence : [{
    sourceType: 'human' as const,
    sourcePageId: node.pageId ?? node.id,
    sourceRegion: null,
    sourceCropId: null,
    rawText: String(override.quantity),
    parser: 'human_quantity_override_v1',
    agreementSignals: [],
    warnings: [],
  }];
  return {
    value: override.quantity,
    rawText: String(override.quantity),
    status: 'human_corrected',
    evidence,
    candidates: [],
    warnings: [],
    diagnosticConfidence: null,
  };
}

function canonicalCycle(cycle: string[]) {
  const values = cycle[0] === cycle[cycle.length - 1] ? cycle.slice(0, -1) : [...cycle];
  if (!values.length) return '';
  const variants = values.map((_, index) => [...values.slice(index), ...values.slice(0, index)]);
  variants.sort((left, right) => left.join('\u0000').localeCompare(right.join('\u0000')));
  return `${variants[0].join('>')}>${variants[0][0]}`;
}

function detectCycles(nodeIds: string[], outgoing: Map<string, AssemblyGraphEdge[]>) {
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const cycles = new Map<string, string[]>();
  const visit = (nodeId: string) => {
    state.set(nodeId, 1);
    stack.push(nodeId);
    for (const edge of outgoing.get(nodeId) ?? []) {
      if (!edge.childNodeId) continue;
      const childState = state.get(edge.childNodeId) ?? 0;
      if (childState === 0) visit(edge.childNodeId);
      else if (childState === 1) {
        const start = stack.lastIndexOf(edge.childNodeId);
        const cycle = [...stack.slice(start), edge.childNodeId];
        cycles.set(canonicalCycle(cycle), cycle);
      }
    }
    stack.pop();
    state.set(nodeId, 2);
  };
  nodeIds.forEach((nodeId) => {
    if ((state.get(nodeId) ?? 0) === 0) visit(nodeId);
  });
  return [...cycles.values()];
}

function descendants(start: Iterable<string>, outgoing: Map<string, AssemblyGraphEdge[]>) {
  const values = new Set(start);
  const queue = [...values];
  while (queue.length) {
    const nodeId = queue.shift()!;
    for (const edge of outgoing.get(nodeId) ?? []) {
      if (edge.childNodeId && !values.has(edge.childNodeId)) {
        values.add(edge.childNodeId);
        queue.push(edge.childNodeId);
      }
    }
  }
  return values;
}

function unresolvedResolution(nodeId: string, warning?: string): AssemblyQuantityResolution {
  const quantity = emptyDrawingField<number>();
  if (warning) quantity.warnings.push(warning);
  return { nodeId, quantity, contributions: [], warnings: warning ? [warning] : [] };
}

function calculateOneOff(input: CalculateAssemblyQuantitiesInput): AssemblyQuantityResult {
  const nodes = new Map(input.nodes.map((node) => [node.id, node]));
  const quantities = new Map((input.oneOffQuantities ?? []).map((entry) => [entry.nodeId, entry.quantity]));
  const overrides = new Map((input.humanOverrides ?? []).map((entry) => [entry.nodeId, entry]));
  const warnings: string[] = [];
  const invalidOverrideNodeIds = [...overrides.values()]
    .filter((override) => !positiveSafeInteger(override.quantity) || !nodes.has(override.nodeId))
    .map((override) => override.nodeId);
  if (invalidOverrideNodeIds.length) warnings.push('One or more human quantity overrides were invalid or referenced missing nodes.');
  const resolutions = input.nodes.map((node) => {
    const override = overrides.get(node.id);
    if (override && positiveSafeInteger(override.quantity)) {
      return { nodeId: node.id, quantity: humanField(node, override), contributions: [], warnings: [] };
    }
    const quantity = quantities.get(node.id);
    if (!quantity?.value || !positiveSafeInteger(quantity.value)) {
      return unresolvedResolution(node.id, 'One-off drawing quantity is unknown and requires review.');
    }
    return { nodeId: node.id, quantity, contributions: [], warnings: quantity.warnings };
  });
  return {
    valid: invalidOverrideNodeIds.length === 0,
    resolutions,
    duplicateEdgeIds: [],
    invalidEdgeIds: [],
    missingChildEdgeIds: [],
    cycles: [],
    overflowNodeIds: [],
    warnings,
  };
}

export function calculateAssemblyQuantities(input: CalculateAssemblyQuantitiesInput): AssemblyQuantityResult {
  if (input.mode === 'ONE_OFF') return calculateOneOff(input);

  const warnings: string[] = [];
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  const duplicateEdgeIds: string[] = [];
  const invalidEdgeIds: string[] = [];
  const missingChildEdgeIds: string[] = [];
  const seenFingerprints = new Set<string>();
  const usableEdges: AssemblyGraphEdge[] = [];
  for (const edge of input.edges) {
    if (seenFingerprints.has(edge.sourceFingerprint)) {
      duplicateEdgeIds.push(edge.id);
      continue;
    }
    seenFingerprints.add(edge.sourceFingerprint);
    if (!nodeById.has(edge.parentNodeId) || !positiveSafeInteger(edge.quantityPerParent ?? 0)) {
      invalidEdgeIds.push(edge.id);
      continue;
    }
    if (!edge.childNodeId || !nodeById.has(edge.childNodeId)) {
      missingChildEdgeIds.push(edge.id);
      continue;
    }
    usableEdges.push(edge);
  }

  const outgoing = new Map<string, AssemblyGraphEdge[]>();
  for (const edge of usableEdges) {
    const entries = outgoing.get(edge.parentNodeId) ?? [];
    entries.push(edge);
    outgoing.set(edge.parentNodeId, entries);
  }
  const cycles = detectCycles([...nodeById.keys()], outgoing);
  const cycleNodeIds = new Set(cycles.flatMap((cycle) => cycle.slice(0, -1)));
  const invalidFromCycles = descendants(cycleNodeIds, outgoing);
  const validNodeIds = [...nodeById.keys()].filter((nodeId) => !invalidFromCycles.has(nodeId));
  const validNodeSet = new Set(validNodeIds);
  const indegree = new Map(validNodeIds.map((nodeId) => [nodeId, 0]));
  for (const edge of usableEdges) {
    if (validNodeSet.has(edge.parentNodeId) && validNodeSet.has(edge.childNodeId!)) {
      indegree.set(edge.childNodeId!, (indegree.get(edge.childNodeId!) ?? 0) + 1);
    }
  }
  const queue = validNodeIds.filter((nodeId) => indegree.get(nodeId) === 0).sort();
  const order: string[] = [];
  while (queue.length) {
    const nodeId = queue.shift()!;
    order.push(nodeId);
    for (const edge of outgoing.get(nodeId) ?? []) {
      if (!edge.childNodeId || !validNodeSet.has(edge.childNodeId)) continue;
      indegree.set(edge.childNodeId, (indegree.get(edge.childNodeId) ?? 0) - 1);
      if (indegree.get(edge.childNodeId) === 0) {
        queue.push(edge.childNodeId);
        queue.sort();
      }
    }
  }

  const contributions = new Map<string, Map<string, number>>();
  const usedEdges = new Map<string, AssemblyGraphEdge[]>();
  const overflowNodeIds = new Set<string>();
  const roots = input.roots ?? [];
  for (const root of roots) {
    if (!nodeById.has(root.nodeId) || !positiveSafeInteger(root.quantity)) {
      warnings.push(`Assembly root ${root.nodeId} is missing or has an invalid requested quantity.`);
      continue;
    }
    if (invalidFromCycles.has(root.nodeId)) continue;
    const rootContributions = contributions.get(root.nodeId) ?? new Map<string, number>();
    const rootTotal = (rootContributions.get(root.nodeId) ?? 0) + root.quantity;
    if (!Number.isSafeInteger(rootTotal) || rootTotal > MAX_SAFE_QUANTITY) {
      overflowNodeIds.add(root.nodeId);
      continue;
    }
    rootContributions.set(root.nodeId, rootTotal);
    contributions.set(root.nodeId, rootContributions);
  }
  if (!roots.length) warnings.push('Assembly quantity calculation requires at least one requested root.');

  const overrides = new Map<string, AssemblyQuantityOverride>();
  for (const override of input.humanOverrides ?? []) {
    if (!nodeById.has(override.nodeId) || !positiveSafeInteger(override.quantity)) {
      warnings.push(`Human quantity override for ${override.nodeId} is invalid or references a missing node.`);
      continue;
    }
    overrides.set(override.nodeId, override);
  }

  for (const nodeId of order) {
    if (overflowNodeIds.has(nodeId)) continue;
    const override = overrides.get(nodeId);
    if (override) contributions.set(nodeId, new Map([[nodeId, override.quantity]]));
    const nodeContributions = contributions.get(nodeId);
    if (!nodeContributions?.size) continue;
    for (const edge of outgoing.get(nodeId) ?? []) {
      const childId = edge.childNodeId!;
      if (!validNodeSet.has(childId)) continue;
      const childContributions = contributions.get(childId) ?? new Map<string, number>();
      let overflowed = false;
      for (const [rootNodeId, quantity] of nodeContributions) {
        const product = quantity * edge.quantityPerParent!;
        const next = (childContributions.get(rootNodeId) ?? 0) + product;
        if (!Number.isSafeInteger(product) || !Number.isSafeInteger(next) || next > MAX_SAFE_QUANTITY) {
          overflowNodeIds.add(childId);
          overflowed = true;
          break;
        }
        childContributions.set(rootNodeId, next);
      }
      if (!overflowed) {
        contributions.set(childId, childContributions);
        usedEdges.set(childId, [...(usedEdges.get(childId) ?? []), edge]);
      }
    }
  }

  const invalidFromOverflow = descendants(overflowNodeIds, outgoing);
  invalidFromOverflow.forEach((nodeId) => overflowNodeIds.add(nodeId));
  const resolutions = input.nodes.map((node): AssemblyQuantityResolution => {
    const override = overrides.get(node.id);
    if (override) return { nodeId: node.id, quantity: humanField(node, override), contributions: [], warnings: [] };
    if (invalidFromCycles.has(node.id)) {
      return unresolvedResolution(node.id, 'Quantity cannot be derived because this node is in or downstream of an assembly cycle.');
    }
    if (overflowNodeIds.has(node.id)) {
      return unresolvedResolution(node.id, 'Quantity exceeds the supported safe-integer range.');
    }
    const nodeContributions = contributions.get(node.id);
    if (!nodeContributions?.size) return unresolvedResolution(node.id);
    const total = [...nodeContributions.values()].reduce((sum, value) => sum + value, 0);
    if (!Number.isSafeInteger(total) || total > MAX_SAFE_QUANTITY) return unresolvedResolution(node.id, 'Quantity exceeds the supported safe-integer range.');
    const incoming = usedEdges.get(node.id) ?? [];
    const isOnlyRootSeed = incoming.length === 0;
    const evidence: DrawingImportEvidence[] = isOnlyRootSeed
      ? [{
          sourceType: 'human',
          sourcePageId: node.pageId ?? node.id,
          sourceRegion: null,
          sourceCropId: null,
          rawText: String(total),
          parser: 'assembly_quantity_graph_v1',
          agreementSignals: ['requested_root_quantity'],
          warnings: [],
          derivedFrom: [{ field: 'rootMultiplier', value: String(total) }],
        }]
      : incoming.map((edge) => ({
          sourceType: 'bom' as const,
          sourcePageId: edge.sourcePageId,
          sourceRegion: edge.sourceRegion,
          sourceCropId: null,
          rawText: null,
          parser: 'assembly_quantity_graph_v1',
          agreementSignals: ['matched_bom_edge'],
          warnings: [],
          derivedFrom: [{ field: 'quantityPerParent' as const, value: String(edge.quantityPerParent) }],
        }));
    const value = total;
    return {
      nodeId: node.id,
      quantity: {
        value,
        rawText: null,
        status: isOnlyRootSeed ? 'derived_locally' : 'derived_from_bom',
        evidence,
        candidates: [],
        warnings: [],
        diagnosticConfidence: null,
      },
      contributions: [...nodeContributions.entries()].map(([rootNodeId, quantity]) => ({ rootNodeId, quantity })),
      warnings: [],
    };
  });

  if (duplicateEdgeIds.length) warnings.push(`${duplicateEdgeIds.length} exact duplicate BOM row(s) were suppressed.`);
  if (missingChildEdgeIds.length) warnings.push(`${missingChildEdgeIds.length} BOM row(s) reference missing drawing pages.`);
  if (invalidEdgeIds.length) warnings.push(`${invalidEdgeIds.length} BOM edge(s) have invalid parent or quantity data.`);
  if (cycles.length) warnings.push(`${cycles.length} assembly cycle(s) require review.`);
  if (overflowNodeIds.size) warnings.push('One or more derived quantities exceed the supported safe-integer range.');

  return {
    valid: !invalidEdgeIds.length && !missingChildEdgeIds.length && !cycles.length && !overflowNodeIds.size && !warnings.some((warning) => warning.startsWith('Assembly root') || warning.startsWith('Human quantity')),
    resolutions,
    duplicateEdgeIds,
    invalidEdgeIds,
    missingChildEdgeIds,
    cycles,
    overflowNodeIds: [...overflowNodeIds].sort(),
    warnings,
  };
}
