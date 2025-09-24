import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const user = session.user as any;
  const role = user?.role as string | undefined;
  const id = user?.id as string | undefined;
  const name = user?.name as string | undefined;
  return NextResponse.json({ email: session.user.email, role, id, name });
}
