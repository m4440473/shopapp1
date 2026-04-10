'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Table from '@/components/Admin/Table';
import { useToast } from '@/components/ui/Toast';
import { fetchJson } from '@/lib/fetchJson';
import { VendorUpsert } from '@/lib/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { canAccessAdmin } from '@/lib/rbac';
import { useCurrentUser } from '@/lib/use-current-user';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/Textarea';

type Item = {
  id: string;
  name: string;
  url?: string;
  phone?: string;
  contact?: string;
  materials?: string;
  notes?: string;
};

type DialogState = { mode: 'create' | 'edit'; data?: Item } | null;

type ImportPreview = {
  sheetNames: string[];
  selectedSheet: string;
  headerRow: number;
  columns: string[];
  previewRows: Array<Record<string, string>>;
  rawPreviewRows: string[][];
  totalRows: number;
  suggestions: {
    name: string | null;
    url: string | null;
    phone: string | null;
    contact: string | null;
    materials: string | null;
    notes: string[];
  };
};

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  duplicateRowsCollapsed: number;
  errors: string[];
  sample: Array<{
    name: string;
    url?: string;
    phone?: string;
    contact?: string;
    materials?: string;
    notes?: string;
    action: 'create' | 'update' | 'skip';
  }>;
};

const EMPTY_IMPORT_MAPPING = {
  nameColumn: '',
  urlColumn: '',
  phoneColumn: '',
  contactColumn: '',
  materialsColumn: '',
  notesColumns: [] as string[],
  appendUnmappedToNotes: true,
  duplicateMode: 'skip' as 'skip' | 'update',
};

