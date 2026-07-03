"use client";

import { useEffect, useState } from "react";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";
import { Footer } from "./footer";
import type { SidebarModule } from "@/types/sidebar";

type AppShellProps = {
  children: React.ReactNode;
  user?: { name?: string | null; image?: string | null; role?: string | null };
  modules?: SidebarModule[];
  backHref?: string;
  appHref?: string;
  appName?: string;
  nested?: boolean;
  envMode?: string;
};

const HAS_BANNER_MODES = new Set(["DEVELOPMENT", "REPLICA"]);

export function AppShell({ children, user, modules = [], backHref, appHref, appName, nested = false, envMode }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const handler = () => setSidebarOpen(false);
    window.addEventListener("closeSidebar", handler);
    return () => window.removeEventListener("closeSidebar", handler);
  }, []);

  // Di mobile sidebar overlay tanpa menggeser konten
  const contentShift = !isMobile && sidebarOpen ? "260px" : "0";
  const hasBanner = !!envMode && HAS_BANNER_MODES.has(envMode);
  // h-14 (56px) navbar + h-8 (32px) banner = 88px
  const mainPt = hasBanner ? "pt-[88px]" : "pt-14";

  const backdrop = sidebarOpen && (
    <div className="fixed inset-0 z-[55] bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
  );

  const sidebar = (
    <Sidebar
      open={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      user={user}
      modules={modules}
      backHref={backHref}
      appHref={appHref}
      appName={appName}
      hasBanner={hasBanner}
    />
  );

  if (nested) {
    return (
      <>
        <Navbar onMenuToggle={() => setSidebarOpen((v) => !v)} userName={user?.name} userImage={user?.image} envMode={envMode} />
        {sidebar}
        {backdrop}
        <div
          className="transition-[margin-left] duration-300"
          style={{ marginLeft: contentShift }}
        >
          {children}
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar onMenuToggle={() => setSidebarOpen((v) => !v)} userName={user?.name} userImage={user?.image} envMode={envMode} />
      {sidebar}
      {backdrop}
      <div
        className="min-h-screen flex flex-col bg-white transition-[margin-left] duration-300"
        style={{ marginLeft: contentShift }}
      >
        <main className={`flex-1 ${mainPt}`}>
          <div className="px-4 sm:px-6 py-4">{children}</div>
        </main>
        <Footer />
      </div>
    </>
  );
}
