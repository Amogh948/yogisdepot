import path from "path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import { API_PREFIX } from "./config/constants";
import { env, isProduction } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { globalRateLimiter } from "./middleware/rateLimit.middleware";
import { authRoutes } from "./routes/auth.routes";
import { productRoutes } from "./routes/product.routes";
import { categoryRoutes } from "./routes/category.routes";
import { cartRoutes } from "./routes/cart.routes";
import { wishlistRoutes } from "./routes/wishlist.routes";
import { addressRoutes } from "./routes/address.routes";
import { orderRoutes } from "./routes/order.routes";
import { reviewRoutes } from "./routes/review.routes";
import { couponRoutes } from "./routes/coupon.routes";
import { notificationRoutes } from "./routes/notification.routes";
import { adminRoutes } from "./routes/admin.routes";
import { vendorRoutes } from "./routes/vendor.routes";
import { paymentRoutes, uploadRoutes } from "./routes/upload.routes";

function hostnameOf(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isLocalDevOrigin(origin: string): boolean {
  const hostname = hostnameOf(origin);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Storefront may be apex or www; cookies are cross-site when the API is api.yogisdepot.com. */
function isAllowedOrigin(origin: string): boolean {
  const hostname = hostnameOf(origin);
  if (!hostname) return false;
  if (!isProduction && isLocalDevOrigin(origin)) return true;

  const allowed = new Set<string>(["yogisdepot.com", "www.yogisdepot.com"]);
  for (const value of env.CLIENT_URL.split(",")) {
    const configured = hostnameOf(value.trim());
    if (!configured) continue;
    allowed.add(configured);
    allowed.add(configured.startsWith("www.") ? configured.slice(4) : `www.${configured}`);
  }
  return allowed.has(hostname);
}

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(mongoSanitize());
  app.use(globalRateLimiter);
  if (!isProduction) {
    app.use(morgan("dev"));
  }

  app.use("/uploads", express.static(path.resolve(process.cwd(), env.UPLOAD_DIR)));

  app.get("/health", (_req, res) => {
    res.json({ success: true, message: "Yogi's Depot API is healthy", data: { uptime: process.uptime() } });
  });

  const api = express.Router();
  api.use("/auth", authRoutes);
  api.use("/products", productRoutes);
  api.use("/categories", categoryRoutes);
  api.use("/cart", cartRoutes);
  api.use("/wishlist", wishlistRoutes);
  api.use("/addresses", addressRoutes);
  api.use("/orders", orderRoutes);
  api.use("/reviews", reviewRoutes);
  api.use("/coupons", couponRoutes);
  api.use("/notifications", notificationRoutes);
  api.use("/admin", adminRoutes);
  api.use("/vendors", vendorRoutes);
  api.use("/uploads", uploadRoutes);
  api.use("/payments", paymentRoutes);
  app.use(API_PREFIX, api);
  // Production storefront calls https://api.yogisdepot.com/products (no /api/v1 prefix).
  app.use(api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
