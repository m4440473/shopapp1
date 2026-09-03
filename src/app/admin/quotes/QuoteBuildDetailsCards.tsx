'use client';

import { CustomFieldInputs, type CustomFieldDefinition } from '@/components/CustomFieldInputs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/Textarea';

export type QuoteAssemblyNotes = {
  materialSummary: string;
  purchaseItems: string;
  requirements: string;
  notes: string;
};

type QuoteBuildDetailsCardsProps = {
  fields: CustomFieldDefinition[];
  customFieldValues: Record<string, unknown>;
  notes: QuoteAssemblyNotes;
  onCustomFieldChange: (fieldId: string, value: unknown) => void;
  onNotesChange: (patch: Partial<QuoteAssemblyNotes>) => void;
};

export function QuoteBuildDetailsCards({
  fields,
  customFieldValues,
  notes,
  onCustomFieldChange,
  onNotesChange,
}: QuoteBuildDetailsCardsProps) {
  return (
    <>
      {fields.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Part build fields</CardTitle>
            <CardDescription>Finish requirements and other build-stage details.</CardDescription>
          </CardHeader>
          <CardContent>
            <CustomFieldInputs fields={fields} values={customFieldValues} onChange={onCustomFieldChange} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Assembly-level notes</CardTitle>
          <CardDescription>Notes and files that apply to the entire quote.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="quoteMaterials">Materials / stock summary</Label>
            <Textarea id="quoteMaterials" value={notes.materialSummary} onChange={(event) => onNotesChange({ materialSummary: event.target.value })} placeholder="Material specs, thickness, and finish requirements" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quotePurchaseItems">Purchased items (hardware, kits, etc.)</Label>
            <Textarea id="quotePurchaseItems" value={notes.purchaseItems} onChange={(event) => onNotesChange({ purchaseItems: event.target.value })} placeholder="List of hardware or kits that need to be procured" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quoteRequirements">Assembly requirements / process notes</Label>
            <p className="text-xs text-muted-foreground">
              These apply across the quote and are included in each converted part&apos;s required reading. Use the per-part Read Me First field above for part-specific instructions.
            </p>
            <Textarea id="quoteRequirements" value={notes.requirements} onChange={(event) => onNotesChange({ requirements: event.target.value })} placeholder="Welding, finishing, or inspection instructions" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quoteNotes">Internal notes</Label>
            <Textarea id="quoteNotes" value={notes.notes} onChange={(event) => onNotesChange({ notes: event.target.value })} placeholder="Internal notes for the estimating team" />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
