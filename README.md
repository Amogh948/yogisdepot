# Yogi's Depot

A production-oriented multi-vendor food marketplace. Customers shop packaged foods, snacks, bakery, and groceries. Vendors manage their own catalog. Admins onboard vendors and run the platform.

The repository is split into two independently runnable apps:

```text
yogisdepot/
├── backend/     Express + MongoDB + TypeScript API
├── frontend/    React + Vite + TypeScript storefront
├── IMPLEMENTATION_PLAN.md
└── README.md
```

## Architecture

- **API prefix:** `/api/v1`
- **Auth:** JWT stored in an HttpOnly cookie (`yd_token`). Never stored in `localStorage`.
- **Roles:** `admin`, `vendor`, `customer`
- **Layering:** Controller → Service → Model. Business logic lives in services.
- **Payments v1:** Cash on Delivery + mock online provider behind `PaymentService`
- **Images v1:** Local disk via `StorageService` (`STORAGE_DRIVER=local`). Cloudinary adapter is selectable but not required.
- **Validation:** Zod on both backend and frontend
- **Server state:** TanStack Query. Auth/UI state: Zustand.

Vendor applications stay pending until an admin approves them. Approval sets `User.role` to `vendor` and vendor status to `active`.

## Prerequisites

- Node.js 20+
- A MongoDB connection string in `backend/.env` as `MONGODB_URI` (MongoDB Atlas recommended)

The API and seed script connect only to that URI. Docker is not required.

Include a database name in the path so data is not written to the default `test` database:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/yogisdepot?retryWrites=true&w=majority
```

## Environment

Copy the examples and fill in values. Never commit real secrets.

Backend (`backend/.env`):

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/yogisdepot?retryWrites=true&w=majority
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
COOKIE_SECURE=false
STORAGE_DRIVER=local
UPLOAD_DIR=uploads
```

Frontend (`frontend/.env`):

```env
VITE_API_URL=http://localhost:5000/api/v1
```

## Run locally

Terminal 1 — API:

```bash
cd backend
npm install
npm run dev
```

Terminal 2 — storefront:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### Seed development data

Seeds the database named in `MONGODB_URI` (the `yogisdepot` database on Atlas if you followed the example above).

```bash
cd backend
npm run seed
```

Development accounts (password `Password@123`) — documented here only, never shown in the UI:

| Role | Email |
|---|---|
| Admin | `admin@yogisdepot.local` |
| Vendor | `vendor@yogisdepot.local` |
| Vendor | `bakery@yogisdepot.local` |
| Customer | `customer@yogisdepot.local` |

Coupon codes: `FRESH10`, `WELCOME50`

## Scripts

Backend: `npm run dev` · `npm run build` · `npm run typecheck` · `npm run seed` · `npm test`

Frontend: `npm run dev` · `npm run build` · `npm run typecheck` · `npm test`

## Authentication flow

1. Register or login (`POST /api/v1/auth/register` / `login`)
2. API sets HttpOnly cookie
3. Frontend calls `GET /api/v1/auth/me` on bootstrap
4. Route guards (`ProtectedRoute`) hide admin/vendor areas
5. Backend middleware remains the source of truth for roles and vendor ownership

Logout clears the cookie and denylists the token `jti`.

## Main API groups

| Group | Base |
|---|---|
| Auth | `/api/v1/auth` |
| Products | `/api/v1/products` |
| Categories | `/api/v1/categories` |
| Cart | `/api/v1/cart` |
| Wishlist | `/api/v1/wishlist` |
| Addresses | `/api/v1/addresses` |
| Orders | `/api/v1/orders` |
| Reviews | `/api/v1/reviews` |
| Coupons | `/api/v1/coupons` |
| Notifications | `/api/v1/notifications` |
| Admin | `/api/v1/admin/*` |
| Vendors | `/api/v1/vendors/*` |

List endpoints return `{ success, message, data, pagination }`.

Checkout never trusts client prices. The order service reloads products, checks stock, applies coupons, tax, and shipping, then decrements inventory.

## Frontend routes

Public: `/` `/products` `/products/:slug` `/categories/:slug` `/search` `/login` `/register`

Customer: `/cart` `/checkout` `/orders` `/orders/:id` `/wishlist` `/profile` `/addresses` `/vendors/apply`

Vendor: `/vendor/*`

Admin: `/admin/*`

## Folder map

Backend domains live under `backend/src/{models,controllers,services,routes,schemas}`. Frontend is feature-oriented under `frontend/src/{pages,features-via-pages,components,services/api,store,hooks,layouts}`. Axios is used only inside `frontend/src/services/api`.

## Deployment notes

- Serve the API over HTTPS and set `COOKIE_SECURE=true` plus `SameSite=None` for cross-site cookies
- Set `CLIENT_URL` to the real frontend origin
- Use a MongoDB replica set in production
- Put object storage behind `STORAGE_DRIVER` when you leave local disk
- Replace `MockOnlineProvider` with Razorpay/Stripe using the existing `PaymentProvider` interface
- Keep `JWT_SECRET` long and unique
- Do not expose stack traces (`NODE_ENV=production`)
