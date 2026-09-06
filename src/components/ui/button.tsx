import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex min-h-10 max-w-full items-center justify-center rounded-[10px] text-center text-sm font-medium leading-[1.2] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "min-h-0 rounded-none p-0 text-primary underline-offset-4 hover:underline",
        /* Legacy aliases kept only for backwards compatibility. */
        hero: "bg-primary text-primary-foreground hover:bg-primary/90",
        lagoon: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        glass: "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "px-4 py-2.5",
        sm: "min-h-9 px-3.5 py-2 text-xs",
        lg: "min-h-10 px-4 py-2.5 text-sm",
        xl: "min-h-11 px-5 py-2.5 text-base",
        icon: "size-10 min-h-10 min-w-10 p-0",
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
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const resolvedVariant = variant ?? "default";
    const resolvedSize = size ?? "default";

    const content = (
      <span
        data-krew-button-content
        className={cn(
          "inline-flex min-w-0 max-w-full items-center justify-center gap-2 text-center",
          resolvedSize === "icon"
            ? "size-full"
            : "whitespace-normal break-words",
        )}
      >
        {children}
      </span>
    );

    return (
      <Comp
        data-slot="button"
        data-variant={resolvedVariant}
        data-size={resolvedSize}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
