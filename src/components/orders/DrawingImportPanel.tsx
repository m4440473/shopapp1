'use client';

import React from 'react';
import { FileArchive, FileCheck2, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DrawingImportProposal, DrawingImportSupportingFile } from '@/modules/drawing-import/drawing-import.schema';
import { bestMaterialMatch, deriveDrawingStockDimensions, parseDrawingQuantityInput } from '@/modules/drawing-import/drawing-import.materials';
import {
  clearDrawingImportDraft,
  readDrawingImportDraft,
  writeDrawingImportDraft,
} from '@/modules/drawing-import/drawing-import.draft';
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
  finalPartLength: string;
  partWidth: string;
  partThickness: string;
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
  const [supportingFiles, setSupportingFiles] = React.useState<DrawingImportSupportingFile[]>([]);
  const [confirmedByPart, setConfirmedByPart] = React.useState<Record<string, DrawingReviewField[]>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [progress, setProgress] = React.useState(0);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [availableMaterials, setAvailableMaterials] = React.useState(materials);
  const [intakeMode, setIntakeMode] = React.useState<'ONE_OFF' | 'ASSEMBLY' | null>(null);
  const [assemblyMultiplier, setAssemblyMultiplier] = React.useState(1);
  const [draftReady, setDraftReady] = React.useState(false);
  const [materialConfirmationKey, setMaterialConfirmationKey] = React.useState<string | null>(null);
  const [creatingMaterialKey, setCreatingMaterialKey] = React.useState<string | null>(null);
  const [quantityDraftByPart, setQuantityDraftByPart] = React.useState<Record<string, string>>({});

  const draftContext = React.useMemo(
    () => ({ destination: destinationLabel, business, customerName }),
    [business, customerName, destinationLabel],
  );

  React.useEffect(() => setAvailableMaterials(materials), [materials]);

  React.useEffect(() => {
    setDraftReady(false);
    setProposals([]);
    setReviewed([]);
    setUploadOnly([]);
    setSupportingFiles([]);
    setConfirmedByPart({});
    setQuantityDraftByPart({});
    setIntakeMode(null);
    setAssemblyMultiplier(1);
    try {
      const draft = readDrawingImportDraft(window.localStorage, draftContext);
      if (draft) {
        if (Array.isArray(draft.proposals)) setProposals(draft.proposals);
        if (Array.isArray(draft.reviewed)) setReviewed(draft.reviewed.map((part: ReviewedDrawingPart) => ({ ...part, finalPartLength: part.finalPartLength ?? '', partWidth: part.partWidth ?? '', partThickness: part.partThickness ?? '' })));
        if (Array.isArray(draft.uploadOnly)) setUploadOnly(draft.uploadOnly.map((part: ReviewedDrawingPart) => ({ ...part, finalPartLength: part.finalPartLength ?? '', partWidth: part.partWidth ?? '', partThickness: part.partThickness ?? '' })));
        if (Array.isArray(draft.supportingFiles)) setSupportingFiles(draft.supportingFiles as DrawingImportSupportingFile[]);
        if (draft.confirmedByPart && typeof draft.confirmedByPart === 'object') {
          setConfirmedByPart(draft.confirmedByPart as Record<string, DrawingReviewField[]>);
        }
        if (draft.intakeMode === 'ONE_OFF' || draft.intakeMode === 'ASSEMBLY') setIntakeMode(draft.intakeMode);
        if (typeof draft.assemblyMultiplier === 'number' && Number.isFinite(draft.assemblyMultiplier) && draft.assemblyMultiplier > 0) {
          setAssemblyMultiplier(Math.floor(draft.assemblyMultiplier));
        }
      }
    } catch {
      // A corrupt browser draft should never block a fresh import.
    } finally {
      setDraftReady(true);
    }
  }, [draftContext]);

  React.useEffect(() => {
    if (!draftReady) return;
    try {
      writeDrawingImportDraft(window.localStorage, draftContext, {
        proposals,
        reviewed,
        uploadOnly,
        supportingFiles,
        confirmedByPart,
        intakeMode,
        assemblyMultiplier,
      });
    } catch {
      // Browser storage can be unavailable or full; the in-memory review remains usable.
    }
  }, [assemblyMultiplier, confirmedByPart, draftContext, draftReady, intakeMode, proposals, reviewed, supportingFiles, uploadOnly]);

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
    if (!intakeMode) {
      setError('Choose one-off parts or assembly before uploading drawings.');
      return;
    }
    setLoading(true);
    setProgress(4);
    setError('');
    try {
      const response = await fetch('/api/orders/drawing-import', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': file.type || 'application/octet-stream',
          'x-shopapp-upload': 'drawing-raw-v1',
          'x-shopapp-filename': encodeURIComponent(file.name),
          'x-shopapp-business': encodeURIComponent(business),
          'x-shopapp-customer': encodeURIComponent(customerName),
          'x-shopapp-draft-reference': encodeURIComponent(draftReference),
        },
        body: file,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Could not read these drawings.');
      const nextProposals = Array.isArray(payload?.proposals) ? payload.proposals as DrawingImportProposal[] : [];
      const nextSupportingFiles = Array.isArray(payload?.supportingFiles) ? payload.supportingFiles as DrawingImportSupportingFile[] : [];
      setProposals(nextProposals);
      setUploadOnly([]);
      setSupportingFiles(nextSupportingFiles);
      const initialConfirmed: Record<string, DrawingReviewField[]> = {};
      setReviewed(nextProposals.map((proposal) => {
        const dimensionProposal = proposal as DrawingImportProposal & {
          partWidth?: typeof proposal.finalPartLength;
          partThickness?: typeof proposal.finalPartLength;
        };
        const materialId = bestMaterialMatch(proposal.material.value, availableMaterials);
        const baseQuantity = proposal.quantity.value || 1;
        const quantity = intakeMode === 'ASSEMBLY' ? baseQuantity * assemblyMultiplier : baseQuantity;
        const finalPartLength = proposal.finalPartLength?.value || '';
        const partWidth = dimensionProposal.partWidth?.value || '';
        const partThickness = dimensionProposal.partThickness?.value || '';
        const derived = deriveDrawingStockDimensions(partThickness, partWidth, finalPartLength, quantity);
        if (derived.cutLength) initialConfirmed[proposal.key] = ['stockSize', 'cutLength'];
        return {
          key: proposal.key,
          partNumber: proposal.partNumber.value || proposal.filename.replace(/\.[^.]+$/, ''),
          partName: proposal.partName.value || '',
          quantity,
          materialId,
          finish: proposal.finish.value || '',
          stockSize: derived.totalStockDimensions || proposal.stockSize.value || '',
          cutLength: derived.cutLength || proposal.cutLength.value || '',
          finalPartLength,
          partWidth,
          partThickness,
          drawingMaterialText: proposal.material.value || '',
          drawingFinishText: proposal.finish.value || '',
          source: {
            storagePath: proposal.storagePath,
            label: proposal.sourcePageNumber
              ? `${proposal.sourceDocumentName ?? proposal.filename} — page ${proposal.sourcePageNumber} of ${proposal.sourceDocumentPageCount}`
              : proposal.filename,
            mimeType: proposal.mimeType,
          },
        };
      }));
      setQuantityDraftByPart({});
      setConfirmedByPart(initialConfirmed);
      setProgress(100);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not read these drawings.');
    } finally {
      setLoading(false);
    }
  }

  function updatePart(key: string, patch: Partial<ReviewedDrawingPart>) {
    setReviewed((current) => current.map((part) => {
      if (part.key !== key) return part;
      const next = { ...part, ...patch };
      if ('quantity' in patch || 'finalPartLength' in patch || 'partWidth' in patch || 'partThickness' in patch) {
        const derived = deriveDrawingStockDimensions(next.partThickness, next.partWidth, next.finalPartLength, next.quantity);
        if (derived.cutLength) {
          next.cutLength = derived.cutLength;
          next.stockSize = derived.totalStockDimensions;
        } else if ('finalPartLength' in patch) {
          next.cutLength = '';
          next.stockSize = '';
        }
      }
      return next;
    }));
    const fields = Object.keys(patch).filter((field): field is DrawingReviewField =>
      ['partNumber', 'partName', 'quantity', 'materialId', 'finish', 'stockSize', 'cutLength', 'finalPartLength', 'partWidth', 'partThickness'].includes(field),
    );
    markFieldsConfirmed(key, fields);
  }

  function updateQuantityDraft(key: string, value: string) {
    setQuantityDraftByPart((current) => ({ ...current, [key]: value }));
    const quantity = parseDrawingQuantityInput(value);
    if (quantity !== null) updatePart(key, { quantity });
  }

  function commitQuantityDraft(part: ReviewedDrawingPart) {
    const value = quantityDraftByPart[part.key];
    const quantity = value === undefined ? part.quantity : parseDrawingQuantityInput(value);
    if (quantity === null) {
      setQuantityDraftByPart((current) => ({ ...current, [part.key]: String(part.quantity) }));
      return;
    }
    updatePart(part.key, { quantity });
    setQuantityDraftByPart((current) => ({ ...current, [part.key]: String(quantity) }));
  }

  async function createDetectedMaterial(part: ReviewedDrawingPart) {
    const detectedName = part.drawingMaterialText.trim();
    if (!detectedName || creatingMaterialKey) return;
    setCreatingMaterialKey(part.key);
    setError('');
    try {
      const response = await fetch('/api/admin/materials', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: detectedName, notes: 'Added from reviewed drawing title-block text.' }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.item?.id) throw new Error(payload?.error || 'Could not add this material.');
      const created = { id: String(payload.item.id), name: String(payload.item.name ?? detectedName) };
      setAvailableMaterials((current) => current.some((material) => material.id === created.id) ? current : [...current, created]);
      updatePart(part.key, { materialId: created.id });
      setMaterialConfirmationKey(null);
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : 'Could not add this material.');
    } finally {
      setCreatingMaterialKey(null);
    }
  }

  function clearSavedDraft() {
    try {
      clearDrawingImportDraft(window.localStorage, draftContext);
    } catch {
      // Ignore unavailable browser storage.
    }
    setProposals([]);
    setReviewed([]);
    setUploadOnly([]);
    setSupportingFiles([]);
    setConfirmedByPart({});
    setQuantityDraftByPart({});
    setIntakeMode(null);
    setAssemblyMultiplier(1);
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
  const destinationFiles = React.useMemo(() => {
    const files = [...supportingFiles, ...uploadOnly.map((part) => part.source)];
    return [...new Map(files.map((file) => [file.storagePath, file])).values()];
  }, [supportingFiles, uploadOnly]);

  return (
    <Card className="border-primary/30 bg-card/80">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Let the drawings fill in the parts</CardTitle>
            <CardDescription>Upload individual drawings, one multi-page drawing packet, or a ZIP. You only need to correct highlighted information.</CardDescription>
          </div>
          <Button type="button" variant="ghost" onClick={onSwitchToManual}>Type parts instead</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-border/60 bg-background/60 p-4">
          <p className="font-semibold">What are these drawings for?</p>
          <p className="mt-1 text-sm text-muted-foreground">Choose this first so quantities are calculated correctly.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setIntakeMode('ONE_OFF')}
              disabled={loading || reviewed.length > 0 || uploadOnly.length > 0}
              className={`rounded-lg border-2 p-3 text-left ${intakeMode === 'ONE_OFF' ? 'border-primary bg-primary/10' : 'border-border/60'}`}
            >
              <span className="block font-semibold">One-off parts</span>
              <span className="text-xs text-muted-foreground">Use each drawing quantity as shown.</span>
            </button>
            <button
              type="button"
              onClick={() => setIntakeMode('ASSEMBLY')}
              disabled={loading || reviewed.length > 0 || uploadOnly.length > 0}
              className={`rounded-lg border-2 p-3 text-left ${intakeMode === 'ASSEMBLY' ? 'border-primary bg-primary/10' : 'border-border/60'}`}
            >
              <span className="block font-semibold">Assembly</span>
              <span className="text-xs text-muted-foreground">Multiply every component quantity by the number of assemblies.</span>
            </button>
          </div>
          {intakeMode === 'ASSEMBLY' ? (
            <div className="mt-3 grid max-w-xs gap-1">
              <Label htmlFor={`assembly-multiplier-${draftReference}`}>Number of assemblies</Label>
              <Input
                id={`assembly-multiplier-${draftReference}`}
                type="number"
                min={1}
                value={assemblyMultiplier}
                disabled={loading || reviewed.length > 0 || uploadOnly.length > 0}
                onChange={(event) => setAssemblyMultiplier(Math.max(1, Number(event.target.value) || 1))}
              />
            </div>
          ) : null}
        </div>
        <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/35 bg-primary/5 p-6 text-center hover:bg-primary/10">
          {!loading ? <Upload className="h-9 w-9 text-primary" /> : null}
          <span className="text-lg font-semibold">{loading ? 'Reading the drawings…' : 'Drop drawings, a PDF packet, or a ZIP here'}</span>
          <span className="max-w-lg text-sm text-muted-foreground">PDF packets are separated page-by-page. Cover and BOM pages stay attached for reference; drawing pages become parts.</span>
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
          <Input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.zip" disabled={loading || !intakeMode} onChange={(event) => void handleUpload(event.target.files)} />
        </label>
        {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

        {reviewed.length || uploadOnly.length || supportingFiles.length ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{reviewed.length} drawing{reviewed.length === 1 ? '' : 's'} read</p>
                <p className="text-sm text-muted-foreground">Neon-orange outlines show exactly what still needs attention.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${incompleteCount ? 'bg-[#ff5a00] text-white shadow-sm' : 'bg-[#0b1f3a] text-white'}`}>{incompleteCount ? `${incompleteCount} need confirmation` : 'All parts confirmed'}</span>
              <Button type="button" variant="ghost" size="sm" onClick={clearSavedDraft}>Clear saved draft</Button>
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
                      <div><p className="font-semibold">Part {index + 1}</p><p className="text-xs text-muted-foreground">{part.source.label}{proposal?.pageCount && !proposal.sourcePageNumber ? ` · ${proposal.pageCount} page${proposal.pageCount === 1 ? '' : 's'}` : ''}</p></div>
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
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={quantityDraftByPart[part.key] ?? String(part.quantity)}
                        onChange={(event) => updateQuantityDraft(part.key, event.target.value)}
                        onBlur={() => commitQuantityDraft(part)}
                      />
                      <span className="text-xs text-muted-foreground">{proposal?.quantity.value === null ? 'Not shown — using 1' : proposal?.quantity.evidence || 'Read from drawing'}</span>
                      {quantityNeedsConfirmation ? (
                        <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md bg-[#0b1f3a] px-3 py-2 text-sm font-semibold text-white">
                          <Checkbox checked={false} onCheckedChange={(checked) => { if (checked) markFieldsConfirmed(part.key, ['quantity']); }} />
                          Quantity {part.quantity} is correct
                        </label>
                      ) : null}
                    </div>
                    <div className={fieldClass('materialId')}>
                      <Label>Material</Label>
                      <Select value={part.materialId || '__missing__'} onValueChange={(value) => updatePart(part.key, { materialId: value === '__missing__' ? '' : value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="__missing__">Please choose</SelectItem>{availableMaterials.map((material) => <SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">Drawing says: {proposal?.material.value || 'Not shown'}</span>
                      <span className="text-xs text-muted-foreground">{part.materialId ? `Matched to: ${availableMaterials.find((material) => material.id === part.materialId)?.name || 'Selected material'}` : 'No automatic match found — please choose'}</span>
                      {!part.materialId && part.drawingMaterialText.trim() && !/^SEE\s+(?:BOM|PARTS?\s+LIST)$/i.test(part.drawingMaterialText.trim()) ? (
                        materialConfirmationKey === part.key ? (
                          <div className="mt-1 rounded-md border border-amber-400/60 bg-amber-50 p-2 text-xs text-amber-950">
                            <p>Create “{part.drawingMaterialText.trim()}” as a new shop material?</p>
                            <div className="mt-2 flex gap-2">
                              <Button type="button" size="sm" onClick={() => void createDetectedMaterial(part)} disabled={creatingMaterialKey === part.key}>{creatingMaterialKey === part.key ? 'Adding…' : 'Yes, add material'}</Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setMaterialConfirmationKey(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <Button type="button" size="sm" variant="outline" onClick={() => setMaterialConfirmationKey(part.key)}>Add detected material to ShopApp</Button>
                        )
                      ) : null}
                    </div>
                    <div className={fieldClass('finish')}><Label>Finish</Label><Input value={part.finish} placeholder="Not shown" onChange={(e) => updatePart(part.key, { finish: e.target.value })} /><span className="text-xs text-muted-foreground">{proposal?.finish.value ? `Drawing says: ${proposal.finish.value} · Added to part notes` : 'No finish found'}</span></div>
                    <div className={fieldClass('partThickness')}><Label>Finished part thickness (in.)</Label><Input value={part.partThickness} placeholder="Read from drawing" onChange={(e) => updatePart(part.key, { partThickness: e.target.value })} /></div>
                    <div className={fieldClass('partWidth')}><Label>Finished part width (in.)</Label><Input value={part.partWidth} placeholder="Read from drawing" onChange={(e) => updatePart(part.key, { partWidth: e.target.value })} /></div>
                    <div className={fieldClass('finalPartLength')}><Label>Final part length (in.)</Label><Input value={part.finalPartLength} placeholder="Required for stock calculation" onChange={(e) => updatePart(part.key, { finalPartLength: e.target.value })} /></div>
                    <div className={fieldClass('cutLength')}><Label>Cut length (final + .125)</Label><Input value={part.cutLength} placeholder="Calculated after final length" readOnly={Boolean(part.finalPartLength.trim())} onChange={(e) => updatePart(part.key, { cutLength: e.target.value })} /></div>
                    <div className={fieldClass('stockSize')}><Label>Total stock dimensions (T × W × cut × qty)</Label><Input value={part.stockSize} placeholder="Calculated after all dimensions" readOnly={Boolean(part.finalPartLength.trim())} onChange={(e) => updatePart(part.key, { stockSize: e.target.value })} /></div>
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
            {destinationFiles.length ? (
              <div className="rounded-xl border border-blue-300/60 bg-blue-50/60 p-4 dark:bg-blue-950/15">
                <p className="font-semibold">{destinationLabel === 'quote' ? 'Quote' : 'Order'} files that will not become parts</p>
                <p className="mb-3 text-sm text-muted-foreground">Original drawing packets and removed assembly drawings stay attached to the {destinationLabel} for reference.</p>
                <div className="space-y-2">
                  {destinationFiles.map((file) => {
                    const removedPart = uploadOnly.find((part) => part.source.storagePath === file.storagePath);
                    return (
                    <div key={file.storagePath} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-background/70 px-3 py-2 text-sm">
                      <span>{file.label}</span>
                      <div className="flex items-center gap-2">
                        <a href={`/api/orders/drawing-import/preview?path=${encodeURIComponent(file.storagePath)}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">Open file</a>
                        {removedPart ? <Button type="button" variant="outline" size="sm" onClick={() => restorePart(removedPart.key)}>Put back in part list</Button> : null}
                      </div>
                    </div>
                  );})}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      {reviewed.length || destinationFiles.length ? (
        <CardFooter className="justify-end">
          <Button type="button" onClick={() => onContinue(reviewed, destinationFiles)} disabled={incompleteCount > 0 || reviewed.length === 0}>Continue with {reviewed.length} part{reviewed.length === 1 ? '' : 's'}{destinationFiles.length ? ` + ${destinationFiles.length} ${destinationLabel} file${destinationFiles.length === 1 ? '' : 's'}` : ''}</Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
