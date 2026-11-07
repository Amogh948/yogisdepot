import { FormEvent, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { productsApi } from "../../services/api/products.api";
import { entityId } from "../../types";
import { formatCad, formatCadFromCents } from "../../utils/money";
import { productImageUrl } from "../../utils/productImage";

const RECENTS_KEY = "yd_recent_searches";
const LIVE_SEARCH_MIN = 2;
const MOBILE_BREAKPOINT_PX = 1024;
/** Ignore focus→open for a beat after an intentional collapse (mobile keyboard / autofocus races). */
const SUPPRESS_OPEN_MS = 500;

export function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

function saveRecent(q: string) {
  const next = [q, ...getRecentSearches().filter((item) => item !== q)].slice(0, 6);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function dismissKeyboard(input: HTMLInputElement | null) {
  input?.blur();
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) {
    active.blur();
  }
}

export function SearchBar({
  autoFocus = false,
  size = "md",
  placeholder = "Search snacks, tea, spices, groceries…",
  initialQuery = "",
}: {
  autoFocus?: boolean;
  size?: "md" | "lg";
  placeholder?: string;
  /** Prefill from the URL without opening the suggestions panel. */
  initialQuery?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const suppressOpenUntil = useRef(0);
  const [value, setValue] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [mobilePanelTop, setMobilePanelTop] = useState<number | null>(null);
  const typedQuery = value.trim();
  const debouncedQuery = useDebouncedValue(typedQuery, 250);
  const liveQuery = debouncedQuery.length >= LIVE_SEARCH_MIN ? debouncedQuery : "";
  const showLiveResults = typedQuery.length >= LIVE_SEARCH_MIN;
  /** Only show the suggestions panel while the user is typing a query — never empty history/trending. */
  const panelOpen = open && showLiveResults;

  const liveSearch = useQuery({
    queryKey: ["products", "live-search", liveQuery],
    queryFn: () => productsApi.list({ search: liveQuery, limit: 8, sort: "popular" }),
    enabled: Boolean(liveQuery) && panelOpen,
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  });

  const products = liveQuery ? liveSearch.data?.items || [] : [];
  const searching = showLiveResults && (!liveQuery || liveSearch.isFetching);
  const priceLabel = (product: (typeof products)[number]) => {
    if (typeof product.sellingPriceCents === "number") return formatCadFromCents(product.sellingPriceCents);
    return formatCad(product.price);
  };

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  // When this SearchBar stays mounted across routes (header), close panel + keyboard on navigation.
  // Skip the first mount so intentional autoFocus on empty /search still works.
  const routeKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${location.pathname}?${location.search}`;
    if (routeKeyRef.current === null) {
      routeKeyRef.current = key;
      return;
    }
    if (routeKeyRef.current === key) return;
    routeKeyRef.current = key;
    suppressOpenUntil.current = Date.now() + SUPPRESS_OPEN_MS;
    setOpen(false);
    dismissKeyboard(inputRef.current);
  }, [location.pathname, location.search]);

  useLayoutEffect(() => {
    if (!panelOpen) {
      setMobilePanelTop(null);
      return;
    }
    const update = () => {
      const isMobile = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`).matches;
      if (!isMobile) {
        setMobilePanelTop(null);
        return;
      }
      const rect = inputRef.current?.getBoundingClientRect();
      setMobilePanelTop(rect ? Math.round(rect.bottom + 8) : null);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [panelOpen, value, products.length, searching]);

  const collapse = () => {
    suppressOpenUntil.current = Date.now() + SUPPRESS_OPEN_MS;
    setOpen(false);
    dismissKeyboard(inputRef.current);
  };

  const go = (q: string) => {
    const next = q.trim();
    if (!next) return;
    saveRecent(next);
    collapse();
    navigate(`/search?q=${encodeURIComponent(next)}`);
  };

  const goProduct = (slug: string, name: string) => {
    saveRecent(name);
    collapse();
    navigate(`/products/${slug}`);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    go(value);
  };

  const height = size === "lg" ? "h-12" : "h-11";

  return (
    <form onSubmit={submit} className="relative w-full" role="search">
      <label className="sr-only" htmlFor="site-search">
        Search products
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-yd-muted" />
      <input
        ref={inputRef}
        id="site-search"
        type="search"
        enterKeyHint="search"
        inputMode="search"
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={panelOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        onFocus={() => {
          if (Date.now() < suppressOpenUntil.current) {
            dismissKeyboard(inputRef.current);
            setOpen(false);
            return;
          }
          // Focus alone must not open local history — only reopen if a live query is already typed.
          setOpen(typedQuery.length >= LIVE_SEARCH_MIN);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 180);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          if (Date.now() < suppressOpenUntil.current) return;
          setOpen(next.trim().length >= LIVE_SEARCH_MIN);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            go(value);
          }
        }}
        placeholder={placeholder}
        className={`${height} w-full rounded-full border border-yd-border bg-white pl-10 pr-10 text-sm text-yd-ink outline-none ring-yd-green/40 placeholder:text-yd-muted focus:ring-2 [&::-webkit-search-cancel-button]:hidden`}
      />
      {value ? (
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 touch-target grid place-items-center"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            setOpen(false);
            inputRef.current?.focus();
          }}
        >
          <X className="h-4 w-4 text-yd-muted" />
        </button>
      ) : null}
      {panelOpen ? (
        <div
          id={listboxId}
          role="listbox"
          style={
            mobilePanelTop != null
              ? { top: mobilePanelTop, maxHeight: `calc(100dvh - ${mobilePanelTop}px - 0.75rem)` }
              : undefined
          }
          className={
            mobilePanelTop != null
              ? "fixed inset-x-0 z-50 overflow-y-auto border-y border-yd-border bg-white p-3 shadow-card"
              : "absolute z-30 mt-2 max-h-[min(70vh,28rem)] w-full overflow-y-auto rounded-card border border-yd-border bg-white p-2 shadow-card"
          }
        >
          <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-yd-muted">
            Products
          </p>
          {searching && !products.length ? (
            <p className="px-3 py-3 text-sm text-yd-muted">Searching…</p>
          ) : null}
          {products.length ? (
            <ul>
              {products.map((product) => {
                const src = productImageUrl(product);
                return (
                  <li key={entityId(product) || product.slug}>
                    <button
                      type="button"
                      role="option"
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-yd-bg"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        goProduct(product.slug, product.name);
                      }}
                    >
                      {src ? (
                        <img
                          src={src}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-lg bg-yd-cream object-cover"
                        />
                      ) : (
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-yd-cream text-xs text-yd-muted">
                          —
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-yd-ink">
                          {product.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-yd-muted">
                          {product.brand || "Yogi's Depot"} · {priceLabel(product)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {!searching && liveQuery && !products.length ? (
            <p className="px-3 py-3 text-sm text-yd-muted">No products match “{typedQuery}”.</p>
          ) : null}
          <button
            type="button"
            className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-yd-green hover:bg-yd-bg"
            onPointerDown={(event) => {
              event.preventDefault();
              go(typedQuery);
            }}
          >
            See all results for “{typedQuery}” →
          </button>
        </div>
      ) : null}
    </form>
  );
}
