'use client';

import { CustomFieldInputs, type CustomFieldDefinition } from '@/components/CustomFieldInputs';
import {
  AddCustomerContactDialog,
  type CustomerWithContacts,
} from '@/components/customers/AddCustomerContactDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BUSINESS_OPTIONS, type BusinessCode } from '@/lib/businesses';
import type { IntakeCustomerOption } from '@/modules/order-intake/order-intake.client';
import { resolveRepeatOrderCustomer } from '@/modules/repeat-orders/repeat-order-customer';
import { NewOrderCustomerDialog, type NewOrderCustomerInput } from './NewOrderCustomerDialog';

const OPTIONAL_VALUE = '__none__';
const PRIORITIES = ['LOW', 'NORMAL', 'RUSH', 'HOT'];

type NamedOption = { id: string; name: string };

export type NewOrderHeaderDraft = {
  business: BusinessCode;
  customerId: string;
  customerContactId: string;
  dueDate: string;
  priority: string;
  assignedMachinistId: string;
  assignedWorkerIds: string[];
  poNumber: string;
};

export type NewOrderSourcingDraft = {
  vendorId: string;
  materialNeeded: boolean;
  materialOrdered: boolean;
  modelIncluded: boolean;
};

type Props = {
  header: NewOrderHeaderDraft;
  sourcing: NewOrderSourcingDraft;
  customers: IntakeCustomerOption[];
  machinists: NamedOption[];
  vendors: NamedOption[];
  customFields: CustomFieldDefinition[];
  customFieldValues: Record<string, unknown>;
  templateMode: boolean;
  conversionMode: boolean;
  templateCustomer?: { id: string; name?: string | null } | null;
  customerDialogOpen: boolean;
  onCustomerDialogOpenChange: (open: boolean) => void;
  onCreateCustomer: (input: NewOrderCustomerInput) => Promise<boolean>;
  onHeaderChange: (patch: Partial<NewOrderHeaderDraft>) => void;
  onSourcingChange: (patch: Partial<NewOrderSourcingDraft>) => void;
  onCustomFieldChange: (fieldId: string, value: unknown) => void;
  onCustomerUpdated: (customer: CustomerWithContacts, newContactId: string) => void;
};

