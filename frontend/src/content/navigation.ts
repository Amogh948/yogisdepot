export const CATEGORY_NAV = [
  { label: "All", to: "/products" },
  { label: "Snacks", to: "/categories/snacks" },
  { label: "Chips", to: "/categories/chips" },
  { label: "Namkeen", to: "/categories/namkeen" },
  { label: "Tea & Coffee", to: "/categories/beverages" },
  { label: "Bakery", to: "/categories/bakery" },
  { label: "Spices", to: "/categories/spices" },
  { label: "Sweets", to: "/categories/sweets" },
  { label: "Pickles", to: "/categories/pickles" },
  { label: "Dry Fruits", to: "/categories/dry-fruits" },
  { label: "Staples", to: "/categories/grocery" },
  { label: "More", to: "/categories" },
] as const;

export const TRENDING_SEARCHES = [
  "Banana Chips",
  "Masala Chai",
  "Ragi Cookies",
  "Filter Coffee",
  "Mango Pickle",
  "Namkeen",
] as const;

export const FREE_DELIVERY_THRESHOLD = 499;
