import NavTabs from '@/components/Admin/NavTabs';
import { prisma } from '@/lib/prisma';

const REQUIRED_SECTIONS = [
  'Header',
  'Customer Info',
  'Total Price',
  'Part Name',
  'Part Info',
  'Line Items',
  'Addons/Labor',
  'Shipping',
];

export const dynamic = 'force-dynamic';

export default async function Page() {
  const templates = await prisma.documentTemplate.findMany({
    orderBy: [{ updatedAt: 'desc' }],
    take: 30,
  });

  return (
    <div className="p-4 text-neutral-100">
      <NavTabs />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Document Templates</h1>
          <p className="text-sm text-muted-foreground">
            Manage quote, invoice, and order print layouts per business. Drag-and-drop ordering and
            live preview are stubbed below.
          </p>
        </div>
        <button
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground opacity-60"
          disabled
        >
          New template (coming soon)
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-lg border border-muted bg-muted/20 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Template Library
          </h2>
          <div className="mt-4 space-y-3">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates configured yet.</p>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-muted bg-background/60 p-3"
                >
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.documentType} ·{' '}
                      {template.businessCode ? `Business ${template.businessCode}` : 'All businesses'}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    v{template.currentVersion} · {template.isDefault ? 'Default' : 'Custom'} ·{' '}
                    {template.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-dashed border-muted bg-background/40 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Drag &amp; Drop Layout (Placeholder)
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Arrange required document sections in the desired order.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {REQUIRED_SECTIONS.map((section) => (
                <li key={section} className="rounded-md border border-muted bg-muted/20 px-3 py-2">
                  {section}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-dashed border-muted bg-background/40 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Live Preview (Placeholder)
            </h2>
            <div className="mt-3 rounded-md border border-muted bg-muted/20 p-4 text-xs text-muted-foreground">
              A live preview of the selected template will render here once section configuration
              and drag-and-drop editing are wired up.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
