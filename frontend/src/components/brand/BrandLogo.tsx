import { Link } from "react-router-dom";

/** Transparent-bg logo so it blends with cream header and white footer. */
export const BRAND_LOGO_SRC = "/brand/yogis-depot-logo.png";

export function BrandLogo({
  to = "/",
  className = "",
  imgClassName = "",
  onClick,
}: {
  to?: string;
  className?: string;
  imgClassName?: string;
  onClick?: (event: React.MouseEvent | React.PointerEvent) => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center touch-manipulation select-none ${className}`}
      aria-label="Yogi's Depot home"
    >
      <img
        src={BRAND_LOGO_SRC}
        alt="Yogi's Depot"
        className={`h-[4.5rem] w-auto object-contain lg:h-24 ${imgClassName}`}
        width={280}
        height={280}
        decoding="async"
      />
    </Link>
  );
}
