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
import { DEFAULT_TEMPLATE_SECTIONS } from '@/lib/document-template-layout';

const DOCUMENT_TYPES = ['QUOTE', 'INVOICE', 'ORDER_PRINT'] as const;

type TemplateLayout = {
  sections: string[];
};

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
  layoutJson: TemplateLayout;
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

function normalizeLayout(layoutJson: unknown): TemplateLayout {
  if (layoutJson && typeof layoutJson === 'object' && Array.isArray((layoutJson as any).sections)) {
    return { sections: (layoutJson as any).sections as string[] };
  }
  return { sections: [...DEFAULT_TEMPLATE_SECTIONS] };
}

export default function TemplatesClient({ initialTemplates }: { initialTemplates: TemplateRecord[] }) {
  const toast = useToast();
  const [templates, setTemplates] = React.useState<TemplateRecord[]>(initialTemplates);
  const [selectedId, setSelectedId] = React.useState<string | null>(templates[0]?.id ?? null);
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
      layoutSections: normalizeLayout(selected.layoutJson).sections,
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
      layoutSections: normalizeLayout(selected.layoutJson).sections,
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

  const addSection = () => {
    setForm((prev) => ({
      ...prev,
      layoutSections: [...prev.layoutSections, `Section ${prev.layoutSections.length + 1}`],
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

  const moveSection = (index: number, direction: 'up' | 'down') => {
    setForm((prev) => {
      const next = [...prev.layoutSections];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return { ...prev, layoutSections: next };
    });
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Layout sections</Label>
                <Button type="button" size="sm" variant="secondary" onClick={addSection}>
                  Add section
                </Button>
              </div>
              <div className="space-y-2">
                {form.layoutSections.map((section, index) => (
                  <div key={`${section}-${index}`} className="flex flex-wrap items-center gap-2">
                    <Input
                      value={section}
                      onChange={(event) => updateSection(index, event.target.value)}
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => moveSection(index, 'up')}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => moveSection(index, 'down')}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => removeSection(index)}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
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
        </div>

        <div className="rounded-lg border border-muted bg-background/40 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Live Preview
          </h2>
          <div className="mt-3 space-y-2">
            {form.layoutSections.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add sections to see a preview.</p>
            ) : (
              form.layoutSections.map((section, index) => (
                <div
                  key={`${section}-preview-${index}`}
                  className="rounded border border-dashed border-muted bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
                >
                  {index + 1}. {section || 'Untitled section'}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
