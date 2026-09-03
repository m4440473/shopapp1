"use client";

import type { FormEvent } from 'react';
import { ClipboardList, FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/Textarea';

export const PART_ATTACHMENT_KINDS = ['DWG', 'STEP', 'PDF', 'PO', 'PRINT', 'IMAGE', 'OTHER'] as const;
export type PartAttachmentKind = (typeof PART_ATTACHMENT_KINDS)[number];

type PartNotesAndFilesPanelProps = {
  notes: any[];
  noteText: string;
  attachments: any[];
  canEdit: boolean;
  attachment: { kind: PartAttachmentKind; label: string; mimeType: string; url: string; uploading: boolean };
  attachmentSaving: boolean;
  attachmentFileKey: number;
  attachmentFileName: string;
  attachmentError: string | null;
  onNoteTextChange: (value: string) => void;
  onAddNote: () => void;
  onAttachmentChange: (patch: Partial<{ kind: PartAttachmentKind; label: string; mimeType: string; url: string }>) => void;
  onAttachmentFileChange: (files: FileList | null) => void;
  onAddAttachment: (event: FormEvent<HTMLFormElement>) => void;
};

export function PartNotesAndFilesPanel({ notes, noteText, attachments, canEdit, attachment, attachmentSaving, attachmentFileKey, attachmentFileName, attachmentError, onNoteTextChange, onAddNote, onAttachmentChange, onAttachmentFileChange, onAddAttachment }: PartNotesAndFilesPanelProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground"><ClipboardList className="h-4 w-4 text-muted-foreground" /> Notes</div>
        <div className="order-detail-tile max-h-72 space-y-3 overflow-auto rounded-lg border p-3">
          {notes.length ? notes.map((note: any) => <div key={note.id} className="space-y-1 text-sm"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{note.user?.name ?? 'Unknown'}</span><span>{new Date(note.createdAt).toLocaleString()}</span></div><p className="text-foreground">{note.content}</p></div>) : <p className="text-sm text-muted-foreground">No notes yet.</p>}
        </div>
        <div className="space-y-2"><Textarea rows={3} value={noteText} onChange={(event) => onNoteTextChange(event.target.value)} placeholder="Add a shop note or inspection comment" /><div className="flex justify-end"><Button size="sm" onClick={onAddNote}>Add note</Button></div></div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground"><FileText className="h-4 w-4 text-muted-foreground" /> Files &amp; print drawings</div>
        <div className="space-y-3">
          {attachments.length ? attachments.map((file: any) => { const href = file.storagePath ? `/attachments/${file.storagePath}` : file.url; return <div key={file.id} className="order-detail-tile rounded-lg border p-3 text-sm"><div className="font-medium text-foreground">{file.label || 'Attachment'}</div><div className="text-xs text-muted-foreground">{file.mimeType || 'Unknown type'}</div>{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">Open file</a> : null}</div>; }) : <p className="text-sm text-muted-foreground">No files yet for this part. Upload a file with type <span className="font-medium text-foreground">PRINT</span> to make it the preferred BOM analyzer source.</p>}
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground"><p className="font-medium text-foreground">Print image slot for BOM analyzer</p><p className="mt-1">Set file type to <span className="font-medium text-foreground">PRINT</span> for drawings/photos you want the BOM tab to auto-prioritize.</p></div>
        <Separator />
        {canEdit ? <form className="space-y-3" onSubmit={onAddAttachment}>
          <div className="grid gap-2"><Label htmlFor="attachment-kind">File type</Label><Select value={attachment.kind} onValueChange={(value) => onAttachmentChange({ kind: value as PartAttachmentKind })}><SelectTrigger id="attachment-kind" className="border-border/60 bg-background/80 text-left"><SelectValue /></SelectTrigger><SelectContent>{PART_ATTACHMENT_KINDS.map((kind) => <SelectItem key={kind} value={kind}>{kind}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-2"><Label htmlFor="attachment-label">Label</Label><Input id="attachment-label" value={attachment.label} onChange={(event) => onAttachmentChange({ label: event.target.value })} /></div>
          <div className="grid gap-2"><Label htmlFor="attachment-mime">Mime type</Label><Input id="attachment-mime" value={attachment.mimeType} onChange={(event) => onAttachmentChange({ mimeType: event.target.value })} /></div>
          <div className="grid gap-2"><Label htmlFor="attachment-url">External link</Label><Input id="attachment-url" value={attachment.url} onChange={(event) => onAttachmentChange({ url: event.target.value })} placeholder="Paste a shared link" disabled={attachment.uploading} /></div>
          <div className="grid gap-2"><Label htmlFor="attachment-file">Upload file</Label><Input key={attachmentFileKey} id="attachment-file" type="file" className="bg-background/80" onChange={(event) => onAttachmentFileChange(event.target.files)} disabled={attachment.uploading} /><p className="text-xs text-muted-foreground">{attachment.uploading ? 'Uploading…' : attachmentFileName ? `Selected: ${attachmentFileName}` : 'Drop a file to upload.'}</p></div>
          {attachmentError ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{attachmentError}</div> : null}
          <div className="flex justify-end"><Button size="sm" type="submit" disabled={attachmentSaving || attachment.uploading}>{attachmentSaving ? 'Attaching…' : 'Add file'}</Button></div>
        </form> : <div className="order-detail-tile rounded-lg border px-3 py-2 text-xs text-slate-300">Admin access required to upload files.</div>}
      </div>
    </div>
  );
}

export function FullOrderFilesPanel({ attachments }: { attachments: any[] }) {
  return (
    <div className="space-y-4">
      <div className="order-detail-tile rounded-lg border p-3 text-xs text-slate-300">
        Full Order Files is admin-only and includes order-level + part-level files for this order.
      </div>
      <div className="space-y-3">
        {attachments.length ? attachments.map((attachment: any) => {
          const href = attachment.storagePath ? `/attachments/${attachment.storagePath}` : attachment.url;
          return (
            <div key={`${attachment.source}-${attachment.id}`} className="order-detail-tile rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{attachment.label || 'Attachment'}</p>
                <Badge variant="outline">{attachment.sourceLabel}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {attachment.partNumber ? `Part: ${attachment.partNumber} · ` : null}
                {attachment.mimeType || 'Unknown type'} · {new Date(attachment.createdAt).toLocaleString()}
              </div>
              {attachment.storagePath ? <div className="mt-1 text-[11px] text-muted-foreground"><code>{attachment.storagePath}</code></div> : null}
              {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">Open file</a> : null}
            </div>
          );
        }) : <p className="text-sm text-muted-foreground">No files found on this order.</p>}
      </div>
    </div>
  );
}
