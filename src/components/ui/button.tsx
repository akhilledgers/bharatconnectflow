import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "./button-variants";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "outline", size = "default", className, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
