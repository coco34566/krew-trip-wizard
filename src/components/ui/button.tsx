import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-center text-[14px] leading-none font-semibold cursor-pointer transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/55 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-primary bg-primary text-primary-foreground shadow-none hover:bg-primary/92 hover:border-primary/92 active:translate-y-px",
        destructive:
          "border border-destructive bg-destructive text-destructive-foreground shadow-none hover:bg-destructive/90 active:translate-y-px",
        outline:
          "border border-border/75 bg-background text-foreground shadow-none hover:border-primary/30 hover:bg-sage/[0.08] hover:text-primary active:translate-y-px",
        secondary:
          "border border-sage/35 bg-sage/14 text-primary shadow-none hover:bg-sage/22 hover:border-sage/50 active:translate-y-px",
        ghost:
          "border border-transparent bg-transparent text-foreground shadow-none hover:bg-sage/[0.08] hover:text-primary active:translate-y-px",
        link: "h-auto rounded-none border-0 p-0 text-primary underline-offset-4 hover:underline",
        /* Legacy names kept for compatibility, visually mapped onto the KREW system. */
        hero:
          "border border-primary bg-primary text-primary-foreground shadow-none hover:bg-primary/92 hover:border-primary/92 active:translate-y-px",
        lagoon:
          "border border-sage/35 bg-sage/14 text-primary shadow-none hover:bg-sage/22 hover:border-sage/50 active:translate-y-px",
        glass:
          "border border-border/75 bg-background text-foreground shadow-none hover:border-primary/30 hover:bg-sage/[0.08] hover:text-primary active:translate-y-px",
      },
      size: {
        sm: "h-9 px-3 text-[13px]",
        default: "h-10 px-4",
        lg: "h-11 px-5 text-[14px]",
        xl: "h-11 px-6 text-[15px]",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
