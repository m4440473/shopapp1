'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/Textarea';

type ChecklistOption = { id: string; name: string; description?: string | null };

export function NewOrderLaunchNotesCard({
  templateMode,
  conversionMode,
  checklistOptions,
  selectedIds,
  notes,
  onSelectedIdsChange,
  onNotesChange,
}: {
  templateMode: boolean;
  conversionMode: boolean;
  checklistOptions: ChecklistOption[];
  selectedIds: string[];
  notes: string;
  onSelectedIdsChange: (ids: string[]) => void;
  onNotesChange: (notes: string) => void;
}) {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur">
      <CardHeader>
        <CardTitle>Checklist items & notes</CardTitle>
        <CardDescription>
          {templateMode
            ? 'Charges, checklist structure, and saved notes are coming from the repeat template.'
            : conversionMode
              ? 'Checklist items will be pulled from the quote parts during conversion.'
              : 'Select checklist items that should be applied to every part.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {!conversionMode && !templateMode ? (
          <div className="grid gap-2">
            <Label>Checklist items (applied per part)</Label>
            <div className="grid gap-3 rounded-lg border border-border/60 bg-background/60 p-4 sm:grid-cols-2">
              {checklistOptions.map((item) => {
                const checked = selectedIds.includes(item.id);
                return (
                  <label key={item.id} className="flex items-start justify-between gap-3 rounded-md border border-border/40 bg-muted/10 p-3 text-sm">
                    <div className="flex items-start gap-3">
                      <Checkbox checked={checked} onCheckedChange={(value) => onSelectedIdsChange(value === true ? [...selectedIds, item.id] : selectedIds.filter((id) => id !== item.id))} />
                      <div className="space-y-1">
                        <span className="font-medium text-foreground">{item.name}</span>
                        {item.description ? <span className="block text-xs text-muted-foreground">{item.description}</span> : null}
                      </div>
                    </div>
                    <span className="text-right text-xs text-muted-foreground">Checklist only</span>
                  </label>
                );
              })}
              {checklistOptions.length === 0 ? <p className="text-sm text-muted-foreground">No checklist-only items available yet. Create them from the admin dashboard.</p> : null}
            </div>
          </div>
        ) : null}
        {templateMode ? <div className="rounded-lg border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">Template charges and checklist structure will be recreated on the new order. Use the part editor above if you need to tweak per-part notes or work instructions before launch.</div> : null}
        {conversionMode ? <div className="rounded-lg border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">Add-ons and labor will copy from the quote parts and become part-level charges and checklist items. Mission-brief instructions will seed from quote requirements plus each part&apos;s quote notes.</div> : null}
        <div className="grid gap-2">
          <Label htmlFor="notes">Launch notes</Label>
          <Textarea id="notes" value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Special instructions, fixtures, or inspection notes" className="min-h-[140px]" />
        </div>
      </CardContent>
    </Card>
  );
}
