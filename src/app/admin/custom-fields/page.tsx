import NavTabs from '@/components/Admin/NavTabs';
import { prisma } from '@/lib/prisma';
import { parseCustomFieldValue } from '@/lib/custom-field-values';
import CustomFieldsClient from './CustomFieldsClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const fields = await prisma.customField.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { options: true },
    take: 50,
  });

  const normalized = fields.map((field) => ({
    ...field,
    defaultValue: parseCustomFieldValue(field.defaultValue),
  }));

  return (
    <div className="p-4 text-neutral-100">
      <NavTabs />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Custom Fields</h1>
          <p className="text-sm text-muted-foreground">
            Configure per-business fields for orders and quotes. Update required fields, ordering,
            and select options in the builder.
          </p>
        </div>
      </div>
      <CustomFieldsClient initialFields={normalized} />
    </div>
  );
}
