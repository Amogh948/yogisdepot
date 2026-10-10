import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { rememberCartPointer, useCartUiStore } from "../../store/cartUi.store";

const PARTICLE_COLORS = ["#287A43", "#183C2B", "#D85B0B", "#E87516", "#B94E27", "#F3E7D3"];
const BURST_MS = 720;
const CONFIRM_MS = 1700;
const PARTICLES_PER_BURST = 12;

type ParticleShape = "circle" | "strip" | "spark";

interface Particle {
  key: string;
  color: string;
  dx: number;
  dy: number;
  rot: number;
  delay: number;
  size: number;
  shape: ParticleShape;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function buildParticles(burstId: number, reduced: boolean): Particle[] {
  if (reduced) return [];
  const count = PARTICLES_PER_BURST;
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count + (index % 3) * 0.2;
    const distance = 36 + (index % 5) * 14;
    const shape: ParticleShape = index % 5 === 0 ? "spark" : index % 3 === 0 ? "strip" : "circle";
    return {
      key: `${burstId}-${index}`,
      color: PARTICLE_COLORS[index % PARTICLE_COLORS.length],
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance * 0.85 + 18 + (index % 4) * 6,
      rot: (index % 2 === 0 ? 1 : -1) * (120 + index * 18),
      delay: (index % 4) * 18,
      size: shape === "strip" ? 3 : shape === "spark" ? 5 : 4 + (index % 3),
      shape,
    };
  });
}

function Burst({ id, x, y }: { id: number; x: number; y: number }) {
  const reduced = prefersReducedMotion();
  const particles = useMemo(() => buildParticles(id, reduced), [id, reduced]);
  const clearBurst = useCartUiStore((s) => s.clearBurst);

  useEffect(() => {
    const timer = window.setTimeout(() => clearBurst(id), BURST_MS);
    return () => window.clearTimeout(timer);
  }, [clearBurst, id]);

  if (reduced || particles.length === 0) return null;

  return (
    <div className="yd-cart-burst" style={{ left: x, top: y }} aria-hidden>
      {particles.map((particle) => (
        <span
          key={particle.key}
          className={`yd-cart-particle yd-cart-particle--${particle.shape}`}
          style={
            {
              "--dx": `${particle.dx}px`,
              "--dy": `${particle.dy}px`,
              "--rot": `${particle.rot}deg`,
              "--delay": `${particle.delay}ms`,
              "--size": `${particle.size}px`,
              backgroundColor: particle.color,
              color: particle.color,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function AddToCartCelebration() {
  const bursts = useCartUiStore((s) => s.bursts);
  const confirmation = useCartUiStore((s) => s.confirmation);
  const clearConfirmation = useCartUiStore((s) => s.clearConfirmation);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      rememberCartPointer(event.clientX, event.clientY);
    };
    document.addEventListener("pointerdown", onPointer, { passive: true });
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  useEffect(() => {
    if (!confirmation) return;
    const timer = window.setTimeout(() => clearConfirmation(confirmation.id), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [clearConfirmation, confirmation]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden" aria-hidden>
        {bursts.map((burst) => (
          <Burst key={burst.id} id={burst.id} x={burst.x} y={burst.y} />
        ))}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(7.5rem+env(safe-area-inset-bottom))] z-[85] flex justify-center px-4 lg:bottom-24">
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {confirmation?.message ?? ""}
        </div>
        {confirmation ? (
          <div
            key={confirmation.id}
            className="yd-cart-confirm inline-flex items-center gap-1.5 rounded-full bg-yd-forest px-3.5 py-2 text-sm font-semibold text-white shadow-card"
          >
            <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
            {confirmation.message}
          </div>
        ) : null}
      </div>
    </>,
    document.body,
  );
}
