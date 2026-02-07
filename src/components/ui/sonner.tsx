"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />,
        info: <InfoIcon className="size-4 text-blue-600" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-600" />,
        error: <OctagonXIcon className="size-4 text-red-600 dark:text-red-400" />,
        loading: <Loader2Icon className="size-4 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        classNames: {
          toast: "!bg-popover !border-border !text-popover-foreground shadow-lg",
          title: "!text-popover-foreground font-medium",
          description: "!text-muted-foreground",
          success: "!bg-popover !border-border !text-popover-foreground",
          error: "!bg-popover !border-border !text-popover-foreground",
          warning: "!bg-popover !border-border !text-popover-foreground",
          info: "!bg-popover !border-border !text-popover-foreground",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--success-bg": "var(--popover)",
          "--success-text": "var(--popover-foreground)",
          "--success-border": "var(--border)",
          "--error-bg": "var(--popover)",
          "--error-text": "var(--popover-foreground)",
          "--error-border": "var(--border)",
          "--warning-bg": "var(--popover)",
          "--warning-text": "var(--popover-foreground)",
          "--warning-border": "var(--border)",
          "--info-bg": "var(--popover)",
          "--info-text": "var(--popover-foreground)",
          "--info-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
