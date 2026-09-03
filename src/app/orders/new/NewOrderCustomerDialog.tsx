'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';

export type NewOrderCustomerInput = { name: string; contact?: string; phone?: string; email?: string; addressLine1?: string; addressLine2?: string; city?: string; stateProvince?: string; postalCode?: string; country?: string };
type Props = { open: boolean; disabled: boolean; onOpenChange: (open: boolean) => void; onCreate: (input: NewOrderCustomerInput) => Promise<boolean> };

export function NewOrderCustomerDialog({ open, disabled, onOpenChange, onCreate }: Props) {
  const [draft, setDraft] = useState({ name: '', contact: '', phone: '', email: '', addressLine1: '', addressLine2: '', city: '', stateProvince: '', postalCode: '', country: 'United States' });
  const update = (key: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  async function submit() {
    if (!draft.name.trim()) return;
    const created = await onCreate({ name: draft.name, contact: draft.contact || undefined, phone: draft.phone || undefined, email: draft.email || undefined, addressLine1: draft.addressLine1 || undefined, addressLine2: draft.addressLine2 || undefined, city: draft.city || undefined, stateProvince: draft.stateProvince || undefined, postalCode: draft.postalCode || undefined, country: draft.country || undefined });
    if (!created) return;
    onOpenChange(false);
    setDraft({ name: '', contact: '', phone: '', email: '', addressLine1: '', addressLine2: '', city: '', stateProvince: '', postalCode: '', country: 'United States' });
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogTrigger asChild><Button type="button" variant="ghost" size="sm" className="justify-start px-0 text-sm text-primary" disabled={disabled}>+ Add customer</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>New customer</DialogTitle><DialogDescription>Quickly capture a new customer record.</DialogDescription></DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2"><Label htmlFor="newCustomerName">Name</Label><Input id="newCustomerName" value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="Customer name" required /></div>
        <div className="grid gap-2"><Label htmlFor="newCustomerContact">Contact</Label><Input id="newCustomerContact" value={draft.contact} onChange={(event) => update('contact', event.target.value)} placeholder="Contact name (optional)" /></div>
        <div className="grid gap-2"><Label htmlFor="newCustomerPhone">Phone</Label><Input id="newCustomerPhone" value={draft.phone} onChange={(event) => update('phone', event.target.value)} placeholder="(555) 123-4567" /></div>
        <div className="grid gap-2"><Label htmlFor="newCustomerEmail">Email</Label><Input id="newCustomerEmail" type="email" value={draft.email} onChange={(event) => update('email', event.target.value)} placeholder="contact@example.com" /></div>
        <div className="grid gap-2"><Label htmlFor="newCustomerAddressLine1">Shipping address line 1</Label><Input id="newCustomerAddressLine1" value={draft.addressLine1} onChange={(event) => update('addressLine1', event.target.value)} placeholder="Street address" /></div>
        <div className="grid gap-2"><Label htmlFor="newCustomerAddressLine2">Address line 2</Label><Input id="newCustomerAddressLine2" value={draft.addressLine2} onChange={(event) => update('addressLine2', event.target.value)} placeholder="Suite, building, attention" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="newCustomerCity">City</Label><Input id="newCustomerCity" value={draft.city} onChange={(event) => update('city', event.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="newCustomerState">State / province</Label><Input id="newCustomerState" value={draft.stateProvince} onChange={(event) => update('stateProvince', event.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="newCustomerPostalCode">Postal code</Label><Input id="newCustomerPostalCode" value={draft.postalCode} onChange={(event) => update('postalCode', event.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="newCustomerCountry">Country</Label><Input id="newCustomerCountry" value={draft.country} onChange={(event) => update('country', event.target.value)} /></div>
        </div>
      </div>
      <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" onClick={() => void submit()}>Save customer</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
