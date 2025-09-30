'use client';

import { useCallback } from 'react';

export function PrintControls() {
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="mb-6 flex flex-col gap-3 rounded border border-black bg-zinc-100 p-4 text-sm text-black print:hidden sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-xl">
        This customer view hides internal vendor pricing. Use the button to open the browser&apos;s print dialog or save as PDF.
      </p>
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white hover:bg-zinc-800"
      >
        Print this quote
      </button>
    </div>
  );
}
