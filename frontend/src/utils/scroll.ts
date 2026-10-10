/** Scroll the window to the top, respecting prefers-reduced-motion. */
export function scrollToTop(behavior: ScrollBehavior = "smooth"): void {
  if (typeof window === "undefined") return;
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, left: 0, behavior: reduced ? "auto" : behavior });
}
