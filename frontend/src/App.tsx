import { Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "./layouts/PublicLayout";
import { AdminLayout, VendorLayout } from "./layouts/DashboardLayout";
import { GuestRoute, ProtectedRoute } from "./routes/guards";
import { HomePage } from "./pages/public/HomePage";
import { ProductListingPage } from "./pages/public/ProductListingPage";
import { ProductDetailPage } from "./pages/public/ProductDetailPage";
import { CategoriesPage } from "./pages/public/CategoriesPage";
import { LoginPage, RegisterPage } from "./pages/public/AuthPages";
import {
  BrandDetailPage,
  BrandsPage,
  FestivalPage,
  GiftsPage,
  HelpPage,
  OffersPage,
  RegionDetailPage,
  RegionsPage,
} from "./pages/public/DiscoveryPages";
import { CartPage } from "./pages/customer/CartPage";
import { CheckoutPage } from "./pages/customer/CheckoutPage";
import { OrderSuccessPage } from "./pages/customer/OrderSuccessPage";
import { OrderDetailPage, OrdersPage } from "./pages/customer/OrdersPage";
import { AddressesPage, ProfilePage, VendorApplyPage, WishlistPage } from "./pages/customer/AccountPages";
import {
  AdminAnalyticsPage,
  AdminCategoriesPage,
  AdminCategoryDetailPage,
  AdminCouponsPage,
  AdminCustomersPage,
  AdminDashboardPage,
  AdminOrderDetailPage,
  AdminOrdersPage,
  AdminProductEditPage,
  AdminProductsPage,
  AdminProductWizardPage,
  AdminReviewsPage,
  AdminSettingsPage,
  AdminVendorDetailPage,
  AdminVendorsPage,
} from "./pages/admin/AdminPages";
import { AdminMerchandisingFormPage, AdminMerchandisingPage } from "./pages/admin/AdminMerchandisingPages";
import {
  AdminDeliveryLocationFormPage,
  AdminDeliveryLocationsPage,
} from "./pages/admin/AdminDeliveryLocationsPage";
import {
  VendorAnalyticsPage,
  VendorDashboardPage,
  VendorInventoryPage,
  VendorOrderDetailPage,
  VendorOrdersPage,
  VendorProductFormPage,
  VendorProductsPage,
  VendorProfilePage,
} from "./pages/vendor/VendorPages";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductListingPage mode="all" />} />
        <Route path="products/:slug" element={<ProductDetailPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="categories/:slug" element={<ProductListingPage mode="category" />} />
        <Route path="search" element={<ProductListingPage mode="search" />} />
        <Route path="offers" element={<OffersPage />} />
        <Route path="discover/regions" element={<RegionsPage />} />
        <Route path="discover/regions/:slug" element={<RegionDetailPage />} />
        <Route path="festival" element={<FestivalPage />} />
        <Route path="gifts" element={<GiftsPage />} />
        <Route path="brands" element={<BrandsPage />} />
        <Route path="brands/:slug" element={<BrandDetailPage />} />
        <Route path="help" element={<HelpPage />} />
        <Route path="account" element={<Navigate to="/profile" replace />} />
        <Route path="account/orders" element={<Navigate to="/orders" replace />} />
        <Route path="account/wishlist" element={<Navigate to="/wishlist" replace />} />
        <Route path="account/addresses" element={<Navigate to="/addresses" replace />} />
        <Route path="account/notifications" element={<Navigate to="/profile" replace />} />
        <Route path="account/payments" element={<Navigate to="/profile" replace />} />
        <Route element={<GuestRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={["customer", "admin", "vendor"]} />}>
          <Route path="cart" element={<CartPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="vendors/apply" element={<VendorApplyPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={["customer", "admin"]} />}>
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="order-success" element={<OrderSuccessPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="addresses" element={<AddressesPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["admin"]} />}>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="vendors" element={<AdminVendorsPage />} />
          <Route path="vendors/:id" element={<AdminVendorDetailPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="products/new" element={<AdminProductWizardPage />} />
          <Route path="products/:id/edit" element={<AdminProductEditPage />} />
          <Route path="merchandising" element={<AdminMerchandisingPage />} />
          <Route path="merchandising/new" element={<AdminMerchandisingFormPage />} />
          <Route path="merchandising/:id" element={<AdminMerchandisingFormPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="categories/:id" element={<AdminCategoryDetailPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="orders/:id" element={<AdminOrderDetailPage />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route path="coupons" element={<AdminCouponsPage />} />
          <Route path="reviews" element={<AdminReviewsPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="delivery-locations" element={<AdminDeliveryLocationsPage />} />
          <Route path="delivery-locations/new" element={<AdminDeliveryLocationFormPage />} />
          <Route path="delivery-locations/:id" element={<AdminDeliveryLocationFormPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["vendor"]} />}>
        <Route path="vendor" element={<VendorLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<VendorDashboardPage />} />
          <Route path="products" element={<VendorProductsPage />} />
          <Route path="products/create" element={<VendorProductFormPage />} />
          <Route path="products/:id/edit" element={<VendorProductFormPage />} />
          <Route path="orders" element={<VendorOrdersPage />} />
          <Route path="orders/:id" element={<VendorOrderDetailPage />} />
          <Route path="inventory" element={<VendorInventoryPage />} />
          <Route path="analytics" element={<VendorAnalyticsPage />} />
          <Route path="profile" element={<VendorProfilePage />} />
        </Route>
      </Route>
    </Routes>
  );
}
