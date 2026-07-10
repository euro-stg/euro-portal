"use client";

import Link from "next/link";
import { getAppIcon } from "@/lib/icon-registry";

type Props = {
  app: { id: string; name: string; path: string; description: string | null };
  colorCls: { gradient: string; border: string };
  iconName: string | null;
  compact?: boolean;
};

export function InternalAppCard({ app, colorCls: c, iconName, compact }: Props) {
  const Icon = getAppIcon(iconName);

  if (compact) {
    return (
      <div className="relative group">
        <Link
          href={app.path}
          onClick={() => window.dispatchEvent(new Event("closeSidebar"))}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-slate-50 active:scale-95 transition-all text-center"
        >
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-sm`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs font-medium text-slate-700 leading-tight line-clamp-2">{app.name}</p>
        </Link>
        {app.description && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[160px] px-2.5 py-1.5 bg-slate-800 text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg text-center leading-tight">
            {app.description}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-800" />
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={app.path}
      onClick={() => window.dispatchEvent(new Event("closeSidebar"))}
      className={`group relative bg-white rounded-2xl border ${c.border} p-4 sm:p-5 flex flex-col items-center gap-2 sm:gap-3 shadow-sm active:scale-95 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 text-center`}
    >
      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-sm`}>
        <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
      </div>
      <div className="flex-1 w-full">
        <p className="font-semibold text-slate-800 text-sm leading-snug">{app.name}</p>
        {app.description && (
          <p className="text-slate-400 text-xs mt-1 leading-relaxed line-clamp-2 text-center hidden sm:block">{app.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-blue-500 transition-colors">
        Buka
        <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
