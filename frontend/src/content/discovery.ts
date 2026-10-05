/** Curated discovery mappings → real product/category API queries. No fake product data. */

export const REGIONS = [
  {
    slug: "south-india",
    name: "South India",
    description: "Crisp banana chips, filter coffee, and coastal spice classics.",
    search: "chips",
    specialties: ["Banana Chips", "Filter Coffee", "Mixture"],
  },
  {
    slug: "north-india",
    name: "North India",
    description: "Warm namkeen, chai blends, and festive mithai favourites.",
    search: "namkeen",
    specialties: ["Namkeen", "Masala Chai", "Mathri"],
  },
  {
    slug: "west-india",
    name: "West India",
    description: "Farsan, pickles, and pantry staples from Gujarat and Maharashtra.",
    search: "pickle",
    specialties: ["Farsan", "Mango Pickle", "Khakhra"],
  },
  {
    slug: "east-india",
    name: "East India",
    description: "Mishti, mustard notes, and tea-time treats.",
    search: "tea",
    specialties: ["Sandesh", "Darjeeling Tea", "Nolen Gur"],
  },
  {
    slug: "northeast-india",
    name: "Northeast India",
    description: "Bold flavours, smoked notes, and regional pantry finds.",
    search: "spice",
    specialties: ["Bhut Jolokia", "Bamboo Shoot", "Local spices"],
  },
] as const;

export const FESTIVALS = [
  { slug: "diwali", name: "Diwali", search: "sweet", blurb: "Sweets, snacks and gift boxes for the festival of lights." },
  { slug: "onam", name: "Onam", search: "chips", blurb: "Kerala classics for the harvest celebration." },
  { slug: "pongal", name: "Pongal", search: "grocery", blurb: "Pantry staples and festive treats." },
  { slug: "ugadi", name: "Ugadi", search: "pickle", blurb: "New year flavours from the Deccan." },
  { slug: "holi", name: "Holi", search: "snack", blurb: "Colourful snacks for celebrations." },
  { slug: "raksha-bandhan", name: "Raksha Bandhan", search: "sweet", blurb: "Thoughtful sweet boxes for siblings." },
  { slug: "eid", name: "Eid", search: "dry", blurb: "Dry fruits and festive sweets." },
  { slug: "christmas", name: "Christmas", search: "bakery", blurb: "Bakery favourites and gift hampers." },
] as const;

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
      { q: "Which payments are supported?", a: "You can pay online via Razorpay or choose cash on delivery where available." },
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
