export type TemplateLayout = {
  sections: string[];
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

export function normalizeTemplateLayout(layoutJson: unknown): TemplateLayout {
  if (layoutJson && typeof layoutJson === 'object' && Array.isArray((layoutJson as any).sections)) {
    return {
      sections: (layoutJson as any).sections.map((section: unknown) => normalizeSectionEntry(section)),
    };
  }

  if (typeof layoutJson === 'string') {
    try {
      const parsed = JSON.parse(layoutJson);
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).sections)) {
        return {
          sections: (parsed as any).sections.map((section: unknown) => normalizeSectionEntry(section)),
        };
      }
    } catch {
      // Ignore malformed JSON and fall back to defaults.
    }
  }

  return { sections: [...DEFAULT_TEMPLATE_SECTIONS] };
}

export function normalizeSectionName(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
