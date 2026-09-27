import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
    env: {
      NODE_ENV: "test",
      MONGODB_URI: "mongodb://127.0.0.1:27017/yogisdepot-test",
      JWT_SECRET: "test-jwt-secret-16",
    },
  },
});
