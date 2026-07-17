'use client';

import React from 'react';
import { FileArchive, FileCheck2, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DrawingImportProposal } from '@/modules/drawing-import/drawing-import.schema';
import { bestMaterialMatch } from '@/modules/drawing-import/drawing-import.materials';
import {
  getDrawingConfirmationNeeds,
  type DrawingReviewField,
} from '@/modules/drawing-import/drawing-import.review';

type MaterialOption = { id: string; name: string };

export type ReviewedDrawingPart = {
  key: string;
  partNumber: string;
  partName: string;
  quantity: number;
  materialId: string;
  finish: string;
  stockSize: string;
  cutLength: string;
  drawingMaterialText: string;
  drawingFinishText: string;
  source: { storagePath: string; label: string; mimeType: string };
};

export function DrawingImportPanel({
  business,
  customerName,
  draftReference,
  materials,
  onContinue,
  onSwitchToManual,
  destinationLabel = 'order',
}: {
  business: string;
  customerName: string;
  draftReference: string;
  materials: MaterialOption[];
  onContinue: (parts: ReviewedDrawingPart[], orderFiles: ReviewedDrawingPart['source'][]) => void;
  onSwitchToManual: () => void;
  destinationLabel?: 'order' | 'quote';
}) {
  const [proposals, setProposals] = React.useState<DrawingImportProposal[]>([]);
  const [reviewed, setReviewed] = React.useState<ReviewedDrawingPart[]>([]);
  const [uploadOnly, setUploadOnly] = React.useState<ReviewedDrawingPart[]>([]);
  const [confirmedByPart, setConfirmedByPart] = React.useState<Record<string, DrawingReviewField[]>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [progress, setProgress] = React.useState(0);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  React.useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    setElapsedSeconds(0);
    setProgress(8);
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSeconds(elapsed);
      setProgress((current) => {
        if (current >= 92) return current;
        const step = elapsed < 5 ? 7 : elapsed < 20 ? 3 : 1;
        return Math.min(92, current + step);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function handleUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    if (!customerName) {
      setError('Choose a customer first, then come back to drawings.');
      return;
    }
    setLoading(true);
    setProgress(4);
    setError('');
    const form = new FormData();
    form.append('file', file);
    form.append('business', business);
    form.append('customerName', customerName);
    form.append('draftReference', draftReference);
    try {
      const response = await fetch('/api/orders/drawing-import', { method: 'POST', credentials: 'include', body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Could not read these drawings.');
      const nextProposals = Array.isArray(payload?.proposals) ? payload.proposals as DrawingImportProposal[] : [];
      setProposals(nextProposals);
      setUploadOnly([]);
      setConfirmedByPart({});
      setReviewed(nextProposals.map((proposal) => {
        const materialId = bestMaterialMatch(proposal.material.value, materials);
        return {
          key: proposal.key,
          partNumber: proposal.partNumber.value || proposal.filename.replace(/\.[^.]+$/, ''),
          partName: proposal.partName.value || '',
          quantity: proposal.quantity.value || 1,
          materialId,
          finish: proposal.finish.value || '',
          stockSize: proposal.stockSize.value || '',
          cutLength: proposal.cutLength.value || '',
          drawingMaterialText: proposal.material.value || '',
          drawingFinishText: proposal.finish.value || '',
          source: { storagePath: proposal.storagePath, label: proposal.filename, mimeType: proposal.mimeType },
        };
      }));
      setProgress(100);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not read these drawings.');
    } finally {
      setLoading(false);
    }
  }

  function updatePart(key: string, patch: Partial<ReviewedDrawingPart>) {
    setReviewed((current) => current.map((part) => part.key === key ? { ...part, ...patch } : part));
    const fields = Object.keys(patch).filter((field): field is DrawingReviewField =>
      ['partNumber', 'partName', 'quantity', 'materialId', 'finish', 'stockSize', 'cutLength'].includes(field),
    );
    markFieldsConfirmed(key, fields);
  }

  function markFieldsConfirmed(key: string, fields: DrawingReviewField[]) {
    if (!fields.length) return;
    setConfirmedByPart((current) => ({
      ...current,
      [key]: [...new Set([...(current[key] ?? []), ...fields])],
    }));
  }

  function removePart(key: string) {
    const part = reviewed.find((candidate) => candidate.key === key);
    const proposal = proposalByKey.get(key);
    if (part && proposal?.isAssembly) {
      setUploadOnly((current) => [...current, part]);
      setReviewed((current) => current.filter((candidate) => candidate.key !== key));
      return;
    }
    setReviewed((current) => current.filter((candidate) => candidate.key !== key));
    setProposals((current) => current.filter((proposalEntry) => proposalEntry.key !== key));
  }

  function restorePart(key: string) {
    const part = uploadOnly.find((candidate) => candidate.key === key);
    if (!part) return;
    setReviewed((current) => [...current, part]);
    setUploadOnly((current) => current.filter((candidate) => candidate.key !== key));
  }

  const proposalByKey = React.useMemo(() => new Map(proposals.map((proposal) => [proposal.key, proposal])), [proposals]);
  const confirmationNeedsByKey = React.useMemo(
    () => new Map(reviewed.map((part) => [
      part.key,
      getDrawingConfirmationNeeds(part, proposalByKey.get(part.key), new Set(confirmedByPart[part.key] ?? [])),
    ])),
    [confirmedByPart, proposalByKey, reviewed],
  );
  const incompleteCount = reviewed.filter((part) => (confirmationNeedsByKey.get(part.key)?.length ?? 0) > 0).length;

  return (
    <Card className="border-primary/30 bg-card/80">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Let the drawings fill in the parts</CardTitle>
            <CardDescription>Upload one drawing or a ZIP. You only need to correct highlighted information.</CardDescription>
          </div>
          <Button type="button" variant="ghost" onClick={onSwitchToManual}>Type parts instead</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/35 bg-primary/5 p-6 text-center hover:bg-primary/10">
          {!loading ? <Upload className="h-9 w-9 text-primary" /> : null}
          <span className="text-lg font-semibold">{loading ? 'Reading the drawings…' : 'Drop drawings or a ZIP here'}</span>
          <span className="max-w-lg text-sm text-muted-foreground">PDF, PNG, JPG, or a ZIP containing up to 50 drawings.</span>
          {loading ? (
            <div className="w-full max-w-xl space-y-2" role="status" aria-live="polite">
              <div className="h-4 overflow-hidden rounded-full border border-primary/30 bg-background shadow-inner">
                <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                <span>{elapsedSeconds < 3 ? 'Uploading and preparing files' : elapsedSeconds < 12 ? 'Reading title blocks and part details' : 'Still working — larger ZIP files can take a few minutes'}</span>
                <span>{progress}% · {elapsedSeconds}s</span>
              </div>
            </div>
          ) : null}
          <Input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.zip" disabled={loading} onChange={(event) => void handleUpload(event.target.files)} />
        </label>
        {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

        {reviewed.length || uploadOnly.length ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{reviewed.length} drawing{reviewed.length === 1 ? '' : 's'} read</p>
                <p className="text-sm text-muted-foreground">Neon-orange outlines show exactly what still needs attention.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${incompleteCount ? 'bg-[#ff5a00] text-white shadow-sm' : 'bg-[#0b1f3a] text-white'}`}>{incompleteCount ? `${incompleteCount} need confirmation` : 'All parts confirmed'}</span>
            </div>
            {reviewed.map((part, index) => {
              const proposal = proposalByKey.get(part.key);
              const confirmationNeeds = confirmationNeedsByKey.get(part.key) ?? [];
              const confirmationFields = new Set(confirmationNeeds.map((need) => need.field));
              const confirmableFields = confirmationNeeds.filter((need) => need.resolution === 'confirm' && need.field !== 'quantity').map((need) => need.field);
              const quantityNeedsConfirmation = confirmationNeeds.some((need) => need.field === 'quantity' && need.resolution === 'confirm');
              const needsCheck = confirmationNeeds.length > 0;
              const fieldClass = (field: DrawingReviewField) =>
                `grid gap-1 rounded-lg border p-2 ${confirmationFields.has(field) ? 'border-[#ff5a00] bg-white shadow-[0_0_0_3px_rgba(255,90,0,0.18)] dark:bg-[#0b1f3a]' : 'border-transparent'}`;
              return (
                <div key={part.key} className={`rounded-xl border bg-white p-4 dark:bg-[#0b1f3a] ${needsCheck ? 'border-[#ff5a00] shadow-[0_0_0_2px_rgba(255,90,0,0.14)]' : 'border-[#0b1f3a]/25'}`}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {proposal?.filename.toLowerCase().endsWith('.zip') ? <FileArchive className="h-5 w-5" /> : <FileCheck2 className="h-5 w-5 text-primary" />}
                      <div><p className="font-semibold">Part {index + 1}</p><p className="text-xs text-muted-foreground">{part.source.label}{proposal?.pageCount ? ` · ${proposal.pageCount} page${proposal.pageCount === 1 ? '' : 's'}` : ''}</p></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={`/api/orders/drawing-import/preview?path=${encodeURIComponent(part.source.storagePath)}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">Open drawing</a>
                      <Button type="button" variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => removePart(part.key)}>
                        <Trash2 className="mr-1 h-4 w-4" /> {proposal?.isAssembly ? 'Remove from part list; keep file' : 'Remove from list'}
                      </Button>
                    </div>
                  </div>
                  {needsCheck ? (
                    <div className="mb-3 rounded-lg border-2 border-[#ff5a00] bg-white p-3 text-sm text-[#0b1f3a] shadow-[0_0_12px_rgba(255,90,0,0.16)] dark:bg-[#0b1f3a] dark:text-white">
                      <p className="font-semibold">Please confirm:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {confirmationNeeds.map((need) => <li key={need.field}><strong>{need.label}:</strong> {need.message}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {confirmationFields.has('assembly') ? (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#ff5a00] bg-white p-2 text-sm text-[#0b1f3a] dark:bg-[#0b1f3a] dark:text-white">
                      <span>This looks like an assembly or parts-list drawing.</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => markFieldsConfirmed(part.key, ['assembly'])}>Keep as a part</Button>
                    </div>
                  ) : null}
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <div className={fieldClass('partNumber')}><Label>Part number</Label><Input value={part.partNumber} onChange={(e) => updatePart(part.key, { partNumber: e.target.value })} /></div>
                    <div className={fieldClass('partName')}><Label>Part name</Label><Input value={part.partName} placeholder="Please enter the part name" onChange={(e) => updatePart(part.key, { partName: e.target.value })} /></div>
                    <div className={fieldClass('quantity')}>
                      <Label>Quantity</Label>
                      <Input type="number" min={1} value={part.quantity} onChange={(e) => updatePart(part.key, { quantity: Number(e.target.value) || 1 })} />
                      <span className="text-xs text-muted-foreground">{proposal?.quantity.value === null ? 'Not shown — using 1' : proposal?.quantity.evidence || 'Read from drawing'}</span>
                      {quantityNeedsConfirmation ? (
                        <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md bg-[#0b1f3a] px-3 py-2 text-sm font-semibold text-white">
                          <Checkbox checked={false} onCheckedChange={(checked) => { if (checked) markFieldsConfirmed(part.key, ['quantity']); }} />
                          Quantity {part.quantity} is correct
                        </label>
                      ) : null}
                    </div>
                    <div className={fieldClass('materialId')}><Label>Material</Label><Select value={part.materialId || '__missing__'} onValueChange={(value) => updatePart(part.key, { materialId: value === '__missing__' ? '' : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__missing__">Please choose</SelectItem>{materials.map((material) => <SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>)}</SelectContent></Select><span className="text-xs text-muted-foreground">Drawing says: {proposal?.material.value || 'Not shown'}</span><span className="text-xs text-muted-foreground">{part.materialId ? `Matched to: ${materials.find((material) => material.id === part.materialId)?.name || 'Selected material'}` : 'No automatic match found — please choose'}</span></div>
                    <div className={fieldClass('finish')}><Label>Finish</Label><Input value={part.finish} placeholder="Not shown" onChange={(e) => updatePart(part.key, { finish: e.target.value })} /><span className="text-xs text-muted-foreground">{proposal?.finish.value ? `Drawing says: ${proposal.finish.value} · Added to part notes` : 'No finish found'}</span></div>
                    <div className={fieldClass('stockSize')}><Label>Stock size</Label><Input value={part.stockSize} placeholder="Not found" onChange={(e) => updatePart(part.key, { stockSize: e.target.value })} /></div>
                    <div className={fieldClass('cutLength')}><Label>Cut length</Label><Input value={part.cutLength} placeholder="Not found" onChange={(e) => updatePart(part.key, { cutLength: e.target.value })} /></div>
                  </div>
                  {confirmableFields.length ? (
                    <div className="mt-3 flex justify-end">
                      <Button type="button" variant="outline" size="sm" onClick={() => markFieldsConfirmed(part.key, confirmableFields)}>The highlighted values look right</Button>
                    </div>
                  ) : null}
                  {proposal?.warnings.length ? <p className="mt-3 border-l-4 border-[#ff5a00] pl-2 text-xs text-[#0b1f3a] dark:text-white">{proposal.warnings.join(' ')}</p> : null}
                </div>
              );
            })}
            {uploadOnly.length ? (
              <div className="rounded-xl border border-blue-300/60 bg-blue-50/60 p-4 dark:bg-blue-950/15">
                <p className="font-semibold">{destinationLabel === 'quote' ? 'Quote' : 'Order'} files that will not become parts</p>
                <p className="mb-3 text-sm text-muted-foreground">These assembly drawings stay attached to the {destinationLabel} for reference.</p>
                <div className="space-y-2">
                  {uploadOnly.map((part) => (
                    <div key={part.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-background/70 px-3 py-2 text-sm">
                      <span>{part.source.label}</span>
                      <div className="flex items-center gap-2">
                        <a href={`/api/orders/drawing-import/preview?path=${encodeURIComponent(part.source.storagePath)}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">Open drawing</a>
                        <Button type="button" variant="outline" size="sm" onClick={() => restorePart(part.key)}>Put back in part list</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      {reviewed.length || uploadOnly.length ? (
        <CardFooter className="justify-end">
          <Button type="button" onClick={() => onContinue(reviewed, uploadOnly.map((part) => part.source))} disabled={incompleteCount > 0 || reviewed.length === 0}>Continue with {reviewed.length} part{reviewed.length === 1 ? '' : 's'}{uploadOnly.length ? ` + ${uploadOnly.length} ${destinationLabel} file${uploadOnly.length === 1 ? '' : 's'}` : ''}</Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
