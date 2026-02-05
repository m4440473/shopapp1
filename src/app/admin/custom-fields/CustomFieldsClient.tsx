'use client';
import { fetchJson } from '@/lib/fetchJson';

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
import type { CustomFieldDefinition, CustomFieldOption } from '@/components/CustomFieldInputs';
import { canAccessAdmin } from '@/lib/rbac';
import { useCurrentUser } from '@/lib/use-current-user';

const FIELD_TYPES: Array<CustomFieldDefinition['fieldType']> = [
  'TEXT',
  'LONG_TEXT',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'SELECT',
  'MULTISELECT',
];

const ENTITY_TYPES: Array<'ORDER' | 'QUOTE'> = ['ORDER', 'QUOTE'];

type CustomFieldFormState = {
  id?: string;
  name: string;
  key: string;
  entityType: 'ORDER' | 'QUOTE';
  fieldType: CustomFieldDefinition['fieldType'];
  description: string;
  businessCode: string;
  defaultValue: unknown;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  options: CustomFieldOption[];
};

const emptyForm: CustomFieldFormState = {
  name: '',
  key: '',
  entityType: 'ORDER',
  fieldType: 'TEXT',
  description: '',
  businessCode: '',
  defaultValue: '',
  isRequired: false,
  isActive: true,
  sortOrder: 0,
  options: [],
};

function normalizeDefaultValue(fieldType: CustomFieldFormState['fieldType'], value: unknown) {
  if (fieldType === 'BOOLEAN') return Boolean(value);
  if (fieldType === 'NUMBER') return typeof value === 'number' ? value : value ? Number(value) : '';
  if (fieldType === 'MULTISELECT') return Array.isArray(value) ? value : [];
  if (fieldType === 'SELECT') return typeof value === 'string' ? value : '';
  return typeof value === 'string' ? value : value ? String(value) : '';
}

