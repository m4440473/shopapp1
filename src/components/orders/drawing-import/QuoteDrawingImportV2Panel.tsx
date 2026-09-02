'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import type { DrawingImportFieldName, DrawingImportPageClassification } from '@/modules/drawing-import/v2/drawing-import-v2.types';

import {
  clearDrawingImportFieldDirty,
  clearDrawingImportJobId,
  countDrawingImportFilters,
  createDrawingImportReviewState,
  markDrawingImportFieldDirty,
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
import { PhoneUploadHandoff } from './PhoneUploadHandoff';
import { buildReviewedQuoteDrawingImport } from './quote-drawing-import';
import type {
  DrawingImportReviewFilter,
  DrawingImportReviewFile,
  DrawingImportReviewState,
  DrawingImportV2ApiClient,
  DrawingImportV2FeatureStatus,
  ResolveDrawingImportEvidenceUrls,
  ReviewedQuoteDrawingPartV2,
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
  onContinue: (parts: ReviewedQuoteDrawingPartV2[], files: DrawingImportReviewFile[], jobId: string) => void;
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
  const [creatingFields, setCreatingFields] = React.useState<string[]>([]);
  const [availableMaterials, setAvailableMaterials] = React.useState(materials);
  const [error, setError] = React.useState('');
  const [phoneActive, setPhoneActive] = React.useState(false);

  const draftContext = React.useMemo<DrawingImportJobDraftContext>(() => ({
    destination, business, customerName, draftReference,
  }), [destination, business, customerName, draftReference]);

  const applySnapshot = React.useCallback((snapshot: Parameters<typeof createDrawingImportReviewState>[0]) => {
    setState((current) => current ? mergeDrawingImportJobSnapshot(current, snapshot) : createDrawingImportReviewState(snapshot));
  }, []);
  const activeJobId = state?.progress.jobId ?? null;
  const activeJobStatus = state?.progress.status ?? null;

  React.useEffect(() => {
    setAvailableMaterials((current) => [...new Map([...current, ...materials].map((material) => [material.id, material])).values()]);
  }, [materials]);

  React.useEffect(() => {
    let active = true;
    setFeature(null);
    setState(null);
    setError('');
    void api.getFeatureStatus().then(async (status) => {
      if (!active) return;
      setFeature(status);
      if (!status.enabled) return;
      const jobId = readDrawingImportJobId(window.localStorage, draftContext);
      if (!jobId) return;
      try {
        const snapshot = await api.getJob(jobId);
        if (active) applySnapshot(snapshot);
      } catch {
        if (active) clearDrawingImportJobId(window.localStorage, draftContext);
      }
    }).catch((statusError) => {
      if (active) setError(statusError instanceof Error ? statusError.message : 'Could not check Drawing Import availability.');
    });
    return () => { active = false; };
  }, [api, applySnapshot, draftContext]);

  React.useEffect(() => {
    if (!activeJobId || !activeJobStatus || TERMINAL_STATUSES.has(activeJobStatus)) return;
    let active = true;
    let timer: number | null = null;
    const poll = async () => {
      try {
        const snapshot = await api.getJob(activeJobId);
        if (active) applySnapshot(snapshot);
      } catch (pollError) {
        if (active) setError(pollError instanceof Error ? pollError.message : 'Could not refresh drawing progress.');
      } finally {
        if (active) timer = window.setTimeout(poll, pollIntervalMs);
      }
    };
    timer = window.setTimeout(poll, pollIntervalMs);
    return () => { active = false; if (timer !== null) window.clearTimeout(timer); };
  }, [activeJobId, activeJobStatus, api, applySnapshot, pollIntervalMs]);

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
      setState(createDrawingImportReviewState(snapshot));
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
    if (!state || reprocessingPageIds.includes(pageId)) return;
    setReprocessingPageIds((current) => [...current, pageId]);
    setError('');
    try { applySnapshot(await api.reprocessPage(state.progress.jobId, pageId)); }
    catch (reprocessError) { setError(reprocessError instanceof Error ? reprocessError.message : 'Could not reprocess this page.'); }
    finally { setReprocessingPageIds((current) => current.filter((candidate) => candidate !== pageId)); }
  }

  function changeField(pageId: string, field: DrawingImportFieldName, value: FieldPrimitive | null) {
    setState((current) => current ? updateDrawingImportField(current, pageId, field, value) : current);
  }

  async function commitField(pageId: string, field: DrawingImportFieldName, overrideValue?: FieldPrimitive | null) {
    if (!state) return;
    const key = `${pageId}:${field}`;
    if (savingFields.includes(key)) return;
    const page = state.pages.find((candidate) => candidate.pageId === pageId);
    const value = overrideValue === undefined ? page?.extraction?.[field].value ?? null : overrideValue;
    setSavingFields((current) => [...current, key]);
    try {
      const savedPage = await api.saveCorrection({ jobId: state.progress.jobId, pageId, field, value });
      setState((current) => {
        if (!current) return current;
        const cleared = clearDrawingImportFieldDirty(current, pageId, field);
        return mergeDrawingImportJobSnapshot(cleared, {
          progress: cleared.progress,
          pages: [savedPage],
          supportingFiles: cleared.supportingFiles,
        });
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this correction.');
    } finally {
      setSavingFields((current) => current.filter((candidate) => candidate !== key));
    }
  }

  async function chooseCandidate(pageId: string, field: DrawingImportFieldName, value: FieldPrimitive) {
    changeField(pageId, field, value);
    await commitField(pageId, field, value);
  }

  async function classifyPage(pageId: string, classification: DrawingImportPageClassification) {
    if (!state) return;
    try {
      const savedPage = await api.saveClassification({ jobId: state.progress.jobId, pageId, classification });
      setState((current) => current ? mergeDrawingImportJobSnapshot(current, {
        progress: current.progress,
        pages: [savedPage],
        supportingFiles: current.supportingFiles,
      }) : current);
    } catch (classificationError) {
      setError(classificationError instanceof Error ? classificationError.message : 'Could not save this page-type decision.');
    }
  }

  async function createMaterial(pageId: string, detectedName: string) {
    if (!onCreateMaterial) return;
    const key = `${pageId}:material`;
    if (creatingFields.includes(key)) return;
    setCreatingFields((current) => [...current, key]);
    try {
      const created = await onCreateMaterial(detectedName);
      setAvailableMaterials((current) => [...new Map([...current, created].map((material) => [material.id, material])).values()]);
      changeField(pageId, 'material', created.name);
      await commitField(pageId, 'material', created.name);
    } catch (materialError) {
      setError(materialError instanceof Error ? materialError.message : 'Could not add this material.');
    } finally {
      setCreatingFields((current) => current.filter((candidate) => candidate !== key));
    }
  }

  function continueToQuote() {
    if (!state) return;
    const result = buildReviewedQuoteDrawingImport(state.pages, availableMaterials, state.supportingFiles);
    if (result.blockingMessages.length) { setError(result.blockingMessages.join(' ')); return; }
    onContinue(result.parts, result.files, state.progress.jobId);
    clearDrawingImportJobId(window.localStorage, draftContext);
  }

  if (!feature) return <div className="rounded-xl border border-border/60 p-4 text-sm text-muted-foreground" role="status">Checking Drawing Import…</div>;
  if (!feature.enabled) return (
    <Card><CardHeader><CardTitle>Drawing Import {feature.version} is unavailable</CardTitle><CardDescription>{feature.reason || 'Use the current drawing importer for this quote.'}</CardDescription></CardHeader><CardFooter><Button type="button" onClick={onSwitchToLegacy}>Use current importer</Button></CardFooter></Card>
  );

  const counts = countDrawingImportFilters(state?.pages ?? []);
  const visiblePages = (state?.pages ?? []).filter((page) => pageMatchesDrawingImportFilter(page, filter));
  const partPages = visiblePages.filter((page) => PART_CLASSIFICATIONS.has(page.classification));
  const supportingPages = visiblePages.filter((page) => !PART_CLASSIFICATIONS.has(page.classification));
  const shadowMode = feature.mode === 'shadow';
  const reviewReady = state ? ['READY_FOR_REVIEW', 'PARTIAL_FAILURE', 'COMPLETE'].includes(state.progress.status) : false;
  const materialChoices = availableMaterials.map((material) => ({ value: material.name, label: material.name }));

  return (
    <Card>
      <CardHeader className="p-4 pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Import drawings</CardTitle><CardDescription>Upload a ZIP or PDF. Multi-page PDFs are split, then each drawing is read separately.</CardDescription></div><Button type="button" variant="ghost" onClick={onSwitchToLegacy}>Use current importer</Button></div></CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {shadowMode ? <p className="rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-950">Shadow mode compares {feature.version} without allowing its results to change the quote.</p> : null}
        {!state ? (
          <>
            <fieldset disabled={phoneActive || uploading} className="contents"><div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Drawing intake mode">
              {(['ONE_OFF', 'ASSEMBLY'] as const).map((mode) => <button key={mode} type="button" aria-pressed={intakeMode === mode} onClick={() => setIntakeMode(mode)} className={`rounded-xl border-2 p-4 text-left ${intakeMode === mode ? 'border-primary bg-primary/10' : 'border-border/60'}`}><span className="block font-semibold">{mode === 'ONE_OFF' ? 'One-off parts' : 'Assembly'}</span><span className="text-xs text-muted-foreground">{mode === 'ONE_OFF' ? 'Use reviewed drawing quantities.' : 'Apply the requested root assembly quantity through the BOM graph.'}</span></button>)}
            </div>
            {intakeMode === 'ASSEMBLY' ? <div className="grid max-w-xs gap-1"><Label htmlFor={`v2-assembly-${draftReference}`}>Number of assemblies</Label><Input id={`v2-assembly-${draftReference}`} type="number" min={1} step={1} value={assemblyMultiplier} onChange={(event) => setAssemblyMultiplier(Math.max(1, Math.floor(Number(event.target.value) || 1)))} /></div> : null}
            <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/35 bg-primary/5 p-6 text-center"><Upload aria-hidden="true" className="h-9 w-9 text-primary" /><span className="font-semibold">{uploading ? 'Starting import…' : 'Choose a drawing packet, drawing, or ZIP'}</span><Input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.zip" disabled={!intakeMode || uploading || phoneActive} onChange={(event) => void upload(event.target.files)} /></label></fieldset>
            <PhoneUploadHandoff context={{ destination, business, customerName, draftReference, intakeMode: intakeMode ?? 'ONE_OFF', assemblyMultiplier: intakeMode === 'ASSEMBLY' ? assemblyMultiplier : 1 }} enabled={Boolean(intakeMode && customerName.trim() && !uploading)} onActiveChange={setPhoneActive} onRestoreContext={context => { setIntakeMode(context.intakeMode); setAssemblyMultiplier(context.assemblyMultiplier); }} onJob={snapshot => { writeDrawingImportJobId(window.localStorage, draftContext, snapshot.progress.jobId); setState(createDrawingImportReviewState(snapshot)); }} />
          </>
        ) : (
          <>
            <DrawingImportJobProgress progress={state.progress} showAdminMetrics={showAdminMetrics} cancelling={cancelling} onCancel={() => void cancel()} />
            <DrawingImportReviewFilters value={filter} counts={counts} onChange={setFilter} />
            <div className="[overflow-anchor:none]">
              <div>{partPages.map((page) => <DrawingImportPageCard key={page.pageId} page={page} dirtyFields={state.dirtyFieldsByPage[page.pageId]} reprocessing={reprocessingPageIds.includes(page.pageId)} resolveEvidenceUrls={resolveEvidenceUrls} fieldChoices={{ material: materialChoices }} creatingFields={creatingFields.includes(`${page.pageId}:material`) ? ['material'] : []} onCreateFieldValue={onCreateMaterial ? (pageId, field, value) => { if (field === 'material') void createMaterial(pageId, value); } : undefined} onFieldChange={changeField} onFieldCommit={(pageId, field, valueOverride) => void commitField(pageId, field, valueOverride)} onChooseCandidate={(pageId, field, value) => void chooseCandidate(pageId, field, value)} onReprocess={(pageId) => void reprocess(pageId)} onKeepFileOnly={(pageId) => void classifyPage(pageId, 'reference')} />)}</div>
              <DrawingImportSupportingPages pages={supportingPages} reprocessingPageIds={reprocessingPageIds} onReprocess={(pageId) => void reprocess(pageId)} onClassifyAsPart={(pageId) => void classifyPage(pageId, 'part_drawing')} />
            </div>
          </>
        )}
        {error ? <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
      </CardContent>
      {state ? <CardFooter className="justify-end p-4 pt-0"><Button type="button" onClick={continueToQuote} disabled={shadowMode || !reviewReady || savingFields.length > 0}>Continue to {destination}</Button></CardFooter> : null}
    </Card>
  );
}
