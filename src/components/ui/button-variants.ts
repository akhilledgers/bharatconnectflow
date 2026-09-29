import { cn } from "../../lib/cn";

// Class recipes copied from the LEDGERS design system (components.md → Button).
const BASE =
  "cursor-pointer inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-[color,box-shadow,background-color] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 [&_svg]:shrink-0";

const VARIANTS = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs shadow-black/5",
  success: "bg-green-600 text-primary-foreground hover:bg-green-700 shadow-xs shadow-black/5",
  outline:
    "bg-background text-accent-foreground border border-input hover:bg-accent shadow-xs shadow-black/5 [&_svg:not([class*=text-]):not([class*=opacity-])]:opacity-60",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-xs shadow-black/5",
  ghost: "text-accent-foreground hover:bg-accent hover:text-accent-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs shadow-black/5",
  link: "text-primary hover:underline underline-offset-4 !px-0 !h-auto",
} as const;

const SIZES = {
  default: "h-8.5 rounded-md px-3 gap-1.5 text-2sm [&_svg:not([class*=size-])]:size-4",
  md: "h-8 rounded-md px-3 gap-1.5 text-xs [&_svg:not([class*=size-])]:size-3.5",
  sm: "h-7 rounded-md px-2.5 gap-1.25 text-xs [&_svg:not([class*=size-])]:size-3.5",
  icon: "size-8.5 p-0 rounded-md [&_svg:not([class*=size-])]:size-4",
  "icon-sm": "size-7 p-0 rounded-md [&_svg:not([class*=size-])]:size-3.5",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

/** Classes for a Button-looking element that isn't a <button> (e.g. a router <Link>). */
export function buttonVariants({ variant = "outline", size = "default" }: { variant?: ButtonVariant; size?: ButtonSize } = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size]);
}
