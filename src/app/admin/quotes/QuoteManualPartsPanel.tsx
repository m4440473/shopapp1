'use client';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/Textarea';

const NO_MATERIAL_VALUE = '__no_material__';

type ManualPartAttachment = {
  storagePath: string;
};

export type QuoteManualPart = {
  key: string;
  name: string;
  partNumber: string;
  quantity: string;
  pieceCount: string;
  materialId: string;
  stockSize: string;
  partThickness: string;
  partWidth: string;
  cutLength: string;
  finish: string;
  drawingFinishText: string;
  drawingMaterialText: string;
  description: string;
  attachments: ManualPartAttachment[];
};

type QuoteManualPartsPanelProps = {
  parts: QuoteManualPart[];
  activePartKey: string;
  materials: Array<{ id: string; name: string }>;
  onAddPart: () => void;
  onSelectPart: (partKey: string) => void;
  onRemovePart: (partKey: string) => void;
  onUpdatePart: (partKey: string, patch: Partial<QuoteManualPart>) => void;
};

export function QuoteManualPartsPanel({
  parts,
  activePartKey,
  materials,
  onAddPart,
  onSelectPart,
  onRemovePart,
  onUpdatePart,
}: QuoteManualPartsPanelProps) {
  const activePart = parts.find((part) => part.key === activePartKey) ?? parts[0] ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parts</CardTitle>
        <CardDescription>Define the core part list before you add labor or files.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3 rounded border border-border/60 bg-muted/10 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Parts list</p>
            <Button type="button" variant="outline" size="sm" onClick={onAddPart}>
              Add part
            </Button>
          </div>
          <div className="space-y-2">
            {parts.map((part, index) => (
              <Button
                key={part.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSelectPart(part.key)}
                className={`h-auto min-w-0 w-full max-w-full flex-col items-stretch justify-start gap-1 whitespace-normal rounded border px-3 py-2 text-left text-sm ${
                  part.key === activePartKey
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="min-w-0 break-words font-medium leading-snug [overflow-wrap:anywhere]">
                  {part.name || `Part ${index + 1}`}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-1 text-xs leading-snug text-muted-foreground">
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                    {part.partNumber || 'No part number'}
                  </span>
                  <span aria-hidden="true">•</span>
                  <span className="shrink-0">Qty {part.quantity || '1'}</span>
                </div>
              </Button>
            ))}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {activePart ? (
            <div className="rounded border border-border/60 bg-card/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Selected part</p>
                  <h3 className="text-lg font-semibold">{activePart.name || 'New part'}</h3>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onRemovePart(activePart.key)}
                  disabled={parts.length === 1}
                >
                  Remove
                </Button>
              </div>

              {activePart.attachments.length ? (
                <div className="mt-3 flex flex-wrap gap-3 rounded-lg border border-border/60 bg-background/60 p-3 text-sm">
                  {activePart.attachments.map((attachment, index) => (
                    <a
                      key={`${attachment.storagePath}-${index}`}
                      href={`/api/orders/drawing-import/preview?path=${encodeURIComponent(attachment.storagePath)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary underline"
                    >
                      Open drawing{activePart.attachments.length > 1 ? ` ${index + 1}` : ''}
                    </a>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Part name *</Label>
                  <Input value={activePart.name} onChange={(event) => onUpdatePart(activePart.key, { name: event.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label>Part number</Label>
                  <Input value={activePart.partNumber} onChange={(event) => onUpdatePart(activePart.key, { partNumber: event.target.value })} placeholder="Optional part #" />
                </div>
                <div className="grid gap-2">
                  <Label>Quantity</Label>
                  <Input type="number" min="1" value={activePart.quantity} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onUpdatePart(activePart.key, { quantity: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Piece count</Label>
                  <Input type="number" min="1" value={activePart.pieceCount} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onUpdatePart(activePart.key, { pieceCount: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Material</Label>
                  <Select
                    value={activePart.materialId || NO_MATERIAL_VALUE}
                    onValueChange={(value) => onUpdatePart(activePart.key, { materialId: value === NO_MATERIAL_VALUE ? '' : value })}
                  >
                    <SelectTrigger className="border border-border bg-background px-3 py-2 text-sm text-left">
                      <SelectValue placeholder="Select material (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_MATERIAL_VALUE}>No material (optional)</SelectItem>
                      {materials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Total stock dimensions</Label>
                  <Input value={activePart.stockSize} onChange={(event) => onUpdatePart(activePart.key, { stockSize: event.target.value })} placeholder="Thickness × width × total length" />
                </div>
                <div className="grid gap-2">
                  <Label>Finished part thickness</Label>
                  <Input value={activePart.partThickness} onChange={(event) => onUpdatePart(activePart.key, { partThickness: event.target.value })} placeholder="e.g. .25 in" />
                </div>
                <div className="grid gap-2">
                  <Label>Finished part width</Label>
                  <Input value={activePart.partWidth} onChange={(event) => onUpdatePart(activePart.key, { partWidth: event.target.value })} placeholder="e.g. 2.5 in" />
                </div>
                <div className="grid gap-2">
                  <Label>Cut length</Label>
                  <Input value={activePart.cutLength} onChange={(event) => onUpdatePart(activePart.key, { cutLength: event.target.value })} placeholder={'e.g. "6.5 in"'} />
                </div>
                <div className="grid gap-2">
                  <Label>Finish</Label>
                  <Input value={activePart.finish} onChange={(event) => onUpdatePart(activePart.key, { finish: event.target.value })} placeholder="e.g. zinc plate, anodize, paint" />
                  {activePart.drawingFinishText ? <span className="text-xs text-muted-foreground">Drawing says: {activePart.drawingFinishText}</span> : null}
                </div>
                {activePart.drawingMaterialText ? (
                  <div className="grid gap-2 rounded-lg border border-[#ff5a00]/50 bg-[#ff5a00]/5 p-3">
                    <Label>Exact material text from drawing</Label>
                    <p className="text-sm font-semibold">{activePart.drawingMaterialText}</p>
                    <p className="text-xs text-muted-foreground">The match can be corrected without losing the print wording.</p>
                  </div>
                ) : null}
                <div className="grid gap-2 md:col-span-2">
                  <Label>Description</Label>
                  <Textarea value={activePart.description} onChange={(event) => onUpdatePart(activePart.key, { description: event.target.value })} placeholder="What needs to happen for this part or assembly?" />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a part to edit its details.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
