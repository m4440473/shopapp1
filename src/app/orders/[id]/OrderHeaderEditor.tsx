'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BUSINESS_OPTIONS } from '@/lib/businesses';

export type OrderHeaderDraft = { business: string; customerId: string; customerContactId: string; receivedDate: string; dueDate: string; vendorId: string; poNumber: string; assignedMachinistId: string; materialNeeded: boolean; materialOrdered: boolean; modelIncluded: boolean };
type NamedOption = { id: string; name: string };
type CustomerOption = NamedOption & { contacts: NamedOption[] };
type Props = { draft: OrderHeaderDraft; setDraft: Dispatch<SetStateAction<OrderHeaderDraft>>; customers: CustomerOption[]; vendors: NamedOption[]; machinists: NamedOption[]; saving: boolean; onSave: () => void };

export function OrderHeaderEditor({ draft, setDraft, customers, vendors, machinists, saving, onSave }: Props) {
  return <>
    <div className="flex items-center justify-between"><p className="text-sm font-semibold text-foreground">Edit order details</p><Button size="sm" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save order'}</Button></div>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="grid gap-2"><Label>Business</Label><Select value={draft.business} onValueChange={(value) => setDraft((previous) => ({ ...previous, business: value }))}><SelectTrigger><SelectValue placeholder="Select business" /></SelectTrigger><SelectContent>{BUSINESS_OPTIONS.map((business) => <SelectItem key={business.code} value={business.code}>{business.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">The order number stays unchanged so existing paperwork and links remain valid.</p></div>
      <div className="grid gap-2"><Label>Customer</Label><Select value={draft.customerId || '__none__'} onValueChange={(value) => setDraft((previous) => ({ ...previous, customerId: value === '__none__' ? '' : value, customerContactId: '' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">Select customer</SelectItem>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-2"><Label>Customer contact</Label><Select value={draft.customerContactId || '__none__'} onValueChange={(value) => setDraft((previous) => ({ ...previous, customerContactId: value === '__none__' ? '' : value }))} disabled={!draft.customerId}><SelectTrigger><SelectValue placeholder="No contact" /></SelectTrigger><SelectContent><SelectItem value="__none__">No contact</SelectItem>{(customers.find((customer) => customer.id === draft.customerId)?.contacts ?? []).map((contact) => <SelectItem key={contact.id} value={contact.id}>{contact.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-2"><Label>Vendor</Label><Select value={draft.vendorId || '__none__'} onValueChange={(value) => setDraft((previous) => ({ ...previous, vendorId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">No vendor</SelectItem>{vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-2"><Label>Received date</Label><Input type="date" value={draft.receivedDate} onChange={(event) => setDraft((previous) => ({ ...previous, receivedDate: event.target.value }))} /></div><div className="grid gap-2"><Label>Due date</Label><Input type="date" value={draft.dueDate} onChange={(event) => setDraft((previous) => ({ ...previous, dueDate: event.target.value }))} /></div>
      <div className="grid gap-2"><Label>Coordinator</Label><Select value={draft.assignedMachinistId || '__none__'} onValueChange={(value) => setDraft((previous) => ({ ...previous, assignedMachinistId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">Unassigned</SelectItem>{machinists.map((machinist) => <SelectItem key={machinist.id} value={machinist.id}>{machinist.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-2 md:col-span-2"><Label>PO Number</Label><Input value={draft.poNumber} onChange={(event) => setDraft((previous) => ({ ...previous, poNumber: event.target.value }))} /></div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={draft.materialNeeded} onCheckedChange={(checked) => setDraft((previous) => ({ ...previous, materialNeeded: checked === true }))} />Material needed</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={draft.materialOrdered} onCheckedChange={(checked) => setDraft((previous) => ({ ...previous, materialOrdered: checked === true }))} />Material ordered</label><label className="flex items-center gap-2 text-sm md:col-span-2"><Checkbox checked={draft.modelIncluded} onCheckedChange={(checked) => setDraft((previous) => ({ ...previous, modelIncluded: checked === true }))} />Model included</label>
    </div>
  </>;
}
