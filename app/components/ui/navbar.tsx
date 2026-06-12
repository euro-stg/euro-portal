"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Menu, ChevronDown, LogOut, User, Layers } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { NotificationBell } from "@/components/ui/notification-bell";

type NavbarProps = {
  onMenuToggle: () => void;
  userName?: string | null;
};

const Navbar = ({ onMenuToggle, userName }: NavbarProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.href = "/sign-in";
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-14 z-40 flex items-center justify-between px-4 bg-white border-b border-slate-200 shadow-sm">
      {/* Left: burger + brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/" className="flex items-center gap-2 select-none">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-800 text-base tracking-tight">
            Euro<span className="text-blue-600">Portal</span>
          </span>
        </Link>
      </div>

      {/* Right: notification bell + user dropdown */}
      <div className="flex items-center gap-1">
        <NotificationBell />
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <span className="text-sm font-medium text-slate-700 hidden sm:block max-w-[120px] truncate">
            {userName ?? "User"}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50">
            <a
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <User className="w-4 h-4 text-slate-400" />
              Profile
            </a>
            <div className="h-px bg-slate-100 mx-2 my-1" />
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
      </div>
      </div>
    </nav>
  );
};

export { Navbar };
