import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { BrandLogo } from "../brand/BrandLogo";

const sections = [
  {
    title: "Shop",
    links: [
      { to: "/products", label: "All products" },
      { to: "/categories", label: "Categories" },
      { to: "/offers", label: "Offers" },
      { to: "/gifts", label: "Gift hampers" },
    ],
  },
  {
    title: "Discover",
    links: [
      { to: "/discover/regions", label: "Taste India" },
      { to: "/festival", label: "Festival store" },
      { to: "/brands", label: "Brands" },
    ],
  },
  {
    title: "Help",
    links: [
      { to: "/help", label: "Help centre" },
      { to: "/orders", label: "Track order" },
      { to: "/vendors/apply", label: "Sell with us" },
    ],
  },
];

function AccordionSection({ title, links }: { title: string; links: Array<{ to: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-yd-border lg:border-0">
      <button
        type="button"
        className="flex w-full items-center justify-between py-3 text-left font-semibold lg:pointer-events-none lg:py-0"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {title}
        <ChevronDown className={`h-4 w-4 text-yd-muted transition lg:hidden ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`space-y-2 pb-3 text-sm text-yd-muted lg:mt-3 lg:block lg:pb-0 ${open ? "block" : "hidden"}`}>
        {links.map((link) => (
          <Link key={link.to} className="block hover:text-yd-green" to={link.to}>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-yd-border bg-white px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-8 lg:px-8 lg:pb-12">
      <div className="mx-auto grid w-full max-w-store gap-2 lg:grid-cols-4 lg:gap-8">
        <div className="pb-4 lg:pb-0">
          <BrandLogo imgClassName="h-[4.5rem] w-auto lg:h-20" />
          <p className="mt-2 text-sm font-medium text-yd-saffron">Good food. Happier homes.</p>
          <p className="mt-2 text-sm text-yd-muted">Everyday Indian favourites from trusted kitchens across India.</p>
        </div>
        {sections.map((section) => (
          <AccordionSection key={section.title} title={section.title} links={section.links} />
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-store text-xs text-yd-muted">© {new Date().getFullYear()} Yogi&apos;s Depot. All rights reserved.</p>
    </footer>
  );
}
