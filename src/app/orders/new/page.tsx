"use client";

import React, { useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const priorities = ['LOW', 'NORMAL', 'RUSH', 'HOT'];
const OPTIONAL_VALUE = '__none__';

type Option = { id: string; name: string };
type ChecklistOption = { id: string; label: string };

export default function NewOrderPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState<Option[]>([]);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerContact, setNewCustomerContact] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [vendors, setVendors] = useState<Option[]>([]);
  const [materials, setMaterials] = useState<Option[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistOption[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [selectedChecklist, setSelectedChecklist] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [partNumber, setPartNumber] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  React.useEffect(() => {
    fetch('/api/admin/customers?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setCustomers(data.items ?? data ?? []))
      .catch(() => setCustomers([]));

    fetch('/api/admin/vendors?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setVendors(data.items ?? []))
      .catch(() => setVendors([]));

    fetch('/api/admin/materials?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setMaterials(data.items ?? []))
      .catch(() => setMaterials([]));

    fetch('/api/admin/checklist-items?take=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setChecklistItems(data.items ?? []))
      .catch(() => setChecklistItems([]));

    const standard = [
      'Deburr',
      'Heat Treat',
      'Grind',
      'Stamp',
      'Inspect',
      'Paint',
      'Black Oxide',
      'Plating',
      'Powder Coating',
      'Zinc',
    ];

    (async () => {
      try {
        const res = await fetch('/api/admin/checklist-items?take=500', {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        const existing = (data.items ?? []) as ChecklistOption[];
        const existingLabels = new Set(existing.map((i) => i.label.toLowerCase()));
        for (const label of standard) {
          if (!existingLabels.has(label.toLowerCase())) {
            await fetch('/api/admin/checklist-items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ label }),
              credentials: 'include',
            });
          }
        }
        const refreshed = await fetch('/api/admin/checklist-items?take=500', {
          credentials: 'include',
        });
        if (refreshed.ok) {
          const d2 = await refreshed.json();
          setChecklistItems(d2.items ?? []);
        }
      } catch (e) {
        // ignore background seeding errors
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const body = {
      orderNumber,
      customerId,
      modelIncluded: false,
      receivedDate: new Date().toISOString().slice(0, 10),
      dueDate,
      priority,
      materialNeeded: false,
      materialOrdered: false,
      vendorId: vendorId || undefined,
      parts: [{ partNumber, quantity, materialId: materialId || undefined }],
      checklistItemIds: selectedChecklist,
      attachments: [],
      notes,
    };
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    if (res.ok) {
      setMessage('Order created!');
      setOrderNumber('');
      setCustomerId('');
      setDueDate('');
      setPriority('NORMAL');
      setPartNumber('');
      setQuantity(1);
      setNotes('');
      setVendorId('');
      setMaterialId('');
      setSelectedChecklist([]);
    } else {
      const error = await res.json();
      setMessage(error?.error ? JSON.stringify(error.error) : 'Error creating order');
    }
    setLoading(false);
  }

  async function createCustomer() {
    if (!newCustomerName.trim()) return;
    const payload = {
      name: newCustomerName,
      contact: newCustomerContact || undefined,
      phone: newCustomerPhone || undefined,
      email: newCustomerEmail || undefined,
      address: newCustomerAddress || undefined,
    };
    const res = await fetch('/api/admin/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      setCustomers((s) => [data.item, ...s]);
      setCustomerId(data.item.id);
      setCustomerDialogOpen(false);
      setNewCustomerName('');
      setNewCustomerContact('');
      setNewCustomerPhone('');
      setNewCustomerEmail('');
      setNewCustomerAddress('');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">New order intake</h1>
        <p className="text-muted-foreground">
          Capture the critical details for a new job ticket before it hits the floor.
        </p>
      </div>

      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader>
          <CardTitle>Create production order</CardTitle>
          <CardDescription>
            Provide customer information, part specifications, and downstream process requirements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-6" onSubmit={handleSubmit}>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="orderNumber">Order number</Label>
                <Input
                  id="orderNumber"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer">Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger id="customer">
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
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
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          placeholder="Customer name"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="newCustomerContact">Contact</Label>
                        <Input
                          id="newCustomerContact"
                          value={newCustomerContact}
                          onChange={(e) => setNewCustomerContact(e.target.value)}
                          placeholder="Contact name (optional)"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="newCustomerPhone">Phone</Label>
                        <Input
                          id="newCustomerPhone"
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="newCustomerEmail">Email</Label>
                        <Input
                          id="newCustomerEmail"
                          type="email"
                          value={newCustomerEmail}
                          onChange={(e) => setNewCustomerEmail(e.target.value)}
                          placeholder="contact@example.com"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="newCustomerAddress">Address</Label>
                        <Textarea
                          id="newCustomerAddress"
                          value={newCustomerAddress}
                          onChange={(e) => setNewCustomerAddress(e.target.value)}
                          placeholder="Shipping address"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="ghost" onClick={() => setCustomerDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="button" onClick={createCustomer}>
                        Save customer
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Select
                  value={vendorId || OPTIONAL_VALUE}
                  onValueChange={(value) => setVendorId(value === OPTIONAL_VALUE ? '' : value)}
                >
                  <SelectTrigger id="vendor">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OPTIONAL_VALUE}>No vendor</SelectItem>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="material">Material</Label>
                <Select
                  value={materialId || OPTIONAL_VALUE}
                  onValueChange={(value) => setMaterialId(value === OPTIONAL_VALUE ? '' : value)}
                >
                  <SelectTrigger id="material">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OPTIONAL_VALUE}>No material</SelectItem>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="border border-dashed border-muted-foreground/40 bg-muted/10">
              <CardHeader>
                <CardTitle className="text-base">Part details</CardTitle>
                <CardDescription>Provide the key identifiers for the first part in this order.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="partNumber">Part number</Label>
                  <Input
                    id="partNumber"
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                    required
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions, fixtures, or inspection notes"
              />
            </div>

            <div className="grid gap-2">
              <Label>Checklist items</Label>
              <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/10 p-4 sm:grid-cols-2">
                {checklistItems.map((item) => {
                  const checked = selectedChecklist.includes(item.id);
                  return (
                    <label key={item.id} className="flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          const isChecked = value === true;
                          setSelectedChecklist((sel) =>
                            isChecked ? [...sel, item.id] : sel.filter((id) => id !== item.id)
                          );
                        }}
                      />
                      <span className="leading-snug text-foreground">{item.label}</span>
                    </label>
                  );
                })}
                {checklistItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No checklist templates available yet. Add items from the admin dashboard.
                  </p>
                )}
              </div>
            </div>

            <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/10 p-4">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Submitting…' : 'Create order'}
              </Button>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link href="/orders">Cancel</Link>
              </Button>
              {message && (
                <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                  {message}
                </div>
              )}
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
