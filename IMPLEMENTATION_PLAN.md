# Yogi's Depot — Implementation Plan

Production-oriented multi-vendor food marketplace. Backend and frontend are independently runnable. API prefix: `/api/v1`.

## Architecture

- **Backend:** Node.js, Express, TypeScript (strict), MongoDB/Mongoose, JWT (HttpOnly cookie), bcryptjs, Zod, Helmet, CORS, rate limiting.
- **Frontend:** React, TypeScript, Vite, React Router, Axios (`withCredentials`), TanStack Query, Zustand, Tailwind CSS, React Hook Form, Zod, Lucide.
- **Layering:** Controller → Service → Model. Business logic never lives in routes or React components.
- **Payments v1:** Cash on Delivery + mock online provider behind `PaymentService`.
- **Images v1:** Local disk via `StorageService`; Cloudinary adapter selectable by env.
- **Auth:** JWT in HttpOnly cookie. Payload `{ userId, role }`. Never localStorage for tokens.

## Database models

| Model | Relationship notes |
|---|---|
| User | Auth identity; roles admin / vendor / customer |
| Vendor | One-to-one with User; pending until admin approval |
| Category | Self-referencing `parentId` for subcategories |
| Product | Belongs to vendor + category; optional food fields |
| Cart | One per user; items store productId + quantity only |
| Wishlist | Unique (userId, productId) |
| Address | Many per customer |
| Order | Snapshots line items; server-computed totals |
| Review | Verified purchase; unique (productId, customerId) |
| Coupon / CouponRedemption | Admin-managed; server-validated |
| Notification | Per-user inbox |
| InventoryTransaction | Stock audit trail |
| PlatformSettings | Singleton tax/shipping |
| TokenDenylist | Logout invalidation |

## API groups (`/api/v1`)

Auth, products, categories, cart, wishlist, addresses, orders, coupons, reviews, uploads, notifications, admin, vendor, analytics.

## Frontend routes

- Public: `/`, `/products`, `/products/:slug`, `/categories/:slug`, `/search`, `/login`, `/register`, `/vendors/apply`
- Customer: `/cart`, `/checkout`, `/orders`, `/orders/:id`, `/wishlist`, `/profile`, `/addresses`
- Vendor: `/vendor/*`
- Admin: `/admin/*`

## Phases

1. Foundation
2. Authentication
3. Admin + Vendor
4. Catalog
5. Customer shopping
6. Orders
7. Reviews + coupons
8. Analytics + notifications
9. UI polish
10. Security + production readiness

After every phase: TypeScript check + build, then continue.
