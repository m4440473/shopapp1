import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.redirect(new URL('/api/auth/signout', process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'));
}