export default function Client({ initial }: { initial: { items?: Item[]; nextCursor?: string | null } }) {
  const [items, setItems] = useState<Item[]>(initial.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor ?? null);
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [form, setForm] = useState({
    name: '',
    url: '',
    phone: '',
    contact: '',
    materials: '',
    notes: '',
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMapping, setImportMapping] = useState(EMPTY_IMPORT_MAPPING);
  const [headerRowInput, setHeaderRowInput] = useState('1');
  const [selectedSheet, setSelectedSheet] = useState('');
  const [importBusy, setImportBusy] = useState<'preview' | 'import' | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const toast = useToast();
  const user = useCurrentUser();
  const isAdmin = canAccessAdmin(user ?? undefined);

  useEffect(() => {
    if (dialog?.mode === 'edit' && dialog.data) {
      setForm({
        name: dialog.data.name ?? '',
        url: dialog.data.url ?? '',
        phone: dialog.data.phone ?? '',
        contact: dialog.data.contact ?? '',
        materials: dialog.data.materials ?? '',
        notes: dialog.data.notes ?? '',
      });
    } else if (dialog?.mode === 'create') {
      setForm({ name: '', url: '', phone: '', contact: '', materials: '', notes: '' });
    }
  }, [dialog]);

  useEffect(() => {
    if (!importPreview) return;
    setHeaderRowInput(String(importPreview.headerRow));
    setSelectedSheet(importPreview.selectedSheet);
    setImportMapping((prev) => ({
      ...prev,
      nameColumn: importPreview.columns.includes(prev.nameColumn)
        ? prev.nameColumn
        : importPreview.suggestions.name || '',
      urlColumn: importPreview.columns.includes(prev.urlColumn)
        ? prev.urlColumn
        : importPreview.suggestions.url || '',
      phoneColumn: importPreview.columns.includes(prev.phoneColumn)
        ? prev.phoneColumn
        : importPreview.suggestions.phone || '',
      contactColumn: importPreview.columns.includes(prev.contactColumn)
        ? prev.contactColumn
        : importPreview.suggestions.contact || '',
      materialsColumn: importPreview.columns.includes(prev.materialsColumn)
        ? prev.materialsColumn
        : importPreview.suggestions.materials || '',
      notesColumns: (
        prev.notesColumns.length
          ? prev.notesColumns.filter((column) => importPreview.columns.includes(column))
          : importPreview.suggestions.notes
      ),
    }));
  }, [importPreview]);

  async function refresh(cursor?: string) {
    const qs = new URLSearchParams();
    if (query) qs.set('q', query);
    if (cursor) qs.set('cursor', cursor);
    const data = await fetchJson<{ items?: Item[]; nextCursor?: string | null }>('/api/admin/vendors?' + qs.toString());
    setItems(cursor ? [...items, ...(data.items ?? [])] : data.items ?? []);
    setNextCursor(data.nextCursor ?? null);
  }

  async function save() {
    try {
      const payload = VendorUpsert.parse({
        name: form.name,
        url: form.url || undefined,
        phone: form.phone || undefined,
        contact: form.contact || undefined,
        materials: form.materials || undefined,
        notes: form.notes || undefined,
      });

      if (dialog?.mode === 'edit' && dialog.data) {
        const res = await fetchJson<{ item: Item }>('/api/admin/vendors/' + dialog.data.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setItems(items.map((i) => (i.id === dialog.data?.id ? res.item : i)));
        toast.push('Vendor updated', 'success');
      } else {
        const res = await fetchJson<{ item: Item }>('/api/admin/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setItems([res.item, ...items]);
        toast.push('Vendor created', 'success');
      }
      setDialog(null);
    } catch (e: any) {
      toast.push(e.message || 'Validation error', 'error');
    }
  }

  async function remove(row: Item) {
    await fetchJson('/api/admin/vendors/' + row.id, { method: 'DELETE' });
    setItems(items.filter((i) => i.id !== row.id));
    toast.push('Vendor deleted', 'success');
  }

  function resetImportState(file: File | null) {
    setImportFile(file);
    setImportPreview(null);
    setImportMapping(EMPTY_IMPORT_MAPPING);
    setHeaderRowInput('1');
    setSelectedSheet('');
    setImportError(null);
    setImportResult(null);
  }

  async function submitImportAction(action: 'preview' | 'import') {
    if (!importFile) {
      setImportError('Choose a spreadsheet file first.');
      return;
    }

    setImportBusy(action);
    setImportError(null);

    try {
      const formData = new FormData();
      formData.set('action', action);
      formData.set('file', importFile);
      if (selectedSheet) formData.set('sheetName', selectedSheet);
      if (headerRowInput) formData.set('headerRow', headerRowInput);

      if (action === 'import') {
        formData.set('nameColumn', importMapping.nameColumn);
        if (importMapping.urlColumn) formData.set('urlColumn', importMapping.urlColumn);
        if (importMapping.phoneColumn) formData.set('phoneColumn', importMapping.phoneColumn);
        if (importMapping.contactColumn) formData.set('contactColumn', importMapping.contactColumn);
        if (importMapping.materialsColumn) formData.set('materialsColumn', importMapping.materialsColumn);
        formData.set('notesColumns', JSON.stringify(importMapping.notesColumns));
        formData.set('appendUnmappedToNotes', String(importMapping.appendUnmappedToNotes));
        formData.set('duplicateMode', importMapping.duplicateMode);
      }

      const res = await fetch('/api/admin/vendors/import', {
        method: 'POST',
        body: formData,
      });
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body?.error || 'Import request failed');
      }

      if (action === 'preview') {
        setImportPreview(body as ImportPreview);
        setImportResult(null);
      } else {
        setImportResult(body as ImportResult);
        await refresh();
        toast.push('Vendor import complete', 'success');
      }
    } catch (error: any) {
      setImportError(typeof error?.message === 'string' ? error.message : 'Import request failed');
    } finally {
      setImportBusy(null);
    }
  }

  const columns = useMemo(
    () => [
      { key: 'name', header: 'Name' },
      { key: 'url', header: 'URL' },
      { key: 'phone', header: 'Phone' },
      { key: 'contact', header: 'Contact' },
      { key: 'materials', header: 'Materials' },
      { key: 'notes', header: 'Notes' },
    ],
    []
  );

  const previewColumnHeaders = importPreview?.columns ?? [];

  return (
    <div className="space-y-6">
      {isAdmin && (
        <section className="space-y-4 rounded-lg border border-border/60 bg-card/40 p-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Import vendors</h2>
            <p className="text-sm text-muted-foreground">
              Upload a spreadsheet, preview the parsed rows, map columns into the current Vendors fields,
              and then import.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="vendorImportFile">Spreadsheet</Label>
                <Input
                  id="vendorImportFile"
                  type="file"
                  accept=".xls,.xlsx,.csv"
                  onChange={(event) => resetImportState(event.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">Supports `.xls`, `.xlsx`, and `.csv`.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="vendorImportSheet">Sheet</Label>
                  <select
                    id="vendorImportSheet"
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedSheet}
                    onChange={(event) => setSelectedSheet(event.target.value)}
                    disabled={!importPreview && !importFile}
                  >
                    <option value="">Auto-select first sheet</option>
                    {(importPreview?.sheetNames ?? []).map((sheet) => (
                      <option key={sheet} value={sheet}>
                        {sheet}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vendorImportHeaderRow">Header row</Label>
                  <Input
                    id="vendorImportHeaderRow"
                    type="number"
                    min={1}
                    value={headerRowInput}
                    onChange={(event) => setHeaderRowInput(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void submitImportAction('preview')} disabled={!importFile || importBusy !== null}>
                  {importBusy === 'preview' ? 'Previewing...' : 'Preview file'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => resetImportState(null)}
                  disabled={!importFile || importBusy !== null}
                >
                  Clear
                </Button>
              </div>

              {importError && <p className="text-sm text-destructive">{importError}</p>}

              {importPreview && (
                <div className="space-y-3 rounded-md border border-border/60 bg-background/40 p-3">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>
                      Sheet: <span className="text-foreground">{importPreview.selectedSheet}</span>
                    </span>
                    <span>
                      Header row: <span className="text-foreground">{importPreview.headerRow}</span>
                    </span>
                    <span>
                      Parsed rows: <span className="text-foreground">{importPreview.totalRows}</span>
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-md border border-border/60">
                    <table className="min-w-full text-sm">
                      <tbody>
                        {importPreview.rawPreviewRows.map((row, rowIndex) => (
                          <tr key={`raw-row-${rowIndex}`} className="border-b border-border/50 last:border-b-0">
                            <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                              Row {rowIndex + 1}
                            </td>
                            {row.map((cell, cellIndex) => (
                              <td key={`raw-cell-${rowIndex}-${cellIndex}`} className="px-3 py-2 text-foreground">
                                {cell || <span className="text-muted-foreground">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-md border border-border/60 bg-background/30 p-4">
              <div className="space-y-1">
                <h3 className="font-medium text-foreground">Column mapping</h3>
                <p className="text-sm text-muted-foreground">
                  Map the source columns into the current Vendor fields.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="mapVendorName">Vendor name</Label>
                <select
                  id="mapVendorName"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={importMapping.nameColumn}
                  onChange={(event) =>
                    setImportMapping((prev) => ({ ...prev, nameColumn: event.target.value }))
                  }
                  disabled={!importPreview}
                >
                  <option value="">Select column</option>
                  {previewColumnHeaders.map((column) => (
                    <option key={`name-${column}`} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="mapVendorUrl">URL</Label>
                <select
                  id="mapVendorUrl"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={importMapping.urlColumn}
                  onChange={(event) =>
                    setImportMapping((prev) => ({ ...prev, urlColumn: event.target.value }))
                  }
                  disabled={!importPreview}
                >
                  <option value="">Do not import</option>
                  {previewColumnHeaders.map((column) => (
                    <option key={`url-${column}`} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="mapVendorPhone">Phone</Label>
                <select
                  id="mapVendorPhone"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={importMapping.phoneColumn}
                  onChange={(event) =>
                    setImportMapping((prev) => ({ ...prev, phoneColumn: event.target.value }))
                  }
                  disabled={!importPreview}
                >
                  <option value="">Do not import</option>
                  {previewColumnHeaders.map((column) => (
                    <option key={`phone-${column}`} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="mapVendorContact">Contact</Label>
                <select
                  id="mapVendorContact"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={importMapping.contactColumn}
                  onChange={(event) =>
                    setImportMapping((prev) => ({ ...prev, contactColumn: event.target.value }))
                  }
                  disabled={!importPreview}
                >
                  <option value="">Do not import</option>
                  {previewColumnHeaders.map((column) => (
                    <option key={`contact-${column}`} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="mapVendorMaterials">Materials</Label>
                <select
                  id="mapVendorMaterials"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={importMapping.materialsColumn}
                  onChange={(event) =>
                    setImportMapping((prev) => ({ ...prev, materialsColumn: event.target.value }))
                  }
                  disabled={!importPreview}
                >
                  <option value="">Do not import</option>
                  {previewColumnHeaders.map((column) => (
                    <option key={`materials-${column}`} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Append to notes</Label>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border/60 bg-background/60 p-3">
                  {previewColumnHeaders.length === 0 && (
                    <p className="text-sm text-muted-foreground">Preview a file to choose note columns.</p>
                  )}
                  {previewColumnHeaders.map((column) => {
                    const checked = importMapping.notesColumns.includes(column);
                    return (
                      <label key={`notes-${column}`} className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setImportMapping((prev) => ({
                              ...prev,
                              notesColumns: event.target.checked
                                ? [...prev.notesColumns, column]
                                : prev.notesColumns.filter((entry) => entry !== column),
                            }))
                          }
                          disabled={!importPreview}
                        />
                        <span>{column}</span>
                      </label>
                    );
                  })}
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={importMapping.appendUnmappedToNotes}
                    onChange={(event) =>
                      setImportMapping((prev) => ({
                        ...prev,
                        appendUnmappedToNotes: event.target.checked,
                      }))
                    }
                    disabled={!importPreview}
                  />
                  <span>Also append unmapped columns to notes</span>
                </label>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="vendorDuplicateMode">Existing vendors</Label>
                <select
                  id="vendorDuplicateMode"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={importMapping.duplicateMode}
                  onChange={(event) =>
                    setImportMapping((prev) => ({
                      ...prev,
                      duplicateMode: event.target.value === 'update' ? 'update' : 'skip',
                    }))
                  }
                  disabled={!importPreview}
                >
                  <option value="skip">Skip matching names</option>
                  <option value="update">Update matching names</option>
                </select>
              </div>

              <Button
                onClick={() => void submitImportAction('import')}
                disabled={!importPreview || !importMapping.nameColumn || importBusy !== null}
              >
                {importBusy === 'import' ? 'Importing...' : 'Import vendors'}
              </Button>
            </div>
          </div>

          {importPreview && (
            <div className="space-y-3">
              <h3 className="font-medium text-foreground">Parsed preview</h3>
              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      {previewColumnHeaders.map((column) => (
                        <th key={`preview-header-${column}`} className="px-3 py-2 text-left font-medium">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.previewRows.map((row, rowIndex) => (
                      <tr key={`preview-row-${rowIndex}`} className="border-t border-border/50">
                        {previewColumnHeaders.map((column) => (
                          <td key={`preview-cell-${rowIndex}-${column}`} className="px-3 py-2 align-top">
                            {row[column] || <span className="text-muted-foreground">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importResult && (
            <div className="space-y-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <span>Created: {importResult.created}</span>
                <span>Updated: {importResult.updated}</span>
                <span>Skipped: {importResult.skipped}</span>
              </div>
              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">Import errors</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                    {importResult.errors.slice(0, 10).map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {importResult.sample.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">Sample results</h3>
                  <div className="overflow-x-auto rounded-md border border-border/60 bg-background/50">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-3 py-2 text-left">Action</th>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Contact</th>
                          <th className="px-3 py-2 text-left">Materials</th>
                          <th className="px-3 py-2 text-left">Phone</th>
                          <th className="px-3 py-2 text-left">URL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.sample.map((row) => (
                          <tr key={`${row.action}-${row.name}`} className="border-t border-border/50">
                            <td className="px-3 py-2 capitalize">{row.action}</td>
                            <td className="px-3 py-2">{row.name}</td>
                            <td className="px-3 py-2">{row.contact || '—'}</td>
                            <td className="px-3 py-2">{row.materials || '—'}</td>
                            <td className="px-3 py-2">{row.phone || '—'}</td>
                            <td className="px-3 py-2">{row.url || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full max-w-xs"
          />
          <Button variant="outline" onClick={() => refresh()}>
            Search
          </Button>
          <div className="flex-1" />
          {isAdmin && <Button onClick={() => setDialog({ mode: 'create' })}>New vendor</Button>}
        </div>

        <Table
          columns={columns as never}
          rows={items}
          onEdit={(row) => setDialog({ mode: 'edit', data: row })}
          onDelete={remove}
          actionsEnabled={isAdmin}
        />

        {nextCursor && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => refresh(nextCursor)}>
              Load more
            </Button>
          </div>
        )}
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'edit' ? 'Edit vendor' : 'New vendor'}</DialogTitle>
            <DialogDescription>Store trusted supplier information.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="vendorName">Name</Label>
              <Input
                id="vendorName"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendorUrl">URL</Label>
              <Input
                id="vendorUrl"
                value={form.url}
                onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://"
              />
            </div>
              <div className="grid gap-2">
                <Label htmlFor="vendorPhone">Phone</Label>
                <Input
                id="vendorPhone"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
                />
              </div>
            <div className="grid gap-2">
              <Label htmlFor="vendorContact">Contact</Label>
              <Input
                id="vendorContact"
                value={form.contact}
                onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendorMaterials">Materials</Label>
              <Input
                id="vendorMaterials"
                value={form.materials}
                onChange={(e) => setForm((prev) => ({ ...prev, materials: e.target.value }))}
                placeholder="Aluminum, stainless, plastics"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendorNotes">Notes</Label>
              <Textarea
                id="vendorNotes"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
