'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BUSINESS_OPTIONS, type BusinessName } from '@/lib/businesses';

export type QuoteAttachmentItem = {
  key: string;
  persistedId?: string;
  url: string;
  storagePath: string;
  label: string;
  mimeType: string;
  isPrintForBom: boolean;
  uploading?: boolean;
};

type QuoteAttachmentsCardProps = {
  business: BusinessName;
  pathPreview: string;
  attachments: QuoteAttachmentItem[];
  onBusinessChange: (business: BusinessName) => void;
  onChange: (key: string, patch: Partial<QuoteAttachmentItem>) => void;
  onUpload: (key: string, files: FileList | null) => Promise<void>;
  onRemove: (key: string) => void;
  onAdd: () => void;
};

export function QuoteAttachmentsCard({
  business,
  pathPreview,
  attachments,
  onBusinessChange,
  onChange,
  onUpload,
  onRemove,
  onAdd,
}: QuoteAttachmentsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attachments</CardTitle>
        <CardDescription>Upload assembly drawings or general quote files. Mark print images so BOM analyzer workflows can prioritize them after conversion.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:w-1/2">
          <Label htmlFor="quoteAttachmentBusiness">Business folder</Label>
          <Select value={business} onValueChange={(value) => onBusinessChange(value as BusinessName)}>
            <SelectTrigger id="quoteAttachmentBusiness" className="border border-border bg-background px-3 py-2 text-sm">
              <SelectValue placeholder="Select a business" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_OPTIONS.map((option) => (
                <SelectItem key={option.slug} value={option.name}>{option.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Files upload under <code className="font-mono text-xs">{pathPreview}</code> inside the storage root.
          </p>
        </div>
        {attachments.map((attachment) => {
          const storedUrl = attachment.storagePath ? `/attachments/${attachment.storagePath}` : '';
          return (
            <div key={attachment.key} className="grid gap-4 rounded border border-border/50 bg-card/40 p-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Label</Label>
                <Input value={attachment.label} onChange={(event) => onChange(attachment.key, { label: event.target.value })} placeholder="Customer print" />
              </div>
              <div className="grid gap-2">
                <Label>MIME type</Label>
                <Input value={attachment.mimeType} onChange={(event) => onChange(attachment.key, { mimeType: event.target.value })} placeholder="application/pdf" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Analyzer role</Label>
                <label className="flex items-center gap-2 rounded border border-border/50 bg-muted/20 px-3 py-2 text-sm">
                  <Checkbox checked={attachment.isPrintForBom} onCheckedChange={(checked) => onChange(attachment.key, { isPrintForBom: checked === true })} />
                  <span>Use as print image for BOM analyzer (adds <code className="font-mono">[PRINT]</code> tag).</span>
                </label>
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Link URL</Label>
                <Input value={attachment.url} onChange={(event) => onChange(attachment.key, { url: event.target.value })} placeholder="https://" />
                {attachment.storagePath ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Stored file ready to open.</span>
                    <Link href={storedUrl} className="underline" target="_blank" rel="noopener noreferrer">Open stored file</Link>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Provide an external link or upload a file below.</p>
                )}
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Upload file</Label>
                <input
                  type="file"
                  onChange={async (event) => {
                    await onUpload(attachment.key, event.target.files);
                    event.target.value = '';
                  }}
                  disabled={attachment.uploading}
                  className="block w-full text-sm text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  {attachment.uploading ? 'Uploading…' : 'Uploads replace the link above with a secure download URL.'}
                </p>
              </div>
              <div className="flex items-end justify-end md:col-span-2">
                <Button type="button" variant="ghost" onClick={() => onRemove(attachment.key)}>Remove</Button>
              </div>
            </div>
          );
        })}
        <Button type="button" variant="outline" onClick={onAdd}>Add attachment</Button>
      </CardContent>
    </Card>
  );
}
