'use client';

import React from 'react';

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

export type CustomFieldOption = {
  id: string;
  label: string;
  value: string;
  sortOrder?: number | null;
  isActive?: boolean | null;
};

export type CustomFieldDefinition = {
  id: string;
  name: string;
  key: string;
  entityType: 'ORDER' | 'QUOTE';
  fieldType: 'TEXT' | 'LONG_TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'MULTISELECT';
  description?: string | null;
  businessCode?: string | null;
  defaultValue?: unknown;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  uiSection?: string | null;
  options?: CustomFieldOption[];
};

type CustomFieldInputsProps = {
  fields: CustomFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
  disabled?: boolean;
  title?: string;
  description?: string;
};

const NONE_VALUE = '__unset__';

const normalizeOptions = (field: CustomFieldDefinition) =>
  (field.options ?? [])
    .filter((option) => option.isActive !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label));

export function CustomFieldInputs({
  fields,
  values,
  onChange,
  disabled,
  title = 'Custom fields',
  description,
}: CustomFieldInputsProps) {
  if (!fields.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
        No custom fields are configured for this business yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => {
          const value = values[field.id];
          const options = normalizeOptions(field);

          if (field.fieldType === 'LONG_TEXT') {
            return (
              <div key={field.id} className="grid gap-2 md:col-span-2">
                <Label htmlFor={`custom-${field.id}`} className="flex items-center gap-2">
                  {field.name}
                  {field.isRequired ? (
                    <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] uppercase text-destructive">
                      Required
                    </span>
                  ) : null}
                </Label>
                <Textarea
                  id={`custom-${field.id}`}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(event) => onChange(field.id, event.target.value)}
                  placeholder={field.description ?? ''}
                  disabled={disabled}
                />
                {field.description ? (
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                ) : null}
              </div>
            );
          }

          if (field.fieldType === 'BOOLEAN') {
            return (
              <div key={field.id} className="flex items-start gap-3 rounded-md border border-border/60 bg-background/60 p-3">
                <Checkbox
                  id={`custom-${field.id}`}
                  checked={Boolean(value)}
                  onCheckedChange={(checked) => onChange(field.id, checked === true)}
                  disabled={disabled}
                />
                <div className="grid gap-1">
                  <Label htmlFor={`custom-${field.id}`} className="text-sm font-medium">
                    {field.name}
                  </Label>
                  {field.description ? (
                    <p className="text-xs text-muted-foreground">{field.description}</p>
                  ) : null}
                </div>
              </div>
            );
          }

          if (field.fieldType === 'SELECT') {
            return (
              <div key={field.id} className="grid gap-2">
                <Label htmlFor={`custom-${field.id}`} className="flex items-center gap-2">
                  {field.name}
                  {field.isRequired ? (
                    <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] uppercase text-destructive">
                      Required
                    </span>
                  ) : null}
                </Label>
                <Select
                  value={typeof value === 'string' && value.length ? value : NONE_VALUE}
                  onValueChange={(nextValue) =>
                    onChange(field.id, nextValue === NONE_VALUE ? undefined : nextValue)
                  }
                  disabled={disabled}
                >
                  <SelectTrigger id={`custom-${field.id}`} className="border-border/60 bg-background/80">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>No selection</SelectItem>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {field.description ? (
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                ) : null}
              </div>
            );
          }

          if (field.fieldType === 'MULTISELECT') {
            const selectedValues = Array.isArray(value) ? value : [];
            return (
              <div key={field.id} className="grid gap-2">
                <Label className="flex items-center gap-2">
                  {field.name}
                  {field.isRequired ? (
                    <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] uppercase text-destructive">
                      Required
                    </span>
                  ) : null}
                </Label>
                <div className="grid gap-2 rounded-md border border-border/60 bg-background/60 p-3">
                  {options.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={selectedValues.includes(option.value)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedValues as string[]);
                          if (checked === true) {
                            next.add(option.value);
                          } else {
                            next.delete(option.value);
                          }
                          onChange(field.id, Array.from(next));
                        }}
                        disabled={disabled}
                      />
                      {option.label}
                    </label>
                  ))}
                  {!options.length ? (
                    <p className="text-xs text-muted-foreground">No options configured.</p>
                  ) : null}
                </div>
                {field.description ? (
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                ) : null}
              </div>
            );
          }

          return (
            <div key={field.id} className="grid gap-2">
              <Label htmlFor={`custom-${field.id}`} className="flex items-center gap-2">
                {field.name}
                {field.isRequired ? (
                  <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] uppercase text-destructive">
                    Required
                  </span>
                ) : null}
              </Label>
              <Input
                id={`custom-${field.id}`}
                type={field.fieldType === 'NUMBER' ? 'number' : field.fieldType === 'DATE' ? 'date' : 'text'}
                value={
                  field.fieldType === 'NUMBER'
                    ? value === undefined || value === null
                      ? ''
                      : String(value)
                    : typeof value === 'string'
                    ? value
                    : ''
                }
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (field.fieldType === 'NUMBER') {
                    onChange(field.id, nextValue === '' ? undefined : Number(nextValue));
                  } else {
                    onChange(field.id, nextValue);
                  }
                }}
                placeholder={field.description ?? ''}
                disabled={disabled}
              />
              {field.description ? (
                <p className="text-xs text-muted-foreground">{field.description}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