export function NewOrderInfoCards({
  header,
  sourcing,
  customers,
  machinists,
  vendors,
  customFields,
  customFieldValues,
  templateMode,
  conversionMode,
  templateCustomer,
  customerDialogOpen,
  onCustomerDialogOpenChange,
  onCreateCustomer,
  onHeaderChange,
  onSourcingChange,
  onCustomFieldChange,
  onCustomerUpdated,
}: Props) {
  const selectedCustomer = customers.find((customer) => customer.id === header.customerId);
  const resolvedCustomerId = resolveRepeatOrderCustomer(header.customerId, templateCustomer?.id);

  return (
    <>
      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader>
          <CardTitle>Customer & schedule</CardTitle>
          <CardDescription>Who is the work for and when do they need it?</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="business">Business</Label>
            <Select
              value={header.business}
              disabled={conversionMode || templateMode}
              onValueChange={(business) => onHeaderChange({ business: business as BusinessCode })}
            >
              <SelectTrigger id="business" className="border-border/60 bg-background/80">
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
            <Label htmlFor="customer">Customer</Label>
            <Select
              value={resolvedCustomerId}
              onValueChange={(customerId) => customerId && onHeaderChange({ customerId, customerContactId: '' })}
              disabled={conversionMode}
            >
              <SelectTrigger id="customer" className="border-border/60 bg-background/80">
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                {templateCustomer && !customers.some((customer) => customer.id === templateCustomer.id) ? (
                  <SelectItem value={templateCustomer.id}>{templateCustomer.name || 'Template customer'}</SelectItem>
                ) : null}
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <NewOrderCustomerDialog
              open={customerDialogOpen}
              disabled={conversionMode}
              onOpenChange={onCustomerDialogOpenChange}
              onCreate={onCreateCustomer}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dueDate">Due date</Label>
            <Input id="dueDate" type="date" value={header.dueDate} onChange={(event) => onHeaderChange({ dueDate: event.target.value })} required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={header.priority} onValueChange={(priority) => onHeaderChange({ priority })}>
              <SelectTrigger id="priority" className="border-border/60 bg-background/80"><SelectValue placeholder="Select priority" /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="machinist">Coordinator (optional)</Label>
            <Select value={header.assignedMachinistId || OPTIONAL_VALUE} onValueChange={(value) => onHeaderChange({ assignedMachinistId: value === OPTIONAL_VALUE ? '' : value })}>
              <SelectTrigger id="machinist" className="border-border/60 bg-background/80"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={OPTIONAL_VALUE}>No coordinator</SelectItem>
                {machinists.map((machinist) => <SelectItem key={machinist.id} value={machinist.id}>{machinist.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="customerContact">Customer contact</Label>
            <Select
              value={header.customerContactId || OPTIONAL_VALUE}
              onValueChange={(value) => onHeaderChange({ customerContactId: value === OPTIONAL_VALUE ? '' : value })}
              disabled={!header.customerId || conversionMode || templateMode}
            >
              <SelectTrigger id="customerContact" className="border-border/60 bg-background/80"><SelectValue placeholder="Select the contact for this order" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={OPTIONAL_VALUE}>No contact selected</SelectItem>
                {(selectedCustomer?.contacts ?? []).map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.name}{contact.title ? ` — ${contact.title}` : ''}{contact.isPrimary ? ' (Primary)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">The selected contact is saved with this order and printed on its traveler.</p>
            {selectedCustomer ? <AddCustomerContactDialog customer={selectedCustomer} onSaved={onCustomerUpdated} /> : null}
          </div>

          {!templateMode ? (
            <div className="grid gap-2 md:col-span-2">
              <Label>Assigned workers (optional)</Label>
              <p className="text-xs text-muted-foreground">Select everyone starting on this job. They will be assigned to every part and can be adjusted per part later.</p>
              <div className="grid gap-2 rounded-lg border border-border/60 bg-background/60 p-3 sm:grid-cols-2">
                {machinists.length ? machinists.map((machinist) => {
                  const checked = header.assignedWorkerIds.includes(machinist.id);
                  return (
                    <label key={machinist.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => onHeaderChange({
                          assignedWorkerIds: value === true
                            ? Array.from(new Set([...header.assignedWorkerIds, machinist.id]))
                            : header.assignedWorkerIds.filter((id) => id !== machinist.id),
                        })}
                      />
                      <span className="text-sm text-foreground">{machinist.name}</span>
                    </label>
                  );
                }) : <p className="text-sm text-muted-foreground">No active employees are available.</p>}
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="poNumber">PO number</Label>
            <Input id="poNumber" value={header.poNumber} onChange={(event) => onHeaderChange({ poNumber: event.target.value })} placeholder="Optional purchase order" />
          </div>
        </CardContent>
      </Card>

      {!templateMode ? (
        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader><CardTitle>Custom intake fields</CardTitle><CardDescription>Additional fields configured for this business.</CardDescription></CardHeader>
          <CardContent><CustomFieldInputs fields={customFields} values={customFieldValues} onChange={onCustomFieldChange} /></CardContent>
        </Card>
      ) : null}

      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader><CardTitle>Vendors & materials</CardTitle><CardDescription>Capture sourcing and prep requirements.</CardDescription></CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="vendor">Vendor</Label>
            <Select value={sourcing.vendorId || OPTIONAL_VALUE} onValueChange={(value) => onSourcingChange({ vendorId: value === OPTIONAL_VALUE ? '' : value })}>
              <SelectTrigger id="vendor" className="border-border/60 bg-background/80"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={OPTIONAL_VALUE}>No vendor</SelectItem>
                {vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3 rounded-lg border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
            <label className="flex items-center gap-3 text-sm text-foreground"><Checkbox checked={sourcing.materialNeeded} onCheckedChange={(value) => onSourcingChange({ materialNeeded: value === true })} />Material needed from purchasing</label>
            <label className="flex items-center gap-3 text-sm text-foreground"><Checkbox checked={sourcing.materialOrdered} onCheckedChange={(value) => onSourcingChange({ materialOrdered: value === true })} />Material ordered / on hand</label>
            <p className="pl-7 text-xs text-muted-foreground">Select this whenever material is already available, even when no purchasing is required.</p>
            <label className="flex items-center gap-3 text-sm text-foreground"><Checkbox checked={sourcing.modelIncluded} onCheckedChange={(value) => onSourcingChange({ modelIncluded: value === true })} />CAD model provided with job</label>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
