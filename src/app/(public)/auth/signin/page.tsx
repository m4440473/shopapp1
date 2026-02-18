"use client";

import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { normalizeCallbackUrl } from '@/lib/auth-redirect';

export default function SignInPage() {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState('/');

  useEffect(() => {
    // Read auth query params on the client to avoid using `useSearchParams`, which can
    // trigger prerender/suspense boundary errors when the page is statically generated.
    const params = new URLSearchParams(window.location.search);
    setError(params.get('error'));
    setCallbackUrl(normalizeCallbackUrl(params.get('callbackUrl'), '/'));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await signIn('credentials', { email, password, redirect: true, callbackUrl });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F14] text-[#E6EDF3]">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 bg-[#121821] p-6 rounded-md shadow">
        <h1 className="text-xl font-semibold">Sign in</h1>
        {error && (
          <div className="text-red-400 text-sm mb-2">Invalid email or password.</div>
        )}
        <label className="block text-sm">
          <span className="text-[#9FB1C1]">Email</span>
          <input
            className="mt-1 w-full rounded bg-[#1B2430] p-2 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-[#9FB1C1]">Password</span>
          <input
            className="mt-1 w-full rounded bg-[#1B2430] p-2 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        <button
          type="submit"
          className="w-full py-2 rounded bg-[#34D399] hover:opacity-90 text-black font-semibold"
        >
          Sign In
        </button>
        <p className="text-xs text-[#9FB1C1]">Demo: admin@example.com / admin123</p>
      </form>
    </div>
  );
}
