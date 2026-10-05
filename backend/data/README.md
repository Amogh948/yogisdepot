# Catalog import data

Place WooCommerce product exports here.

Default file used by import scripts:

`wc-product-export-25-9-2026-1790336288881.csv`

```bash
npm run import:fmcg:audit -- ./data/wc-product-export-25-9-2026-1790336288881.csv

npm run import:fmcg -- \
  --file=./data/wc-product-export-25-9-2026-1790336288881.csv \
  --source-currency=CAD \
  --dry-run

npm run import:fmcg -- \
  --file=./data/wc-product-export-25-9-2026-1790336288881.csv \
  --source-currency=CAD \
  --vendor-slug=himalaya-pantry
```

`--source-currency=CAD` is required. Prices are converted to integer cents.
