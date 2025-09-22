'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function SignInPage() {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await signIn('credentials', { email, password, redirect: true, callbackUrl: '/' });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F14] text-[#E6EDF3]">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 bg-[#121821] p-6 rounded-md shadow">
        <h1 className="text-xl font-semibold">Sign in</h1>
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
