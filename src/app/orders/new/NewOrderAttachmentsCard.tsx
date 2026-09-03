'use client';

import { PlusCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BUSINESS_OPTIONS, type BusinessName } from '@/lib/businesses';

type StoredAttachment = {
  id?: string | null;
  kind: string;
  label?: string | null;
  storagePath?: string | null;
  url?: string | null;
};

type AttachmentDraft = {
  url: string;
  storagePath: string;
  label: string;
  mimeType: string;
  uploading?: boolean;
};

export function NewOrderAttachmentsCard({
  mode,
  templateOrderAttachments,
  templatePartAttachmentEntries,
  attachments,
  attachmentBusiness,
  attachmentPathPreview,
  onAttachmentBusinessChange,
  onAdd,
  onRemove,
  onUpdate,
  onUrlChange,
  onFile,
}: {
  mode: 'template' | 'conversion' | 'direct';
  templateOrderAttachments: StoredAttachment[];
  templatePartAttachmentEntries: Array<{ key: string; partLabel: string; attachment: StoredAttachment }>;
  attachments: AttachmentDraft[];
  attachmentBusiness: BusinessName;
  attachmentPathPreview: string;
  onAttachmentBusinessChange: (business: BusinessName) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<AttachmentDraft>) => void;
  onUrlChange: (index: number, value: string) => void;
  onFile: (index: number, files: FileList | null) => void;
}) {
  if (mode === 'template') {
    return (
      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader><CardTitle>Template files</CardTitle><CardDescription>Saved order files and part files will copy into the new order automatically.</CardDescription></CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Order-level files</p>
            {templateOrderAttachments.length ? templateOrderAttachments.map((attachment, index) => {
              const href = attachment.storagePath ? `/attachments/${attachment.storagePath}` : attachment.url;
              return (
                <div key={attachment.id ?? `${attachment.label}-${index}`} className="rounded-xl border border-border/60 bg-background/60 p-4 text-sm">
                  <div className="font-medium text-foreground">{attachment.label || 'Template attachment'}</div>
                  <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{attachment.kind}</div>
                  {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex font-medium text-primary hover:underline">Open file</a> : null}
                </div>
              );
            }) : <p className="text-sm text-muted-foreground">No order-level files saved on this template.</p>}
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Part files</p>
            {templatePartAttachmentEntries.length ? templatePartAttachmentEntries.map((entry) => {
              const href = entry.attachment.storagePath ? `/attachments/${entry.attachment.storagePath}` : entry.attachment.url;
              return (
                <div key={entry.key} className="rounded-xl border border-border/60 bg-background/60 p-4 text-sm">
                  <div className="font-medium text-foreground">{entry.attachment.label || 'Template attachment'}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{entry.partLabel} · {entry.attachment.kind}</div>
                  {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex font-medium text-primary hover:underline">Open file</a> : null}
                </div>
              );
            }) : <p className="text-sm text-muted-foreground">No part files saved on this template.</p>}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === 'conversion') {
    return (
      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader><CardTitle>Attachments</CardTitle><CardDescription>Existing quote attachments will copy to the order automatically.</CardDescription></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Uploads from this screen are disabled while converting a quote. Add attachments to the quote first to have them copied into the order folder.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div><CardTitle>Attachments</CardTitle><CardDescription>Link drawings, STEP files, or upload lightweight references.</CardDescription></div>
        <div className="flex flex-col gap-3 md:items-end">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <Label className="text-xs uppercase tracking-[0.3em] text-muted-foreground md:text-right">Storage business</Label>
            <Select value={attachmentBusiness} onValueChange={(value) => onAttachmentBusinessChange(value as BusinessName)}>
              <SelectTrigger className="w-[220px] border-border/60 bg-background/80"><SelectValue placeholder="Select a business" /></SelectTrigger>
              <SelectContent>{BUSINESS_OPTIONS.map((option) => <SelectItem key={option.slug} value={option.name}>{option.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground md:text-right">Files upload to{' '}<code className="rounded bg-muted px-1 py-0.5 text-[11px]">{attachmentPathPreview}</code></p>
          <Button type="button" variant="secondary" className="rounded-full border border-primary/40 bg-primary/10 text-primary" onClick={onAdd}><PlusCircle className="mr-2 h-4 w-4" /> Add attachment</Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {attachments.map((attachment, index) => (
          <div key={index} className="rounded-xl border border-border/60 bg-background/60 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Attachment {index + 1}</h3>
              {attachments.length > 1 ? <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(index)}>Remove</Button> : null}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="grid gap-2"><Label>Label</Label><Input value={attachment.label} onChange={(event) => onUpdate(index, { label: event.target.value })} placeholder="e.g. REV B STEP" /></div>
              <div className="grid gap-2"><Label>Mime type</Label><Input value={attachment.mimeType} onChange={(event) => onUpdate(index, { mimeType: event.target.value })} placeholder="application/step" /></div>
              <div className="grid gap-2 md:col-span-2"><Label>External link</Label><Input value={attachment.url} onChange={(event) => onUrlChange(index, event.target.value)} placeholder="Paste Google Drive or SharePoint link" disabled={attachment.uploading} /></div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Upload file</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <Input type="file" className="bg-background/80" onChange={(event) => onFile(index, event.target.files)} disabled={attachment.uploading} />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Upload className="h-4 w-4 text-muted-foreground" />{attachment.uploading ? 'Uploading…' : 'Drop a file to upload'}</div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Uploads are written to the shared storage above for easy access on the shop floor.</p>
                  {attachment.storagePath ? (
                    <p className="flex flex-wrap items-center gap-1">Stored file:<code className="rounded bg-muted px-1 py-0.5 text-[11px]">{attachment.storagePath}</code><a href={`/api/orders/drawing-import/preview?path=${encodeURIComponent(attachment.storagePath)}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">Open stored copy</a></p>
                  ) : <p>Add a file to copy it into shared storage.</p>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
