import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";

// Recipes from components.md → Input / Select trigger / Checkbox / Form item.
const FIELD =
  "w-full bg-background border border-input shadow-xs shadow-black/5 transition-[color,box-shadow] text-foreground placeholder:text-muted-foreground/80 focus-visible:ring-ring/30 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-muted/80 read-only:cursor-not-allowed aria-invalid:border-destructive/60 aria-invalid:ring-destructive/10 rounded-md";


export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { inputSize?: "default" | "sm" }>(
  function Input({ className, inputSize = "default", ...props }, ref) {
    return (
      <input
        ref={ref}
        data-slot="input"
        className={cn(FIELD, "flex", inputSize === "sm" ? "h-7 px-2.5 text-xs" : "h-8.5 px-3 text-2sm", className)}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} data-slot="textarea" className={cn(FIELD, "resize-none px-2.5 py-2.5 text-xs", className)} {...props} />;
});

/** Native <select> styled as the DS select trigger. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { selectSize?: "default" | "sm"; wrapperClassName?: string }>(
  function Select({ className, wrapperClassName, selectSize = "default", children, ...props }, ref) {
    return (
      <div className={cn("relative", wrapperClassName)}>
        <select
          ref={ref}
          data-slot="select-trigger"
          className={cn(
            FIELD,
            "cursor-pointer appearance-none pe-8",
            selectSize === "sm" ? "h-7 ps-2.5 text-xs" : "h-8.5 ps-3 text-2sm",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 opacity-60" />
      </div>
    );
  },
);

/** Native checkbox with the DS look (blue fill when checked). */
export const Checkbox = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(function Checkbox(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "peer size-4.5 shrink-0 cursor-pointer rounded-md border border-input bg-background accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

export function Label({ required, className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label data-slot="form-label" className={cn("text-xs font-medium text-foreground", className)} {...props}>
      {children}
      {required && <span className="text-destructive"> *</span>}
    </label>
  );
}

export function FormItem({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex flex-col gap-2.5", className)}>{children}</div>;
}
