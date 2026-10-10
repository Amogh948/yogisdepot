import { Link, NavLink, Outlet } from "react-router-dom";
import { ReactNode, useState } from "react";
import { Menu, X } from "lucide-react";

export function DashboardShell({
  title,
  links,
  homeHref,
}: {
  title: string;
  homeHref: string;
  links: Array<{ to: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const nav = (
    <nav className="space-y-1">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `block rounded-xl px-3 py-2 text-sm font-medium ${isActive ? "bg-saffron-100 text-saffron-800" : "text-charcoal-800 hover:bg-cream-100"}`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-cream-50">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-cream-200 bg-white px-4 py-3 lg:hidden">
        <Link to={homeHref} className="font-display text-lg">
          {title}
        </Link>
        <button type="button" aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open ? (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden">
          <div className="h-full w-72 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-lg">{title}</p>
              <button type="button" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            <Link to="/" className="mt-6 block text-sm font-semibold text-saffron-700">
              Back to shop
            </Link>
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex max-w-7xl">
        <aside className="hidden w-60 shrink-0 border-r border-cream-200 bg-white p-4 lg:block">
          <Link to={homeHref} className="mb-6 block font-display text-2xl text-saffron-700">
            {title}
          </Link>
          {nav}
          <Link to="/" className="mt-8 block text-sm font-semibold text-saffron-700">
            Back to shop
          </Link>
        </aside>
        <main className="min-w-0 flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AdminLayout() {
  return (
    <DashboardShell
      title="Admin"
      homeHref="/admin/dashboard"
      links={[
        { to: "/admin/dashboard", label: "Dashboard" },
        { to: "/admin/vendors", label: "Vendors" },
        { to: "/admin/products", label: "Products" },
        { to: "/admin/merchandising", label: "Merchandising" },
        { to: "/admin/home-sections", label: "Home sections" },
        { to: "/admin/festivals", label: "Festivals" },
        { to: "/admin/brands", label: "Brands" },
        { to: "/admin/categories", label: "Categories" },
        { to: "/admin/orders", label: "Orders" },
        { to: "/admin/customers", label: "Customers" },
        { to: "/admin/coupons", label: "Coupons" },
        { to: "/admin/reviews", label: "Reviews" },
        { to: "/admin/analytics", label: "Analytics" },
        { to: "/admin/delivery-locations", label: "Delivery areas" },
        { to: "/admin/tax-rates", label: "Provincial taxes" },
        { to: "/admin/settings", label: "Settings" },
      ]}
    />
  );
}

export function VendorLayout() {
  return (
    <DashboardShell
      title="Vendor"
      homeHref="/vendor/dashboard"
      links={[
        { to: "/vendor/dashboard", label: "Dashboard" },
        { to: "/vendor/products", label: "Products" },
        { to: "/vendor/products/create", label: "Add product" },
        { to: "/vendor/orders", label: "Orders" },
        { to: "/vendor/inventory", label: "Inventory" },
        { to: "/vendor/analytics", label: "Analytics" },
        { to: "/vendor/profile", label: "Profile" },
      ]}
    />
  );
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-3xl">{title}</h1>
      {action}
    </div>
  );
}
