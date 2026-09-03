'use client';

import { CustomFieldInputs, type CustomFieldDefinition } from '@/components/CustomFieldInputs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

type QuoteCustomIntakeFieldsCardProps = {
  fields: CustomFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
};

export function QuoteCustomIntakeFieldsCard({ fields, values, onChange }: QuoteCustomIntakeFieldsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom intake fields</CardTitle>
        <CardDescription>Additional fields configured for this business.</CardDescription>
      </CardHeader>
      <CardContent>
        <CustomFieldInputs fields={fields} values={values} onChange={onChange} />
      </CardContent>
    </Card>
  );
}
