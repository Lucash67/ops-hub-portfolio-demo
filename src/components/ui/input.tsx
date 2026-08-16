import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./utils";

/**
 * No celular, fonte abaixo de 16px faz o iOS dar zoom automático ao focar o
 * campo — daí `text-base` até sm. A altura de 44px também é regra de toque.
 */
const FIELD_BASE =
  "flex h-11 w-full rounded-xl border border-surface-border bg-surface-elevated px-4 text-base text-text-primary transition-colors focus:border-brand-orange/50 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 sm:h-10 sm:text-sm";

/** Teclado numérico correto sem precisar repetir inputMode em cada campo. */
function numericKeyboard(
  type: InputHTMLAttributes<HTMLInputElement>["type"],
  step: InputHTMLAttributes<HTMLInputElement>["step"],
  inputMode: InputHTMLAttributes<HTMLInputElement>["inputMode"],
): InputHTMLAttributes<HTMLInputElement>["inputMode"] {
  if (inputMode) return inputMode;
  if (type !== "number") return undefined;
  const hasDecimals = step != null && step !== "1" && step !== 1;
  return hasDecimals ? "decimal" : "numeric";
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, type, step, inputMode, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <input
        id={id}
        ref={ref}
        type={type}
        step={step}
        inputMode={numericKeyboard(type, step, inputMode)}
        className={cn(
          FIELD_BASE,
          "py-2 placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-brand-red focus:border-brand-red focus:ring-brand-red/20",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-brand-red">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";

export const Select = forwardRef<
  HTMLSelectElement,
  InputHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }
>(({ className, label, error, id, children, ...props }, ref) => (
  <div className="space-y-1.5">
    {label && (
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
    )}
    <select
      id={id}
      ref={ref}
      className={cn(FIELD_BASE, "py-2", className)}
      {...props}
    >
      {children}
    </select>
    {error && <p className="text-xs text-brand-red">{error}</p>}
  </div>
));
Select.displayName = "Select";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  InputHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }
>(({ className, label, error, id, ...props }, ref) => (
  <div className="space-y-1.5">
    {label && (
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
    )}
    <textarea
      id={id}
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full resize-none rounded-xl border border-surface-border bg-surface-elevated px-4 py-3 text-base text-text-primary placeholder:text-text-muted transition-colors focus:border-brand-orange/50 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 sm:text-sm",
        className
      )}
      {...props}
    />
    {error && <p className="text-xs text-brand-red">{error}</p>}
  </div>
));
Textarea.displayName = "Textarea";
