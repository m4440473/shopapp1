'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';

export type NewQuoteCustomerInput = {
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
};

type NewQuoteCustomerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: NewQuoteCustomerInput) => Promise<boolean>;
};

export function NewQuoteCustomerDialog({ open, onOpenChange, onCreate }: NewQuoteCustomerDialogProps) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateProvince, setStateProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('United States');

  async function createCustomer() {
    if (!name.trim()) return;

    const created = await onCreate({
      name,
      contact: contact || undefined,
      phone: phone || undefined,
      email: email || undefined,
      addressLine1: addressLine1 || undefined,
      addressLine2: addressLine2 || undefined,
      city: city || undefined,
      stateProvince: stateProvince || undefined,
      postalCode: postalCode || undefined,
      country: country || undefined,
    });
    if (!created) return;

    onOpenChange(false);
    setName('');
    setContact('');
    setPhone('');
    setEmail('');
    setAddressLine1('');
    setAddressLine2('');
    setCity('');
    setStateProvince('');
    setPostalCode('');
    setCountry('United States');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="justify-start px-0 text-sm text-primary">
          + Add customer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
          <DialogDescription>Quickly capture a new customer record.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="newCustomerName">Name</Label>
            <Input
              id="newCustomerName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Customer name"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newCustomerContact">Contact</Label>
            <Input
              id="newCustomerContact"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="Contact name (optional)"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newCustomerPhone">Phone</Label>
            <Input
              id="newCustomerPhone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newCustomerEmail">Email</Label>
            <Input
              id="newCustomerEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="contact@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newCustomerAddressLine1">Shipping address line 1</Label>
            <Input id="newCustomerAddressLine1" value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} placeholder="Street address" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newCustomerAddressLine2">Address line 2</Label>
            <Input id="newCustomerAddressLine2" value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} placeholder="Suite, building, attention" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="newCustomerCity">City</Label><Input id="newCustomerCity" value={city} onChange={(event) => setCity(event.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="newCustomerState">State / province</Label><Input id="newCustomerState" value={stateProvince} onChange={(event) => setStateProvince(event.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="newCustomerPostalCode">Postal code</Label><Input id="newCustomerPostalCode" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="newCustomerCountry">Country</Label><Input id="newCustomerCountry" value={country} onChange={(event) => setCountry(event.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void createCustomer()}>
            Save customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
