'use client';

import { useCallback, type ChangeEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type TemplateOption = {
  id: string;
  name: string;
  description?: string | null;
};

type PrintControlsProps = {
  templates: TemplateOption[];
  selectedTemplateId?: string | null;
  templateLabel?: string;
};

export function PrintControls({ templates, selectedTemplateId, templateLabel = 'Template' }: PrintControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleTemplateChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextTemplateId = event.target.value;
      const params = new URLSearchParams(searchParams);
      if (nextTemplateId) {
        params.set('templateId', nextTemplateId);
      } else {
        params.delete('templateId');
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const selectedValue = selectedTemplateId ?? '';

  return (
    <div className="mb-6 flex flex-col gap-4 rounded border border-black bg-zinc-100 p-4 text-sm text-black print:hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl">
          This customer view hides internal vendor pricing. Choose a template to preview the layout before printing or saving as
          PDF.
        </p>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white hover:bg-zinc-800"
        >
          Print
        </button>
      </div>
      {templates.length > 0 && (
        <label className="flex flex-col gap-2 text-sm font-semibold text-black sm:max-w-sm">
          <span>{templateLabel}</span>
          <select
            value={selectedValue}
            onChange={handleTemplateChange}
            className="rounded border border-black bg-white px-3 py-2 text-sm font-normal"
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
                {template.description ? ` — ${template.description}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
