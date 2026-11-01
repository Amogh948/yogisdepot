import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "../components/navigation/BottomNav";
import { DesktopHeader, MobileHeader } from "../components/navigation/SiteHeader";
import { SiteFooter } from "../components/navigation/SiteFooter";
import { ViewCartBar } from "../components/cart/ViewCartBar";
import { DeliveryCoverageNotice } from "../components/commerce/DeliveryCoverageNotice";

export function PublicLayout() {
  const location = useLocation();
  const hideSearch = location.pathname === "/search";

  return (
    <div className="relative w-full bg-yd-bg">
      <header className="sticky top-0 z-30 w-full border-b border-yd-border/80 bg-yd-bg backdrop-blur">
        <MobileHeader hideSearch={hideSearch} />
        <DesktopHeader hideSearch={hideSearch} />
        <DeliveryCoverageNotice className="border-t border-yd-saffron/30" />
      </header>

      <main className="mx-auto w-full max-w-store px-4 py-4 pb-28 lg:px-8 lg:pb-10">
        <Outlet />
      </main>

      <SiteFooter />
      <ViewCartBar />
      <BottomNav />
    </div>
  );
}
