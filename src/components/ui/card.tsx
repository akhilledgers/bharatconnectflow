import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

// components.md → Card.
type DivProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: DivProps) {
  return (
    <div
      data-slot="card"
      className={cn("flex flex-col items-stretch rounded-xl border border-border bg-card text-card-foreground shadow-xs shadow-black/5", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: DivProps) {
  return <div data-slot="card-header" className={cn("flex min-h-14 flex-wrap items-center justify-between gap-2.5 border-b border-border px-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 data-slot="card-title" className={cn("text-sm font-semibold tracking-tight text-foreground", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p data-slot="card-description" className={cn("text-xs text-muted-foreground", className)} {...props} />;
}

export function CardToolbar({ className, ...props }: DivProps) {
  return <div data-slot="card-toolbar" className={cn("flex items-center gap-2.5", className)} {...props} />;
}

export function CardContent({ className, ...props }: DivProps) {
  return <div data-slot="card-content" className={cn("grow p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: DivProps) {
  return <div data-slot="card-footer" className={cn("flex min-h-14 items-center border-t border-border px-5", className)} {...props} />;
}
