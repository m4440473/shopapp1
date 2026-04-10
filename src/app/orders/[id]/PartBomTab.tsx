'use client';

import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PrintAnalyzerResult } from '@/lib/printAnalyzer/schema';

type PartAttachmentLike = {
  id: string;
  kind?: string | null;
  label?: string | null;
  mimeType?: string | null;
  storagePath?: string | null;
  url?: string | null;
};

type AnalyzeErrorPayload = {
  error: string;
  detail?: string;
  issues?: unknown;
  debug?: unknown;
  rawModelText?: string;
  extractedJsonText?: string;
};

type UnitPreference = 'inch' | 'mm';

const INCH_PER_MM = 1 / 25.4;
const MM_PER_INCH = 25.4;

export function mmToIn(mm: number): number {
  return mm * INCH_PER_MM;
}

export function inToMm(inputIn: number): number {
  return inputIn * MM_PER_INCH;
}

function trimTrailingZeros(value: string): string {
  return value.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function formatInches(value: number): string {
  return trimTrailingZeros(value.toFixed(4));
}

export function formatMm(value: number): string {
  return trimTrailingZeros(value.toFixed(3));
}

export function parseThreadPitch(thread: string): { pitchIn?: number; pitchMm?: number; tpi?: number } {
  const metricMatch = thread.match(/^M(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/i);
  if (metricMatch) {
    const pitchMm = Number.parseFloat(metricMatch[2]);
    if (Number.isFinite(pitchMm) && pitchMm > 0) {
      return { pitchMm, pitchIn: mmToIn(pitchMm) };
    }
  }

  const imperialMatch = thread.match(/(\d+\/\d+|\d+)\s*-\s*(\d{1,3})/);
  if (imperialMatch) {
    const tpi = Number.parseInt(imperialMatch[2], 10);
    if (Number.isFinite(tpi) && tpi > 0) {
      return { tpi, pitchIn: 1 / tpi, pitchMm: inToMm(1 / tpi) };
    }
  }

  return {};
}

export function isTightTolerance(
  hole: PrintAnalyzerResult['holes'][number],
  units: PrintAnalyzerResult['units']
): boolean {
  const fit = hole.tolerance?.fit ?? '';
  if (/(H7|H6|G7|F7)/i.test(fit)) return true;

  const plusRaw = hole.tolerance?.plus;
  const minusRaw = hole.tolerance?.minus;
  if (typeof plusRaw !== 'number' || typeof minusRaw !== 'number') return false;

  const plus = Math.abs(plusRaw);
  const minus = Math.abs(minusRaw);
  const band = plus + minus;

  if (units === 'inch') {
    return band <= 0.0015 || (plus <= 0.001 && minus <= 0.001);
  }
  if (units === 'mm') {
    return band <= 0.04;
  }

  return false;
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

function isPdfMimeType(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

function isAnalyzeErrorPayload(payload: unknown): payload is AnalyzeErrorPayload {
  return Boolean(payload && typeof payload === 'object' && 'error' in payload);
}

export function PartBomTab({
  orderId,
  partId,
  attachments,
}: {
  orderId: string;
  partId: string;
  attachments: PartAttachmentLike[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrintAnalyzerResult | null>(null);
  const [debugPayload, setDebugPayload] = useState<AnalyzeErrorPayload | null>(null);
  const [primaryUnits, setPrimaryUnits] = useState<UnitPreference>('inch');
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const imageAttachments = useMemo(
    () =>
      attachments.filter((attachment) => {
        const attachmentKind = (attachment.kind ?? '').toUpperCase();
        const isPrintKind = attachmentKind === 'PRINT';
        const isImageKind = attachmentKind === 'IMAGE';
        const mimeType = (attachment.mimeType ?? '').toLowerCase();
        const isImageMime = mimeType.startsWith('image/');
        const isPdfMime = isPdfMimeType(mimeType);
        const isExplicitUnsupportedMime = Boolean(mimeType && !isImageMime && !isPdfMime);
        if (isExplicitUnsupportedMime) return false;
        return isPrintKind || isImageKind || isImageMime || isPdfMime;
      }),
    [attachments]
  );

  const attachmentOptions = useMemo(
    () =>
      imageAttachments
        .map((attachment) => {
          const attachmentKind = (attachment.kind ?? '').toUpperCase();
          return {
            id: attachment.id,
            label: attachment.label?.trim() || 'Print attachment',
            mimeType: attachment.mimeType ?? 'image/*',
            isPreferredPrint: attachmentKind === 'PRINT',
          };
        })
        .sort((a, b) => Number(b.isPreferredPrint) - Number(a.isPreferredPrint)),
    [imageAttachments]
  );

  const canAnalyze = (!loading && Boolean(file)) || (!loading && Boolean(selectedAttachmentId));

  useEffect(() => {
    let active = true;

    const loadSavedAnalysis = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}/parts/${partId}/bom-analysis`, {
          credentials: 'include',
        });
        const payload = (await response.json().catch(() => null)) as
          | { result?: PrintAnalyzerResult | null; updatedAt?: string }
          | null;

        if (!active || !response.ok || !payload?.result) return;

        setResult(payload.result);
        setLoadedAt(payload.updatedAt ?? null);
        if (payload.result.units === 'mm') setPrimaryUnits('mm');
        if (payload.result.units === 'inch') setPrimaryUnits('inch');
      } catch {
        // Ignore load failures and allow manual analysis.
      }
    };

    void loadSavedAnalysis();

    return () => {
      active = false;
    };
  }, [orderId, partId]);

  const detectedUnits = result?.units ?? 'unknown';
  const showSecondaryUnits = detectedUnits === 'mm';

  const formatPrimary = (value: number): string => {
    if (primaryUnits === 'mm') return `${formatMm(value)} mm`;
    return `${formatInches(value)} in`;
  };

  const getDisplayDiameter = (diameter: number): { primary: string; secondary?: string } => {
    if (detectedUnits === 'mm') {
      if (primaryUnits === 'mm') {
        return { primary: `${formatMm(diameter)} mm`, secondary: `${formatInches(mmToIn(diameter))} in` };
      }
      return { primary: `${formatInches(mmToIn(diameter))} in`, secondary: `${formatMm(diameter)} mm` };
    }

    if (detectedUnits === 'inch') {
      const primary = primaryUnits === 'mm' ? `${formatMm(inToMm(diameter))} mm` : `${formatInches(diameter)} in`;
      const secondary = primaryUnits === 'mm' ? `${formatInches(diameter)} in` : undefined;
      return { primary, secondary };
    }

    return { primary: String(diameter) };
  };

  const renderTolerance = (tolerance?: { plus?: number; minus?: number; fit?: string; note?: string }) => {
    if (!tolerance) return '—';

    const parts: string[] = [];
    if (typeof tolerance.plus === 'number' || typeof tolerance.minus === 'number') {
      const plus = typeof tolerance.plus === 'number' ? tolerance.plus : 0;
      const minus = typeof tolerance.minus === 'number' ? tolerance.minus : 0;

      if (detectedUnits === 'mm') {
        if (primaryUnits === 'mm') {
          parts.push(`+${formatMm(plus)} / -${formatMm(Math.abs(minus))} mm`);
        } else {
          parts.push(`+${formatInches(mmToIn(plus))} / -${formatInches(mmToIn(Math.abs(minus)))} in`);
        }
      } else if (detectedUnits === 'inch') {
        if (primaryUnits === 'mm') {
          parts.push(`+${formatMm(inToMm(plus))} / -${formatMm(inToMm(Math.abs(minus)))} mm`);
        } else {
          parts.push(`+${formatInches(plus)} / -${formatInches(Math.abs(minus))} in`);
        }
      }
    }

    if (tolerance.fit) parts.push(`Fit ${tolerance.fit}`);
    if (tolerance.note) parts.push(tolerance.note);

    return parts.length ? parts.join(' • ') : '—';
  };

  const getAttachmentDataUrl = async (attachmentId: string): Promise<string> => {
    const target = imageAttachments.find((attachment) => attachment.id === attachmentId);
    if (!target) throw new Error('Selected print attachment was not found.');

    const openHref = target.storagePath ? `/attachments/${target.storagePath}` : target.url;
    if (!openHref) throw new Error('Selected print attachment has no usable URL.');

    const response = await fetch(openHref, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to load selected print attachment.');

    const blob = await response.blob();
    const hintedMimeType = (target.mimeType ?? '').toLowerCase();
    const blobMimeType = (blob.type ?? '').toLowerCase();
    const resolvedMimeType = hintedMimeType || blobMimeType;
    const isPdf = isPdfMimeType(resolvedMimeType);
    const contentType = hintedMimeType.startsWith('image/')
      ? hintedMimeType
      : blobMimeType.startsWith('image/')
      ? blobMimeType
      : isPdf
      ? 'application/pdf'
      : 'image/png';

    if (!hintedMimeType.startsWith('image/') && !blobMimeType.startsWith('image/') && !isPdf) {
      throw new Error('Selected file is not a supported print. Choose a PNG/JPG/WEBP/PDF file in Notes & Files.');
    }

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Failed to read selected print attachment.'));
      reader.readAsDataURL(new File([blob], isPdf ? 'attachment.pdf' : 'attachment-image', { type: contentType }));
    });

    return base64;
  };

  const onAnalyze = async () => {
    if (!canAnalyze) return;

    setLoading(true);
    setError(null);
    setDebugPayload(null);
    setResult(null);

    try {
      const dataUrl = selectedAttachmentId ? await getAttachmentDataUrl(selectedAttachmentId) : await fileToDataUrl(file as File);

      const response = await fetch('/api/print-analyzer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          dataUrl,
          orderId,
          partId,
          sourceLabel: selectedAttachmentId ? 'stored-attachment' : file?.name ?? 'upload',
        }),
      });

      const payload = (await response.json().catch(() => ({ error: 'Non-JSON response from API.' }))) as
        | PrintAnalyzerResult
        | AnalyzeErrorPayload;

      if (!response.ok || isAnalyzeErrorPayload(payload)) {
        const message = isAnalyzeErrorPayload(payload)
          ? payload.detail
            ? `${payload.error} (${payload.detail})`
            : payload.error
          : 'Analyzer request failed.';

        setError(message);
        if (isAnalyzeErrorPayload(payload)) {
          setDebugPayload(payload);
        }
        return;
      }

      setResult(payload);
      setLoadedAt(new Date().toISOString());
      if (payload.units === 'mm') {
        setPrimaryUnits('mm');
      } else if (payload.units === 'inch') {
        setPrimaryUnits('inch');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown analyzer error';
      setError(`Failed to analyze image: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>BOM Analyzer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {attachmentOptions.length ? (
              <div className="grid gap-2">
                <Label htmlFor="bom-attachment">Use existing Notes & Files print image</Label>
                <Select value={selectedAttachmentId} onValueChange={setSelectedAttachmentId}>
                  <SelectTrigger id="bom-attachment" className="border-border/60 bg-background/80">
                    <SelectValue placeholder="Choose stored print image (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {attachmentOptions.map((attachment) => (
                      <SelectItem key={attachment.id} value={attachment.id}>
                        {attachment.label}{attachment.isPreferredPrint ? ' • PRINT' : ''} ({attachment.mimeType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="bom-upload">Upload print image</Label>
              <Input
                id="bom-upload"
                type="file"
                accept="image/*,application/pdf"
                className="bg-background/80"
                onChange={(event) => {
                  setFile(event.currentTarget.files?.[0] ?? null);
                  setError(null);
                  setResult(null);
                }}
              />
              <p className="text-xs text-muted-foreground">PNG/JPG/WEBP screenshots, photos, or first-page PDFs of the print. Files marked PRINT in Notes & Files are listed first above.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={onAnalyze} disabled={!canAnalyze}>
              {loading ? 'Analyzing…' : 'Analyze'}
            </Button>
            <span className="text-xs text-muted-foreground">Order {orderId.slice(0, 8)} • Part {partId.slice(0, 8)}</span>
            {loadedAt ? <span className="text-xs text-muted-foreground">Saved analysis loaded • {new Date(loadedAt).toLocaleString()}</span> : null}
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {debugPayload ? (
            <details className="rounded-md border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">Debug details</summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap">{JSON.stringify(debugPayload, null, 2)}</pre>
            </details>
          ) : null}
        </CardContent>
      </Card>

      {result ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Units</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="text-muted-foreground">
                Detected units: <span className="font-medium text-foreground">{result.units}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Primary units:</span>
                <div className="flex rounded-md bg-muted/20 p-1">
                  {(['inch', 'mm'] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setPrimaryUnits(unit)}
                      className={`h-8 rounded px-3 text-xs font-medium transition ${
                        primaryUnits === unit
                          ? 'border border-border/60 bg-background text-foreground'
                          : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
                {showSecondaryUnits ? <span className="text-xs text-muted-foreground">(secondary conversion shown)</span> : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>General tolerances</CardTitle>
            </CardHeader>
            <CardContent>
              {result.generalTolerances.length ? (
                <ul className="space-y-2 text-sm">
                  {result.generalTolerances.map((item, idx) => (
                    <li key={`${item.note}-${idx}`} className="rounded-md border border-border/60 bg-muted/10 p-2">
                      <div className="text-foreground">{item.note}</div>
                      <div className="text-xs text-muted-foreground">Confidence {formatInches(item.confidence * 100).replace(/\.$/, '')}%</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Unable to confidently read general tolerances. Please check the paper print.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Holes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60">
                    <TableHead>Diameter</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Tolerance</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.holes.length ? (
                    result.holes.map((hole, idx) => {
                      const diameter = getDisplayDiameter(hole.diameter);
                      const tight = isTightTolerance(hole, result.units);
                      return (
                        <TableRow key={`${hole.diameter}-${idx}`} className="border-border/60">
                          <TableCell>
                            <div className="font-medium text-foreground">{diameter.primary}</div>
                            {diameter.secondary ? <div className="text-xs text-muted-foreground">{diameter.secondary}</div> : null}
                          </TableCell>
                          <TableCell>{hole.count}</TableCell>
                          <TableCell>{hole.notes ?? '—'}</TableCell>
                          <TableCell>{renderTolerance(hole.tolerance)}</TableCell>
                          <TableCell>
                            {tight ? (
                              <div className="flex flex-col gap-1">
                                <Badge variant="secondary" className="w-fit bg-amber-500/20 text-amber-100">
                                  TIGHT TOL
                                </Badge>
                                <span className="text-xs text-muted-foreground">Consider reamer / boring + ream.</span>
                              </div>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>{formatInches(hole.confidence * 100)}%</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow className="border-border/60">
                      <TableCell colSpan={6} className="text-sm text-muted-foreground">
                        No hole data detected.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Radii</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60">
                    <TableHead>Radius</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Tolerance</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.radii.length ? (
                    result.radii.map((radius, idx) => {
                      const display = getDisplayDiameter(radius.radius);
                      return (
                        <TableRow key={`${radius.radius}-${idx}`} className="border-border/60">
                          <TableCell>
                            <div className="font-medium text-foreground">{display.primary}</div>
                            {display.secondary ? <div className="text-xs text-muted-foreground">{display.secondary}</div> : null}
                          </TableCell>
                          <TableCell>{radius.count}</TableCell>
                          <TableCell>{radius.notes ?? '—'}</TableCell>
                          <TableCell>{renderTolerance(radius.tolerance)}</TableCell>
                          <TableCell>{formatInches(radius.confidence * 100)}%</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow className="border-border/60">
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        No radius data detected.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tapped holes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60">
                    <TableHead>Thread</TableHead>
                    <TableHead>Pitch</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Class/Fit</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Recommended tap drill</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.tappedHoles.length ? (
                    result.tappedHoles.map((tap, idx) => {
                      const pitch = parseThreadPitch(tap.thread);
                      return (
                        <TableRow key={`${tap.thread}-${idx}`} className="border-border/60">
                          <TableCell className="font-medium text-foreground">{tap.thread}</TableCell>
                          <TableCell>
                            <div className="space-y-0.5 text-xs">
                              {typeof pitch.pitchMm === 'number' ? <div>{formatMm(pitch.pitchMm)} mm</div> : null}
                              {typeof pitch.pitchIn === 'number' ? <div>{formatInches(pitch.pitchIn)} in</div> : null}
                              {typeof pitch.tpi === 'number' ? <div className="text-muted-foreground">{pitch.tpi} TPI</div> : null}
                              {!pitch.pitchIn && !pitch.pitchMm ? <div className="text-muted-foreground">—</div> : null}
                            </div>
                          </TableCell>
                          <TableCell>{tap.count}</TableCell>
                          <TableCell>{tap.classOrFit ?? '—'}</TableCell>
                          <TableCell>{tap.calloutNotes ?? '—'}</TableCell>
                          <TableCell>
                            {tap.recommendedTapDrill
                              ? `${tap.recommendedTapDrill.drill}${
                                  typeof tap.recommendedTapDrill.diameter === 'number'
                                    ? ` (${formatPrimary(tap.recommendedTapDrill.diameter)})`
                                    : ''
                                }${tap.recommendedTapDrill.basis ? ` — ${tap.recommendedTapDrill.basis}` : ''}`
                              : '—'}
                          </TableCell>
                          <TableCell>{formatInches(tap.confidence * 100)}%</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow className="border-border/60">
                      <TableCell colSpan={7} className="text-sm text-muted-foreground">
                        No tapped-hole data detected.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Setup / flips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                Estimated setups: <span className="font-medium text-foreground">{result.setup.estimatedSetups}</span>
              </p>
              <p>
                Estimated flips: <span className="font-medium text-foreground">{result.setup.estimatedFlips}</span>
              </p>
              <p>
                Assumed machine: <span className="font-medium text-foreground">{result.setup.assumedMachine}</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              {result.warnings.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                  {result.warnings.map((warning, idx) => (
                    <li key={`${warning}-${idx}`}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No warnings.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <details>
                <summary className="cursor-pointer text-sm font-medium text-foreground">Raw JSON</summary>
                <pre className="mt-2 overflow-auto rounded-md border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
