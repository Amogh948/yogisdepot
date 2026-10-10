# FMCG Architecture Audit — Yogi's Depot

**Date:** 2026-10-03  
**Market target:** Canada (CAD, integer cents, GST/HST/PST/QST)  
**Stack:** TypeScript Express/Mongoose + React/Vite, TanStack Query, Zustand, Tailwind

## 1. Project structure

| Area | Path |
|------|------|
| Backend | `backend/src/` — models, services, controllers, routes, schemas |
| Frontend | `frontend/src/` — pages, components, services/api, hooks, store |
| API prefix | `/api/v1` (also mounted at root for production) |
| State | TanStack Query + Zustand guest cart |
| Styling | Tailwind (`yd-*` design tokens) |

## 2. Pre-change catalog model

- **Product** (`backend/src/models/Product.ts`): flat document — `sku`, `price`, `compareAtPrice`, `costPrice`, `stock`, string `brand`. No Brand collection, no variants, no SKU collection, no Pricing/Inventory/Warehouse.
- **Cart**: `{ productId, quantity }` only; prices not stored.
- **Order**: line snapshots with `unitPrice`/`totalPrice`; totals via `order.service.quote` using `PlatformSettings.taxRate` (flat).
- **Coupon**: server validation exists; currency messaging used ₹.
- **Auth**: JWT cookie; roles `admin` \| `vendor` \| `customer`; `requireVendor` attaches approved vendorId.
- **Admin product create**: no dedicated multi-step wizard; vendor product form only.
- **Payments**: Square (Canada / CAD) via pluggable `PaymentProvider` (historical note: previously Razorpay/INR).

## 3. Price / cart / order calculation sites

| Location | Role |
|----------|------|
| `order.service.quote` | Authoritative (pre-change): subtotal, coupon, shipping threshold, flat taxRate |
| `cart.service.getHydrated` | Line totals from `product.price` |
| `CheckoutPage.tsx` | Client-side 5% tax + ₹40/₹499 (must remove) |
| `CartPage.tsx` | Client-side ₹40/499 total |
| `FREE_DELIVERY_THRESHOLD` | Hard-coded 499 in frontend |

## 4. India-assumption inventory (classified)

### Class 1 — production behavior (must change)

- `DEFAULT_TAX_RATE` / `taxRate` as checkout tax authority
- `DEFAULT_SHIPPING_FEE=40`, `FREE_SHIPPING_THRESHOLD=499`
- Checkout/Cart client fee/tax math and `₹` display
- Address/Vendor defaults `country: "India"`
- SiteHeader “Deliver to Bengaluru”
- Legacy Razorpay `INR` / `+91` phone normalize (replaced by Square CAD)
- Coupon error `₹…`
- `en-IN` locale on orders

### Class 2 — seed / tests

- `seed.ts` Pune/Bengaluru addresses → Canada addresses
- `order.pricing.test.ts` flat 0.05/40/499 → cents + Canadian tax
- `ProductCard.test.tsx` expects `₹49`

### Class 3 — documentation

- None prior; this audit + `FMCG_ARCHITECTURE.md` + implementation summary

### Class 4 — leave alone

- “Taste India” / regional pantry merchandising (product assortment branding)
- Tailwind `rgba(..., 0.05)` opacity
- lockfile noise

**Not found:** CGST, SGST, IGST, GSTIN, HSN, `BLR-WH-01`

## 5. Gaps vs target architecture

Brand → Product → Variant → SKU → Pricing / Inventory / Batch / TaxCategory  
CanadianTaxRate (versioned) + `canadianTax.service`  
Warehouse (`YYZ-WH-01`) + reservation lifecycle  
Scratch campaigns  
Platform/handling/small-cart fees in cents  
`checkoutPricing.service` single source of truth  
Order immutable money + tax snapshots  
Admin Steps 1–7 product wizard  

## 6. Implementation principles

- Incremental refactor; preserve auth and historical orders
- Backend source of truth for price, tax, fees, inventory, scratch, coupons
- Integer CAD cents + basis-point tax math only on authoritative paths
- Do not rewrite historical order totals when tax/catalog changes
