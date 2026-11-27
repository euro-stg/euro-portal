"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Heartbeat status online: ping tiap 60 dtk hanya saat tab terlihat; ping lagi saat tab kembali aktif.
export function PresenceHeartbeat() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  useEffect(() => {
    const ping = () => {
      if (document.hidden) return;
      fetch("/api/presence", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathRef.current }), keepalive: true,
      }).catch(() => {});
    };
    ping();
    const t = setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", ping); };
  }, []);

  return null;
}
