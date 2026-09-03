'use client';

import { PlusCircle } from 'lucide-react';

import { AvailableItemsLibrary, type AvailableItem } from '@/components/AvailableItemsLibrary';
import { AssignedItemsPanel } from '@/components/AssignedItemsPanel';
import { CustomerPartNoteSuggestions, appendSuggestedNote } from '@/components/customer-parts/CustomerPartNoteSuggestions';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/Textarea';
import type { CustomerPartNoteSuggestion } from '@/modules/customer-parts/customer-parts.types';
import {
  calculateAssignmentTotalCents,
  formatWorkItemRateLabel,
  getWorkItemPricingSemantic,
  getWorkItemUnitsLabel,
  type WorkItemRateType,
} from '@/modules/pricing/work-item-pricing';
import type { RepeatOrderTemplateDetail } from '@/modules/repeat-orders/repeat-orders.types';

const OPTIONAL_VALUE = '__none__';
const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
const numberFromString = (value: string) => {
  const parsed = Number.parseFloat(value || '0');
  return Number.isFinite(parsed) ? parsed : 0;
};

export type NewOrderAddonOption = {
  id: string;
  name: string;
  description?: string | null;
  rateType?: WorkItemRateType;
  rateCents?: number;
  active?: boolean;
  affectsPrice?: boolean;
  isChecklistItem?: boolean;
  department?: { id: string; name: string } | null;
};

export type NewOrderPartAddonSelection = { key: string; addonId: string; units: string; notes: string };

export type NewOrderPartInput = {
  key: string;
  templatePartId?: string;
  sourceQuotePartId?: string;
  partNumber: string;
  partName: string;
  quantity: string;
  materialId?: string;
  stockSize?: string;
  cutLength?: string;
  finalPartLength?: string;
  drawingMaterialText?: string;
  drawingFinishText?: string;
  finish?: string;
  partWidth?: string;
  partThickness?: string;
  notes?: string;
  workInstructions?: string;
  noteSuggestions?: CustomerPartNoteSuggestion[];
  addonSelections: NewOrderPartAddonSelection[];
  templateCharges?: RepeatOrderTemplateDetail['parts'][number]['charges'];
  templateAttachments?: RepeatOrderTemplateDetail['parts'][number]['attachments'];
  attachments: Array<{ kind: 'DWG' | 'STEP' | 'PRINT' | 'PDF' | 'IMAGE'; storagePath: string; label: string; mimeType: string }>;
};

type NewOrderPartsEditorProps = {
  mode: 'direct' | 'conversion' | 'template';
  parts: NewOrderPartInput[];
  activePartKey: string;
  materials: Array<{ id: string; name: string }>;
  availableItems: AvailableItem[];
  availableItemsById: Map<string, AvailableItem>;
  onSelectPart: (partKey: string) => void;
  onAddPart: () => void;
  onImportMore: () => void;
  onRemovePart: (partKey: string) => void;
  onUpdatePart: (partKey: string, patch: Partial<NewOrderPartInput>) => void;
  onAddAddon: (partKey: string, addonId: string) => void;
  onUpdateAddon: (partKey: string, key: string, patch: Partial<NewOrderPartAddonSelection>) => void;
  onRemoveAddon: (partKey: string, key: string) => void;
  onMoveAddon: (partKey: string, key: string, direction: 'up' | 'down') => void;
};

