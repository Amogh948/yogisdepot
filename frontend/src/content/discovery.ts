/** Curated discovery mappings → real product/category API queries. No fake product data. */

export const GIFT_BANDS = [
  { slug: "under-499", name: "Under $75", maxPrice: 499, blurb: "Thoughtful small gifts" },
  { slug: "under-999", name: "Under $99", maxPrice: 999, blurb: "Perfect for family" },
  { slug: "under-1499", name: "Under $149", maxPrice: 1499, blurb: "Premium curated boxes" },
  { slug: "premium", name: "Premium", minPrice: 1500, blurb: "Corporate & celebration hampers" },
] as const;

export const OFFER_SECTIONS = [
  { title: "Today's deals", query: { discount: "true", sort: "discount", limit: 12 } },
  { title: "Under $9.99", query: { maxPrice: 99, sort: "price_asc", limit: 12 } },
  { title: "Under $19.99", query: { maxPrice: 199, sort: "price_asc", limit: 12 } },
  { title: "20%+ off", query: { discount: "true", sort: "discount", limit: 12 } },
] as const;

export const HELP_FAQS = [
  {
    category: "Orders & delivery",
    items: [
      { q: "How do I track my order?", a: "Open My Orders, select your order, and follow the delivery timeline." },
      { q: "When is delivery free?", a: "Orders over $75 usually qualify for free standard delivery." },
    ],
  },
  {
    category: "Payments",
    items: [
      { q: "Which payments are supported?", a: "You can pay by card online via Square or choose cash on delivery where available." },
      { q: "My payment failed. What next?", a: "Your cart is kept. Retry checkout or choose another payment method." },
    ],
  },
  {
    category: "Returns & refunds",
    items: [
      { q: "Can I cancel an order?", a: "Pending and confirmed orders can often be cancelled from the order detail page." },
      { q: "How do refunds work?", a: "Paid cancellations are refunded as per the payment provider timeline." },
    ],
  },
  {
    category: "Account",
    items: [
      { q: "How do I update my address?", a: "Go to Account → Addresses to add, edit, or remove delivery addresses." },
      { q: "How do I contact support?", a: "Use the Help page contact section or email support@yogisdepot.local." },
    ],
  },
] as const;
