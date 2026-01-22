import NavTabs from '@/components/Admin/NavTabs';
import { normalizeTemplateLayout } from '@/lib/document-template-layout';
import { prisma } from '@/lib/prisma';
import TemplatesClient from './TemplatesClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const templates = await prisma.documentTemplate.findMany({
    orderBy: [{ updatedAt: 'desc' }],
    take: 30,
  });

  const normalized = templates.map((template) => ({
    ...template,
    layoutJson: normalizeTemplateLayout(template.layoutJson),
  }));

  return (
    <div className="p-4 text-neutral-100">
      <NavTabs />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Document Templates</h1>
          <p className="text-sm text-muted-foreground">
            Manage quote, invoice, and order print layouts per business. Update the layout sections
            and preview the render order.
          </p>
        </div>
      </div>
      <TemplatesClient initialTemplates={normalized} />
    </div>
  );
}
