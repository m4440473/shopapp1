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
} from '@/lib/document-template-layout';

const DOCUMENT_TYPES = ['QUOTE', 'INVOICE', 'ORDER_PRINT'] as const;

const SECTION_LIBRARY = [
  {
    name: 'Header',
    description: 'Logo, document title, and date',
  },
  {
    name: 'Customer Info',
    description: 'Customer name, contact, and addresses',
  },
  {
    name: 'Total Price',
    description: 'Totals, taxes, and balance due',
  },
  {
    name: 'Part Name',
    description: 'Primary part/assembly identifier',
  },
  {
    name: 'Part Info',
    description: 'Material, finish, and specs',
  },
  {
    name: 'Line Items',
    description: 'Parts table and quantities',
  },
  {
    name: 'Addons/Labor',
    description: 'Add-on services and labor entries',
  },
  {
    name: 'Shipping',
    description: 'Shipping method and delivery notes',
  },
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
  layoutJson: { sections: string[] };
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
  layoutSections: string[];
};

type DragPayload =
  | { source: 'library'; name: string }
  | { source: 'canvas'; index: number };

const emptyTemplate: TemplateFormState = {
  name: '',
  documentType: 'QUOTE',
  description: '',
  businessCode: '',
  isDefault: false,
  isActive: true,
  schemaVersion: 1,
  layoutSections: [...DEFAULT_TEMPLATE_SECTIONS],
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

function PreviewSection({
  title,
  documentType,
}: {
  title: string;
  documentType: TemplateFormState['documentType'];
}) {
  const key = normalizeSectionName(title);
  const isInvoice = documentType === 'INVOICE';
  const isOrderPrint = documentType === 'ORDER_PRINT';

  if (key === 'header') {
    if (isOrderPrint) {
      return (
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">C&amp;R Machine</p>
            <p className="text-lg font-semibold text-foreground">Job Router</p>
            <p className="text-xs text-muted-foreground">Order #WO-2043 · Due Mar 14, 2026</p>
          </div>
          <div className="rounded-md border border-dashed border-border px-3 py-2 text-[10px] text-muted-foreground">
            Priority: Rush
          </div>
        </div>
      );
    }
    if (isInvoice) {
      return (
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Company</p>
            <p className="text-lg font-semibold text-foreground">Invoice</p>
            <p className="text-xs text-muted-foreground">#INV-2043 · Feb 4, 2026</p>
          </div>
          <div className="rounded-md border border-dashed border-border px-3 py-2 text-[10px] text-muted-foreground">
            Net 30
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Company</p>
          <p className="text-lg font-semibold text-foreground">Quote</p>
          <p className="text-xs text-muted-foreground">#QT-1104 · Oct 12, 2025</p>
        </div>
        <div className="rounded-md border border-dashed border-border px-3 py-2 text-[10px] text-muted-foreground">
          Logo
        </div>
      </div>
    );
  }

  if (key === 'customer info') {
    if (isOrderPrint) {
      return (
        <div className="grid gap-1 text-xs text-muted-foreground">
          <p className="text-sm font-medium text-foreground">Apex Industrial</p>
          <p>Attn: Sam Carter · sam@apexindustrial.com</p>
          <p>(213) 555-7741 · 88 Foundry Ave.</p>
        </div>
      );
    }
    if (isInvoice) {
      return (
        <div className="grid gap-1 text-xs text-muted-foreground">
          <p className="text-sm font-medium text-foreground">Precision Parts Co.</p>
          <p>Accounts Payable · ap@precision.com</p>
          <p>1200 West Loop Rd. · Chicago, IL</p>
        </div>
      );
    }
    return (
      <div className="grid gap-1 text-xs text-muted-foreground">
        <p className="text-sm font-medium text-foreground">Precision Parts Co.</p>
        <p>Attn: Jaime Lee · jaime@precision.com</p>
        <p>(312) 555-2891 · 1200 West Loop Rd.</p>
      </div>
    );
  }

  if (key === 'total price') {
    if (isOrderPrint) {
      return (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Job #</p>
            <p className="font-semibold text-foreground">WO-2043</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Machinist</p>
            <p className="font-semibold text-foreground">K. Patel</p>
          </div>
          <div className="col-span-2 rounded-md bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground">
            Due: Mar 14, 2026 · Priority: Rush
          </div>
        </div>
      );
    }
    if (isInvoice) {
      return (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Subtotal</p>
            <p className="font-semibold text-foreground">$12,450.00</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Tax</p>
            <p className="font-semibold text-foreground">$980.00</p>
          </div>
          <div className="col-span-2 rounded-md bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground">
            Balance due: $13,430.00
          </div>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Subtotal</p>
          <p className="font-semibold text-foreground">$12,450.00</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Add-ons</p>
          <p className="font-semibold text-foreground">$1,420.00</p>
        </div>
        <div className="col-span-2 rounded-md bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground">
          Total due: $13,870.00
        </div>
      </div>
    );
  }

  if (key === 'part name') {
    return (
      <div className="text-sm text-foreground">
        Bracket Assembly A · Qty 24
        <p className="text-xs text-muted-foreground">PN-2201 · Rev B</p>
      </div>
    );
  }

  if (key === 'part info') {
    return (
      <div className="grid gap-1 text-xs text-muted-foreground">
        <p>Material: 6061-T6 Aluminum</p>
        <p>Finish: Clear anodize</p>
        <p>Notes: Tight tolerance on bore.</p>
      </div>
    );
  }

  if (key === 'line items') {
    if (isOrderPrint) {
      return (
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-muted-foreground">
            <span>001 · CNC Mill</span>
            <span>✓</span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-muted-foreground">
            <span>002 · Deburr</span>
            <span>✓</span>
          </div>
        </div>
      );
    }
    if (isInvoice) {
      return (
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-muted-foreground">
            <span>Bracket Assembly A (24 pcs)</span>
            <span>$9,600.00</span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-muted-foreground">
            <span>Finishing · Clear anodize</span>
            <span>$2,850.00</span>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-muted-foreground">
          <span>Machine time (4 hrs)</span>
          <span>$720.00</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-muted-foreground">
          <span>Material charge</span>
          <span>$320.00</span>
        </div>
      </div>
    );
  }

  if (key === 'addons labor') {
    if (isOrderPrint) {
      return (
        <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Process checklist, routing, and inspection sign-offs.
        </div>
      );
    }
    if (isInvoice) {
      return (
        <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Packaging, rush fees, and invoice adjustments.
        </div>
      );
    }
    return (
      <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        Packaging, rush fees, and add-on services.
      </div>
    );
  }

  if (key === 'shipping') {
    if (isOrderPrint) {
      return (
        <div className="text-xs text-muted-foreground">
          Box 1 · 42 lbs · 24 pcs · 24x18x12
        </div>
      );
    }
    if (isInvoice) {
      return (
        <div className="text-xs text-muted-foreground">
          Ship via UPS Ground · Dock delivery · Tracking sent.
        </div>
      );
    }
    return (
      <div className="text-xs text-muted-foreground">
        UPS Ground · Ship by Nov 10 · Customer pickup available.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
      Custom section content goes here.
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
      schemaVersion: selected.schemaVersion ?? 1,
      layoutSections: normalizeTemplateLayout(selected.layoutJson).sections,
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
      schemaVersion: selected.schemaVersion ?? 1,
      layoutSections: normalizeTemplateLayout(selected.layoutJson).sections,
    });
  }, [selectedId, templates]);

  const refresh = React.useCallback(async () => {
    const data = await fetchJson<{ items: TemplateRecord[] }>('/api/admin/document-templates?take=100');
    setTemplates(data.items ?? []);
  }, []);

  const handleCreateNew = () => {
    setSelectedId(null);
    setForm({ ...emptyTemplate });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.push('Template name is required', 'error');
      return;
    }

    const payload = {
      name: form.name.trim(),
      documentType: form.documentType,
      description: form.description.trim() || undefined,
      businessCode: form.businessCode.trim() || undefined,
      isDefault: form.isDefault,
      isActive: form.isActive,
      schemaVersion: form.schemaVersion,
      layoutJson: {
        sections: form.layoutSections.filter((section) => section.trim().length > 0),
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
    setForm({ ...emptyTemplate });
  };

  const addSection = (name: string, index?: number) => {
    setForm((prev) => ({
      ...prev,
      layoutSections: insertItem(prev.layoutSections, index ?? prev.layoutSections.length, name),
    }));
  };

  const updateSection = (index: number, value: string) => {
    setForm((prev) => {
      const next = [...prev.layoutSections];
      next[index] = value;
      return { ...prev, layoutSections: next };
    });
  };

  const removeSection = (index: number) => {
    setForm((prev) => ({
      ...prev,
      layoutSections: prev.layoutSections.filter((_, i) => i !== index),
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
      addSection(payload.name, targetIndex);
    } else {
      setForm((prev) => ({
        ...prev,
        layoutSections: moveItem(prev.layoutSections, payload.index, targetIndex),
      }));
    }

    setDraggingIndex(null);
    setDropIndex(null);
  };

  const handleDragOver = (event: React.DragEvent, targetIndex: number) => {
    event.preventDefault();
    setDropIndex(targetIndex);
  };

  const handleDragLeave = () => {
    setDropIndex(null);
  };

  const handleCanvasDrop = (event: React.DragEvent) => {
    handleDrop(event, form.layoutSections.length);
  };

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
                      {template.documentType} ·{' '}
                      {template.businessCode ? `Business ${template.businessCode}` : 'All businesses'}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    v{template.currentVersion} · {template.isDefault ? 'Default' : 'Custom'} ·{' '}
                    {template.isActive ? 'Active' : 'Inactive'}
                  </div>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border border-muted bg-background/40 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Template Builder
          </h2>
          <div className="mt-4 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="templateName">Template name *</Label>
              <Input
                id="templateName"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Standard quote"
              />
            </div>
            <div className="grid gap-2">
              <Label>Document type</Label>
              <Select
                value={form.documentType}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, documentType: value as TemplateFormState['documentType'] }))
                }
              >
                <SelectTrigger className="border-border/60 bg-background/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="templateDescription">Description</Label>
              <Textarea
                id="templateDescription"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Shown in the layout gallery"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="templateBusinessCode">Business code (optional)</Label>
              <Input
                id="templateBusinessCode"
                value={form.businessCode}
                onChange={(event) => setForm((prev) => ({ ...prev, businessCode: event.target.value }))}
                placeholder="STD"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="schemaVersion">Schema version</Label>
              <Input
                id="schemaVersion"
                type="number"
                value={form.schemaVersion}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, schemaVersion: Number(event.target.value || 1) }))
                }
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.isDefault}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, isDefault: checked === true }))
                  }
                />
                Default for type
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, isActive: checked === true }))
                  }
                />
                Active
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr,1.4fr]">
          <div className="rounded-lg border border-muted bg-background/40 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Section Library
              </h3>
              <span className="text-xs text-muted-foreground">Drag onto the canvas</span>
            </div>
            <div className="mt-3 space-y-3">
              {SECTION_LIBRARY.map((section) => (
                <div
                  key={section.name}
                  draggable
                  onDragStart={(event) => handleDragStart(event, { source: 'library', name: section.name })}
                  className={`rounded-lg border border-border/60 bg-background/80 p-3 text-left transition hover:border-primary/50 ${
                    form.layoutSections.includes(section.name) ? 'opacity-40' : 'cursor-grab'
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">{section.name}</p>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={form.layoutSections.includes(section.name)}
                      onClick={() => addSection(section.name)}
                    >
                      Add to layout
                    </Button>
                    <span className="text-xs text-muted-foreground">Drag to position</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-dashed border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground">Custom section</p>
              <div className="mt-2 flex gap-2">
                <Input
                  value={customSectionName}
                  onChange={(event) => setCustomSectionName(event.target.value)}
                  placeholder="e.g. Certifications"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!customSectionName.trim()) return;
                    addSection(customSectionName.trim());
                    setCustomSectionName('');
                  }}
                >
                  Add
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Use for one-off sections.</p>
            </div>
          </div>

          <div
            className="rounded-lg border border-muted bg-background/40 p-4"
            onDragOver={(event) => handleDragOver(event, form.layoutSections.length)}
            onDrop={handleCanvasDrop}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Layout Canvas
              </h3>
              <span className="text-xs text-muted-foreground">Drop sections here</span>
            </div>
            {form.layoutSections.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Drag sections from the library to start building your template.
              </div>
            ) : (
              <div className="mt-4 space-y-3" onDragLeave={handleDragLeave}>
                {form.layoutSections.map((section, index) => (
                  <div
                    key={`${section}-${index}`}
                    draggable
                    onDragStart={(event) => handleDragStart(event, { source: 'canvas', index })}
                    onDragOver={(event) => handleDragOver(event, index)}
                    onDrop={(event) => handleDrop(event, index)}
                    className={`rounded-lg border border-border/60 bg-background/80 p-3 transition ${
                      draggingIndex === index ? 'opacity-60' : ''
                    } ${dropIndex === index ? 'border-primary/60 bg-primary/10' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-1 items-start gap-3">
                        <div className="mt-1 select-none text-lg text-muted-foreground">⋮⋮</div>
                        <div className="flex-1 space-y-2">
                          <Input
                            value={section}
                            onChange={(event) => updateSection(index, event.target.value)}
                            className="bg-background"
                          />
                          <p className="text-xs text-muted-foreground">
                            Drag to reorder. Rename if needed.
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSection(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Layout updates as you drag.</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => addSection('New section')}>
                Add blank section
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" onClick={handleSave}>
            {form.id ? 'Save template' : 'Create template'}
          </Button>
          {form.id ? (
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border border-muted bg-background/40 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Live Preview</h2>
            <span className="text-xs text-muted-foreground">Updates instantly</span>
          </div>
          <div className="mt-4 space-y-4">
            {form.layoutSections.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add sections to see a preview.</p>
            ) : (
              form.layoutSections.map((section, index) => (
                <div
                  key={`${section}-preview-${index}`}
                  className="rounded-lg border border-dashed border-muted bg-muted/20 p-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {section || 'Untitled section'}
                  </p>
                  <div className="mt-3 text-sm">
                    <PreviewSection
                      title={section || 'Untitled section'}
                      documentType={form.documentType}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
