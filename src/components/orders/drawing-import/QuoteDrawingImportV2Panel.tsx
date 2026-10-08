'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import type { DrawingImportFieldName, DrawingImportPageClassification } from '@/modules/drawing-import/v2/drawing-import-v2.types';

import {
  acknowledgeDrawingImportClassificationSave,
  acknowledgeDrawingImportFieldSave,
  clearDrawingImportJobId,
  countDrawingImportFilters,
  createDrawingImportReviewState,
  drawingImportCanReview,
  drawingImportCanKeepFileOnly,
  drawingImportCanTransferToDraft,
  drawingImportHasUnsavedChanges,
  mergeDrawingImportJobSnapshot,
  pageMatchesDrawingImportFilter,
  readDrawingImportJobId,
  updateDrawingImportField,
  writeDrawingImportJobId,
  type DrawingImportJobDraftContext,
} from './drawing-import-review-state';
import { DrawingImportJobProgress } from './DrawingImportJobProgress';
import { DrawingImportPageCard } from './DrawingImportPageCard';
import { DrawingImportReviewFilters } from './DrawingImportReviewFilters';
import { DrawingImportSupportingPages } from './DrawingImportSupportingPages';
import { DrawingImportProcessingPages } from './DrawingImportProcessingPages';
import { createDrawingImportSaveQueue } from './drawing-import-save-queue';
import { createDrawingImportHandoff } from './drawing-import-handoff';
import { DrawingImportDraftReadiness } from './DrawingImportDraftReadiness';
import { PhoneUploadHandoff } from './PhoneUploadHandoff';
import { buildReviewedQuoteDrawingImport } from './quote-drawing-import';
import type {
  DrawingImportReviewFilter,
  ContinueDrawingImport,
  DrawingImportReviewState,
  DrawingImportV2ApiClient,
  DrawingImportV2FeatureStatus,
  ResolveDrawingImportEvidenceUrls,
} from './drawing-import-ui.types';

type FieldPrimitive = string | number | boolean;
type MaterialOption = { id: string; name: string };

const TERMINAL_STATUSES = new Set(['READY_FOR_REVIEW', 'PARTIAL_FAILURE', 'FAILED', 'CANCELLED', 'COMPLETE']);
const PART_CLASSIFICATIONS = new Set(['part_drawing', 'assembly_drawing']);

