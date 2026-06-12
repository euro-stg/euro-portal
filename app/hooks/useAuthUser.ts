"use client";

import { useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  employeeId?: string | null;
  name?: string | null;
  age?: number | null;
  status?: string | null;
  phone?: string | null;
  email?: string | null;
  organizationName?: string | null;
  jobPositionName?: string | null;
  branchName?: string | null;
  joinDate?: string | null;
  resignDate?: string | null;
  image?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/session", {
          cache: "no-store",
        });

        if (!res.ok) {
          setUser(null);
          setAuthenticated(false);
          return;
        }

        const json = await res.json();
        setUser(json.user);
        setAuthenticated(true);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, []);

  return { user, loading, authenticated };
}
