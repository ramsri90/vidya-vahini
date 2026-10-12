import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#0F766E] text-white shadow hover:bg-[#0d655e]",
        destructive:
          "bg-[#B91C1C] text-white shadow-xs hover:bg-[#991b1b]",
        outline:
          "border border-[#E7E0D2] bg-white text-[#1F2937] shadow-xs hover:bg-[#FDFBF6] hover:text-[#0F766E]",
        secondary:
          "bg-[#CCFBF1] text-[#0F766E] shadow-xs hover:bg-[#99F6E4]",
        ghost: "hover:bg-[#FDFBF6] hover:text-[#0F766E]",
        link: "text-[#0F766E] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-[8px] px-3 text-xs",
        lg: "h-11 rounded-[10px] px-8",
        action: "h-9 px-3 text-xs rounded-[10px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
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
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