export function NewOrderPartsEditor({ mode, parts, activePartKey, materials, availableItems, availableItemsById, onSelectPart, onAddPart, onImportMore, onRemovePart, onUpdatePart, onAddAddon, onUpdateAddon, onRemoveAddon, onMoveAddon }: NewOrderPartsEditorProps) {
  const templateMode = mode === 'template';
  const conversionMode = mode === 'conversion';
  const activePart = parts.find((part) => part.key === activePartKey) ?? parts[0];

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Parts in this order</CardTitle>
          <CardDescription>{templateMode ? 'Review the saved part setup, then adjust only what this repeat run needs.' : 'Track every unique part, quantity, and preferred material.'}</CardDescription>
        </div>
        {!templateMode && (
          <div className="flex flex-wrap gap-2">
            {!conversionMode && <Button type="button" variant="ghost" onClick={onImportMore}>Import more drawings</Button>}
            <Button type="button" variant="secondary" className="rounded-full border border-primary/40 bg-primary/10 text-primary" onClick={onAddPart}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add part
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <AvailableItemsLibrary
          title="Available items library"
          description={templateMode ? 'Charges and checklist structure come from the repeat template and are read-only here.' : conversionMode ? 'Add-ons come from the quote and are read-only here.' : 'Drag items onto the selected part or click Add.'}
          items={availableItems}
          onAddItem={(item) => { if (activePart && !conversionMode && !templateMode) onAddAddon(activePart.key, item.id); }}
          disabled={conversionMode || templateMode}
        />
        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-background/60 p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Parts list</p>
            <p className="text-xs text-muted-foreground">{templateMode ? 'Select a part to review notes, work instructions, and saved files.' : 'Select a part to assign add-ons.'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {parts.map((part, index) => (
                <Button key={part.key} type="button" variant="outline" size="sm" onClick={() => onSelectPart(part.key)} className={`justify-start ${part.key === activePartKey ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground'}`}>
                  {part.partNumber || `Part ${index + 1}`}
                </Button>
              ))}
            </div>
          </div>
          {activePart ? (
            <>
              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Selected part</h3>
                  {!templateMode && parts.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => onRemovePart(activePart.key)}>Remove</Button>}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2"><Label>Part number</Label><Input value={activePart.partNumber} onChange={(event) => onUpdatePart(activePart.key, { partNumber: event.target.value })} placeholder="e.g. SP-1024" disabled={templateMode} required /></div>
                  <div className="grid gap-2"><Label>Part name</Label><Input value={activePart.partName} onChange={(event) => onUpdatePart(activePart.key, { partName: event.target.value })} placeholder="e.g. Vertical rail mount" disabled={templateMode} /></div>
                  <div className="grid gap-2">
                    <Label>Quantity</Label>
                    <Input type="number" min={1} value={activePart.quantity} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onUpdatePart(activePart.key, { quantity: event.target.value })} onBlur={() => { if (!activePart.quantity.trim()) onUpdatePart(activePart.key, { quantity: '1' }); }} />
                  </div>
                  {activePart.attachments.length ? (
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Drawing attached to this part</Label>
                      {activePart.attachments.map((attachment) => (
                        <div key={attachment.storagePath} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-sm"><span>{attachment.label}</span><a href={`/api/orders/drawing-import/preview?path=${encodeURIComponent(attachment.storagePath)}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">Open drawing</a></div>
                      ))}
                    </div>
                  ) : null}
                  <div className="grid gap-2"><Label>Finished part thickness (optional)</Label><Input value={activePart.partThickness || ''} onChange={(event) => onUpdatePart(activePart.key, { partThickness: event.target.value })} placeholder="e.g. .25 in" disabled={templateMode} /></div>
                  <div className="grid gap-2"><Label>Finished part width (optional)</Label><Input value={activePart.partWidth || ''} onChange={(event) => onUpdatePart(activePart.key, { partWidth: event.target.value })} placeholder="e.g. 2.5 in" disabled={templateMode} /></div>
                  <div className="grid gap-2"><Label>Total stock dimensions (optional)</Label><Input value={activePart.stockSize || ''} onChange={(event) => onUpdatePart(activePart.key, { stockSize: event.target.value })} placeholder="Thickness × width × total length" disabled={templateMode} /></div>
                  <div className="grid gap-2"><Label>Cut length (optional)</Label><Input value={activePart.cutLength || ''} onChange={(event) => onUpdatePart(activePart.key, { cutLength: event.target.value })} placeholder="e.g. 6.5 in" disabled={templateMode} /></div>
                  <div className="grid gap-2">
                    <Label>Preferred material</Label>
                    <Select value={activePart.materialId || OPTIONAL_VALUE} onValueChange={(value) => onUpdatePart(activePart.key, { materialId: value === OPTIONAL_VALUE ? '' : value })} disabled={templateMode}>
                      <SelectTrigger className="border-border/60 bg-background/80"><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent><SelectItem value={OPTIONAL_VALUE}>TBD</SelectItem>{materials.map((material) => <SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 md:col-span-2"><Label>Notes</Label><Textarea value={activePart.notes} onChange={(event) => onUpdatePart(activePart.key, { notes: event.target.value })} placeholder="Surface finish, tolerances, tooling, etc." className="min-h-[100px]" /></div>
                  <div className="grid gap-2 rounded-lg border border-amber-500/35 bg-amber-500/5 p-4 md:col-span-2">
                    <div className="space-y-1"><Label className="text-amber-100">Required reading / Read Me First</Label><p className="text-xs text-muted-foreground">If this has text, whichever employee is selected to start the timer must read and acknowledge it first. Acknowledgements are recorded per user, department, and version.</p></div>
                    <Textarea value={activePart.workInstructions || ''} onChange={(event) => onUpdatePart(activePart.key, { workInstructions: event.target.value })} placeholder="Example: Review rev C print; use fixture 207-B; first piece inspection required before continuing." className="min-h-[140px] border-amber-500/25 bg-background/80" />
                  </div>
                  <div className="md:col-span-2"><CustomerPartNoteSuggestions suggestions={activePart.noteSuggestions ?? []} onApply={(suggestion) => onUpdatePart(activePart.key, { [suggestion.destination]: appendSuggestedNote(activePart[suggestion.destination] || '', suggestion.text) })} /></div>
                </div>
              </div>
              {templateMode ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Saved process items</h3>
                    <div className="mt-3 space-y-3">
                      {(activePart.templateCharges ?? []).length ? (activePart.templateCharges ?? []).map((charge, index) => (
                        <div key={charge.id ?? `${charge.name}-${index}`} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-medium text-foreground">{charge.name}</span><span className="text-xs uppercase tracking-wide text-muted-foreground">{charge.kind}</span></div><div className="mt-1 text-xs text-muted-foreground">Qty {charge.quantity} at ${charge.unitPrice} each</div>{charge.description ? <p className="mt-2 text-sm text-muted-foreground">{charge.description}</p> : null}</div>
                      )) : <p className="text-sm text-muted-foreground">No saved charges on this part.</p>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Saved part files</h3>
                    <div className="mt-3 space-y-3">
                      {(activePart.templateAttachments ?? []).length ? (activePart.templateAttachments ?? []).map((attachment, index) => {
                        const href = attachment.storagePath ? `/attachments/${attachment.storagePath}` : attachment.url;
                        return <div key={attachment.id ?? `${attachment.label}-${index}`} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3 text-sm"><div className="font-medium text-foreground">{attachment.label || 'Template attachment'}</div><div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{attachment.kind}</div>{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex font-medium text-primary hover:underline">Open file</a> : null}</div>;
                      }) : <p className="text-sm text-muted-foreground">No saved files on this part.</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <AssignedItemsPanel
                  title="Assigned add-ons & labor"
                  description={conversionMode ? 'Add-ons are read-only while converting from a quote.' : 'Drop items here or use Add from the library.'}
                  assignments={activePart.addonSelections.map((selection) => ({ key: selection.key, itemId: selection.addonId, units: selection.units, notes: selection.notes }))}
                  itemsById={availableItemsById}
                  onAddItem={(itemId) => { if (!conversionMode) onAddAddon(activePart.key, itemId); }}
                  onUpdateAssignment={(key, patch) => { if (!conversionMode) onUpdateAddon(activePart.key, key, patch); }}
                  onRemoveAssignment={(key) => { if (!conversionMode) onRemoveAddon(activePart.key, key); }}
                  onMoveAssignment={(key, direction) => { if (!conversionMode) onMoveAddon(activePart.key, key, direction); }}
                  renderMeta={(assignment, item) => {
                    if (!item) return null;
                    if (getWorkItemPricingSemantic(item) === 'CHECKLIST_ONLY') return <div className="rounded border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">No charge (checklist only).</div>;
                    if (typeof item.rateCents !== 'number') return <div className="rounded border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Price unavailable for this add-on.</div>;
                    const units = numberFromString(assignment.units);
                    const totalCents = calculateAssignmentTotalCents({ item, units });
                    return <div className="rounded border border-border/60 bg-background px-3 py-2 text-sm">{formatWorkItemRateLabel(item)} x {units.toFixed(2)} {getWorkItemUnitsLabel(item.rateType, 'short')} = {formatCurrency(totalCents)}</div>;
                  }}
                  disabled={conversionMode}
                />
              )}
            </>
          ) : <p className="text-sm text-muted-foreground">Select a part to edit details.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
