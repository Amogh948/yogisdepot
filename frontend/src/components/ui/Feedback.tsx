import { ReactNode } from "react";
import { formatCad } from "../../utils/money";

export function Badge({
  children,
  tone = "saffron",
}: {
  children: ReactNode;
  tone?: "saffron" | "sage" | "red" | "muted" | "veg";
}) {
  const tones = {
    saffron: "bg-yd-saffron/15 text-yd-saffron",
    sage: "bg-yd-green/15 text-yd-green",
    veg: "bg-yd-green/15 text-yd-green",
    red: "bg-yd-error/10 text-yd-error",
    muted: "bg-yd-cream text-yd-muted",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-yd-border/80 bg-white p-4 shadow-soft ${className}`}>{children}</div>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-yd-border bg-white px-6 py-12 text-center">
      <h3 className="font-display text-xl text-yd-forest">{title}</h3>
      <p className="mt-2 text-sm text-yd-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="rounded-card bg-yd-error/10 px-6 py-8 text-center text-yd-error">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1 text-sm opacity-80">{message || "Please try again."}</p>
      {retry ? (
        <button className="mt-3 min-h-11 font-semibold underline" onClick={retry} type="button">
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-yd-cream ${className}`} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-yd-border/60 bg-white">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex justify-between pt-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function Price({ price, compareAt }: { price: number; compareAt?: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-base font-semibold text-yd-ink">{formatCad(price)}</span>
      {compareAt && compareAt > price ? (
        <span className="text-xs text-yd-muted line-through">{formatCad(compareAt)}</span>
      ) : null}
    </div>
  );
}

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <p className="text-xs text-yd-muted">
      <span className="font-semibold text-yd-green">{value.toFixed(1)}</span> ★{count !== undefined ? ` · ${count}` : ""}
    </p>
  );
}

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  size = "md",
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const compact = size === "sm";
  return (
    <div
      className={
        compact
          ? "inline-flex h-9 items-center rounded-full bg-yd-green text-white"
          : "inline-flex h-11 items-center rounded-full border border-yd-border bg-white"
      }
    >
      <button
        type="button"
        className={compact ? "h-9 w-8 text-lg leading-none" : "h-11 w-11"}
        aria-label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className={compact ? "min-w-5 text-center text-sm font-semibold" : "w-8 text-center text-sm font-semibold"} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={compact ? "h-9 w-8 text-lg leading-none" : "h-11 w-11"}
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 py-6">
      <button className="min-h-11 px-3 text-sm font-semibold disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)} type="button">
        Previous
      </button>
      <span className="text-sm text-yd-muted">
        {page} / {totalPages}
      </span>
      <button className="min-h-11 px-3 text-sm font-semibold disabled:opacity-40" disabled={page >= totalPages} onClick={() => onPage(page + 1)} type="button">
        Next
      </button>
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex min-w-0 items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-[22px] leading-tight text-yd-forest lg:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-yd-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
