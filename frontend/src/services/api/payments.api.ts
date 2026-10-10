import { api, unwrap } from "./client";

export const paymentsApi = {
  config: () =>
    unwrap<{
      squareApplicationId: string;
      squareLocationId: string;
      squareEnvironment: "sandbox" | "production";
      squareEnabled: boolean;
    }>(api.get("/payments/config")),
};