export default function CustomFieldsClient({ initialFields }: { initialFields: CustomFieldDefinition[] }) {
  const toast = useToast();
  const [fields, setFields] = React.useState<CustomFieldDefinition[]>(initialFields);
  const [selectedId, setSelectedId] = React.useState<string | null>(fields[0]?.id ?? null);
  const user = useCurrentUser();
  const isAdmin = canAccessAdmin(user ?? undefined);
  const [form, setForm] = React.useState<CustomFieldFormState>(() => {
    const selected = fields[0];
    if (!selected) return emptyForm;
    return {
      id: selected.id,
      name: selected.name,
      key: selected.key,
      entityType: selected.entityType as 'ORDER' | 'QUOTE',
      fieldType: selected.fieldType,
      description: selected.description ?? '',
      businessCode: selected.businessCode ?? '',
      defaultValue: normalizeDefaultValue(selected.fieldType, selected.defaultValue),
      isRequired: selected.isRequired,
      isActive: selected.isActive,
      sortOrder: selected.sortOrder ?? 0,
      options: (selected.options ?? []).map((option) => ({ ...option })),
    };
  });

  const hasOptions = form.fieldType === 'SELECT' || form.fieldType === 'MULTISELECT';

  React.useEffect(() => {
    if (!selectedId) return;
    const selected = fields.find((field) => field.id === selectedId);
    if (!selected) return;
    setForm({
      id: selected.id,
      name: selected.name,
      key: selected.key,
      entityType: selected.entityType as 'ORDER' | 'QUOTE',
      fieldType: selected.fieldType,
      description: selected.description ?? '',
      businessCode: selected.businessCode ?? '',
      defaultValue: normalizeDefaultValue(selected.fieldType, selected.defaultValue),
      isRequired: selected.isRequired,
      isActive: selected.isActive,
      sortOrder: selected.sortOrder ?? 0,
      options: (selected.options ?? []).map((option) => ({ ...option })),
    });
  }, [fields, selectedId]);

  const refresh = React.useCallback(async () => {
    const data = await fetchJson<{ items: CustomFieldDefinition[] }>('/api/admin/custom-fields?take=100');
    setFields(data.items ?? []);
  }, []);

  const handleCreateNew = () => {
    setSelectedId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.key.trim()) {
      toast.push('Name and key are required', 'error');
      return;
    }

    const payload = {
      entityType: form.entityType,
      name: form.name.trim(),
      key: form.key.trim(),
      fieldType: form.fieldType,
      description: form.description.trim() || undefined,
      businessCode: form.businessCode.trim() || undefined,
      defaultValue: form.defaultValue,
      isRequired: form.isRequired,
      isActive: form.isActive,
      sortOrder: Number.isFinite(form.sortOrder) ? form.sortOrder : 0,
      options: hasOptions
        ? form.options.map((option, index) => ({
            label: option.label.trim(),
            value: option.value.trim(),
            sortOrder: option.sortOrder ?? index,
            isActive: option.isActive ?? true,
          }))
        : undefined,
    };

    if (form.id) {
      await fetchJson(`/api/admin/custom-fields/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast.push('Custom field updated', 'success');
    } else {
      const response = await fetchJson<{ item: CustomFieldDefinition }>(`/api/admin/custom-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setSelectedId(response.item.id);
      toast.push('Custom field created', 'success');
    }

    await refresh();
  };

  const handleDelete = async () => {
    if (!form.id) return;
    await fetchJson(`/api/admin/custom-fields/${form.id}`, { method: 'DELETE' });
    toast.push('Custom field deleted', 'success');
    await refresh();
    setSelectedId(null);
    setForm({ ...emptyForm });
  };

  const handleOptionChange = (index: number, patch: Partial<CustomFieldOption>) => {
    setForm((prev) => {
      const next = [...prev.options];
      next[index] = { ...next[index], ...patch };
      return { ...prev, options: next };
    });
  };

  const addOption = () => {
    setForm((prev) => ({
      ...prev,
      options: [
        ...prev.options,
        {
          id: `new-${Math.random().toString(36).slice(2)}`,
          label: '',
          value: '',
          sortOrder: prev.options.length,
          isActive: true,
        },
      ],
    }));
  };

  const removeOption = (index: number) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const moveField = async (fieldId: string, direction: 'up' | 'down') => {
    const sorted = [...fields].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
    );
    const index = sorted.findIndex((field) => field.id === fieldId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) return;

    const current = sorted[index];
    const target = sorted[targetIndex];

    await Promise.all([
      fetchJson(`/api/admin/custom-fields/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: target.sortOrder ?? 0 }),
      }),
      fetchJson(`/api/admin/custom-fields/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: current.sortOrder ?? 0 }),
      }),
    ]);

    await refresh();
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div className="rounded-lg border border-muted bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Field Library</h2>
          {isAdmin && (
            <Button type="button" size="sm" variant="secondary" onClick={handleCreateNew}>
              Add field
            </Button>
          )}
        </div>
        <div className="mt-4 space-y-3">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom fields configured yet.</p>
          ) : (
            fields
              .slice()
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
              .map((field) => (
                <div
                  key={field.id}
                  className={`rounded-md border border-muted p-3 ${
                    selectedId === field.id ? 'bg-primary/10' : 'bg-background/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => setSelectedId(field.id)}
                    >
                      <p className="font-medium text-foreground">{field.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {field.entityType} · {field.fieldType} ·{' '}
                        {field.businessCode ? `Business ${field.businessCode}` : 'All businesses'}
                      </p>
                    </button>
                    {isAdmin && (
                      <div className="flex flex-col gap-1 text-xs">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => moveField(field.id, 'up')}
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => moveField(field.id, 'down')}
                        >
                          ↓
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {field.isRequired ? 'Required' : 'Optional'} ·{' '}
                    {field.isActive ? 'Active' : 'Inactive'} · Order {field.sortOrder}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      <div className="rounded-lg border border-muted bg-background/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Field Builder</h2>
        <div className="mt-4 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="fieldName">Field label *</Label>
            <Input
              id="fieldName"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Order reference"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fieldKey">Field key *</Label>
            <Input
              id="fieldKey"
              value={form.key}
              onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
              placeholder="order_reference"
            />
          </div>
          <div className="grid gap-2">
            <Label>Entity type</Label>
            <Select
              value={form.entityType}
              onValueChange={(value) => setForm((prev) => ({ ...prev, entityType: value as 'ORDER' | 'QUOTE' }))}
            >
              <SelectTrigger className="border-border/60 bg-background/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Field type</Label>
            <Select
              value={form.fieldType}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  fieldType: value as CustomFieldDefinition['fieldType'],
                  options: ['SELECT', 'MULTISELECT'].includes(value) ? prev.options : [],
                  defaultValue: normalizeDefaultValue(value as CustomFieldDefinition['fieldType'], prev.defaultValue),
                }))
              }
            >
              <SelectTrigger className="border-border/60 bg-background/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fieldDescription">Description</Label>
            <Textarea
              id="fieldDescription"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Used on the intake form"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="businessCode">Business code (optional)</Label>
            <Input
              id="businessCode"
              value={form.businessCode}
              onChange={(event) => setForm((prev) => ({ ...prev, businessCode: event.target.value }))}
              placeholder="STD"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sortOrder">Sort order</Label>
            <Input
              id="sortOrder"
              type="number"
              value={form.sortOrder}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, sortOrder: Number(event.target.value || 0) }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>Default value</Label>
            {form.fieldType === 'LONG_TEXT' ? (
              <Textarea
                value={typeof form.defaultValue === 'string' ? form.defaultValue : ''}
                onChange={(event) => setForm((prev) => ({ ...prev, defaultValue: event.target.value }))}
              />
            ) : form.fieldType === 'BOOLEAN' ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean(form.defaultValue)}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, defaultValue: checked === true }))
                  }
                />
                Default to checked
              </label>
            ) : form.fieldType === 'SELECT' ? (
              <Input
                value={typeof form.defaultValue === 'string' ? form.defaultValue : ''}
                onChange={(event) => setForm((prev) => ({ ...prev, defaultValue: event.target.value }))}
                placeholder="Option value"
              />
            ) : form.fieldType === 'MULTISELECT' ? (
              <Input
                value={Array.isArray(form.defaultValue) ? form.defaultValue.join(', ') : ''}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    defaultValue: event.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="value1, value2"
              />
            ) : (
              <Input
                value={form.defaultValue as string | number | undefined}
                onChange={(event) => setForm((prev) => ({ ...prev, defaultValue: event.target.value }))}
                type={form.fieldType === 'NUMBER' ? 'number' : form.fieldType === 'DATE' ? 'date' : 'text'}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isRequired}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, isRequired: checked === true }))
                }
              />
              Required
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

          {hasOptions ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Options</Label>
                {isAdmin && (
                  <Button type="button" size="sm" variant="secondary" onClick={addOption}>
                    Add option
                  </Button>
                )}
              </div>
              {form.options.length === 0 ? (
                <p className="text-xs text-muted-foreground">No options configured yet.</p>
              ) : (
                form.options.map((option, index) => (
                  <div key={option.id} className="grid gap-2 rounded border border-border/60 p-3">
                    <div className="grid gap-2">
                      <Label>Label</Label>
                      <Input
                        value={option.label}
                        onChange={(event) => handleOptionChange(index, { label: event.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Value</Label>
                      <Input
                        value={option.value}
                        onChange={(event) => handleOptionChange(index, { value: event.target.value })}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={option.isActive ?? true}
                          onCheckedChange={(checked) =>
                            handleOptionChange(index, { isActive: checked === true })
                          }
                        />
                        Active
                      </label>
                      {isAdmin && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeOption(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {isAdmin && (
              <>
                <Button type="button" onClick={handleSave}>
                  {form.id ? 'Save field' : 'Create field'}
                </Button>
                {form.id ? (
                  <Button type="button" variant="destructive" onClick={handleDelete}>
                    Delete
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
