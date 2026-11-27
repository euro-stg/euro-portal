import {
  LayoutDashboard, Users, Tag, Shield, Package, Settings, Settings2,
  Database, Bell, Layers, FileText, Ticket, Workflow, BookOpen, FolderKanban,
  Key, Link2,
  GitBranch, Briefcase, Building2, Network,
  ShieldCheck,
  Code2, Scale, FolderOpen, BarChart2, Globe, Lock, Cpu,
  FileSignature, Send, CheckSquare, PenLine, ListChecks,
  Mail,
  Stethoscope, Terminal, ScrollText, Star, Newspaper, History,
  Activity, HeartPulse, Monitor, MonitorPlay, GraduationCap, ClipboardCheck, Gauge, Headset, UserSearch, MailCheck, Presentation, Radar, Microscope, Award, Rocket, Stamp, FileCheck, Siren, ScanLine, LifeBuoy, Calculator, Wallet, Smartphone, Zap,
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
  Stethoscope, Terminal, ScrollText, Star, Newspaper, History,
  Activity, HeartPulse, Monitor, MonitorPlay, GraduationCap, ClipboardCheck, Gauge, Headset, UserSearch, MailCheck, Presentation, Radar, Microscope, Award, Rocket, Stamp, FileCheck, Siren, ScanLine, LifeBuoy, Calculator, Wallet, Smartphone, Zap,
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
  History:         "text-sky-500",
  Activity: "text-rose-500",
  HeartPulse: "text-rose-500",
  Monitor: "text-sky-500",
  MonitorPlay: "text-violet-500",
  GraduationCap: "text-emerald-500",
  ClipboardCheck: "text-teal-500",
  Gauge: "text-cyan-500",
  Headset: "text-indigo-500",
  UserSearch: "text-blue-500",
  MailCheck: "text-violet-500",
  Presentation: "text-orange-500",
  Radar: "text-cyan-500",
  Microscope: "text-teal-500",
  Award: "text-amber-500",
  Rocket: "text-orange-500",
  Stamp: "text-rose-500",
  FileCheck: "text-emerald-500",
  Siren: "text-rose-500",
  ScanLine: "text-slate-500",
  LifeBuoy: "text-sky-500",
  Calculator: "text-slate-500",
  Wallet: "text-emerald-500",
  Smartphone: "text-indigo-500",
  Zap: "text-amber-500",
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
