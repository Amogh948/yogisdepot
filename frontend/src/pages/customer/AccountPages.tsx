import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChevronRight,
  Heart,
  HelpCircle,
  MapPin,
  Package,
  Store,
  Tag,
} from "lucide-react";
import { useAuthStore } from "../../store/auth.store";
import { addressApi, notificationsApi, wishlistApi, vendorPublicApi } from "../../services/api/commerce.api";
import { authApi } from "../../services/api/auth.api";
import { Button } from "../../components/ui/Button";
import { Input, Textarea } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/Feedback";
import { ProductGrid } from "../../components/product/ProductCarousel";
import { entityId } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";
import { useCommerceActions } from "../../hooks/useCommerceActions";

const accountLinks = [
  { to: "/orders", label: "My Orders", icon: Package },
  { to: "/addresses", label: "Addresses", icon: MapPin },
  { to: "/wishlist", label: "Wishlist", icon: Heart },
  { to: "/profile#notifications", label: "Notifications", icon: Bell },
  { to: "/offers", label: "Offers", icon: Tag },
  { to: "/help", label: "Help & Support", icon: HelpCircle },
  { to: "/vendors/apply", label: "Sell on Yogi's Depot", icon: Store },
];

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const toast = useToastStore((s) => s.push);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: () => notificationsApi.list() });
  const initials = user ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "YD" : "YD";

  if (!user) return null;
  return (
    <div className="mx-auto max-w-lg space-y-5 lg:max-w-none lg:grid lg:grid-cols-[260px_1fr] lg:gap-8 lg:space-y-0">
      <aside className="space-y-4">
        <section className="rounded-[14px] border border-yd-border bg-white p-5 shadow-soft">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-yd-green text-xl font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-2xl text-yd-forest">
                {user.firstName} {user.lastName}
              </h1>
              <p className="truncate text-sm text-yd-muted">{user.email}</p>
              <button type="button" className="mt-1 text-sm font-semibold text-yd-green" onClick={() => setEditing((v) => !v)}>
                Edit profile
              </button>
            </div>
          </div>
        </section>

        <nav className="overflow-hidden rounded-[14px] border border-yd-border bg-white shadow-soft">
          {accountLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-h-[56px] items-center gap-3 border-b border-yd-border px-4 last:border-b-0 hover:bg-yd-bg"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-yd-green/10 text-yd-green">
                <item.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
              </span>
              <span className="flex-1 font-semibold text-yd-ink">{item.label}</span>
              <ChevronRight className="h-4 w-4 text-yd-muted" />
            </Link>
          ))}
        </nav>

        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            await logout();
            navigate("/");
          }}
        >
          Logout
        </Button>
      </aside>

      <div className="space-y-4">
        {editing ? (
          <section className="rounded-[14px] border border-yd-border bg-white p-4 shadow-soft">
            <h2 className="font-display text-xl text-yd-forest">Edit profile</h2>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const result = await authApi.updateProfile({
                  firstName: String(form.get("firstName")),
                  lastName: String(form.get("lastName")),
                  phone: String(form.get("phone")),
                });
                setUser(result.data);
                toast("Profile updated");
                setEditing(false);
              }}
            >
              <Input label="First name" name="firstName" defaultValue={user.firstName} />
              <Input label="Last name" name="lastName" defaultValue={user.lastName} />
              <Input label="Phone" name="phone" defaultValue={user.phone || ""} />
              <div className="sm:col-span-2 flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button>Save</Button>
              </div>
            </form>
          </section>
        ) : null}

        <section id="notifications" className="rounded-[14px] border border-yd-border bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl text-yd-forest">Notifications</h2>
            <button className="text-sm font-semibold text-yd-green" type="button" onClick={() => notificationsApi.markAll()}>
              Mark all read
            </button>
          </div>
          <div className="space-y-2">
            {(notifications.data?.data || []).slice(0, 8).map((item) => (
              <p key={item.createdAt} className={`text-sm ${item.isRead ? "text-yd-muted" : "font-semibold text-yd-ink"}`}>
                {item.title} — {item.body}
              </p>
            ))}
            {!notifications.data?.data?.length ? <p className="text-sm text-yd-muted">No notifications yet.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

const addressSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(8),
  addressLine1: z.string().min(3),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z.string().min(3),
  country: z.string().min(2),
  addressType: z.enum(["home", "work", "other"]),
});

