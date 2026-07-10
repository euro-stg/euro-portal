"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function EuLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => window.dispatchEvent(new Event("closeSidebar"))}
    >
      {children}
    </Link>
  );
}
