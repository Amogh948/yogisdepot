import { PaymentMethod } from "../../config/constants";
import { env } from "../../config/env";
import { BadRequestError } from "../../errors/AppError";
import { SquareProvider } from "./square.provider";
import {
  PaymentIntent,
  PaymentIntentInput,
  PaymentProvider,
  PaymentResult,
  PaymentVerifyExtra,
  RefundResult,
} from "./payment.types";

export type {
  PaymentIntent,
  PaymentIntentInput,
  PaymentProvider,
  PaymentResult,
  PaymentVerifyExtra,
  RefundResult,
} from "./payment.types";

class CodProvider implements PaymentProvider {
  async createPayment(input: PaymentIntentInput): Promise<PaymentIntent> {
    return {
      provider: "cod",
      status: "pending",
      reference: `cod_${input.orderNumber}`,
    };
  }

  async verifyPayment(reference: string): Promise<PaymentResult> {
    return { success: true, reference, status: "pending" };
  }

  async refundPayment(reference: string): Promise<RefundResult> {
    return { success: true, reference };
  }
}

class MockOnlineProvider implements PaymentProvider {
  async createPayment(input: PaymentIntentInput): Promise<PaymentIntent> {
    const reference = `mock_${input.orderNumber}_${Date.now()}`;
    return {
      provider: "mock_online",
      status: "created",
      reference,
      clientPayload: {
        mockCheckoutId: reference,
        amount: input.amount,
        autoCapture: 1,
      },
    };
  }

  async verifyPayment(reference: string): Promise<PaymentResult> {
    if (!reference.startsWith("mock_")) {
      return { success: false, reference, status: "failed" };
    }
    return { success: true, reference, status: "paid" };
  }

  async refundPayment(reference: string): Promise<RefundResult> {
    return { success: true, reference };
  }
}

function providers(): Record<PaymentMethod, PaymentProvider> {
  return {
    cod: new CodProvider(),
    mock_online: new MockOnlineProvider(),
    square: new SquareProvider(),
  };
}

export const PaymentService = {
  publicConfig() {
    const squareEnabled = Boolean(
      env.SQUARE_APPLICATION_ID && env.SQUARE_ACCESS_TOKEN && env.SQUARE_LOCATION_ID,
    );
    return {
      squareApplicationId: env.SQUARE_APPLICATION_ID,
      squareLocationId: env.SQUARE_LOCATION_ID,
      squareEnvironment: env.SQUARE_ENVIRONMENT,
      squareEnabled,
    };
  },

  async createPayment(input: PaymentIntentInput): Promise<PaymentIntent> {
    const provider = providers()[input.method];
    if (!provider) {
      throw new BadRequestError("Unsupported payment method");
    }
    return provider.createPayment(input);
  },

  async verifyPayment(
    method: PaymentMethod,
    reference: string,
    amount: number,
    extra?: PaymentVerifyExtra,
  ): Promise<PaymentResult> {
    return providers()[method].verifyPayment(reference, amount, extra);
  },

  async refundPayment(method: PaymentMethod, reference: string, amount: number): Promise<RefundResult> {
    return providers()[method].refundPayment(reference, amount);
  },
};
