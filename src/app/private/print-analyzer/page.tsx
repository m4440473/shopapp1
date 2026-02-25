'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

import styles from './PrintAnalyzer.module.css';
import type { PrintAnalyzerResult } from '@/lib/printAnalyzer/schema';

type AnalyzeResponse = PrintAnalyzerResult | AnalyzeError;


type AnalyzeError = { error: string; detail?: string; rawModelText?: string };

function isAnalyzeError(payload: AnalyzeResponse): payload is AnalyzeError {
  return typeof (payload as AnalyzeError).error === 'string';
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

function renderTolerance(value?: { plus?: number; minus?: number; fit?: string; note?: string }) {
  if (!value) return '—';
  const parts: string[] = [];
  if (typeof value.plus === 'number') parts.push(`+${value.plus}`);
  if (typeof value.minus === 'number') parts.push(`${value.minus}`);
  if (value.fit) parts.push(`fit ${value.fit}`);
  if (value.note) parts.push(value.note);
  return parts.length ? parts.join(', ') : '—';
}

export default function PrintAnalyzerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [result, setResult] = useState<PrintAnalyzerResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const canAnalyze = Boolean(file) && !loading;
  const buttonLabel = loading ? 'Analyzing…' : 'Analyze';

  const unitsLabel = useMemo(() => result?.units ?? 'unknown', [result]);

  async function onAnalyze() {
    if (!file) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const dataUrl = await fileToDataUrl(file);
      const response = await fetch('/api/print-analyzer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });

      const payload = (await response.json().catch(() => ({ error: 'Non-JSON response from API.' }))) as AnalyzeResponse;
      if (!response.ok || isAnalyzeError(payload)) {
        const detail = isAnalyzeError(payload) && payload.detail ? ` (${payload.detail})` : '';
        const errorMessage = isAnalyzeError(payload) ? payload.error : 'Unexpected API response.';
        setError(`${errorMessage}${detail}`);
        return;
      }

      setResult(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to analyze image: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.card}>
          <h1 className={styles.heading}>Print Analyzer (Private)</h1>
          <p className={styles.subtle}>Upload a print image and extract feature/tolerance data into structured JSON.</p>

          <div className={styles.row}>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const picked = event.currentTarget.files?.[0] ?? null;
                setFile(picked);
                setResult(null);
                setError('');
                setPreviewUrl(picked ? URL.createObjectURL(picked) : '');
              }}
            />
            <button className={styles.button} onClick={onAnalyze} disabled={!canAnalyze}>
              {buttonLabel}
            </button>
          </div>

          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Uploaded print preview"
              className={styles.preview}
              width={900}
              height={600}
              unoptimized
            />
          ) : null}

          {error ? <p className={styles.error}>{error}</p> : null}
        </section>

        {result ? (
          <>
            <section className={styles.card}>
              <strong>Units detected:</strong> <span className={styles.badge}>{unitsLabel}</span>
            </section>

            <section className={styles.card}>
              <h2>General tolerances</h2>
              {result.generalTolerances.length ? (
                <ul className={styles.list}>
                  {result.generalTolerances.map((item, index) => (
                    <li key={`${item.note}-${index}`}>
                      {item.note} (confidence: {item.confidence.toFixed(2)})
                    </li>
                  ))}
                </ul>
              ) : (
                <p>None detected.</p>
              )}
            </section>

            <section className={styles.card}>
              <h2>Holes</h2>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Diameter</th>
                    <th>Count</th>
                    <th>Notes</th>
                    <th>Tolerance</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {result.holes.length ? (
                    result.holes.map((hole, index) => (
                      <tr key={`${hole.diameter}-${index}`}>
                        <td>{hole.diameter}</td>
                        <td>{hole.count}</td>
                        <td>{hole.notes ?? '—'}</td>
                        <td>{renderTolerance(hole.tolerance)}</td>
                        <td>{hole.confidence.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>No hole data detected.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className={styles.card}>
              <h2>Radii</h2>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Radius</th>
                    <th>Count</th>
                    <th>Notes</th>
                    <th>Tolerance</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {result.radii.length ? (
                    result.radii.map((radius, index) => (
                      <tr key={`${radius.radius}-${index}`}>
                        <td>{radius.radius}</td>
                        <td>{radius.count}</td>
                        <td>{radius.notes ?? '—'}</td>
                        <td>{renderTolerance(radius.tolerance)}</td>
                        <td>{radius.confidence.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>No radius data detected.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className={styles.card}>
              <h2>Tapped holes</h2>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Thread</th>
                    <th>Count</th>
                    <th>Class/Fit</th>
                    <th>Notes</th>
                    <th>Recommended tap drill</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {result.tappedHoles.length ? (
                    result.tappedHoles.map((tap, index) => (
                      <tr key={`${tap.thread}-${index}`}>
                        <td>{tap.thread}</td>
                        <td>{tap.count}</td>
                        <td>{tap.classOrFit ?? '—'}</td>
                        <td>{tap.calloutNotes ?? '—'}</td>
                        <td>
                          {tap.recommendedTapDrill
                            ? `${tap.recommendedTapDrill.drill}${
                                typeof tap.recommendedTapDrill.diameter === 'number'
                                  ? ` (${tap.recommendedTapDrill.diameter})`
                                  : ''
                              }${tap.recommendedTapDrill.basis ? ` — ${tap.recommendedTapDrill.basis}` : ''}`
                            : '—'}
                        </td>
                        <td>{tap.confidence.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>No tapped hole data detected.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className={styles.card}>
              <h2>Warnings</h2>
              {result.warnings.length ? (
                <ul className={styles.list}>
                  {result.warnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p>No warnings.</p>
              )}
            </section>

            <section className={styles.card}>
              <details>
                <summary>Raw JSON</summary>
                <pre className={styles.rawJson}>{JSON.stringify(result, null, 2)}</pre>
              </details>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
