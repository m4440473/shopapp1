'use client';

import { AddCustomerContactDialog } from '@/components/customers/AddCustomerContactDialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { IntakeCustomerOption } from '@/modules/order-intake/order-intake.client';

type QuoteCustomerContactPickerProps = {
  customers: IntakeCustomerOption[];
  customerId: string;
  customerContactId: string;
  onSelect: (contactId: string) => void;
  onCustomerSaved: (customer: IntakeCustomerOption, newContactId: string) => void;
};

export function QuoteCustomerContactPicker({
  customers,
  customerId,
  customerContactId,
  onSelect,
  onCustomerSaved,
}: QuoteCustomerContactPickerProps) {
  const selectedCustomer = customers.find((customer) => customer.id === customerId);

  return (
    <div className="grid gap-2">
      <Label htmlFor="quoteCustomerContact">Customer contact</Label>
      <Select
        value={customerContactId || '__no_contact__'}
        onValueChange={(value) => onSelect(value === '__no_contact__' ? '' : value)}
        disabled={!customerId}
      >
        <SelectTrigger id="quoteCustomerContact" className="border border-border bg-background px-3 py-2 text-sm">
          <SelectValue placeholder="Select the contact for this quote" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__no_contact__">No contact selected</SelectItem>
          {(selectedCustomer?.contacts ?? []).map((contact) => (
            <SelectItem key={contact.id} value={contact.id}>
              {contact.name}{contact.title ? ` — ${contact.title}` : ''}{contact.isPrimary ? ' (Primary)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Choose the Toyota contact for this specific quote. The details below are saved as a historical snapshot.
      </p>
      {selectedCustomer ? (
        <AddCustomerContactDialog
          customer={selectedCustomer}
          onSaved={onCustomerSaved}
        />
      ) : null}
    </div>
  );
}

export type QuoteContactSnapshot = {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

type QuoteContactSnapshotFieldsProps = {
  value: QuoteContactSnapshot;
  onChange: (patch: Partial<QuoteContactSnapshot>) => void;
};

export function QuoteContactSnapshotFields({ value, onChange }: QuoteContactSnapshotFieldsProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="quoteContact">Contact / Engineer</Label>
        <Input
          id="quoteContact"
          value={value.contactName}
          onChange={(event) => onChange({ contactName: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="quoteEmail">Contact email</Label>
        <Input
          id="quoteEmail"
          type="email"
          value={value.contactEmail}
          onChange={(event) => onChange({ contactEmail: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="quotePhone">Contact phone</Label>
        <Input
          id="quotePhone"
          value={value.contactPhone}
          onChange={(event) => onChange({ contactPhone: event.target.value })}
        />
      </div>
    </>
  );
}
