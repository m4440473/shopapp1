"use client";

import { useEffect, useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';

import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { AUTH_REQUIRED_EVENT_NAME, emitAuthRequired } from '@/lib/auth-required';
import { shouldPromptForSignIn } from '@/lib/auth-required-response';

export default function AuthRequiredDialog() {
  const [open, setOpen] = useState(false);
  const callbackUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/';
    return `${window.location.pathname}${window.location.search}`;
  }, []);

  useEffect(() => {
    const onAuthRequired = () => setOpen(true);
    window.addEventListener(AUTH_REQUIRED_EVENT_NAME, onAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT_NAME, onAuthRequired);
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);
      if (await shouldPromptForSignIn(response, input, init, window.location.origin)) {
        emitAuthRequired({ url: typeof input === 'string' ? input : undefined });
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in required</DialogTitle>
          <DialogDescription>Your session is missing or expired. Sign in to continue this action.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Button type="button" onClick={() => void signIn(undefined, { callbackUrl })}>
            Sign in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