export function QuoteDrawingImportV2Panel({
  api,
  business,
  customerName,
  draftReference,
  materials,
  onContinue,
  onSwitchToLegacy,
  onCreateMaterial,
  resolveEvidenceUrls,
  pollIntervalMs = 2_000,
  showAdminMetrics = true,
  destination = 'quote',
}: {
  api: DrawingImportV2ApiClient;
  business: string;
  customerName: string;
  draftReference: string;
  materials: MaterialOption[];
  onContinue: ContinueDrawingImport;
  onSwitchToLegacy: () => void;
  onCreateMaterial?: (detectedName: string) => Promise<MaterialOption>;
  resolveEvidenceUrls?: ResolveDrawingImportEvidenceUrls;
  pollIntervalMs?: number;
  showAdminMetrics?: boolean;
  destination?: 'quote' | 'order';
}) {
  const [feature, setFeature] = React.useState<DrawingImportV2FeatureStatus | null>(null);
  const [state, setState] = React.useState<DrawingImportReviewState | null>(null);
  const [intakeMode, setIntakeMode] = React.useState<'ONE_OFF' | 'ASSEMBLY' | null>(null);
  const [assemblyMultiplier, setAssemblyMultiplier] = React.useState(1);
  const [filter, setFilter] = React.useState<DrawingImportReviewFilter>('all');
  const [uploading, setUploading] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [reprocessingPageIds, setReprocessingPageIds] = React.useState<string[]>([]);
  const [savingFields, setSavingFields] = React.useState<string[]>([]);
  const [saveErrors, setSaveErrors] = React.useState<Record<string, string>>({});
  const [classifyingPageIds, setClassifyingPageIds] = React.useState<string[]>([]);
  const [classificationErrors, setClassificationErrors] = React.useState<Record<string, { classification: DrawingImportPageClassification; message: string }>>({});
  const [creatingFields, setCreatingFields] = React.useState<string[]>([]);
  const [availableMaterials, setAvailableMaterials] = React.useState(materials);
  const [error, setError] = React.useState('');
  const [refreshError, setRefreshError] = React.useState('');
  const [restoreJobId, setRestoreJobId] = React.useState<string | null>(null);
  const [restoring, setRestoring] = React.useState(false);
  const [phoneActive, setPhoneActive] = React.useState(false);
  const [transferring, setTransferring] = React.useState(false);
  const [transferError, setTransferError] = React.useState('');
  const [handoff] = React.useState(createDrawingImportHandoff);
  const transferringRef = React.useRef(false);
  const stateRef = React.useRef(state);
  const pendingClassification = React.useRef(new Set<string>());

  const updateState = React.useCallback((updater: DrawingImportReviewState | null | ((current: DrawingImportReviewState | null) => DrawingImportReviewState | null)) => {
    const next = typeof updater === 'function' ? updater(stateRef.current) : updater;
    stateRef.current = next;
    setState(next);
  }, []);

  const draftContext = React.useMemo<DrawingImportJobDraftContext>(() => ({
    destination, business, customerName, draftReference,
  }), [destination, business, customerName, draftReference]);

  const applySnapshot = React.useCallback((snapshot: Parameters<typeof createDrawingImportReviewState>[0]) => {
    updateState((current) => current ? mergeDrawingImportJobSnapshot(current, snapshot) : createDrawingImportReviewState(snapshot));
  }, [updateState]);
  const saveQueue = React.useMemo(() => createDrawingImportSaveQueue({
    save: api.saveCorrection,
    onSaved: (input, savedPage) => {
      if (stateRef.current?.progress.jobId !== input.jobId) return;
      updateState((current) => current ? acknowledgeDrawingImportFieldSave(current, input, savedPage) : current);
      setSaveErrors((current) => { const next = { ...current }; delete next[`${input.pageId}:${input.field}`]; return next; });
    },
    onError: (input, saveError) => {
      if (stateRef.current?.progress.jobId !== input.jobId) return;
      setSaveErrors((current) => ({ ...current, [`${input.pageId}:${input.field}`]: saveError instanceof Error ? saveError.message : 'Could not save this correction.' }));
    },
    onPendingChange: setSavingFields,
  }), [api, updateState]);
  const activeJobId = state?.progress.jobId ?? null;
  const activeJobStatus = state?.progress.status ?? null;

  React.useEffect(() => {
    setAvailableMaterials((current) => [...new Map([...current, ...materials].map((material) => [material.id, material])).values()]);
  }, [materials]);

  React.useEffect(() => {
    let active = true;
    setFeature(null);
    updateState(null);
    setError('');
    setRefreshError('');
    setSaveErrors({});
    setClassificationErrors({});
    setRestoreJobId(null);
    setRestoring(true);
    void api.getFeatureStatus().then(async (status) => {
      if (!active) return;
      setFeature(status);
      if (!status.enabled) { setRestoring(false); return; }
      const jobId = readDrawingImportJobId(window.localStorage, draftContext);
      if (!jobId) { setRestoring(false); return; }
      setRestoreJobId(jobId);
      try {
        const snapshot = await api.getJob(jobId);
        if (active) { applySnapshot(snapshot); setRestoreJobId(null); }
      } catch (restoreError) {
        if (active) setRefreshError(restoreError instanceof Error ? restoreError.message : 'Could not reload your saved import.');
      } finally {
        if (active) setRestoring(false);
      }
    }).catch((statusError) => {
      if (active) { setError(statusError instanceof Error ? statusError.message : 'Could not check Drawing Import availability.'); setRestoring(false); }
    });
    return () => { active = false; };
  }, [api, applySnapshot, draftContext, updateState]);

  React.useEffect(() => {
    if (!activeJobId || !activeJobStatus || TERMINAL_STATUSES.has(activeJobStatus)) return;
    let active = true;
    let timer: number | null = null;
    const poll = async () => {
      try {
        const snapshot = await api.getJob(activeJobId);
        if (active) { applySnapshot(snapshot); setRefreshError(''); }
      } catch (pollError) {
        if (active) setRefreshError(pollError instanceof Error ? pollError.message : 'Could not refresh drawing progress.');
      } finally {
        if (active) timer = window.setTimeout(poll, pollIntervalMs);
      }
    };
    timer = window.setTimeout(poll, pollIntervalMs);
    return () => { active = false; if (timer !== null) window.clearTimeout(timer); };
  }, [activeJobId, activeJobStatus, api, applySnapshot, pollIntervalMs]);

  async function refreshSavedImport() {
    const jobId = stateRef.current?.progress.jobId ?? restoreJobId;
    if (!jobId || restoring) return;
    setRestoring(true);
    try {
      const snapshot = await api.getJob(jobId);
      if ((stateRef.current?.progress.jobId ?? restoreJobId) !== jobId) return;
      applySnapshot(snapshot);
      setRestoreJobId(null);
      setRefreshError('');
    } catch (restoreError) {
      setRefreshError(restoreError instanceof Error ? restoreError.message : 'Could not reload your saved import.');
    } finally { setRestoring(false); }
  }

  async function upload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !intakeMode) return;
    if (!customerName.trim()) { setError('Choose a customer before uploading drawings.'); return; }
    setUploading(true);
    setError('');
    try {
      const snapshot = await api.startQuoteImport({
        file, business, customerName, draftReference, intakeMode, assemblyMultiplier,
      });
      writeDrawingImportJobId(window.localStorage, draftContext, snapshot.progress.jobId);
      updateState(createDrawingImportReviewState(snapshot));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not start the drawing import.');
    } finally {
      setUploading(false);
    }
  }

  async function cancel() {
    if (!state || cancelling) return;
    setCancelling(true);
    setError('');
    try { applySnapshot(await api.cancelJob(state.progress.jobId)); }
    catch (cancelError) { setError(cancelError instanceof Error ? cancelError.message : 'Could not cancel this import.'); }
    finally { setCancelling(false); }
  }

  async function reprocess(pageId: string) {
    if (!state || reprocessingPageIds.includes(pageId) || transferringRef.current) return;
    if (drawingImportHasUnsavedChanges(stateRef.current) || savingFields.length || creatingFields.length || pendingClassification.current.size) { setError('Finish saving your corrections before reprocessing a page.'); return; }
    if (!TERMINAL_STATUSES.has(state.progress.status)) { setError('Wait for the current page request to finish before reprocessing another page.'); return; }
    setReprocessingPageIds((current) => [...current, pageId]);
    setError('');
    try { applySnapshot(await api.reprocessPage(state.progress.jobId, pageId)); }
    catch (reprocessError) { setError(reprocessError instanceof Error ? reprocessError.message : 'Could not reprocess this page.'); }
    finally { setReprocessingPageIds((current) => current.filter((candidate) => candidate !== pageId)); }
  }

  function changeField(pageId: string, field: DrawingImportFieldName, value: FieldPrimitive | null) {
    if (!drawingImportCanReview(stateRef.current) || transferringRef.current) return;
    updateState((current) => current ? updateDrawingImportField(current, pageId, field, value) : current);
  }

  async function commitField(pageId: string, field: DrawingImportFieldName, overrideValue?: FieldPrimitive | null) {
    const current = stateRef.current;
    if (!current || !drawingImportCanReview(current) || transferringRef.current) return;
    const page = current.pages.find((candidate) => candidate.pageId === pageId);
    if (!page?.extraction) return;
    const value = overrideValue === undefined ? page?.extraction?.[field].value ?? null : overrideValue;
    changeField(pageId, field, value);
    await saveQueue.enqueue({ jobId: current.progress.jobId, pageId, field, value });
  }

  async function chooseCandidate(pageId: string, field: DrawingImportFieldName, value: FieldPrimitive) {
    changeField(pageId, field, value);
    await commitField(pageId, field, value);
  }

  async function classifyPage(pageId: string, classification: DrawingImportPageClassification) {
    const current = stateRef.current;
    if (!current || !(classification === 'reference' ? drawingImportCanKeepFileOnly(current) : drawingImportCanReview(current)) || pendingClassification.current.has(pageId) || transferringRef.current) return;
    if (drawingImportHasUnsavedChanges(current) || savingFields.length || creatingFields.length) { setError('Finish saving your corrections before changing a page type.'); return; }
    pendingClassification.current.add(pageId);
    setClassifyingPageIds([...pendingClassification.current]);
    setError('');
    try {
      const savedPage = await api.saveClassification({ jobId: current.progress.jobId, pageId, classification });
      updateState((latest) => latest?.progress.jobId === current.progress.jobId ? acknowledgeDrawingImportClassificationSave(latest, savedPage) : latest);
      setClassificationErrors((errors) => { const next = { ...errors }; delete next[pageId]; return next; });
    } catch (classificationError) {
      if (stateRef.current?.progress.jobId === current.progress.jobId) setClassificationErrors((errors) => ({ ...errors, [pageId]: { classification, message: classificationError instanceof Error ? classificationError.message : 'Could not save this page-type decision.' } }));
    } finally {
      pendingClassification.current.delete(pageId);
      setClassifyingPageIds([...pendingClassification.current]);
    }
  }

  async function createMaterial(pageId: string, detectedName: string) {
    if (!onCreateMaterial || transferringRef.current) return;
    const jobId = stateRef.current?.progress.jobId;
    const key = `${pageId}:material`;
    if (creatingFields.includes(key)) return;
    setCreatingFields((current) => [...current, key]);
    try {
      const created = await onCreateMaterial(detectedName);
      setAvailableMaterials((current) => [...new Map([...current, created].map((material) => [material.id, material])).values()]);
      if (stateRef.current?.progress.jobId !== jobId || stateRef.current.pages.find((page) => page.pageId === pageId)?.extraction?.material.value !== detectedName) return;
      changeField(pageId, 'material', created.name);
      await commitField(pageId, 'material', created.name);
    } catch (materialError) {
      setError(materialError instanceof Error ? materialError.message : 'Could not add this material.');
    } finally {
      setCreatingFields((current) => current.filter((candidate) => candidate !== key));
    }
  }

  async function continueToQuote() {
    const current = stateRef.current;
    if (!current || !drawingImportCanTransferToDraft(current) || drawingImportHasUnsavedChanges(current) || savingFields.length || creatingFields.length || pendingClassification.current.size || Object.keys(saveErrors).length || Object.keys(classificationErrors).length || refreshError || transferringRef.current) return;
    const result = buildReviewedQuoteDrawingImport(current.pages, availableMaterials, current.supportingFiles);
    if (result.blockingMessages.length) { setError(result.blockingMessages.join(' ')); return; }
    transferringRef.current = true;
    setTransferring(true);
    setTransferError('');
    try {
      await handoff.transfer(result.parts, result.files, current.progress.jobId, onContinue, () => {
        // The receiving draft is durable; an unavailable browser storage cannot undo that acknowledgement.
        try { clearDrawingImportJobId(window.localStorage, draftContext); } catch { /* Retaining a recovery pointer is safe. */ }
      });
    } catch (problem) {
      setTransferError(problem instanceof Error ? problem.message : 'Could not save the receiving draft.');
    } finally {
      transferringRef.current = false;
      setTransferring(false);
    }
  }

  if (!feature) return <div className="rounded-xl border border-border/60 p-4 text-sm text-muted-foreground" role={error ? 'alert' : 'status'}>{error || 'Checking Drawing Import…'}</div>;
  if (!feature.enabled) return (
    <Card><CardHeader><CardTitle>Drawing Import {feature.version} is unavailable</CardTitle><CardDescription>{feature.reason || 'Use the current drawing importer for this quote.'}</CardDescription></CardHeader><CardFooter><Button type="button" onClick={onSwitchToLegacy}>Use current importer</Button></CardFooter></Card>
  );

  const counts = countDrawingImportFilters(state?.pages ?? []);
  const visiblePages = (state?.pages ?? []).filter((page) => pageMatchesDrawingImportFilter(page, filter));
  const partPages = visiblePages.filter((page) => PART_CLASSIFICATIONS.has(page.classification));
  const supportingPages = visiblePages.filter((page) => !PART_CLASSIFICATIONS.has(page.classification));
  const activeReprocessPageIds = [...new Set([...reprocessingPageIds, ...(state && !TERMINAL_STATUSES.has(state.progress.status) ? state.pages : []).filter((page) => page.processingStatus === 'queued' || page.processingStatus === 'processing').map((page) => page.pageId)])];
  const shadowMode = feature.mode === 'shadow';
  const reviewReady = drawingImportCanReview(state);
  const transferReady = drawingImportCanTransferToDraft(state);
  const pendingSave = savingFields.length > 0 || creatingFields.length > 0 || classifyingPageIds.length > 0;
  const hasUnsavedChanges = drawingImportHasUnsavedChanges(state);
  const materialChoices = availableMaterials.map((material) => ({ value: material.name, label: material.name }));
  const draftReadiness = state && (reviewReady || transferReady) ? buildReviewedQuoteDrawingImport(state.pages, availableMaterials, state.supportingFiles) : null;

  return (
    <Card>
      <CardHeader className="p-4 pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Import drawings</CardTitle><CardDescription>Upload a ZIP of PDF, PNG, or JPG drawings, or a multi-page assembly PDF. PDFs are split locally without OCR into individual pages; each page is read in its own AI request.</CardDescription></div>{!state && !restoreJobId ? <Button type="button" variant="ghost" onClick={onSwitchToLegacy}>Use current importer</Button> : null}</div></CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {shadowMode ? <p className="rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-950">Shadow mode compares {feature.version} without allowing its results to change the quote.</p> : null}
        {!state && (restoring || restoreJobId) ? <div className="rounded-lg border border-border/60 p-4 text-sm" role="status">{restoring ? 'Restoring your saved import…' : 'Your import is still saved. Retry loading it to continue; you do not need to upload it again.'}</div> : !state ? (
          <>
            <fieldset disabled={phoneActive || uploading} className="contents"><div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Drawing intake mode">
              {(['ONE_OFF', 'ASSEMBLY'] as const).map((mode) => <button key={mode} type="button" aria-pressed={intakeMode === mode} onClick={() => setIntakeMode(mode)} className={`rounded-xl border-2 p-4 text-left ${intakeMode === mode ? 'border-primary bg-primary/10' : 'border-border/60'}`}><span className="block font-semibold">{mode === 'ONE_OFF' ? 'One-off parts' : 'Assembly'}</span><span className="text-xs text-muted-foreground">{mode === 'ONE_OFF' ? 'Use reviewed drawing quantities.' : 'Apply the requested root assembly quantity through the BOM graph.'}</span></button>)}
            </div>
            {intakeMode === 'ASSEMBLY' ? <div className="grid max-w-xs gap-1"><Label htmlFor={`v2-assembly-${draftReference}`}>Number of assemblies</Label><Input id={`v2-assembly-${draftReference}`} type="number" min={1} step={1} value={assemblyMultiplier} onChange={(event) => setAssemblyMultiplier(Math.max(1, Math.floor(Number(event.target.value) || 1)))} /></div> : null}
            <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/35 bg-primary/5 p-6 text-center"><Upload aria-hidden="true" className="h-9 w-9 text-primary" /><span className="font-semibold">{uploading ? 'Starting import…' : 'Choose a drawing packet, drawing, or ZIP'}</span><Input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.zip" disabled={!intakeMode || uploading || phoneActive} onChange={(event) => void upload(event.target.files)} /></label></fieldset>
            <PhoneUploadHandoff context={{ destination, business, customerName, draftReference, intakeMode: intakeMode ?? 'ONE_OFF', assemblyMultiplier: intakeMode === 'ASSEMBLY' ? assemblyMultiplier : 1 }} enabled={Boolean(intakeMode && customerName.trim() && !uploading)} onActiveChange={setPhoneActive} onRestoreContext={context => { setIntakeMode(context.intakeMode); setAssemblyMultiplier(context.assemblyMultiplier); }} onJob={snapshot => { writeDrawingImportJobId(window.localStorage, draftContext, snapshot.progress.jobId); updateState(createDrawingImportReviewState(snapshot)); }} />
          </>
        ) : (
          <>
            <DrawingImportJobProgress progress={state.progress} showAdminMetrics={showAdminMetrics} cancelling={cancelling} onCancel={() => void cancel()} />
            {reviewReady ? <fieldset disabled={transferring} className="contents">
            {draftReadiness ? <DrawingImportDraftReadiness result={draftReadiness} /> : null}
            <DrawingImportReviewFilters value={filter} counts={counts} onChange={setFilter} />
            <div className="[overflow-anchor:none]">
              <div>{partPages.map((page) => <DrawingImportPageCard key={page.pageId} page={page} dirtyFields={state.dirtyFieldsByPage[page.pageId]} reprocessing={activeReprocessPageIds.includes(page.pageId)} resolveEvidenceUrls={resolveEvidenceUrls} fieldChoices={{ material: materialChoices }} creatingFields={creatingFields.includes(`${page.pageId}:material`) ? ['material'] : []} onCreateFieldValue={onCreateMaterial ? (pageId, field, value) => { if (field === 'material') void createMaterial(pageId, value); } : undefined} onFieldChange={changeField} onFieldCommit={(pageId, field, valueOverride) => void commitField(pageId, field, valueOverride)} onChooseCandidate={(pageId, field, value) => void chooseCandidate(pageId, field, value)} onReprocess={(pageId) => void reprocess(pageId)} onKeepFileOnly={(pageId) => void classifyPage(pageId, 'reference')} />)}</div>
              <DrawingImportSupportingPages pages={supportingPages} reprocessingPageIds={[...activeReprocessPageIds, ...classifyingPageIds]} onReprocess={(pageId) => void reprocess(pageId)} onClassifyAsPart={(pageId) => void classifyPage(pageId, 'part_drawing')} onKeepFileOnly={(pageId) => void classifyPage(pageId, 'reference')} />
            </div>
            </fieldset> : <>
              <DrawingImportProcessingPages pages={state.pages} active={!TERMINAL_STATUSES.has(state.progress.status)} />
              {draftReadiness ? <DrawingImportDraftReadiness result={draftReadiness} /> : null}
              {drawingImportCanKeepFileOnly(state) ? <fieldset disabled={transferring} className="contents"><p className="text-sm text-muted-foreground">Choose Keep file only for each saved page to finish manually in the draft. This does not rerun AI or discard the drawings.</p><DrawingImportSupportingPages pages={state.pages} reprocessingPageIds={[...activeReprocessPageIds, ...classifyingPageIds]} onReprocess={(pageId) => void reprocess(pageId)} onKeepFileOnly={(pageId) => void classifyPage(pageId, 'reference')} /></fieldset> : null}
            </>}
          </>
        )}
        {error ? <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
        {transferError ? <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">The receiving draft was not confirmed saved. Your import and reviewed values are retained; retry the transfer below. {transferError}</p> : null}
        {refreshError ? <div className="space-y-2 rounded-lg border border-amber-400/60 p-3 text-sm" role="alert"><p>Could not refresh the import. Saved pages and your current edits are retained. {refreshError}</p><Button type="button" size="sm" variant="outline" disabled={restoring} onClick={() => void refreshSavedImport()}>{restoring ? 'Retrying…' : 'Retry loading saved import'}</Button></div> : null}
        {Object.keys(saveErrors).length ? <div className="space-y-2 rounded-lg border border-destructive/40 p-3 text-sm" role="alert"><p>Some corrections have not saved. Keep this page open. {Object.values(saveErrors).join(' ')}</p><Button type="button" size="sm" variant="outline" disabled={pendingSave} onClick={() => { for (const key of Object.keys(saveErrors)) { const [pageId, field] = key.split(':'); void commitField(pageId, field as DrawingImportFieldName); } }}>Retry saving corrections</Button></div> : null}
        {Object.keys(classificationErrors).length ? <div className="space-y-2 rounded-lg border border-destructive/40 p-3 text-sm" role="alert"><p>A page-type decision has not saved. {Object.values(classificationErrors).map((entry) => entry.message).join(' ')}</p><Button type="button" size="sm" variant="outline" disabled={pendingSave || hasUnsavedChanges} onClick={() => { for (const [pageId, failure] of Object.entries(classificationErrors)) void classifyPage(pageId, failure.classification); }}>Retry saving page types</Button></div> : null}
      </CardContent>
      {state ? <CardFooter className="flex-wrap justify-end gap-3 p-4 pt-0">{pendingSave || hasUnsavedChanges ? <p className="text-sm text-muted-foreground" role="status">{pendingSave ? 'Saving your changes…' : 'Click outside the edited field to save before continuing.'}</p> : null}<Button type="button" onClick={() => void continueToQuote()} disabled={transferring || shadowMode || !transferReady || pendingSave || hasUnsavedChanges || Object.keys(saveErrors).length > 0 || Object.keys(classificationErrors).length > 0 || Boolean(refreshError) || activeReprocessPageIds.length > 0 || Boolean(draftReadiness?.blockingMessages.length)}>{transferring ? 'Saving to draft…' : transferError ? 'Retry transfer to draft' : `Continue to ${destination} draft`}</Button></CardFooter> : null}
    </Card>
  );
}
