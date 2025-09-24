"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/Textarea';
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
  email?: string | null;
  address?: string | null;
};

type EditCustomerDialogProps = {
  customer: Customer;
};

type FormState = {
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
};

export function EditCustomerDialog({ customer }: EditCustomerDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>({
    name: customer.name,
    contact: customer.contact ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    address: customer.address ?? '',
  });

  React.useEffect(() => {
    setForm({
      name: customer.name,
      contact: customer.contact ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
    });
  }, [customer]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        name: form.name.trim(),
        contact: form.contact.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full border-border/60" type="button">
          <Pencil className="mr-2 h-4 w-4" /> Edit customer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
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
          <div className="grid gap-2">
            <Label htmlFor="customer-contact">Primary contact</Label>
            <Input
              id="customer-contact"
              value={form.contact}
              onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))}
              placeholder="Name of primary contact"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-phone">Phone</Label>
            <Input
              id="customer-phone"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="(555) 555-5555"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-email">Email</Label>
            <Input
              id="customer-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="contact@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-address">Address</Label>
            <Textarea
              id="customer-address"
              rows={3}
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Street\nCity, State ZIP"
            />
          </div>
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
