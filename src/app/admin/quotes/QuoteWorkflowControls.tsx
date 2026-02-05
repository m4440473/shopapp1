"use client";
import { fetchJson } from '@/lib/fetchJson';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/Toast';
import type { QuoteApprovalMetadata, QuoteConversionMetadata, QuoteMetadata } from '@/lib/quote-metadata';
import type { BusinessName } from '@/lib/businesses';

interface QuoteWorkflowControlsProps {
  quoteId: string;
  quoteNumber: string;
  businessName: BusinessName;
  companyName: string;
  customerName: string;
  customerId?: string | null;
  approval: QuoteApprovalMetadata;
  conversion: QuoteConversionMetadata;
  layout?: 'detail' | 'table';
  onMetadataUpdate?: (metadata: QuoteMetadata) => void;
  onConverted?: (args: { orderId: string; orderNumber: string; metadata: QuoteMetadata }) => void;
}

const CHECKBOX_LABEL = 'PO / Approval received';

export default function QuoteWorkflowControls({
  quoteId,
  quoteNumber,
  businessName,
  companyName,
  customerName,
  customerId,
  approval,
  conversion,
  layout = 'detail',
  onMetadataUpdate,
  onConverted,
}: QuoteWorkflowControlsProps) {
  const router = useRouter();
  const toast = useToast();

  const [approvalState, setApprovalState] = React.useState<QuoteApprovalMetadata>(approval);
  const [conversionState, setConversionState] = React.useState<QuoteConversionMetadata>(conversion);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [savingApproval, setSavingApproval] = React.useState(false);
  const [converting, setConverting] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    setApprovalState(approval);
  }, [approval]);

  React.useEffect(() => {
    setConversionState(conversion);
  }, [conversion]);

  const attachmentHref = React.useMemo(() => {
    if (approvalState?.attachmentUrl) {
      return approvalState.attachmentUrl;
    }
    if (approvalState?.attachmentStoragePath) {
      return `/attachments/${approvalState.attachmentStoragePath}`;
    }
    return null;
  }, [approvalState]);

  const readyForConversion =
    Boolean(approvalState?.received) && Boolean(customerId) && !conversionState?.orderId;

  const alreadyConverted = Boolean(conversionState?.orderId);

  function closeDialog() {
    setDialogOpen(false);
    setSelectedFile(null);
    setUploadError(null);
  }

  async function markApproval(received: boolean, attachment?: any) {
    setSavingApproval(true);
    try {
      const response = await fetchJson<{ approval: QuoteApprovalMetadata; metadata: QuoteMetadata }>(
        `/api/admin/quotes/${quoteId}/approval`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ received, attachment }),
        },
      );

      setApprovalState(response.approval);
      onMetadataUpdate?.(response.metadata);
      if (layout === 'detail') {
        router.refresh();
      }
      toast.push(received ? 'Approval file captured.' : 'Approval status updated.', 'success');
    } catch (error: any) {
      const message = error?.body?.error || error.message || 'Failed to update approval status';
      toast.push(message, 'error');
    } finally {
      setSavingApproval(false);
    }
  }

  async function handleApprovalToggle(next: boolean | 'indeterminate') {
    const checked = Boolean(next);
    if (checked) {
      setDialogOpen(true);
      return;
    }

    if (approvalState?.received) {
      await markApproval(false);
    }
  }

  async function handleUploadSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setUploadError('Select an approval or PO file to continue.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('business', businessName);
      formData.append('customerName', customerName || companyName);
      formData.append('quoteNumber', quoteNumber);

      const uploadResponse = await fetch(`/api/admin/quotes/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const body = await uploadResponse.json().catch(() => ({}));
        const message = body?.error || 'Failed to upload approval file';
        throw new Error(message);
      }

      const uploaded = await uploadResponse.json();
      await markApproval(true, uploaded);
      closeDialog();
    } catch (error: any) {
      setUploadError(error?.message || 'Failed to save approval file');
    } finally {
      setUploading(false);
    }
  }

  async function handleConvert() {
    setConverting(true);
    try {
      router.push(`/orders/new?quoteId=${quoteId}`);
    } catch (error: any) {
      const message = error?.body?.error || error.message || 'Conversion setup failed';
      toast.push(message, 'error');
    } finally {
      setConverting(false);
    }
  }

  const approvalControls = (
    <div className="flex items-center gap-2">
      <Checkbox
        id={`approval-toggle-${quoteId}`}
        checked={Boolean(approvalState?.received)}
        onCheckedChange={handleApprovalToggle}
        disabled={savingApproval || converting}
      />
      <Label
        htmlFor={`approval-toggle-${quoteId}`}
        className={layout === 'table' ? 'text-xs font-medium' : 'text-sm font-medium'}
      >
        {CHECKBOX_LABEL}
      </Label>
      {approvalState?.received && attachmentHref && (
        <Button asChild variant="link" size={layout === 'table' ? 'sm' : 'default'} className="px-0">
          <Link href={attachmentHref} target="_blank" rel="noopener noreferrer">
            View file
          </Link>
        </Button>
      )}
    </div>
  );

  return (
    <div className={layout === 'table' ? 'flex flex-col gap-2 text-xs' : 'space-y-3'}>
      {approvalControls}

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Upload approval or PO</DialogTitle>
              <DialogDescription>
                Attach the signed approval or purchase order to mark this quote ready for conversion.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor={`approval-file-${quoteId}`} className="text-sm">
                Approval file
              </Label>
              <Input
                id={`approval-file-${quoteId}`}
                type="file"
                required
                onChange={(event) => {
                  setUploadError(null);
                  setSelectedFile(event.target.files?.[0] ?? null);
                }}
              />
            </div>
            {uploadError && (
              <p className="text-sm text-destructive">{uploadError}</p>
            )}
            <DialogFooter className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={uploading}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? 'Uploading…' : 'Save approval'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className={layout === 'table' ? 'flex flex-col gap-2' : 'flex flex-col gap-2'}>
        {alreadyConverted ? (
          <p className={layout === 'table' ? 'text-xs text-muted-foreground' : 'text-sm text-muted-foreground'}>
            Converted to{' '}
            <Link href={`/orders/${conversionState.orderId}`} className="text-primary underline">
              {conversionState.orderNumber ?? 'View order'}
            </Link>
            .
          </p>
        ) : (
          <Button
            onClick={handleConvert}
            disabled={!readyForConversion || savingApproval || converting}
            variant={layout === 'table' ? 'outline' : 'default'}
            size={layout === 'table' ? 'sm' : 'default'}
            title={
              readyForConversion
                ? 'Convert this quote into a work order'
                : !approvalState?.received
                ? 'Upload approval before converting'
                : 'Link this quote to a customer before converting'
            }
          >
            {converting ? 'Converting…' : 'Convert to order'}
          </Button>
        )}
        {!alreadyConverted && !approvalState?.received && (
          <p className={layout === 'table' ? 'text-[11px] text-muted-foreground' : 'text-xs text-muted-foreground'}>
            Upload a PO or approval to enable conversion.
          </p>
        )}
        {!alreadyConverted && approvalState?.received && !customerId && (
          <p className={layout === 'table' ? 'text-[11px] text-destructive' : 'text-xs text-destructive'}>
            Assign a customer record before converting.
          </p>
        )}
      </div>
    </div>
  );
}
