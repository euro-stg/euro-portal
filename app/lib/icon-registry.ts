import {
  LayoutDashboard, Users, Tag, Shield, Package, Settings, Settings2,
  Database, Bell, Layers, FileText, Ticket, Workflow, BookOpen, FolderKanban,
  Key, Link2,
  GitBranch, Briefcase, Building2, Network,
  ShieldCheck,
  Code2, Scale, FolderOpen, BarChart2, Globe, Lock, Cpu,
  FileSignature, Send, CheckSquare, PenLine, ListChecks,
  Mail,
  Stethoscope, Terminal, ScrollText, Star, Newspaper,
  type LucideIcon,
} from "lucide-react";

export const iconRegistry: Record<string, LucideIcon> = {
  LayoutDashboard, Users, Tag, Shield, Package, Settings, Settings2,
  Database, Bell, Layers, FileText, Ticket, Workflow, BookOpen, FolderKanban,
  Key, Link2,
  GitBranch, Briefcase, Building2, Network,
  ShieldCheck,
  Code2, Scale, FolderOpen, BarChart2, Globe, Lock, Cpu,
  FileSignature, Send, CheckSquare, PenLine, ListChecks,
  Mail,
  Stethoscope, Terminal, ScrollText, Star, Newspaper,
};

export const iconColorRegistry: Record<string, string> = {
  LayoutDashboard: "text-blue-500",
  Users:           "text-indigo-500",
  Tag:             "text-emerald-500",
  Shield:          "text-violet-500",
  Package:         "text-orange-500",
  Database:        "text-cyan-500",
  Settings:        "text-slate-400",
  Settings2:       "text-slate-400",
  Bell:            "text-amber-500",
  Layers:          "text-blue-500",
  FileText:        "text-rose-500",
  Ticket:          "text-teal-500",
  Workflow:        "text-purple-500",
  BookOpen:        "text-sky-500",
  FolderKanban:    "text-pink-500",
  Key:             "text-amber-500",
  Link2:           "text-teal-500",
  GitBranch:       "text-teal-500",
  Briefcase:       "text-indigo-500",
  Building2:       "text-emerald-500",
  Network:         "text-violet-500",
  ShieldCheck:     "text-violet-500",
  Code2:           "text-blue-500",
  Scale:           "text-orange-500",
  FolderOpen:      "text-amber-500",
  BarChart2:       "text-cyan-500",
  Globe:           "text-sky-500",
  Lock:            "text-rose-500",
  Cpu:             "text-slate-500",
  FileSignature:   "text-violet-500",
  Send:            "text-blue-500",
  CheckSquare:     "text-emerald-500",
  PenLine:         "text-indigo-500",
  ListChecks:      "text-teal-500",
  Mail:            "text-violet-500",
  Stethoscope:     "text-rose-500",
  Terminal:        "text-slate-600",
  ScrollText:      "text-blue-500",
  Star:            "text-amber-500",
  Newspaper:       "text-orange-500",
};

/** Untuk app card di dashboard — fallback ke Layers */
export function getAppIcon(name: string | null): LucideIcon {
  return (name && iconRegistry[name]) ? iconRegistry[name] : Layers;
}

/** Untuk sidebar — fallback ke LayoutDashboard */
export function getSidebarIcon(name: string | null): LucideIcon {
  return (name && iconRegistry[name]) ? iconRegistry[name] : LayoutDashboard;
}

export function getIconColor(name: string | null): string {
  return (name && iconColorRegistry[name]) ? iconColorRegistry[name] : "text-slate-400";
}
