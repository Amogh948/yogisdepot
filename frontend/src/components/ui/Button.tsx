import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary: "bg-yd-green text-white hover:bg-yd-green-dark",
    secondary: "bg-yd-forest text-white hover:bg-yd-forest/90",
    accent: "bg-yd-saffron text-white hover:bg-yd-terracotta",
    ghost: "bg-transparent text-yd-ink hover:bg-yd-cream",
    danger: "bg-yd-error text-white hover:bg-yd-error/90",
    outline: "border border-yd-border bg-white text-yd-ink hover:bg-yd-bg",
  };
  const sizes: Record<string, string> = {
    sm: "min-h-9 px-3 text-sm",
    md: "min-h-11 px-4 text-sm",
    lg: "min-h-12 px-5 text-base",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yd-green disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}
