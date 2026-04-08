'use client';

import React from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/Toast';
import { fetchJson } from '@/lib/fetchJson';
import {
  DEFAULT_TEMPLATE_SECTIONS,
  normalizeSectionName,
  normalizeTemplateLayout,
  type TemplateLayoutBlock,
} from '@/lib/document-template-layout';

const DOCUMENT_TYPES = ['QUOTE', 'INVOICE', 'ORDER_PRINT'] as const;

const SECTION_LIBRARY = [
  { type: 'header', label: 'Header', description: 'Logo, document title, and date' },
  { type: 'customer info', label: 'Customer Info', description: 'Customer name, contact, and addresses' },
  { type: 'total price', label: 'Total Price', description: 'Totals, taxes, and balance due' },
  { type: 'part name', label: 'Part Name', description: 'Primary part/assembly identifier' },
  { type: 'part info', label: 'Part Info', description: 'Material, finish, and specs' },
  { type: 'line items', label: 'Line Items', description: 'Parts table and quantities' },
  { type: 'addons/labor', label: 'Addons/Labor', description: 'Add-on services and labor entries' },
  { type: 'shipping', label: 'Shipping', description: 'Shipping method and delivery notes' },
];

type TemplateRecord = {
  id: string;
  name: string;
  documentType: (typeof DOCUMENT_TYPES)[number];
  description?: string | null;
  businessCode?: string | null;
  isDefault: boolean;
  isActive: boolean;
  schemaVersion: number;
  currentVersion: number;
  layoutJson: { sections: string[]; blocks: TemplateLayoutBlock[] };
};

type LayoutBlock = {
  id: string;
  type: string;
  label: string;
  visible: boolean;
  variant: 'standard' | 'compact';
  options?: {
    showUnitPrice?: boolean;
    showQuantity?: boolean;
    showLineTotal?: boolean;
    showPricingMode?: boolean;
  };
};

type TemplateFormState = {
  id?: string;
  name: string;
  documentType: (typeof DOCUMENT_TYPES)[number];
  description: string;
  businessCode: string;
  isDefault: boolean;
  isActive: boolean;
  schemaVersion: number;
  layoutBlocks: LayoutBlock[];
};

type DragPayload = { source: 'library'; type: string; label: string } | { source: 'canvas'; index: number };

