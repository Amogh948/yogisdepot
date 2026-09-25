import { api, unwrap } from "./client";

export const paymentsApi = {
  config: () => unwrap<{ razorpayKeyId: string; razorpayEnabled: boolean }>(api.get("/payments/config")),
};
