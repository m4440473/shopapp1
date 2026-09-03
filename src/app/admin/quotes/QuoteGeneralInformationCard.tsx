'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BUSINESS_OPTIONS, type BusinessCode } from '@/lib/businesses';
import type { IntakeCustomerOption } from '@/modules/order-intake/order-intake.client';

import { NewQuoteCustomerDialog, type NewQuoteCustomerInput } from './NewQuoteCustomerDialog';
import {
  QuoteContactSnapshotFields,
  QuoteCustomerContactPicker,
  type QuoteContactSnapshot,
} from './QuoteCustomerContactFields';

export type QuoteGeneralInformationValue = QuoteContactSnapshot & {
  business: BusinessCode;
  quoteNumber: string;
  companyName: string;
  customerId: string;
  customerContactId: string;
};

type QuoteGeneralInformationCardProps = {
  value: QuoteGeneralInformationValue;
  customers: IntakeCustomerOption[];
  customerDialogOpen: boolean;
  onBusinessChange: (business: BusinessCode) => void;
  onCustomerSelect: (customerId: string) => void;
  onCustomerDialogOpenChange: (open: boolean) => void;
  onCreateCustomer: (input: NewQuoteCustomerInput) => Promise<boolean>;
  onCustomerContactSelect: (contactId: string) => void;
  onCustomerSaved: (customer: IntakeCustomerOption, newContactId: string) => void;
  onContactChange: (patch: Partial<QuoteContactSnapshot>) => void;
};

export function QuoteGeneralInformationCard({
  value,
  customers,
  customerDialogOpen,
  onBusinessChange,
  onCustomerSelect,
  onCustomerDialogOpenChange,
  onCreateCustomer,
  onCustomerContactSelect,
  onCustomerSaved,
  onContactChange,
}: QuoteGeneralInformationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>General information</CardTitle>
        <CardDescription>Who is requesting the work and how we can reach them.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="quoteBusiness">Business *</Label>
          <Select value={value.business} onValueChange={(business) => onBusinessChange(business as BusinessCode)}>
            <SelectTrigger id="quoteBusiness" className="border border-border bg-background px-3 py-2 text-sm">
              <SelectValue placeholder="Select a business" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_OPTIONS.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.prefix} — {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="quoteCompanyName">Company *</Label>
          <Select value={value.customerId} onValueChange={onCustomerSelect}>
            <SelectTrigger id="quoteCompanySelect" className="border border-border bg-background px-3 py-2 text-sm">
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
              {value.customerId && !customers.some((customer) => customer.id === value.customerId) ? (
                <SelectItem value={value.customerId}>{value.companyName || 'Saved customer'}</SelectItem>
              ) : null}
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <NewQuoteCustomerDialog
            open={customerDialogOpen}
            onOpenChange={onCustomerDialogOpenChange}
            onCreate={onCreateCustomer}
          />
          <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-sm">
            {value.customerId ? (
              <>
                <p className="font-semibold text-foreground">{value.companyName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Customer record selected. Contact details below apply only to this quote.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Choose a customer above to continue.</p>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Quote number</Label>
          <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
            {value.quoteNumber || 'Assigned automatically when this draft is saved'}
          </div>
        </div>

        <QuoteCustomerContactPicker
          customers={customers}
          customerId={value.customerId}
          customerContactId={value.customerContactId}
          onSelect={onCustomerContactSelect}
          onCustomerSaved={onCustomerSaved}
        />
        <QuoteContactSnapshotFields value={value} onChange={onContactChange} />
      </CardContent>
      <CardContent className="grid gap-4" />
    </Card>
  );
}
