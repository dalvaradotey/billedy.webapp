import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-bold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-coral text-coral-ink hover:bg-coral/90 focus-visible:ring-coral/30",
        outline:
          "border border-line-strong bg-surface hover:bg-surface-2",
        secondary:
          "bg-surface-3 text-foreground hover:bg-line-strong h-10 px-4 text-sm font-bold rounded-full",
        subtle:
          "bg-surface-3 text-foreground hover:bg-line-strong h-9 px-4 text-sm font-medium rounded-full",
        ghost:
          "hover:bg-surface-2 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        action: "bg-muted/50 text-foreground hover:bg-muted border border-transparent hover:border-border h-10 px-4 text-sm font-bold rounded-full",
        cta: "bg-jade text-jade-ink hover:bg-jade/90 active:scale-[0.98] !h-14 text-base font-extrabold rounded-full",
        "cta-sm": "bg-jade text-jade-ink hover:bg-jade/90 active:scale-[0.98] h-10 px-4 text-sm font-bold rounded-full",
      },
      size: {
        default: "h-11 px-5 py-2 has-[>svg]:px-4",
        xs: "h-7 gap-1 px-2.5 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3.5 has-[>svg]:px-3",
        lg: "h-12 px-6 has-[>svg]:px-5",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
