import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, forwardRef } from "react";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    const inputId = id || label.replace(/\s+/g, "-").toLowerCase();
    return (
      <label className="block space-y-1.5" htmlFor={inputId}>
        <span className="text-sm font-medium text-yd-ink">{label}</span>
        <input
          ref={ref}
          id={inputId}
          className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none ring-yd-green/40 focus:ring-2 ${error ? "border-yd-error" : "border-yd-border"} ${className}`}
          {...props}
        />
        {hint && !error ? <span className="text-xs text-yd-muted">{hint}</span> : null}
        {error ? <span className="text-xs text-yd-error">{error}</span> : null}
      </label>
    );
  },
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    const inputId = id || label.replace(/\s+/g, "-").toLowerCase();
    return (
      <label className="block space-y-1.5" htmlFor={inputId}>
        <span className="text-sm font-medium text-yd-ink">{label}</span>
        <textarea
          ref={ref}
          id={inputId}
          className={`min-h-28 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none ring-yd-green/40 focus:ring-2 ${error ? "border-yd-error" : "border-yd-border"} ${className}`}
          {...props}
        />
        {hint && !error ? <span className="text-xs text-yd-muted">{hint}</span> : null}
        {error ? <span className="text-xs text-yd-error">{error}</span> : null}
      </label>
    );
  },
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(
  ({ label, error, id, children, ...props }, ref) => {
    const inputId = id || label.replace(/\s+/g, "-").toLowerCase();
    return (
      <label className="block space-y-1.5" htmlFor={inputId}>
        <span className="text-sm font-medium text-yd-ink">{label}</span>
        <select
          ref={ref}
          id={inputId}
          className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none ring-yd-green/40 focus:ring-2 ${error ? "border-yd-error" : "border-yd-border"}`}
          {...props}
        >
          {children}
        </select>
        {error ? <span className="text-xs text-yd-error">{error}</span> : null}
      </label>
    );
  },
);
Select.displayName = "Select";
