"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Customer = {
  id: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  address?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  contacts?: Array<{
    id: string;
    name: string;
    title?: string | null;
    phone?: string | null;
    fax?: string | null;
    email?: string | null;
    isPrimary: boolean;
  }>;
};

type EditCustomerDialogProps = {
  customer: Customer;
};

type FormState = {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
};

type ContactForm = {
  key: string;
  id?: string;
  name: string;
  title: string;
  phone: string;
  fax: string;
  email: string;
  isPrimary: boolean;
};

function initialContacts(customer: Customer): ContactForm[] {
  if (customer.contacts?.length) {
    return customer.contacts.map((contact) => ({
      key: contact.id,
      id: contact.id,
      name: contact.name,
      title: contact.title ?? '',
      phone: contact.phone ?? '',
      fax: contact.fax ?? '',
      email: contact.email ?? '',
      isPrimary: contact.isPrimary,
    }));
  }
  if (customer.contact || customer.phone || customer.fax || customer.email) {
    return [{
      key: `legacy-${customer.id}`,
      name: customer.contact ?? customer.email ?? 'Primary contact',
      title: '',
      phone: customer.phone ?? '',
      fax: customer.fax ?? '',
      email: customer.email ?? '',
      isPrimary: true,
    }];
  }
  return [];
}

export function EditCustomerDialog({ customer }: EditCustomerDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>({
    name: customer.name,
    addressLine1: customer.addressLine1 ?? '',
    addressLine2: customer.addressLine2 ?? '',
    city: customer.city ?? '',
    stateProvince: customer.stateProvince ?? '',
    postalCode: customer.postalCode ?? '',
    country: customer.country ?? '',
  });
  const [contacts, setContacts] = React.useState<ContactForm[]>(() => initialContacts(customer));

  React.useEffect(() => {
    setForm({
      name: customer.name,
      addressLine1: customer.addressLine1 ?? '',
      addressLine2: customer.addressLine2 ?? '',
      city: customer.city ?? '',
      stateProvince: customer.stateProvince ?? '',
      postalCode: customer.postalCode ?? '',
      country: customer.country ?? '',
    });
    setContacts(initialContacts(customer));
  }, [customer]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        name: form.name.trim(),
        address: customer.address ?? undefined,
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim(),
        city: form.city.trim(),
        stateProvince: form.stateProvince.trim(),
        postalCode: form.postalCode.trim(),
        country: form.country.trim(),
        contacts: contacts.map(({ key: _key, ...contact }) => ({
          ...contact,
          name: contact.name.trim(),
          title: contact.title.trim(),
          phone: contact.phone.trim(),
          fax: contact.fax.trim(),
          email: contact.email.trim(),
        })),
      };
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || 'Failed to update customer');
      }
      setSuccess('Customer updated');
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update customer');
    } finally {
      setLoading(false);
    }
  }

  function updateContact(key: string, updates: Partial<ContactForm>) {
    setContacts((current) => current.map((contact) => (contact.key === key ? { ...contact, ...updates } : contact)));
  }

  function markPrimary(key: string) {
    setContacts((current) => current.map((contact) => ({ ...contact, isPrimary: contact.key === key })));
  }

  function removeContact(key: string) {
    setContacts((current) => {
      const removed = current.find((contact) => contact.key === key);
      const next = current.filter((contact) => contact.key !== key);
      if (removed?.isPrimary && next[0]) next[0] = { ...next[0], isPrimary: true };
      return next;
    });
  }

  function addContact() {
    setContacts((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        name: '',
        title: '',
        phone: '',
        fax: '',
        email: '',
        isPrimary: current.length === 0,
      },
    ]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full border-border/60" type="button">
          <Pencil className="mr-2 h-4 w-4" /> Edit customer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit customer</DialogTitle>
          <DialogDescription>Update the customer&apos;s contact and shipping information.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="customer-name">Name</Label>
            <Input
              id="customer-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          <section className="space-y-3 rounded-lg border border-border/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-foreground">Contacts</h3>
                <p className="text-xs text-muted-foreground">Add everyone who may request or approve work.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addContact}>
                <Plus className="mr-2 h-4 w-4" /> Add contact
              </Button>
            </div>
            {contacts.map((contact, index) => (
              <div key={contact.key} className="space-y-3 rounded-md border border-border/50 bg-muted/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Contact {index + 1}</p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={contact.isPrimary ? 'default' : 'ghost'}
                      onClick={() => markPrimary(contact.key)}
                    >
                      <Star className="mr-1.5 h-3.5 w-3.5" /> {contact.isPrimary ? 'Primary' : 'Make primary'}
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeContact(contact.key)} aria-label="Remove contact">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor={`customer-contact-name-${contact.key}`}>Name</Label>
                    <Input id={`customer-contact-name-${contact.key}`} value={contact.name} onChange={(event) => updateContact(contact.key, { name: event.target.value })} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`customer-contact-title-${contact.key}`}>Title / department</Label>
                    <Input id={`customer-contact-title-${contact.key}`} value={contact.title} onChange={(event) => updateContact(contact.key, { title: event.target.value })} placeholder="Purchasing, engineer, owner…" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`customer-contact-phone-${contact.key}`}>Phone</Label>
                    <Input id={`customer-contact-phone-${contact.key}`} value={contact.phone} onChange={(event) => updateContact(contact.key, { phone: event.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`customer-contact-email-${contact.key}`}>Email</Label>
                    <Input id={`customer-contact-email-${contact.key}`} type="email" value={contact.email} onChange={(event) => updateContact(contact.key, { email: event.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`customer-contact-fax-${contact.key}`}>Fax</Label>
                    <Input id={`customer-contact-fax-${contact.key}`} value={contact.fax} onChange={(event) => updateContact(contact.key, { fax: event.target.value })} />
                  </div>
                </div>
              </div>
            ))}
            {!contacts.length ? <p className="text-sm text-muted-foreground">No contacts recorded yet.</p> : null}
          </section>

          <section className="space-y-3 rounded-lg border border-border/60 p-4">
            <div>
              <h3 className="font-semibold text-foreground">Shipping address</h3>
              <p className="text-xs text-muted-foreground">Structured fields are ready for a future shipping integration.</p>
            </div>
            {customer.address && !customer.addressLine1 ? (
              <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                Legacy address preserved until structured fields are entered: {customer.address}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="customer-address-line-1">Address line 1</Label>
                <Input id="customer-address-line-1" value={form.addressLine1} onChange={(event) => setForm((prev) => ({ ...prev, addressLine1: event.target.value }))} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="customer-address-line-2">Address line 2</Label>
                <Input id="customer-address-line-2" value={form.addressLine2} onChange={(event) => setForm((prev) => ({ ...prev, addressLine2: event.target.value }))} placeholder="Suite, unit, building…" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer-city">City</Label>
                <Input id="customer-city" value={form.city} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer-state">State / province</Label>
                <Input id="customer-state" value={form.stateProvince} onChange={(event) => setForm((prev) => ({ ...prev, stateProvince: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer-postal-code">Postal code</Label>
                <Input id="customer-postal-code" value={form.postalCode} onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer-country">Country</Label>
                <Input id="customer-country" value={form.country} onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))} placeholder="United States" />
              </div>
            </div>
          </section>
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {success}
            </div>
          )}
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="sm:order-first"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="rounded-full">
              {loading ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
