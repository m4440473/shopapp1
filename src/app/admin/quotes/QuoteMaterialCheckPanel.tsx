'use client';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/Textarea';

type MaterialStatus = 'UNREVIEWED' | 'IN_STOCK' | 'NEED_TO_ORDER' | 'NOT_REQUIRED';

export type QuoteMaterialCheckPart = {
  key: string;
  name: string;
  partNumber: string;
  quantity: string;
  materialId: string;
  stockSize: string;
  cutLength: string;
  drawingMaterialText: string;
  drawingFinishText: string;
  finish: string;
  partThickness: string;
  partWidth: string;
  materialStatus: MaterialStatus;
  materialNotes: string;
  inventoryLocation: string;
  procurementVendorId: string;
  attachments: Array<{ storagePath: string }>;
};

type QuoteMaterialCheckPatch = Partial<Pick<
  QuoteMaterialCheckPart,
  'materialStatus' | 'materialNotes' | 'inventoryLocation' | 'procurementVendorId'
>>;

type QuoteMaterialCheckPanelProps = {
  parts: QuoteMaterialCheckPart[];
  materials: Array<{ id: string; name: string }>;
  vendors: Array<{ id: string; name: string }>;
  loading: boolean;
  canPrint: boolean;
  onPrint: () => void;
  onUpdate: (partKey: string, patch: QuoteMaterialCheckPatch) => void;
};

export function QuoteMaterialCheckPanel({ parts, materials, vendors, loading, canPrint, onPrint, onUpdate }: QuoteMaterialCheckPanelProps) {
  return (
    <div className="space-y-5">
      <Card className="border-[#ff5a00]/40">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Material check</CardTitle>
              <CardDescription>Review this list on screen, print it for the shop walk, then enter what you found.</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={onPrint} disabled={loading || !canPrint}>Print shop walkdown sheet</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-[#0b1f3a]/25 bg-white p-4 text-sm text-[#0b1f3a] dark:bg-[#0b1f3a] dark:text-white">
            Use the large choices on every part. <strong>Need to order</strong> will require a vendor before you can continue. An in-stock location is helpful but will not block you.
          </div>
        </CardContent>
      </Card>

      {parts.filter((part) => part.name.trim()).map((part, index) => {
        const materialName = materials.find((material) => material.id === part.materialId)?.name || 'Not matched';
        const materialResolved = part.materialStatus !== 'UNREVIEWED' && (part.materialStatus !== 'NEED_TO_ORDER' || Boolean(part.procurementVendorId));
        return (
          <Card key={part.key} className={!materialResolved ? 'border-2 border-[#ff5a00] shadow-[0_0_0_3px_rgba(255,90,0,0.12)]' : 'border-[#0b1f3a]/25'}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Part {index + 1}</p>
                  <CardTitle>{part.partNumber || 'No part number'} — {part.name}</CardTitle>
                  <CardDescription>Qty {part.quantity || '1'} · {materialName} · Total stock {part.stockSize || 'not shown'} · Cut {part.cutLength || 'not shown'}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${materialResolved ? 'border-[#0b1f3a] bg-[#0b1f3a] text-white' : 'border-[#ff5a00] bg-[#ff5a00]/10 text-[#ff5a00]'}`}>
                    {materialResolved ? '✓ Material decision resolved' : 'Needs confirmation'}
                  </span>
                  {part.attachments.map((attachment, attachmentIndex) => (
                    <a key={`${attachment.storagePath}-${attachmentIndex}`} href={`/api/orders/drawing-import/preview?path=${encodeURIComponent(attachment.storagePath)}`} target="_blank" rel="noopener noreferrer" className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-primary hover:bg-muted">
                      Open drawing{part.attachments.length > 1 ? ` ${attachmentIndex + 1}` : ''}
                    </a>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Drawing says</p>
                  <p className="mt-1 font-medium">Material: {part.drawingMaterialText || 'Not shown'}</p>
                  <p className="mt-1 font-medium">Finish: {part.drawingFinishText || part.finish || 'Not shown'}</p>
                  <p className="mt-1 font-medium">Finished thickness: {part.partThickness || 'Not shown'}</p>
                  <p className="mt-1 font-medium">Finished width: {part.partWidth || 'Not shown'}</p>
                  <p className="mt-1 font-medium">Total stock dimensions: {part.stockSize || 'Not shown'}</p>
                </div>
                <div className="grid gap-2">
                  <Label>Stock check / purchasing note</Label>
                  <Textarea value={part.materialNotes} onChange={(event) => onUpdate(part.key, { materialNotes: event.target.value })} placeholder="Where to look, supplier details, lead time, or anything the stock checker should know" />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {([['IN_STOCK', '✓ In stock', 'Material is already in the shop'], ['NEED_TO_ORDER', 'Order material', 'Choose a vendor below'], ['NOT_REQUIRED', 'Not required', 'No material purchase or stock check']] as const).map(([value, label, description]) => (
                  <button key={value} type="button" onClick={() => onUpdate(part.key, { materialStatus: value })} className={`rounded-xl border-2 p-4 text-left transition ${part.materialStatus === value ? value === 'NEED_TO_ORDER' ? 'border-[#ff5a00] bg-[#ff5a00] text-white' : 'border-[#0b1f3a] bg-[#0b1f3a] text-white' : 'border-border/60 bg-background hover:border-[#ff5a00]'}`}>
                    <span className="block text-base font-semibold">{label}</span>
                    <span className={`mt-1 block text-xs ${part.materialStatus === value ? 'text-white/80' : 'text-muted-foreground'}`}>{description}</span>
                  </button>
                ))}
              </div>
              {part.materialStatus === 'IN_STOCK' ? (
                <div className="grid gap-2 md:max-w-xl"><Label>Where did you find it?</Label><Input value={part.inventoryLocation} onChange={(event) => onUpdate(part.key, { inventoryLocation: event.target.value })} placeholder="Rack, shelf, bin, or area" /></div>
              ) : null}
              {part.materialStatus === 'NEED_TO_ORDER' ? (
                <div className={`grid gap-4 rounded-xl border-2 p-4 md:max-w-xl ${part.procurementVendorId ? 'border-[#0b1f3a]/60 bg-[#0b1f3a]/10' : 'border-[#ff5a00] bg-[#ff5a00]/5'}`}>
                  <div className="grid gap-2">
                    <Label>Order from *</Label>
                    <Select value={part.procurementVendorId || '__choose_vendor__'} onValueChange={(value) => onUpdate(part.key, { procurementVendorId: value === '__choose_vendor__' ? '' : value })}>
                      <SelectTrigger className="border border-border bg-background px-3 py-2 text-sm"><SelectValue placeholder="Choose vendor" /></SelectTrigger>
                      <SelectContent><SelectItem value="__choose_vendor__">Choose a vendor</SelectItem>{vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {part.procurementVendorId ? <p className="text-xs font-semibold text-[#0b1f3a] dark:text-white">✓ Vendor selected. Material decision resolved.</p> : <p className="text-xs text-[#ff5a00]">Choose a vendor to resolve this part.</p>}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
