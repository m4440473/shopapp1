import NavTabs from '@/components/Admin/NavTabs';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const fields = await prisma.customField.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { options: true },
    take: 50,
  });

  return (
    <div className="p-4 text-neutral-100">
      <NavTabs />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Custom Fields</h1>
          <p className="text-sm text-muted-foreground">
            Configure per-business fields for orders and quotes. Drag-and-drop and validation
            controls will arrive in the next phase.
          </p>
        </div>
        <button
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground opacity-60"
          disabled
        >
          Add custom field (coming soon)
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-lg border border-muted bg-muted/20 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Field Library
          </h2>
          <div className="mt-4 space-y-3">
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom fields configured yet.</p>
            ) : (
              fields.map((field) => (
                <div
                  key={field.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-muted bg-background/60 p-3"
                >
                  <div>
                    <p className="font-medium">{field.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {field.entityType} · {field.fieldType} ·{' '}
                      {field.businessCode ? `Business ${field.businessCode}` : 'All businesses'}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {field.isRequired ? 'Required' : 'Optional'} · {field.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-muted bg-background/40 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Field Builder (Placeholder)
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>• Choose a field type, label, and business scope.</li>
            <li>• Mark required fields and set default values.</li>
            <li>• Configure select options for drop-down fields.</li>
          </ul>
          <div className="mt-4 rounded-md border border-muted bg-muted/20 p-3 text-xs text-muted-foreground">
            Live validation + drag-and-drop ordering will appear here in Phase 2.
          </div>
        </div>
      </div>
    </div>
  );
}
