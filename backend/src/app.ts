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

function isLocalDevOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string): boolean {
  const configured = env.CLIENT_URL.split(",").map((value) => value.trim()).filter(Boolean);
  if (configured.includes(origin)) {
    return true;
  }
  return !isProduction && isLocalDevOrigin(origin);
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

  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/products`, productRoutes);
  app.use(`${API_PREFIX}/categories`, categoryRoutes);
  app.use(`${API_PREFIX}/cart`, cartRoutes);
  app.use(`${API_PREFIX}/wishlist`, wishlistRoutes);
  app.use(`${API_PREFIX}/addresses`, addressRoutes);
  app.use(`${API_PREFIX}/orders`, orderRoutes);
  app.use(`${API_PREFIX}/reviews`, reviewRoutes);
  app.use(`${API_PREFIX}/coupons`, couponRoutes);
  app.use(`${API_PREFIX}/notifications`, notificationRoutes);
  app.use(`${API_PREFIX}/admin`, adminRoutes);
  app.use(`${API_PREFIX}/vendors`, vendorRoutes);
  app.use(`${API_PREFIX}/uploads`, uploadRoutes);
  app.use(`${API_PREFIX}/payments`, paymentRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
