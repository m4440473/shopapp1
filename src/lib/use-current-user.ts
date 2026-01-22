"use client";

import { useEffect, useState } from "react";

export type CurrentUser = {
  id?: string;
  role?: string;
  admin?: boolean;
  name?: string;
  email?: string;
} | null;

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/whoami", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setUser({
            id: data.id,
            role: data.role,
            admin: data.admin,
            name: data.name,
            email: data.email,
          });
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
