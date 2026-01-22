"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  ClipboardList,
  Info,
  LayoutDashboard,
  Menu,
  PlusCircle,
  Search,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { canAccessAdmin } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/use-current-user";

const baseLinks = [
  { href: "/", label: "Shop Floor Intelligence", icon: LayoutDashboard },
  { href: "/about", label: "Overview", icon: Info },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/orders/new", label: "New Order", icon: PlusCircle },
];

type AppNavProps = {
  companyName: string;
  initials: string;
  logoUrl: string | null;
};

type NavLink = { href: string; label: string; icon: React.ElementType };

export default function AppNav({ companyName, initials, logoUrl }: AppNavProps) {
  const pathname = usePathname() || "/";
  const user = useCurrentUser();

  const links = React.useMemo<NavLink[]>(() => {
    const items: NavLink[] = [...baseLinks];
    if (user?.role === "MACHINIST" || user?.role === "ADMIN") {
      if (user?.id) {
        items.push({ href: `/machinists/${user.id}`, label: "Machinist Profile", icon: Wrench });
      }
    }
    if (user) {
      items.push({ href: "/account/password", label: "Account", icon: UserRound });
    }
    if (user && canAccessAdmin(user)) {
      items.push({ href: "/admin/users", label: "Admin", icon: BadgeCheck });
    }
    return items;
  }, [user]);

  const isAuthed = Boolean(user);
  const accountLink = isAuthed ? "/account/password" : "/auth/signin";
  const accountLabel = isAuthed ? "Account" : "Sign in";

  return (
    <div className="flex w-full items-center gap-4">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col gap-4">
            <SheetHeader>
              <SheetTitle className="text-left">Menu</SheetTitle>
            </SheetHeader>
            <form action="/search" className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                name="q"
                placeholder="Search orders..."
                className="h-11 rounded-full border-border/60 bg-secondary/40 pl-10"
                aria-label="Search orders"
              />
            </form>
            <Separator />
            <nav className="flex flex-col gap-2">
              {links.map((link) => {
                const active =
                  link.href === "/admin/users"
                    ? pathname.startsWith("/admin")
                    : pathname === link.href || pathname.startsWith(`${link.href}/`);
                const Icon = link.icon;
                return (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  </SheetClose>
                );
              })}
            </nav>
            <Separator />
            <SheetClose asChild>
              <Button asChild variant="secondary" className="w-full justify-center" size="lg">
                <Link href={accountLink}>{accountLabel}</Link>
              </Button>
            </SheetClose>
          </SheetContent>
        </Sheet>

        <Link href="/" className="flex items-center gap-3 text-left">
          {logoUrl ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-background shadow-lg shadow-primary/30">
              <Image
                src={logoUrl}
                alt={`${companyName} logo`}
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
            </span>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/90 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/30">
              {initials}
            </div>
          )}
          <div className="hidden sm:block">
            <p className="text-[0.65rem] uppercase tracking-[0.35em] text-muted-foreground">{companyName}</p>
            <h1 className="text-xl font-semibold text-foreground">ShopApp</h1>
          </div>
        </Link>
      </div>

      <nav className="hidden items-center gap-4 text-sm font-medium text-muted-foreground md:flex">
        {links.map((link) => {
          const active =
            link.href === "/admin/users"
              ? pathname.startsWith("/admin")
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "transition-colors hover:text-primary",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <form action="/search" className="relative ml-auto hidden w-full max-w-sm md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          placeholder="Search orders..."
          className="h-10 rounded-full border-border/60 bg-secondary/40 pl-10 text-sm placeholder:text-muted-foreground/80"
          aria-label="Search orders"
        />
      </form>

      <Button
        asChild
        variant="secondary"
        className="ml-auto rounded-full border border-primary/40 bg-primary/10 text-sm text-primary hover:bg-primary/20 md:ml-0"
      >
        <Link href={accountLink}>{accountLabel}</Link>
      </Button>
    </div>
  );
}
