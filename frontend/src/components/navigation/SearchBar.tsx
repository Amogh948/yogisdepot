import { FormEvent, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TRENDING_SEARCHES } from "../../content/navigation";
import { productsApi } from "../../services/api/products.api";
import { entityId } from "../../types";
import { formatCad, formatCadFromCents } from "../../utils/money";
import { productImageUrl } from "../../utils/productImage";

const RECENTS_KEY = "yd_recent_searches";
const LIVE_SEARCH_MIN = 2;
const MOBILE_BREAKPOINT_PX = 1024;

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

export function SearchBar({
  autoFocus = false,
  size = "md",
  placeholder = "Search snacks, tea, spices, groceries…",
}: {
  autoFocus?: boolean;
  size?: "md" | "lg";
  placeholder?: string;
}) {
  const navigate = useNavigate();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [mobilePanelTop, setMobilePanelTop] = useState<number | null>(null);
  const typedQuery = value.trim();
  const debouncedQuery = useDebouncedValue(typedQuery, 250);
  const liveQuery = debouncedQuery.length >= LIVE_SEARCH_MIN ? debouncedQuery : "";
  const showLiveResults = typedQuery.length >= LIVE_SEARCH_MIN;
  const suggestions = getRecentSearches();

  const liveSearch = useQuery({
    queryKey: ["products", "live-search", liveQuery],
    queryFn: () => productsApi.list({ search: liveQuery, limit: 8, sort: "popular" }),
    enabled: Boolean(liveQuery) && open,
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  });

  const products = liveQuery ? liveSearch.data?.items || [] : [];
  const searching = showLiveResults && (!liveQuery || liveSearch.isFetching);
  const priceLabel = (product: (typeof products)[number]) => {
    if (typeof product.sellingPriceCents === "number") return formatCadFromCents(product.sellingPriceCents);
    return formatCad(product.price);
  };

  useLayoutEffect(() => {
    if (!open) {
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
  }, [open, value, products.length, searching]);

  const go = (q: string) => {
    const next = q.trim();
    if (!next) return;
    saveRecent(next);
    navigate(`/search?q=${encodeURIComponent(next)}`);
    setOpen(false);
  };

  const goProduct = (slug: string, name: string) => {
    saveRecent(name);
    navigate(`/products/${slug}`);
    setOpen(false);
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
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 180)}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        className={`${height} w-full rounded-full border border-yd-border bg-white pl-10 pr-10 text-sm text-yd-ink outline-none ring-yd-green/40 placeholder:text-yd-muted focus:ring-2`}
      />
      {value ? (
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 touch-target grid place-items-center"
          aria-label="Clear search"
          onClick={() => setValue("")}
        >
          <X className="h-4 w-4 text-yd-muted" />
        </button>
      ) : null}
      {open ? (
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
          {showLiveResults ? (
            <div>
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
                          onMouseDown={(event) => {
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
                onMouseDown={(event) => {
                  event.preventDefault();
                  go(typedQuery);
                }}
              >
                See all results for “{typedQuery}” →
              </button>
            </div>
          ) : (
            <>
              {suggestions.length > 0 ? (
                <div className="mb-2">
                  <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-yd-muted">
                    Recent
                  </p>
                  <ul>
                    {suggestions.map((item) => (
                      <li key={item}>
                        <button
                          type="button"
                          className="w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-yd-bg"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            go(item);
                          }}
                        >
                          {item}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-yd-muted">
                Trending
              </p>
              <ul>
                {TRENDING_SEARCHES.map((item) => (
                  <li key={item}>
                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-yd-bg"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        go(item);
                      }}
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
              {typedQuery.length > 0 && typedQuery.length < LIVE_SEARCH_MIN ? (
                <p className="mt-1 px-3 py-2 text-xs text-yd-muted">
                  Type at least {LIVE_SEARCH_MIN} characters to see products
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </form>
  );
}
