# FMCG Architecture (Canada / CAD)

## Market

- Customer market: **Canada**
- Currency: **CAD**
- Authoritative money: **integer cents**
- Tax: versioned **GST / HST / PST / QST** by province + transaction date
- No Indian GST (CGST/SGST/IGST), INR, or ₹ on authoritative paths

## Collection structure

```text
Brand
  └── Product (embedded variants[])
        └── Sku (productId, variantId, vendorId)
              ├── Pricing (CAD cents, effective windows)
              ├── Inventory (skuId + warehouseId)
              │     └── InventoryBatch (FEFO-ready via expiryDate)
              └── TaxCategory (TAXABLE | ZERO_RATED | EXEMPT)

CanadianTaxRate (versioned rows: province, component, rateBps, effectiveFrom/To)

Warehouse (default YYZ-WH-01)

Cart.items: { skuId?, productId?, quantity }
Order: immutable money + taxSnapshot

ScratchCampaign → UserScratchReward
Coupon
PlatformSettings (fees in cents; taxRate deprecated for checkout)
```

## Relationships

- Every SKU stores `productId`, `variantId`, `vendorId`.
- Backend verifies the variant belongs to the product before create.
- Vendor mutations derive vendor identity from the session — never from the request body.

## Pricing flow

1. Active `Pricing` for SKU at transaction time (effective window).
2. Public APIs expose MRP / selling / discount — never `costPriceCents`.
3. Cart/checkout never trust client prices.

## Checkout flow

`checkoutPricing.service` is the single source of truth:

```text
subtotal
− productDiscount (display; already in selling price lines)
− scratchDiscount
− couponDiscount
+ deliveryFee
+ platformFee
+ handlingFee
+ smallCartFee
+ tax
= total
```

All amounts in CAD cents. Quote validates availability but **does not** permanently deduct inventory.

## Canadian tax strategy

- `canadianTax.service` is the only authoritative tax calculator.
- Rates loaded from `CanadianTaxRate` where  
  `effectiveFrom <= txnDate` and (`effectiveTo` null or `txnDate < effectiveTo`) and `isActive`.
- Do not “pick latest” without effective windows.
- Jurisdiction from **shipping address** province, not IP/device.
- Orders store immutable `taxSnapshot` (jurisdiction, components, rates, amounts).

## Inventory / reservation

```text
AVAILABLE → RESERVED → SOLD
RESERVED → RELEASED / EXPIRED
```

Atomic Mongo `$inc` with quantity predicates. Quote ≠ reserve.

## Scratch-card flow

1. Client requests scratch (optional campaign id).
2. Server selects reward by probability among eligible rewards.
3. Persist `UserScratchReward` (unique per user+campaign).
4. Refresh returns the same reward.
5. Checkout accepts reward **ID** only; server loads value.
6. Redemption marks status `redeemed`.

## Order snapshot strategy

Orders store line and order-level cents fields, fee breakdown, coupon/scratch refs, and `taxSnapshot`. Historical totals are never recalculated from live catalog/tax config.

## Admin flow

Steps 1–7 wizard at `/admin/products/new` → `POST /admin/products/wizard`.  
Vendor create still uses simplified single-SKU auto-stack via `product.service.create`.

## Migration

```bash
cd backend && npm run migrate:fmcg
```

Idempotent: Brand + variant + Sku + Pricing + Inventory at `YYZ-WH-01`, cart `skuId` remap, coupon cents backfill, Canadian tax seed.
