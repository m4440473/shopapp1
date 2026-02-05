'use client';
import { fetchJson } from '@/lib/fetchJson';

import { FormEvent, useEffect, useState } from 'react';

import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

interface PasswordState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function PasswordClient() {
  const toast = useToast();
  const [form, setForm] = useState<PasswordState>({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/password', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setHasPassword(Boolean(data.hasPassword));
        } else {
          setHasPassword(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasPassword(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.newPassword.length < 8) {
      toast.push('New password must be at least 8 characters.', 'error');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.push('Passwords do not match.', 'error');
      return;
    }
    if ((hasPassword ?? false) && !form.currentPassword) {
      toast.push('Enter your current password to make a change.', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, string> = { newPassword: form.newPassword };
      if (form.currentPassword) {
        payload.currentPassword = form.currentPassword;
      }
      await fetchJson('/api/account/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast.push('Password updated successfully.', 'success');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setHasPassword(true);
    } catch (error: any) {
      toast.push(error.body?.error ?? 'Unable to update password.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const description =
    hasPassword === null
      ? 'Loading account details…'
      : hasPassword
        ? 'Update your password by confirming your current credentials.'
        : 'Create a password for your account.';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {hasPassword && (
            <div className="grid gap-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={form.currentPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                autoComplete="current-password"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              value={form.newPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              autoComplete="new-password"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading || hasPassword === null}>
              {loading ? 'Saving…' : 'Save password'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
