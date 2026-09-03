'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/checkbox';
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

export type CustomerContactOption = {
  id: string;
  name: string;
  title?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  isPrimary?: boolean;
};

export type CustomerWithContacts = {
  id: string;
  name: string;
  contacts?: CustomerContactOption[];
};

export function AddCustomerContactDialog({
  customer,
  onSaved,
}: {
  customer: CustomerWithContacts;
  onSaved: (customer: CustomerWithContacts, newContactId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [fax, setFax] = useState('');
  const [email, setEmail] = useState('');
  const [makePrimary, setMakePrimary] = useState(!(customer.contacts?.length));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMakePrimary(!(customer.contacts?.length));
  }, [customer.contacts?.length, open]);

  async function saveContact() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    const existing = customer.contacts ?? [];
    const submittedEmail = email.trim();
    try {
      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: [
            ...existing.map((contact) => ({
              id: contact.id,
              name: contact.name,
              title: contact.title ?? '',
              phone: contact.phone ?? '',
              fax: contact.fax ?? '',
              email: contact.email ?? '',
              isPrimary: makePrimary ? false : contact.isPrimary,
            })),
            {
              name: name.trim(),
              title: title.trim(),
              phone: phone.trim(),
              fax: fax.trim(),
              email: submittedEmail,
              isPrimary: makePrimary || existing.length === 0,
            },
          ],
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Could not add this contact.');
      }
      const payload = await response.json();
      const updated = payload.item as CustomerWithContacts;
      const existingIds = new Set(existing.map((contact) => contact.id));
      const newContact = (updated.contacts ?? []).find((contact) => !existingIds.has(contact.id));
      if (!newContact) throw new Error('The contact was saved, but could not be selected automatically.');
      onSaved(updated, newContact.id);
      setName('');
      setTitle('');
      setPhone('');
      setFax('');
      setEmail('');
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add this contact.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="justify-start px-0 text-xs text-primary">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add contact for {customer.name}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add customer contact</DialogTitle>
          <DialogDescription>Add another person under {customer.name} without creating a duplicate customer.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="new-contact-name">Name</Label>
            <Input id="new-contact-name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-contact-title">Title / department</Label>
            <Input id="new-contact-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-contact-phone">Phone</Label>
            <Input id="new-contact-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-contact-fax">Fax</Label>
            <Input id="new-contact-fax" value={fax} onChange={(event) => setFax(event.target.value)} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="new-contact-email">Email</Label>
            <Input id="new-contact-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={makePrimary} onCheckedChange={(checked) => setMakePrimary(checked === true)} />
          Make this the primary contact
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" onClick={saveContact} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save contact'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