function createDefaultBlocks(): LayoutBlock[] {
  return DEFAULT_TEMPLATE_SECTIONS.map((label, index) => ({
    id: `default-${index + 1}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    type: normalizeSectionName(label),
    label,
    visible: true,
    variant: 'standard',
  }));
}

const emptyTemplate: TemplateFormState = {
  name: '',
  documentType: 'QUOTE',
  description: '',
  businessCode: '',
  isDefault: false,
  isActive: true,
  schemaVersion: 2,
  layoutBlocks: createDefaultBlocks(),
};

function parseDragPayload(event: React.DragEvent) {
  const raw = event.dataTransfer.getData('text/plain');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (from === to || from < 0 || from >= items.length || to < 0 || to > items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function insertItem<T>(items: T[], index: number, value: T) {
  const next = [...items];
  const safeIndex = Math.max(0, Math.min(index, next.length));
  next.splice(safeIndex, 0, value);
  return next;
}

function isPricingBlock(block: LayoutBlock, documentType: TemplateFormState['documentType']) {
  if (documentType !== 'QUOTE') return false;
  const key = normalizeSectionName(block.type || block.label);
  return key === 'part pricing' || key === 'part info' || key === 'pricing';
}

function toFormLayoutBlocks(layoutJson: unknown): LayoutBlock[] {
  const normalized = normalizeTemplateLayout(layoutJson);
  if (!normalized.blocks.length) {
    return createDefaultBlocks();
  }
  return normalized.blocks.map((block) => ({
    id: block.id,
    type: block.type,
    label: block.label,
    visible: block.visible !== false,
    variant: block.variant === 'compact' ? 'compact' : 'standard',
    options:
      block.options && typeof block.options === 'object'
        ? {
            showUnitPrice: block.options.showUnitPrice !== false,
            showQuantity: block.options.showQuantity !== false,
            showLineTotal: block.options.showLineTotal !== false,
            showPricingMode: block.options.showPricingMode !== false,
          }
        : undefined,
  }));
}

function PreviewSection({ title }: { title: string }) {
  return (
    <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
      {title}
    </div>
  );
}

export default function TemplatesClient({ initialTemplates }: { initialTemplates: TemplateRecord[] }) {
  const toast = useToast();
  const [templates, setTemplates] = React.useState<TemplateRecord[]>(initialTemplates);
  const [selectedId, setSelectedId] = React.useState<string | null>(templates[0]?.id ?? null);
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null);
  const [dropIndex, setDropIndex] = React.useState<number | null>(null);
  const [customSectionName, setCustomSectionName] = React.useState('');
  const [form, setForm] = React.useState<TemplateFormState>(() => {
    const selected = templates[0];
    if (!selected) return emptyTemplate;
    return {
      id: selected.id,
      name: selected.name,
      documentType: selected.documentType,
      description: selected.description ?? '',
      businessCode: selected.businessCode ?? '',
      isDefault: selected.isDefault,
      isActive: selected.isActive,
      schemaVersion: selected.schemaVersion ?? 2,
      layoutBlocks: toFormLayoutBlocks(selected.layoutJson),
    };
  });

  React.useEffect(() => {
    if (!selectedId) return;
    const selected = templates.find((template) => template.id === selectedId);
    if (!selected) return;
    setForm({
      id: selected.id,
      name: selected.name,
      documentType: selected.documentType,
      description: selected.description ?? '',
      businessCode: selected.businessCode ?? '',
      isDefault: selected.isDefault,
      isActive: selected.isActive,
      schemaVersion: selected.schemaVersion ?? 2,
      layoutBlocks: toFormLayoutBlocks(selected.layoutJson),
    });
  }, [selectedId, templates]);

  const refresh = React.useCallback(async () => {
    const data = await fetchJson<{ items: TemplateRecord[] }>('/api/admin/document-templates?take=100');
    setTemplates(data.items ?? []);
  }, []);

  const handleCreateNew = () => {
    setSelectedId(null);
    setForm({ ...emptyTemplate, layoutBlocks: createDefaultBlocks() });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.push('Template name is required', 'error');
      return;
    }

    const normalizedBlocks = form.layoutBlocks.map((block, index) => ({
      id: block.id,
      type: block.type || normalizeSectionName(block.label),
      label: block.label,
      visible: block.visible !== false,
      order: index,
      variant: block.variant,
      options: isPricingBlock(block, form.documentType)
        ? {
            showUnitPrice: block.options?.showUnitPrice !== false,
            showQuantity: block.options?.showQuantity !== false,
            showLineTotal: block.options?.showLineTotal !== false,
            showPricingMode: block.options?.showPricingMode !== false,
          }
        : undefined,
    }));

    const payload = {
      name: form.name.trim(),
      documentType: form.documentType,
      description: form.description.trim() || undefined,
      businessCode: form.businessCode.trim() || undefined,
      isDefault: form.isDefault,
      isActive: form.isActive,
      schemaVersion: form.schemaVersion,
      layoutJson: {
        sections: normalizedBlocks.map((block) => block.label),
        blocks: normalizedBlocks,
      },
    };

    if (form.id) {
      await fetchJson(`/api/admin/document-templates/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast.push('Template updated', 'success');
    } else {
      const response = await fetchJson<{ item: TemplateRecord }>(`/api/admin/document-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setSelectedId(response.item.id);
      toast.push('Template created', 'success');
    }

    await refresh();
  };

  const handleDelete = async () => {
    if (!form.id) return;
    await fetchJson(`/api/admin/document-templates/${form.id}`, { method: 'DELETE' });
    toast.push('Template deleted', 'success');
    await refresh();
    setSelectedId(null);
    setForm({ ...emptyTemplate, layoutBlocks: createDefaultBlocks() });
  };

  const addBlock = (type: string, label: string, index?: number) => {
    const block: LayoutBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      label,
      visible: true,
      variant: 'standard',
    };
    setForm((prev) => ({
      ...prev,
      layoutBlocks: insertItem(prev.layoutBlocks, index ?? prev.layoutBlocks.length, block),
    }));
  };

  const updateBlock = (index: number, patch: Partial<LayoutBlock>) => {
    setForm((prev) => {
      const next = [...prev.layoutBlocks];
      next[index] = { ...next[index], ...patch };
      return { ...prev, layoutBlocks: next };
    });
  };

  const removeBlock = (index: number) => {
    setForm((prev) => ({
      ...prev,
      layoutBlocks: prev.layoutBlocks.filter((_, i) => i !== index),
    }));
  };

  const handleDragStart = (event: React.DragEvent, payload: DragPayload) => {
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'move';
    if (payload.source === 'canvas') setDraggingIndex(payload.index);
  };

  const handleDrop = (event: React.DragEvent, targetIndex: number) => {
    event.preventDefault();
    const payload = parseDragPayload(event);
    if (!payload) return;

    if (payload.source === 'library') {
      addBlock(payload.type, payload.label, targetIndex);
    } else {
      setForm((prev) => ({
        ...prev,
        layoutBlocks: moveItem(prev.layoutBlocks, payload.index, targetIndex),
      }));
    }

    setDraggingIndex(null);
    setDropIndex(null);
  };

  const handleDragOver = (event: React.DragEvent, targetIndex: number) => {
    event.preventDefault();
    setDropIndex(targetIndex);
  };

  const handleDragLeave = () => setDropIndex(null);
  const handleCanvasDrop = (event: React.DragEvent) => handleDrop(event, form.layoutBlocks.length);

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr,2fr,1.4fr]">
      <div className="rounded-lg border border-muted bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Template Library</h2>
          <Button type="button" size="sm" variant="secondary" onClick={handleCreateNew}>
            New template
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates configured yet.</p>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className={`rounded-md border border-muted p-3 ${
                  selectedId === template.id ? 'bg-primary/10' : 'bg-background/60'
                }`}
              >
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                  onClick={() => setSelectedId(template.id)}
                >
                  <div>
                    <p className="font-medium text-foreground">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.documentType} · {template.businessCode ? `Business ${template.businessCode}` : 'All businesses'}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    v{template.currentVersion} · {template.isDefault ? 'Default' : 'Custom'} · {template.isActive ? 'Active' : 'Inactive'}
                  </div>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border border-muted bg-background/40 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Template Builder</h2>
          <div className="mt-4 space-y-4">
            <div className="grid gap-2"><Label htmlFor="templateName">Template name *</Label><Input id="templateName" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
            <div className="grid gap-2">
              <Label>Document type</Label>
              <Select value={form.documentType} onValueChange={(value) => setForm((prev) => ({ ...prev, documentType: value as TemplateFormState['documentType'] }))}>
                <SelectTrigger className="border-border/60 bg-background/80"><SelectValue /></SelectTrigger>
                <SelectContent>{DOCUMENT_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label htmlFor="templateDescription">Description</Label><Textarea id="templateDescription" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
            <div className="grid gap-2"><Label htmlFor="templateBusinessCode">Business code (optional)</Label><Input id="templateBusinessCode" value={form.businessCode} onChange={(event) => setForm((prev) => ({ ...prev, businessCode: event.target.value }))} /></div>
            <div className="grid gap-2"><Label htmlFor="schemaVersion">Schema version</Label><Input id="schemaVersion" type="number" value={form.schemaVersion} onChange={(event) => setForm((prev) => ({ ...prev, schemaVersion: Number(event.target.value || 2) }))} /></div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.isDefault} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isDefault: checked === true }))} />Default for type</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked === true }))} />Active</label>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr,1.4fr]">
          <div className="rounded-lg border border-muted bg-background/40 p-4">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Block Library</h3><span className="text-xs text-muted-foreground">Drag onto canvas</span></div>
            <div className="mt-3 space-y-3">
              {SECTION_LIBRARY.map((section) => (
                <div key={section.label} draggable onDragStart={(event) => handleDragStart(event, { source: 'library', type: section.type, label: section.label })} className="cursor-grab rounded-lg border border-border/60 bg-background/80 p-3 text-left transition hover:border-primary/50">
                  <p className="text-sm font-semibold text-foreground">{section.label}</p>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => addBlock(section.type, section.label)}>Add block</Button>
                    <span className="text-xs text-muted-foreground">Drag to position</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-dashed border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground">Custom block</p>
              <div className="mt-2 flex gap-2">
                <Input value={customSectionName} onChange={(event) => setCustomSectionName(event.target.value)} placeholder="e.g. Certifications" />
                <Button type="button" variant="secondary" onClick={() => { if (!customSectionName.trim()) return; addBlock(normalizeSectionName(customSectionName), customSectionName.trim()); setCustomSectionName(''); }}>Add</Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-muted bg-background/40 p-4" onDragOver={(event) => handleDragOver(event, form.layoutBlocks.length)} onDrop={handleCanvasDrop}>
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Layout Canvas</h3><span className="text-xs text-muted-foreground">Drop blocks here</span></div>
            {form.layoutBlocks.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Drag blocks from the library.</div>
            ) : (
              <div className="mt-4 space-y-3" onDragLeave={handleDragLeave}>
                {form.layoutBlocks.map((block, index) => (
                  <div key={block.id} draggable onDragStart={(event) => handleDragStart(event, { source: 'canvas', index })} onDragOver={(event) => handleDragOver(event, index)} onDrop={(event) => handleDrop(event, index)} className={`rounded-lg border border-border/60 bg-background/80 p-3 transition ${draggingIndex === index ? 'opacity-60' : ''} ${dropIndex === index ? 'border-primary/60 bg-primary/10' : ''}`}>
                    <div className="grid gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="mt-1 select-none text-lg text-muted-foreground">⋮⋮</div>
                        <div className="grid flex-1 gap-2 md:grid-cols-2">
                          <Input value={block.label} onChange={(event) => updateBlock(index, { label: event.target.value })} className="bg-background" placeholder="Block label" />
                          <Select value={block.variant} onValueChange={(value) => updateBlock(index, { variant: value as LayoutBlock['variant'] })}>
                            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="standard">Standard</SelectItem><SelectItem value="compact">Compact</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeBlock(index)}>Remove</Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <label className="flex items-center gap-2"><Checkbox checked={block.visible} onCheckedChange={(checked) => updateBlock(index, { visible: checked === true })} />Show block</label>
                        <span>Type: {block.type}</span>
                      </div>
                      {isPricingBlock(block, form.documentType) ? (
                        <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
                          <p className="mb-2 font-semibold text-foreground">Pricing options</p>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="flex items-center gap-2"><Checkbox checked={block.options?.showUnitPrice !== false} onCheckedChange={(checked) => updateBlock(index, { options: { ...block.options, showUnitPrice: checked === true } })} />Show unit price</label>
                            <label className="flex items-center gap-2"><Checkbox checked={block.options?.showQuantity !== false} onCheckedChange={(checked) => updateBlock(index, { options: { ...block.options, showQuantity: checked === true } })} />Show qty</label>
                            <label className="flex items-center gap-2"><Checkbox checked={block.options?.showLineTotal !== false} onCheckedChange={(checked) => updateBlock(index, { options: { ...block.options, showLineTotal: checked === true } })} />Show line total</label>
                            <label className="flex items-center gap-2"><Checkbox checked={block.options?.showPricingMode !== false} onCheckedChange={(checked) => updateBlock(index, { options: { ...block.options, showPricingMode: checked === true } })} />Show pricing mode</label>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" onClick={handleSave}>{form.id ? 'Save template' : 'Create template'}</Button>
          {form.id ? <Button type="button" variant="destructive" onClick={handleDelete}>Delete</Button> : null}
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border border-muted bg-background/40 p-4">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Live Preview</h2><span className="text-xs text-muted-foreground">Updates instantly</span></div>
          <div className="mt-4 space-y-4">
            {form.layoutBlocks.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add blocks to preview.</p>
            ) : (
              form.layoutBlocks.filter((block) => block.visible).map((block) => (
                <div key={`${block.id}-preview`} className="rounded-lg border border-dashed border-muted bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{block.label || 'Untitled block'} · {block.variant}</p>
                  <div className="mt-3 text-sm"><PreviewSection title={block.label || 'Untitled block'} /></div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
