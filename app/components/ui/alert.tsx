import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";

type AlertVariant = "success" | "error" | "warning" | "info";

interface AlertProps {
  variant?: AlertVariant;
  message: string;
}

const styles: Record<AlertVariant, { wrap: string; icon: React.ElementType; iconCls: string }> = {
  success: { wrap: "bg-green-50 border border-green-200 text-green-800",  icon: CheckCircle,     iconCls: "text-green-500" },
  error:   { wrap: "bg-red-50 border border-red-200 text-red-800",        icon: XCircle,         iconCls: "text-red-500"   },
  warning: { wrap: "bg-amber-50 border border-amber-200 text-amber-800",  icon: AlertTriangle,   iconCls: "text-amber-500" },
  info:    { wrap: "bg-blue-50 border border-blue-200 text-blue-800",     icon: Info,            iconCls: "text-blue-500"  },
};

export function Alert({ variant = "info", message }: AlertProps) {
  const { wrap, icon: Icon, iconCls } = styles[variant];
  return (
    <div role="alert" className={cn("flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm", wrap)}>
      <Icon className={cn("w-4 h-4 flex-shrink-0", iconCls)} />
      <span>{message}</span>
    </div>
  );
}
