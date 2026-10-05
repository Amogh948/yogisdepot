import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { addressApi, cartApi, deliveryApi, ordersApi } from "../../services/api/commerce.api";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/Feedback";
import { entityId, mediaUrl } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";
import { paymentsApi } from "../../services/api/payments.api";
import { openRazorpayCheckout } from "../../utils/razorpay";
import { detectCurrentAddress } from "../../utils/geolocation";
import { useAuthStore } from "../../store/auth.store";
import { formatCad } from "../../utils/money";

const steps = ["Address", "Delivery", "Payment"] as const;

const checkoutAddressSchema = z.object({
  fullName: z.string().min(2, "Enter the full name"),
  phone: z.string().min(8, "Enter a valid phone"),
  addressLine1: z.string().min(3, "Enter the street address"),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "Enter the city"),
  state: z.string().min(2, "Enter the state"),
  postalCode: z.string().min(3, "Enter the postal code"),
  country: z.string().min(2),
  landmark: z.string().optional(),
  addressType: z.enum(["home", "work", "other"]),
});

type CheckoutAddressForm = z.infer<typeof checkoutAddressSchema>;

export function CheckoutPage() {
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.push);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [addressId, setAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "razorpay">("razorpay");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [scratchRewardId, setScratchRewardId] = useState("");
  const [paying, setPaying] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const cart = useQuery({ queryKey: ["cart"], queryFn: () => cartApi.get() });
  const addresses = useQuery({ queryKey: ["addresses"], queryFn: () => addressApi.list() });
  const paymentConfig = useQuery({ queryKey: ["payments-config"], queryFn: () => paymentsApi.config() });
  const razorpayEnabled = paymentConfig.data?.data.razorpayEnabled !== false;
  const savedAddresses = addresses.data?.data || [];
  const selected = useMemo(
    () => savedAddresses.find((item) => entityId(item) === addressId) || savedAddresses.find((item) => item.isDefault) || savedAddresses[0],
    [savedAddresses, addressId],
  );
  const resolvedAddressId = addressId || (selected ? entityId(selected) : "");

  const quote = useQuery({
    queryKey: ["checkout-quote", appliedCoupon, scratchRewardId, resolvedAddressId],
    queryFn: () =>
      ordersApi.quote({
        coupon: appliedCoupon || undefined,
        scratchRewardId: scratchRewardId || undefined,
        addressId: resolvedAddressId || undefined,
      }),
    enabled: Boolean(cart.data?.data?.items.length),
  });

  const deliveryCheck = useQuery({
    queryKey: [
      "delivery-check",
      selected?.country,
      selected?.state,
      selected?.city,
      selected?.postalCode,
    ],
    queryFn: () =>
      deliveryApi.check({
        country: selected!.country,
        state: selected!.state,
        city: selected!.city,
        postalCode: selected!.postalCode,
      }),
    enabled: Boolean(selected),
  });
  const undeliverable =
    Boolean(selected) &&
    deliveryCheck.isSuccess &&
    deliveryCheck.data?.data?.deliverable === false;
  const undeliverableMessage =
    deliveryCheck.data?.data?.message || "The product is undeliverable in this location.";

  const addressDefaults: CheckoutAddressForm = {
    fullName: user ? `${user.firstName} ${user.lastName}`.trim() : "",
    phone: user?.phone || "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "ON",
    postalCode: "",
    country: "Canada",
    landmark: "",
    addressType: "home",
  };

  const form = useForm<CheckoutAddressForm>({
    resolver: zodResolver(checkoutAddressSchema),
    defaultValues: addressDefaults,
  });

  useEffect(() => {
    if (!addresses.isLoading && savedAddresses.length === 0) {
      setShowAddressForm(true);
    }
  }, [addresses.isLoading, savedAddresses.length]);

  const createAddress = useMutation({
    mutationFn: (values: CheckoutAddressForm) => addressApi.create(values),
    onSuccess: async (result) => {
      const createdId = entityId(result.data);
      setAddressId(createdId);
      setShowAddressForm(false);
      form.reset(addressDefaults);
      toast("Address saved");
      await queryClient.invalidateQueries({ queryKey: ["addresses"] });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not save address", "error"),
  });

  const detectLiveAddress = async () => {
    setDetecting(true);
    setShowAddressForm(true);
    try {
      const detected = await detectCurrentAddress();
      form.setValue("addressLine1", detected.addressLine1, { shouldDirty: true, shouldValidate: true });
      form.setValue("addressLine2", detected.addressLine2 || "", { shouldDirty: true });
      form.setValue("city", detected.city, { shouldDirty: true, shouldValidate: true });
      form.setValue("state", detected.state, { shouldDirty: true, shouldValidate: true });
      form.setValue("postalCode", detected.postalCode, { shouldDirty: true, shouldValidate: true });
      form.setValue("country", detected.country || "Canada", { shouldDirty: true, shouldValidate: true });
      form.setValue("landmark", detected.landmark || "", { shouldDirty: true });
      toast("Address filled from your current location");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not detect your location", "error");
    } finally {
      setDetecting(false);
    }
  };

  const cartHold = useRef(cart.data?.data);
  if (cart.data?.data?.items.length) {
    cartHold.current = cart.data.data;
  }

  const finish = async (orderId: string) => {
    toast("Order placed successfully");
    await queryClient.invalidateQueries({ queryKey: ["cart"] });
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
    navigate(`/order-success?orderId=${orderId}`);
  };

  const abandonPayment = async (orderId: string) => {
    try {
      const current = await ordersApi.get(orderId);
      if (current.data.paymentStatus === "pending" || current.data.paymentStatus === "failed") {
        await ordersApi.cancel(orderId);
      }
    } catch {
      // Order may already be paid, cancelled, or missing.
    }
    await queryClient.invalidateQueries({ queryKey: ["cart"] });
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const placeOrder = useMutation({
    mutationFn: () => {
      if (undeliverable) {
        throw new ApiError(undeliverableMessage, 400);
      }
      return ordersApi.create({
        addressId: entityId(selected!),
        paymentMethod,
        couponCode: appliedCoupon || couponCode || undefined,
        scratchRewardId: scratchRewardId || undefined,
      });
    },
    onSuccess: async (result) => {
      const orderId = entityId(result.data.order);
      if (paymentMethod !== "razorpay") {
        await finish(orderId);
        return;
      }
      const payload = result.data.payment.clientPayload;
      if (!payload) {
        toast("Unable to start Razorpay checkout", "error");
        await abandonPayment(orderId);
        return;
      }
      setPaying(true);
      let settled = false;
      const settle = (action: () => void) => {
        if (settled) return;
        settled = true;
        setPaying(false);
        action();
      };
      await openRazorpayCheckout({
        key: String(payload.keyId),
        amount: Number(payload.amount),
        currency: String(payload.currency || "CAD"),
        name: "Yogis Depot",
        description: `Order ${result.data.order.orderNumber}`,
        order_id: String(payload.razorpayOrderId),
        prefill: {
          name: user ? `${user.firstName} ${user.lastName}` : undefined,
          email: user?.email,
          contact: selected?.phone || user?.phone,
        },
        theme: { color: "#c45e12" },
        handler: (response) => {
          void ordersApi
            .verifyRazorpay(orderId, response)
            .then(async () => {
              settle(() => undefined);
              await finish(orderId);
            })
            .catch((error: unknown) => {
              settle(() => {
                toast(error instanceof ApiError ? error.message : "Payment verification failed", "error");
                void abandonPayment(orderId);
              });
            });
        },
        onFailure: (response) => {
          settle(() => {
            toast(response.error?.description || "Payment failed. Please try again.", "error");
            void abandonPayment(orderId);
          });
        },
        modal: {
          ondismiss: () => {
            window.setTimeout(() => {
              settle(() => {
                toast("Payment was cancelled. Your cart is still saved.", "info");
                void abandonPayment(orderId);
              });
            }, 400);
          },
        },
      });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Checkout failed", "error"),
  });

  const cartData = cart.data?.data?.items.length ? cart.data.data : paying ? cartHold.current : cart.data?.data;
  if (!cartData?.items.length) {
    return <EmptyState title="Nothing to checkout" body="Add items to your cart first." />;
  }

  const quoteData = (quote.data?.data || {}) as {
    subtotal?: number;
    discount?: number;
    shippingFee?: number;
    tax?: number;
    total?: number;
    platformFeeCents?: number;
    handlingFeeCents?: number;
    taxSnapshot?: { jurisdiction?: string; components?: Array<{ type: string; taxAmountCents: number }> };
  };
  const shipping = Number(quoteData.shippingFee ?? 0);
  const tax = Number(quoteData.tax ?? 0);
  const discount = Number(quoteData.discount ?? 0);
  const total = Number(quoteData.total ?? cartData.subtotal);
  const platformFee = (quoteData.platformFeeCents ?? 0) / 100;
  const handlingFee = (quoteData.handlingFeeCents ?? 0) / 100;

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <ol className="mb-5 flex items-center gap-0 overflow-x-auto text-xs font-semibold">
          {steps.map((label, index) => {
            const stepNumber = index + 1;
            const isCurrent = stepNumber === step;
            const isDone = stepNumber < step;
            return (
              <li key={label} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setStep(stepNumber)}
                  aria-current={isCurrent ? "step" : undefined}
                  className="flex items-center gap-2 whitespace-nowrap px-1 py-1"
                >
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold ${
                      isCurrent || isDone ? "bg-yd-green text-white" : "bg-yd-cream text-yd-muted"
                    }`}
                  >
                    {stepNumber}
                  </span>
                  <span className={isCurrent ? "text-yd-forest" : "text-yd-muted"}>{label}</span>
                </button>
                {index < steps.length - 1 ? <span className="mx-2 h-px w-6 bg-yd-border sm:w-10" aria-hidden /> : null}
              </li>
            );
          })}
        </ol>
        {step === 1 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl text-yd-forest">Deliver to</h2>
              <button type="button" className="text-sm font-semibold text-yd-green" onClick={() => setShowAddressForm(true)}>
                + Add new
              </button>
            </div>
            {savedAddresses.map((address) => (
              <label
                key={entityId(address)}
                className={`flex cursor-pointer gap-3 rounded-[14px] border bg-white p-4 shadow-soft ${
                  selected && entityId(selected) === entityId(address) ? "border-yd-green ring-1 ring-yd-green/30" : "border-yd-border"
                }`}
              >
                <input type="radio" name="address" className="mt-1 accent-yd-green" checked={selected ? entityId(selected) === entityId(address) : false} onChange={() => setAddressId(entityId(address))} />
                <span className="text-sm">
                  <strong className="capitalize text-yd-ink">{address.addressType}</strong>
                  <span className="text-yd-muted"> · {address.fullName}</span>
                  <br />
                  <span className="text-yd-muted">
                    {address.addressLine1}, {address.city} {address.postalCode}
                  </span>
                </span>
              </label>
            ))}
            {!savedAddresses.length && !showAddressForm ? (
              <p className="rounded-[14px] border border-yd-border bg-white p-4 text-sm text-yd-muted">
                No saved addresses yet. Add one below or detect your current location.
              </p>
            ) : null}
            {undeliverable ? (
              <p className="rounded-[14px] border border-yd-error/30 bg-yd-error/10 px-4 py-3 text-sm font-medium text-yd-error">
                {undeliverableMessage}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="w-full" loading={detecting} onClick={() => void detectLiveAddress()}>
                Detect live address
              </Button>
            </div>
            {showAddressForm ? (
              <form className="space-y-3 rounded-[14px] border border-yd-border bg-white p-4 shadow-soft" onSubmit={form.handleSubmit((values) => createAddress.mutate(values))}>
                <h2 className="font-display text-xl text-yd-forest">New delivery address</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Full name" {...form.register("fullName")} error={form.formState.errors.fullName?.message} />
                  <Input label="Phone" {...form.register("phone")} error={form.formState.errors.phone?.message} />
                  <div className="sm:col-span-2">
                    <Input label="Address" {...form.register("addressLine1")} error={form.formState.errors.addressLine1?.message} />
                  </div>
                  <div className="sm:col-span-2">
                    <Input label="Apartment / landmark" {...form.register("addressLine2")} />
                  </div>
                  <Input label="City" {...form.register("city")} error={form.formState.errors.city?.message} />
                  <Select label="Province" {...form.register("state")}>
                    {["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"].map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </Select>
                  <Input label="Postal code" {...form.register("postalCode")} error={form.formState.errors.postalCode?.message} />
                  <Input label="Country" {...form.register("country")} error={form.formState.errors.country?.message} />
                  <Select label="Address type" {...form.register("addressType")}>
                    <option value="home">Home</option>
                    <option value="work">Work</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddressForm(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" loading={createAddress.isPending}>
                    Save address
                  </Button>
                </div>
              </form>
            ) : null}
            <Button
              className="w-full"
              size="lg"
              disabled={!selected || undeliverable || deliveryCheck.isFetching}
              onClick={() => {
                if (undeliverable) {
                  toast(undeliverableMessage, "error");
                  return;
                }
                setStep(2);
              }}
            >
              Continue to delivery →
            </Button>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="rounded-[14px] border border-yd-border bg-white p-4 shadow-soft">
            <h2 className="font-display text-xl text-yd-forest">Delivery</h2>
            {undeliverable ? (
              <p className="mt-3 rounded-[12px] border border-yd-error/30 bg-yd-error/10 px-4 py-3 text-sm font-medium text-yd-error">
                {undeliverableMessage}
              </p>
            ) : null}
            <label className="mt-4 flex cursor-pointer gap-3 rounded-[12px] border border-yd-green bg-yd-green/5 p-4">
              <input type="radio" checked readOnly className="mt-1 accent-yd-green" />
              <span>
                <p className="font-semibold text-yd-ink">Standard delivery</p>
                <p className="text-sm text-yd-muted">Packed from vendor kitchens. Free over $75.</p>
              </span>
            </label>
            <Button className="mt-4 w-full" size="lg" disabled={undeliverable} onClick={() => setStep(3)}>
              Continue to payment
            </Button>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="space-y-3 rounded-[14px] border border-yd-border bg-white p-4 shadow-soft">
            <h2 className="font-display text-xl text-yd-forest">Payment</h2>
            <p className="text-sm text-yd-muted">
              Deliver to {selected?.fullName}, {selected?.city}
            </p>
            {undeliverable ? (
              <p className="rounded-[12px] border border-yd-error/30 bg-yd-error/10 px-4 py-3 text-sm font-medium text-yd-error">
                {undeliverableMessage}
              </p>
            ) : null}
            {razorpayEnabled ? (
              <label className={`flex cursor-pointer gap-3 rounded-[12px] border p-4 ${paymentMethod === "razorpay" ? "border-yd-green bg-yd-green/5" : "border-yd-border"}`}>
                <input type="radio" className="accent-yd-green" checked={paymentMethod === "razorpay"} onChange={() => setPaymentMethod("razorpay")} />
                <span>
                  <p className="font-semibold">UPI / Cards / Netbanking</p>
                  <p className="text-xs text-yd-muted">Pay securely with Razorpay</p>
                </span>
              </label>
            ) : null}
            <label className={`flex cursor-pointer gap-3 rounded-[12px] border p-4 ${paymentMethod === "cod" ? "border-yd-green bg-yd-green/5" : "border-yd-border"}`}>
              <input type="radio" className="accent-yd-green" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} />
              <span>
                <p className="font-semibold">Cash on Delivery</p>
                <p className="text-xs text-yd-muted">Pay when your order arrives</p>
              </span>
            </label>
            <Button
              className="w-full"
              size="lg"
              loading={placeOrder.isPending || paying}
              disabled={undeliverable}
              onClick={() => placeOrder.mutate()}
            >
              Place order →
            </Button>
          </div>
        ) : null}
      </div>
      <aside className="h-fit rounded-[14px] border border-yd-border bg-white p-4 shadow-soft lg:sticky lg:top-28">
        <h2 className="font-display text-xl text-yd-forest">Order summary</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {cartData.items.slice(0, 4).map((item) => {
            const src = mediaUrl(item.product.thumbnail || item.product.images[0]);
            return src ? <img key={item.productId} src={src} alt="" className="h-12 w-12 rounded-lg object-cover bg-yd-cream" /> : null;
          })}
        </div>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-yd-muted">Item total</dt><dd>{formatCad(Number(quoteData.subtotal ?? cartData.subtotal))}</dd></div>
          <div className="flex justify-between"><dt className="text-yd-muted">Discount</dt><dd className="text-yd-green">−{formatCad(discount)}</dd></div>
          <div className="flex justify-between"><dt className="text-yd-muted">Delivery</dt><dd>{formatCad(shipping)}</dd></div>
          {platformFee > 0 ? (
            <div className="flex justify-between"><dt className="text-yd-muted">Platform fee</dt><dd>{formatCad(platformFee)}</dd></div>
          ) : null}
          {handlingFee > 0 ? (
            <div className="flex justify-between"><dt className="text-yd-muted">Handling</dt><dd>{formatCad(handlingFee)}</dd></div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-yd-muted">Tax{quoteData.taxSnapshot?.jurisdiction ? ` (${quoteData.taxSnapshot.jurisdiction})` : ""}</dt>
            <dd>{formatCad(tax)}</dd>
          </div>
          <div className="flex justify-between border-t border-yd-border pt-2 font-semibold"><dt>Total</dt><dd>{formatCad(total)}</dd></div>
        </dl>
        <p className="mt-2 text-[11px] text-yd-muted">Totals are calculated server-side in CAD. Tax uses your shipping province.</p>
        <div className="mt-4">
          <Input label="Coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
        </div>
        <Button
          className="mt-2 w-full"
          onClick={async () => {
            try {
              setAppliedCoupon(couponCode.trim().toUpperCase());
              await queryClient.invalidateQueries({ queryKey: ["checkout-quote"] });
              toast("Coupon will be validated on the server quote");
            } catch (error) {
              toast(error instanceof ApiError ? error.message : "Invalid coupon", "error");
            }
          }}
        >
          Apply
        </Button>
        <div className="mt-3">
          <Input
            label="Scratch reward ID (optional)"
            value={scratchRewardId}
            onChange={(e) => setScratchRewardId(e.target.value.trim())}
          />
        </div>
        {step === 1 ? (
          <Button className="mt-3 w-full" disabled={!selected} onClick={() => setStep(2)}>
            Continue to delivery
          </Button>
        ) : null}
      </aside>
    </div>
  );
}
