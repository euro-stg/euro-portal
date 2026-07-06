"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function useNotifRefresh(load: () => void) {
  const r = useSearchParams().get("_r");
  useEffect(() => {
    if (r) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);
}
