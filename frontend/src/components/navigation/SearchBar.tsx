import { FormEvent, useState } from "react";
import { Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TRENDING_SEARCHES } from "../../content/navigation";

const RECENTS_KEY = "yd_recent_searches";

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
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const suggestions = getRecentSearches();

  const go = (q: string) => {
    const next = q.trim();
    if (!next) return;
    saveRecent(next);
    navigate(`/search?q=${encodeURIComponent(next)}`);
    setOpen(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    go(value);
  };

  const height = size === "lg" ? "h-12" : "h-11";

  return (
    <form onSubmit={submit} className="relative w-full">
      <label className="sr-only" htmlFor="site-search">
        Search products
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-yd-muted" />
      <input
        id="site-search"
        value={value}
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className={`${height} w-full rounded-full border border-yd-border bg-white pl-10 pr-10 text-sm text-yd-ink outline-none ring-yd-green/40 placeholder:text-yd-muted focus:ring-2`}
      />
      {value ? (
        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 touch-target grid place-items-center" aria-label="Clear search" onClick={() => setValue("")}>
          <X className="h-4 w-4 text-yd-muted" />
        </button>
      ) : null}
      {open ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-card border border-yd-border bg-white p-2 shadow-card">
          {suggestions.length > 0 ? (
            <div className="mb-2">
              <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-yd-muted">Recent</p>
              <ul>
                {suggestions.map((item) => (
                  <li key={item}>
                    <button type="button" className="w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-yd-bg" onMouseDown={() => go(item)}>
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-yd-muted">Trending</p>
          <ul>
            {TRENDING_SEARCHES.map((item) => (
              <li key={item}>
                <button type="button" className="w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-yd-bg" onMouseDown={() => go(item)}>
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
