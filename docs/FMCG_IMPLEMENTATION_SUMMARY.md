# FMCG Implementation Summary

## Files created

### Docs
- `docs/FMCG_ARCHITECTURE_AUDIT.md`
- `docs/FMCG_ARCHITECTURE.md`
- `docs/FMCG_IMPLEMENTATION_SUMMARY.md`

### Backend models
- `Counter`, `Brand`, `TaxCategory`, `CanadianTaxRate`, `Warehouse`, `Sku`, `Pricing`, `Inventory`, `InventoryBatch`, `InventoryReservation`, `ScratchCampaign`, `UserScratchReward`

### Backend services / utils
- `utils/money.ts` (+ tests)
- `utils/businessIds.ts`
- `services/tax/canadianTax.service.ts` (+ tests)
- `services/checkout/checkoutPricing.service.ts`
- `services/inventory/inventoryReservation.service.ts`
- `services/catalog/skuOffer.service.ts`
- `services/catalog/catalogAdmin.service.ts`
- `services/scratch/scratch.service.ts`

### Backend API / scripts
- `controllers/fmcg/fmcg.controller.ts`
- `controllers/scratch/scratch.controller.ts`
- `routes/scratch.routes.ts`
- `scripts/seedCanadianTaxRates.ts`
- `scripts/migrateProductsToFmcg.ts` (`npm run migrate:fmcg`)

### Frontend
- `utils/money.ts` (`formatCad` / `formatCadFromCents`)
- Admin product wizard (`AdminProductWizardPage`)
- Offers scratch panel

## Files modified (high level)

- Product / Cart / Order / Coupon / PlatformSettings / Address / Vendor models
- `order.service`, `cart.service`, `coupon.service`, `product.service`, payments Razorpay (CAD)
- Admin routes, product controller (public offers, strip cost)
- Constants (CAD fee defaults, `YYZ-WH-01`)
- Seed addresses → Canada
- Checkout/Cart/Account/Header/Admin settings → CAD + server quote
- Discovery Offers → scratch UI

## Models created/modified

| Model | Change |
|-------|--------|
| Product | FMCG fields, embedded variants, legacy dual-read |
| Sku / Pricing / Inventory* | New |
| CanadianTaxRate / TaxCategory | New (Canada) |
| Order | Cents totals + taxSnapshot |
| Cart | skuId + productId dual-read |
| PlatformSettings | Fee cents; taxRate deprecated for checkout |

## APIs created/modified

- `POST /admin/products/wizard`, brands, tax-categories, tax-rates, warehouses, skus, inventory, batches, pricing, scratch-campaigns
- `POST /scratch/scratch`, `GET /scratch/rewards`, `GET /scratch/campaign`
- Cart accepts `skuId` or `productId`
- Orders quote accepts `addressId`, `scratchRewardId`; create stores snapshots
- Public products return offers + CAD fields; no cost price

## UI changes

- CAD formatting across storefront/admin/vendor
- Checkout uses server quote (tax by shipping province)
- Cart no longer hardcodes ₹40/499 tax math
- Admin Steps 1–7 wizard + CAD fee settings
- Offers scratch card (server-authoritative)

## Migration requirements

```bash
cd backend
npm run migrate:fmcg
```

Run after deploy/seed. Idempotent. Existing historical orders are not rewritten.

## Indexes added

- Product: productCode, brandId, status, variants.variantCode
- Sku: skuCode unique, barcode sparse unique, productId, vendorId
- Inventory: skuId+warehouseId unique
- Order: orderNumber, customerId+createdAt, status (existing retained)
- UserScratchReward: code unique, userId+status+expiry, userId+campaignId unique
- CanadianTaxRate: province+component+effectiveFrom

## Tests added/updated

- `money.test.ts`
- `canadianTax.service.test.ts`
- `order.pricing.test.ts` (cents assembly)
- Frontend `ProductCard.test.tsx` expects CAD

## Assumptions

- Razorpay currency set to CAD; if the Razorpay account cannot settle CAD, swap payment provider later (interface preserved).
- Default warehouse `YYZ-WH-01` (Toronto).
- Seed/demo prices remain numeric dollars until migration builds Pricing in cents.
- “Taste India” merchandising copy intentionally retained (assortment branding).

## WooCommerce catalog import

- Scripts: `npm run import:fmcg:audit`, `npm run import:fmcg`
- Source CSV: `backend/data/wc-product-export-*.csv`
- Idempotent via `Product.source.{system,sourceId}`; SKUs `SKU-YD-{sourceId}`
- Requires `--source-currency=CAD`; prices → integer cents; `costPriceCents=0`
- Warehouse `YYZ-WH-01`; InventoryBatch skipped (no source batch data)

## Remaining TODOs

- Admin UIs for tax-rate versioning / warehouses / batches beyond API + settings fees
- Full multi-variant picker UX on PDP (offers array is returned)
- Guest cart `skuId` persistence
- Optional FEFO deduction from InventoryBatch on sale
- Dedicated CAD payment provider if Razorpay CAD is unavailable in production