export function AddressesPage() {
  const query = useQuery({ queryKey: ["addresses"], queryFn: () => addressApi.list() });
  const queryClient = useQueryClient();
  const toast = useToastStore((s) => s.push);
  const form = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: { fullName: "", phone: "", addressLine1: "", city: "", state: "", postalCode: "", country: "India", addressType: "home" as const },
  });
  const create = useMutation({
    mutationFn: (values: z.infer<typeof addressSchema>) => addressApi.create(values),
    onSuccess: async () => {
      toast("Address saved");
      form.reset({ fullName: "", phone: "", addressLine1: "", city: "", state: "", postalCode: "", country: "India", addressType: "home" });
      await queryClient.invalidateQueries({ queryKey: ["addresses"] });
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl text-yd-forest">Addresses</h1>
        </div>
        {!query.data?.data?.length ? (
          <EmptyState title="No addresses yet" body="Add a delivery address for faster checkout." />
        ) : (
          query.data.data.map((address) => (
            <article key={entityId(address)} className="rounded-card border border-yd-border bg-white p-4 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold capitalize text-yd-ink">
                    {address.addressType} · {address.fullName}
                  </p>
                  <p className="mt-1 text-sm text-yd-muted">
                    {address.addressLine1}, {address.city}, {address.state} {address.postalCode}
                  </p>
                  {address.isDefault ? <p className="mt-1 text-xs font-semibold text-yd-green">Default</p> : null}
                </div>
                <button
                  className="text-sm font-semibold text-yd-error"
                  type="button"
                  onClick={async () => {
                    await addressApi.remove(entityId(address));
                    await queryClient.invalidateQueries({ queryKey: ["addresses"] });
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
      <form className="space-y-3 rounded-card border border-yd-border bg-white p-4 shadow-soft" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
        <h2 className="font-display text-xl text-yd-forest">+ Add new address</h2>
        <Input label="Full name" {...form.register("fullName")} error={form.formState.errors.fullName?.message} />
        <Input label="Phone" {...form.register("phone")} />
        <Input label="Address" {...form.register("addressLine1")} />
        <Input label="City" {...form.register("city")} />
        <Input label="State" {...form.register("state")} />
        <Input label="Postal code" {...form.register("postalCode")} />
        <Button loading={create.isPending}>Save address</Button>
      </form>
    </div>
  );
}

export function WishlistPage() {
  const query = useQuery({ queryKey: ["wishlist"], queryFn: () => wishlistApi.list() });
  const { addToCart, toggleWishlist } = useCommerceActions();
  if (!query.data?.data.length) {
    return (
      <EmptyState
        title="Your wishlist is empty"
        body="Tap the heart on a product to save it for later."
        action={<Link className="font-semibold text-yd-green" to="/products">Browse products →</Link>}
      />
    );
  }
  return (
    <div>
      <h1 className="mb-4 font-display text-3xl text-yd-forest">Wishlist</h1>
      <ProductGrid
        products={query.data.data}
        wished={new Set(query.data.data.map((p) => entityId(p)))}
        onAdd={(p) => addToCart.mutate({ product: p })}
        onWishlist={(p) => toggleWishlist.mutate({ product: p, wished: true })}
      />
    </div>
  );
}

const applySchema = z.object({
  businessName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  description: z.string().optional(),
  addressLine1: z.string().min(3),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z.string().min(3),
});

export function VendorApplyPage() {
  const toast = useToastStore((s) => s.push);
  const form = useForm({ resolver: zodResolver(applySchema) });
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-3xl text-yd-forest">Become a vendor</h1>
      <p className="mt-2 text-sm text-yd-muted">Admin approval is required before your store goes live.</p>
      <form
        className="mt-5 space-y-3"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await vendorPublicApi.apply({
              businessName: values.businessName,
              email: values.email,
              phone: values.phone,
              description: values.description,
              address: {
                addressLine1: values.addressLine1,
                city: values.city,
                state: values.state,
                postalCode: values.postalCode,
                country: "India",
              },
            });
            toast("Application submitted");
            form.reset();
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Application failed", "error");
          }
        })}
      >
        <Input label="Business name" {...form.register("businessName")} />
        <Input label="Email" {...form.register("email")} />
        <Input label="Phone" {...form.register("phone")} />
        <Textarea label="Description" {...form.register("description")} />
        <Input label="Address" {...form.register("addressLine1")} />
        <Input label="City" {...form.register("city")} />
        <Input label="State" {...form.register("state")} />
        <Input label="Postal code" {...form.register("postalCode")} />
        <Button>Submit application</Button>
      </form>
    </div>
  );
}
