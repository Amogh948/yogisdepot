import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { Address } from "../models/Address";
import { Category } from "../models/Category";
import { Coupon } from "../models/Coupon";
import { Product } from "../models/Product";
import { Review } from "../models/Review";
import { User } from "../models/User";
import { Vendor } from "../models/Vendor";
import { getPlatformSettings } from "../models/PlatformSettings";
import { hashPassword } from "../utils/password";
import { logger } from "../utils/logger";

const images = {
  chips: "https://images.unsplash.com/photo-1566478989037-eec170761d8a?w=800&q=80",
  namkeen: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&q=80",
  juice: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=800&q=80",
  soda: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=800&q=80",
  bread: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80",
  cookies: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&q=80",
  cake: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80",
  granola: "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=800&q=80",
  tea: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&q=80",
  honey: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&q=80",
};

async function seed(): Promise<void> {
  await connectDatabase();
  await mongoose.connection.dropDatabase();

  const password = await hashPassword("Password@123");

  const [, customer, , vendorUserOne, vendorUserTwo] = await User.create([
    { firstName: "Asha", lastName: "Mehta", email: "admin@yogisdepot.local", phone: "9000000001", password, role: "admin", isEmailVerified: true },
    { firstName: "Ravi", lastName: "Sharma", email: "customer@yogisdepot.local", phone: "9000000002", password, role: "customer", isEmailVerified: true },
    { firstName: "Neha", lastName: "Iyer", email: "neha@yogisdepot.local", phone: "9000000003", password, role: "customer", isEmailVerified: true },
    { firstName: "Karan", lastName: "Patel", email: "vendor@yogisdepot.local", phone: "9000000004", password, role: "vendor", isEmailVerified: true },
    { firstName: "Meera", lastName: "Nair", email: "bakery@yogisdepot.local", phone: "9000000005", password, role: "vendor", isEmailVerified: true },
  ]);

  const [pantryVendor, bakeryVendor] = await Vendor.create([
    {
      userId: vendorUserOne._id,
      businessName: "Himalaya Pantry",
      slug: "himalaya-pantry",
      description: "Crunchy snacks, pantry staples, and everyday groceries.",
      email: "vendor@yogisdepot.local",
      phone: "9000000004",
      address: { addressLine1: "12 Market Road", city: "Pune", state: "Maharashtra", postalCode: "411001", country: "India" },
      status: "active",
      approvalStatus: "approved",
      commissionRate: 10,
    },
    {
      userId: vendorUserTwo._id,
      businessName: "Sunrise Bakehouse",
      slug: "sunrise-bakehouse",
      description: "Fresh bakery, cookies, and artisanal breads.",
      email: "bakery@yogisdepot.local",
      phone: "9000000005",
      address: { addressLine1: "88 Baker Lane", city: "Bengaluru", state: "Karnataka", postalCode: "560001", country: "India" },
      status: "active",
      approvalStatus: "approved",
      commissionRate: 12,
    },
  ]);

  const snacks = await Category.create({ name: "Snacks", slug: "snacks", description: "Crisps, namkeen, and munchies", isActive: true, sortOrder: 1 });
  const beverages = await Category.create({ name: "Beverages", slug: "beverages", description: "Juices, teas, and coolers", isActive: true, sortOrder: 2 });
  const bakery = await Category.create({ name: "Bakery", slug: "bakery", description: "Breads, cakes, and cookies", isActive: true, sortOrder: 3 });
  const grocery = await Category.create({ name: "Grocery", slug: "grocery", description: "Everyday pantry essentials", isActive: true, sortOrder: 4 });

  const chips = await Category.create({ name: "Chips", slug: "chips", parentId: snacks._id, isActive: true });
  const namkeen = await Category.create({ name: "Namkeen", slug: "namkeen", parentId: snacks._id, isActive: true });
  const juices = await Category.create({ name: "Juices", slug: "juices", parentId: beverages._id, isActive: true });
  const tea = await Category.create({ name: "Tea & Infusions", slug: "tea", parentId: beverages._id, isActive: true });
  const bread = await Category.create({ name: "Bread", slug: "bread", parentId: bakery._id, isActive: true });
  const cookies = await Category.create({ name: "Cookies", slug: "cookies", parentId: bakery._id, isActive: true });
  const cakes = await Category.create({ name: "Cakes", slug: "cakes", parentId: bakery._id, isActive: true });
  const staples = await Category.create({ name: "Pantry", slug: "pantry", parentId: grocery._id, isActive: true });

  const catalog = [
    { name: "Masala Potato Chips", sku: "HP-CHIP-01", vendor: pantryVendor, category: snacks, sub: chips, price: 49, compare: 65, stock: 120, img: images.chips, veg: true, tags: ["chips", "spicy"], brand: "Himalaya Pantry", featured: true, ingredients: "Potato, sunflower oil, spices", allergens: ["none"] },
    { name: "Peri Peri Chips", sku: "HP-CHIP-02", vendor: pantryVendor, category: snacks, sub: chips, price: 59, compare: 79, stock: 80, img: images.chips, veg: true, tags: ["chips"], brand: "Himalaya Pantry", featured: true, ingredients: "Potato, chilli seasoning", allergens: [] },
    { name: "Classic Mixture Namkeen", sku: "HP-NAM-01", vendor: pantryVendor, category: snacks, sub: namkeen, price: 89, compare: 110, stock: 60, img: images.namkeen, veg: true, tags: ["namkeen"], brand: "Himalaya Pantry", featured: false, ingredients: "Gram flour, peanuts, spices", allergens: ["peanuts"] },
    { name: "Moong Dal Crunch", sku: "HP-NAM-02", vendor: pantryVendor, category: snacks, sub: namkeen, price: 75, stock: 90, img: images.namkeen, veg: true, tags: ["namkeen", "protein"], brand: "Himalaya Pantry", featured: false, ingredients: "Moong dal, oil, salt", allergens: [] },
    { name: "Cold Pressed Orange Juice", sku: "HP-JUI-01", vendor: pantryVendor, category: beverages, sub: juices, price: 129, compare: 149, stock: 40, img: images.juice, veg: true, vegan: true, tags: ["juice"], brand: "Grove", featured: true, ingredients: "Orange juice", allergens: [] },
    { name: "Mixed Fruit Cooler", sku: "HP-JUI-02", vendor: pantryVendor, category: beverages, sub: juices, price: 99, stock: 55, img: images.juice, veg: true, vegan: true, tags: ["juice"], brand: "Grove", featured: false, ingredients: "Apple, mango, banana", allergens: [] },
    { name: "Darjeeling Leaf Tea", sku: "HP-TEA-01", vendor: pantryVendor, category: beverages, sub: tea, price: 249, compare: 299, stock: 35, img: images.tea, veg: true, vegan: true, tags: ["tea"], brand: "Himalaya Pantry", featured: true, ingredients: "Darjeeling tea leaves", allergens: [] },
    { name: "Tulsi Ginger Infusion", sku: "HP-TEA-02", vendor: pantryVendor, category: beverages, sub: tea, price: 189, stock: 50, img: images.tea, veg: true, vegan: true, tags: ["tea", "herbal"], brand: "Himalaya Pantry", featured: false, ingredients: "Tulsi, ginger, lemongrass", allergens: [] },
    { name: "Wildflower Honey", sku: "HP-HON-01", vendor: pantryVendor, category: grocery, sub: staples, price: 320, compare: 380, stock: 28, img: images.honey, veg: true, tags: ["honey"], brand: "Meadow", featured: true, ingredients: "Raw honey", allergens: [] },
    { name: "Toasted Granola", sku: "HP-GRA-01", vendor: pantryVendor, category: grocery, sub: staples, price: 275, stock: 42, img: images.granola, veg: true, tags: ["breakfast"], brand: "Meadow", featured: false, ingredients: "Oats, honey, almonds", allergens: ["nuts"] },
    { name: "Sourdough Loaf", sku: "SB-BRD-01", vendor: bakeryVendor, category: bakery, sub: bread, price: 110, stock: 24, img: images.bread, veg: true, tags: ["bread"], brand: "Sunrise", featured: true, ingredients: "Flour, water, salt, starter", allergens: ["gluten"] },
    { name: "Multigrain Sandwich Bread", sku: "SB-BRD-02", vendor: bakeryVendor, category: bakery, sub: bread, price: 85, compare: 99, stock: 30, img: images.bread, veg: true, tags: ["bread"], brand: "Sunrise", featured: false, ingredients: "Wheat, seeds, yeast", allergens: ["gluten"] },
    { name: "Dark Chocolate Cookies", sku: "SB-CKI-01", vendor: bakeryVendor, category: bakery, sub: cookies, price: 160, compare: 199, stock: 48, img: images.cookies, veg: true, tags: ["cookies"], brand: "Sunrise", featured: true, ingredients: "Flour, cocoa, butter, sugar", allergens: ["gluten", "milk"] },
    { name: "Butter Shortbread", sku: "SB-CKI-02", vendor: bakeryVendor, category: bakery, sub: cookies, price: 145, stock: 36, img: images.cookies, veg: true, tags: ["cookies"], brand: "Sunrise", featured: false, ingredients: "Butter, flour, sugar", allergens: ["gluten", "milk"] },
    { name: "Cardamom Tea Cake", sku: "SB-CAK-01", vendor: bakeryVendor, category: bakery, sub: cakes, price: 420, compare: 499, stock: 12, img: images.cake, veg: true, tags: ["cake"], brand: "Sunrise", featured: true, ingredients: "Flour, eggs, cardamom, butter", allergens: ["gluten", "egg", "milk"] },
    { name: "Chocolate Fudge Slice", sku: "SB-CAK-02", vendor: bakeryVendor, category: bakery, sub: cakes, price: 95, stock: 20, img: images.cake, veg: true, tags: ["cake"], brand: "Sunrise", featured: false, ingredients: "Cocoa, cream, sugar", allergens: ["milk"] },
    { name: "Sparkling Lemon Soda", sku: "HP-SOD-01", vendor: pantryVendor, category: beverages, sub: juices, price: 45, stock: 100, img: images.soda, veg: true, vegan: true, tags: ["soda"], brand: "Grove", featured: false, ingredients: "Carbonated water, lemon", allergens: [] },
    { name: "Roasted Foxnuts", sku: "HP-SNK-03", vendor: pantryVendor, category: snacks, sub: namkeen, price: 135, compare: 165, stock: 44, img: images.namkeen, veg: true, vegan: true, tags: ["makhana"], brand: "Himalaya Pantry", featured: true, ingredients: "Foxnuts, ghee, spices", allergens: [] },
    { name: "Millet Khakhra Pack", sku: "HP-SNK-04", vendor: pantryVendor, category: snacks, sub: chips, price: 70, stock: 70, img: images.chips, veg: true, vegan: true, tags: ["khakhra"], brand: "Himalaya Pantry", featured: false, ingredients: "Millet flour, oil, spices", allergens: [] },
    { name: "Honey Oat Cookies", sku: "SB-CKI-03", vendor: bakeryVendor, category: bakery, sub: cookies, price: 155, stock: 26, img: images.cookies, veg: true, tags: ["cookies", "oats"], brand: "Sunrise", featured: false, ingredients: "Oats, honey, butter", allergens: ["gluten", "milk"] },
  ];

  const products = await Product.insertMany(
    catalog.map((item) => ({
      name: item.name,
      slug: item.sku.toLowerCase(),
      description: `${item.name} from ${item.brand}. Carefully sourced and packed for freshness.`,
      shortDescription: `Premium ${item.tags[0]} from ${item.brand}.`,
      sku: item.sku,
      vendorId: item.vendor._id,
      categoryId: item.category._id,
      subCategoryId: item.sub._id,
      brand: item.brand,
      images: [item.img],
      thumbnail: item.img,
      price: item.price,
      compareAtPrice: item.compare,
      discount: item.compare ? Math.round(((item.compare - item.price) / item.compare) * 100) : 0,
      stock: item.stock,
      lowStockThreshold: 8,
      unit: "pack",
      ingredients: item.ingredients,
      allergens: item.allergens,
      tags: item.tags,
      isVegetarian: item.veg,
      isVegan: Boolean(item.vegan),
      isFeatured: item.featured,
      isActive: true,
      rating: 4.4,
      reviewCount: 1,
      storageInstructions: "Store in a cool, dry place.",
      foodType: item.veg ? "vegetarian" : "regular",
    })),
  );

  await Address.create({
    customerId: customer._id,
    fullName: "Ravi Sharma",
    phone: "9000000002",
    addressLine1: "42 River View",
    city: "Pune",
    state: "Maharashtra",
    postalCode: "411045",
    country: "India",
    addressType: "home",
    isDefault: true,
  });

  await Coupon.create([
    {
      couponCode: "FRESH10",
      discountType: "percentage",
      discountValue: 10,
      minimumOrderValue: 199,
      maximumDiscount: 150,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000 * 90),
      usageLimit: 1000,
      perUserLimit: 5,
      isActive: true,
    },
    {
      couponCode: "WELCOME50",
      discountType: "fixed",
      discountValue: 50,
      minimumOrderValue: 299,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000 * 90),
      usageLimit: 500,
      perUserLimit: 1,
      isActive: true,
    },
  ]);

  await Review.create({
    productId: products[0]._id,
    customerId: customer._id,
    orderId: new mongoose.Types.ObjectId(),
    rating: 5,
    title: "Crispy and addictive",
    comment: "Perfect masala kick. Will order again.",
    isVerifiedPurchase: true,
    isApproved: true,
  });

  await getPlatformSettings();
  logger.info("Seed complete");
  logger.info("Dev accounts (password Password@123): admin@yogisdepot.local, vendor@yogisdepot.local, bakery@yogisdepot.local, customer@yogisdepot.local");
  await disconnectDatabase();
}

seed().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error("Seed failed", message);
  process.exit(1);
});
