import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#0B0F14] text-[#E6EDF3]">
      <h1 className="text-2xl font-bold mb-4">Welcome to ShopApp!</h1>
      {session?.user ? (
        <div>
          <p>Hello, {session.user.name || session.user.email}!</p>
          <p>Your role: {session.user.role}</p>
        </div>
      ) : (
        <p>Please <a href="/auth/signin" className="underline text-[#34D399]">sign in</a> to continue.</p>
      )}
    </main>
  );
}
