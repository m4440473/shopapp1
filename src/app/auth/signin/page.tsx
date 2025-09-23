import { getCsrfToken } from "next-auth/react";

export default async function SignInPage() {
  const csrfToken = await getCsrfToken();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 80 }}>
      <h1>Sign In</h1>
      <form method="post" action="/api/auth/callback/credentials" style={{ minWidth: 300 }}>
        <input name="csrfToken" type="hidden" defaultValue={csrfToken} />
        <div style={{ marginBottom: 16 }}>
          <label>Email</label>
          <input name="email" type="email" required style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>Password</label>
          <input name="password" type="password" required style={{ width: '100%' }} />
        </div>
        <button type="submit" style={{ width: '100%' }}>Sign in</button>
      </form>
    </div>
  );
}
