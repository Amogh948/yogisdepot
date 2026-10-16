import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { mediaUrl } from "../../types";

const AUTOPLAY_MS = 4000;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.5;

function clampPan(
  x: number,
  y: number,
  zoom: number,
  width: number,
  height: number,
) {
  if (zoom <= ZOOM_MIN || !width || !height) return { x: 0, y: 0 };
  const maxX = (width * (zoom - 1)) / 2;
  const maxY = (height * (zoom - 1)) / 2;
  return {
    x: Math.min(Math.max(x, -maxX), maxX),
    y: Math.min(Math.max(y, -maxY), maxY),
  };
}

export function ProductImageGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const slides = images.filter(Boolean);
  const zoomed = zoom > ZOOM_MIN;
  const slideKey = slides.join("|");

  const resetZoom = () => {
    setZoom(ZOOM_MIN);
    setPan({ x: 0, y: 0 });
    setDragging(false);
    dragRef.current = null;
  };

  const stageSize = () => {
    const el = stageRef.current;
    return { width: el?.clientWidth ?? 0, height: el?.clientHeight ?? 0 };
  };

  const adjustZoom = (delta: number) => {
    const { width, height } = stageSize();
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number((zoom + delta).toFixed(1))));
    setZoom(next);
    setPan((prev) => clampPan(prev.x, prev.y, next, width, height));
  };

  useEffect(() => {
    setActive(0);
    resetZoom();
    trackRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [slideKey]);

  useEffect(() => {
    resetZoom();
  }, [active]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || zoomed) return;

    const onScroll = () => {
      const width = el.clientWidth;
      if (!width) return;
      const next = Math.round(el.scrollLeft / width);
      setActive(Math.min(Math.max(next, 0), Math.max(slides.length - 1, 0)));
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [slides.length, zoomed]);

  const goTo = (index: number, behavior: ScrollBehavior = "smooth") => {
    const el = trackRef.current;
    if (!el || !slides.length) return;
    const total = slides.length;
    const next = ((index % total) + total) % total;
    el.scrollTo({ left: next * el.clientWidth, behavior });
    setActive(next);
  };

  useEffect(() => {
    if (!isDesktop || paused || zoomed || slides.length <= 1) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const timer = window.setInterval(() => {
      const el = trackRef.current;
      if (!el) return;
      const width = el.clientWidth || 1;
      const current = Math.round(el.scrollLeft / width);
      const next = (current + 1) % slides.length;
      el.scrollTo({ left: next * width, behavior: "smooth" });
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [isDesktop, paused, zoomed, slides.length]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!zoomed) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !zoomed) return;
    const { width, height } = stageSize();
    setPan(
      clampPan(
        drag.originX + (event.clientX - drag.startX),
        drag.originY + (event.clientY - drag.startY),
        zoom,
        width,
        height,
      ),
    );
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  };

  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (!el) return;
    if (zoomed) {
      resetZoom();
      return;
    }
    const rect = el.getBoundingClientRect();
    const offsetX = event.clientX - rect.left - rect.width / 2;
    const offsetY = event.clientY - rect.top - rect.height / 2;
    const nextZoom = 2;
    setZoom(nextZoom);
    setPan(
      clampPan(
        -offsetX * (nextZoom - 1),
        -offsetY * (nextZoom - 1),
        nextZoom,
        rect.width,
        rect.height,
      ),
    );
  };

  if (!slides.length) {
    return (
      <div className="aspect-square overflow-hidden rounded-card border border-yd-border bg-yd-cream" />
    );
  }

  return (
    <div>
      <div
        ref={stageRef}
        className="relative overflow-hidden rounded-card border border-yd-border bg-yd-cream"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        aria-roledescription="carousel"
        aria-label={`${alt} image gallery`}
      >
        <div
          ref={trackRef}
          className={`flex aspect-square snap-x snap-mandatory no-scrollbar ${
            zoomed ? "overflow-hidden touch-none" : "overflow-x-auto scroll-smooth touch-pan-x"
          } ${zoomed ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={onDoubleClick}
        >
          {slides.map((src, index) => (
            <div
              key={`${src}-${index}`}
              className="h-full w-full shrink-0 snap-center snap-always overflow-hidden"
              aria-hidden={index !== active}
            >
              <img
                src={mediaUrl(src)}
                alt={index === 0 ? alt : `${alt} ${index + 1}`}
                className="h-full w-full object-cover select-none"
                draggable={false}
                style={
                  index === active
                    ? {
                        transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                        transformOrigin: "center center",
                        transition: dragging ? "none" : "transform 180ms ease-out",
                      }
                    : undefined
                }
              />
            </div>
          ))}
        </div>

        <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
          <button
            type="button"
            aria-label="Zoom in"
            disabled={zoom >= ZOOM_MAX}
            onClick={() => adjustZoom(ZOOM_STEP)}
            className="grid h-10 w-10 place-items-center rounded-full border border-yd-border bg-white/95 text-yd-ink shadow-soft transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            disabled={zoom <= ZOOM_MIN}
            onClick={() => adjustZoom(-ZOOM_STEP)}
            className="grid h-10 w-10 place-items-center rounded-full border border-yd-border bg-white/95 text-yd-ink shadow-soft transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
        </div>

        {zoomed ? (
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
            {zoom.toFixed(1)}×
          </span>
        ) : null}

        {slides.length > 1 && !zoomed ? (
          <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {slides.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 w-1.5 rounded-full transition ${
                  index === active ? "bg-white shadow-soft" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>

      {slides.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {slides.map((src, index) => (
            <button
              key={`thumb-${src}-${index}`}
              type="button"
              aria-label={`Show image ${index + 1}`}
              aria-current={index === active}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border ${
                index === active ? "border-yd-green ring-2 ring-yd-green/30" : "border-yd-border"
              }`}
              onClick={() => goTo(index)}
            >
              <img src={mediaUrl(src)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
