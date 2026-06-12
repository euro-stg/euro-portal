import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:   "bg-slate-600 text-white hover:bg-slate-700 focus-visible:ring-slate-600",
        primary:   "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600",
        success:   "bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600",
        danger:    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
        secondary: "bg-gray-400 text-white hover:bg-gray-500 focus-visible:ring-gray-400",
        outline:   "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-300",
        ghost:     "text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-300",
        link:      "text-blue-600 underline-offset-4 hover:underline focus-visible:ring-blue-600",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-8 rounded-md px-3 text-xs",
        lg:      "h-11 rounded-md px-8",
        icon:    "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        suppressHydrationWarning
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
