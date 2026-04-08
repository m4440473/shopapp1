export type TemplateBlockVariant = 'standard' | 'compact';

export type TemplateLayoutBlock = {
  id: string;
  type: string;
  label: string;
  visible: boolean;
  order: number;
  variant: TemplateBlockVariant;
  options?: Record<string, unknown>;
};

export type TemplateLayout = {
  sections: string[];
  blocks: TemplateLayoutBlock[];
};

export const DEFAULT_TEMPLATE_SECTIONS = [
  'Header',
  'Customer Info',
  'Total Price',
  'Part Name',
  'Part Info',
  'Line Items',
  'Addons/Labor',
  'Shipping',
];

function normalizeSectionEntry(section: unknown): string {
  if (typeof section === 'string') {
    return section;
  }

  if (section && typeof section === 'object') {
    const record = section as Record<string, unknown>;
    const candidate = record.label ?? record.name ?? record.title ?? record.type ?? record.id;
    if (typeof candidate === 'string') {
      return candidate;
    }
  }

  return String(section ?? '');
}

function toSlug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function normalizeBlockRecord(block: unknown, index: number): TemplateLayoutBlock {
  const record = (block && typeof block === 'object' ? block : {}) as Record<string, unknown>;
  const labelCandidate = record.label ?? record.name ?? record.title ?? record.type ?? record.id;
  const label = typeof labelCandidate === 'string' && labelCandidate.trim() ? labelCandidate.trim() : `Block ${index + 1}`;

  const id =
    typeof record.id === 'string' && record.id.trim()
      ? record.id.trim()
      : `${toSlug(typeof record.type === 'string' ? record.type : label) || 'block'}-${index + 1}`;

  const variant = record.variant === 'compact' ? 'compact' : 'standard';
  const options =
    record.options && typeof record.options === 'object' && !Array.isArray(record.options)
      ? (record.options as Record<string, unknown>)
      : undefined;

  return {
    id,
    type: typeof record.type === 'string' && record.type.trim() ? record.type.trim() : normalizeSectionName(label),
    label,
    visible: record.visible !== false,
    order: typeof record.order === 'number' && Number.isFinite(record.order) ? record.order : index,
    variant,
    options,
  };
}

function blocksFromLegacySections(sections: string[]): TemplateLayoutBlock[] {
  return sections.map((section, index) => ({
    id: `legacy-${toSlug(section) || `section-${index + 1}`}`,
    type: normalizeSectionName(section),
    label: section,
    visible: true,
    order: index,
    variant: 'standard' as const,
    options: undefined,
  }));
}

function sortBlocks(blocks: TemplateLayoutBlock[]) {
  return [...blocks].sort((a, b) => a.order - b.order);
}

function normalizeFromRecord(record: Record<string, unknown>): TemplateLayout {
  const sections = Array.isArray(record.sections)
    ? record.sections.map((section: unknown) => normalizeSectionEntry(section)).filter((section) => section.trim().length > 0)
    : [];

  const blocks = Array.isArray(record.blocks)
    ? sortBlocks(record.blocks.map((block, index) => normalizeBlockRecord(block, index)))
    : blocksFromLegacySections(sections);

  const normalizedBlocks = blocks.length > 0 ? blocks : blocksFromLegacySections(DEFAULT_TEMPLATE_SECTIONS);

  return {
    sections: sections.length ? sections : normalizedBlocks.map((block) => block.label),
    blocks: normalizedBlocks,
  };
}

export function normalizeTemplateLayout(layoutJson: unknown): TemplateLayout {
  if (layoutJson && typeof layoutJson === 'object') {
    return normalizeFromRecord(layoutJson as Record<string, unknown>);
  }

  if (typeof layoutJson === 'string') {
    try {
      const parsed = JSON.parse(layoutJson);
      if (parsed && typeof parsed === 'object') {
        return normalizeFromRecord(parsed as Record<string, unknown>);
      }
    } catch {
      // Ignore malformed JSON and fall back to defaults.
    }
  }

  const defaultBlocks = blocksFromLegacySections(DEFAULT_TEMPLATE_SECTIONS);
  return {
    sections: [...DEFAULT_TEMPLATE_SECTIONS],
    blocks: defaultBlocks,
  };
}

export function normalizeSectionName(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
