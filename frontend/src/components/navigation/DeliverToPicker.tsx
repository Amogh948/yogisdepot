import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { BottomSheet } from "../ui/Overlay";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Feedback";
import { addressApi, deliveryApi } from "../../services/api/commerce.api";
import { useAuthStore } from "../../store/auth.store";
import { formatDeliveryLabel, useDeliveryPreferenceStore } from "../../store/deliveryPreference.store";
import { useLocationHint } from "../../hooks/useSettings";
import { entityId, type Address } from "../../types";
import { DeliveryCoverageNotice } from "../commerce/DeliveryCoverageNotice";
import { assessDeliveryCoverage } from "../../utils/deliveryCoverage";

function addressSummary(address: Address) {
  return `${address.addressLine1}${address.addressLine2 ? `, ${address.addressLine2}` : ""}, ${address.city}, ${address.state} ${address.postalCode}`;
}

function PlaceChooser({
  open,
  usingFallback,
  onUse,
  onFallback,
}: {
  open: boolean;
  usingFallback: boolean;
  onUse: (place: { label: string; city: string; postalCode?: string; source: "manual" | "ip" }, keepOpen?: boolean) => void;
  onFallback: () => void;
}) {
  const hint = useLocationHint(open);
  const areas = useQuery({
    queryKey: ["delivery-locations"],
    queryFn: () => deliveryApi.locations(),
    staleTime: 60_000,
  });
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [checked, setChecked] = useState(false);
  const suggestion = hint.data?.city
    ? [hint.data.city, hint.data.region].filter(Boolean).join(", ")
    : "";
  const draft = {
    label: city.trim(),
    city: city.trim(),
    postalCode: postalCode.trim() || undefined,
  };
  const showDraft = checked && Boolean(draft.city || draft.postalCode);

  const submit = (place: { label: string; city: string; postalCode?: string; source: "manual" | "ip" }) => {
    setChecked(true);
    if (areas.isError) {
      onUse(place, false);
      return;
    }
    const result = assessDeliveryCoverage(place, areas.data?.data || []);
    const blocked = areas.isLoading || result.status === "unavailable" || result.status === "needs-postal";
    onUse(place, blocked);
  };

  return (
    <div className="space-y-3 border-b border-yd-border pb-3">
      <p className="text-sm text-yd-muted">
        {usingFallback
          ? "Using Toronto until you pick a place. You can change this anytime."
          : "Choose where to deliver. You can change this anytime."}
      </p>
      {suggestion ? (
        <Button
          className="w-full"
          variant="outline"
          onClick={() => submit({ label: hint.data?.city || suggestion, city: hint.data?.city || suggestion, source: "ip" })}
        >
          Use {suggestion}
        </Button>
      ) : null}
      <label className="block space-y-1">
        <span className="text-xs font-medium text-yd-ink">City</span>
        <input
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className="h-11 w-full rounded-xl border border-yd-border px-3 text-sm outline-none ring-yd-green/40 focus:ring-2"
          placeholder="Calgary"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-yd-ink">Postal code</span>
        <input
          value={postalCode}
          onChange={(event) => setPostalCode(event.target.value)}
          className="h-11 w-full rounded-xl border border-yd-border px-3 text-sm outline-none ring-yd-green/40 focus:ring-2"
          placeholder="T2P 1J9"
        />
      </label>
      <Button
        className="w-full"
        disabled={!city.trim()}
        onClick={() => submit({ ...draft, source: "manual" })}
      >
        Use this place
      </Button>
      <DeliveryCoverageNotice place={showDraft ? draft : undefined} className="rounded-xl" />
      <button type="button" className="w-full text-sm font-semibold text-yd-muted" onClick={onFallback}>
        Not now — use Toronto for now
      </button>
    </div>
  );
}

function PickerBody({
  user,
  loading,
  items,
  preferenceId,
  open,
  usingFallback,
  onUsePlace,
  onFallback,
  onSelect,
  onClose,
  onSignIn,
  onAddAddress,
}: {
  user: unknown;
  loading: boolean;
  items: Address[];
  preferenceId?: string;
  open: boolean;
  usingFallback: boolean;
  onUsePlace: (place: { label: string; city: string; postalCode?: string; source: "manual" | "ip" }, keepOpen?: boolean) => void;
  onFallback: () => void;
  onSelect: (address: Address) => void;
  onClose: () => void;
  onSignIn: () => void;
  onAddAddress: () => void;
}) {
  const chooser = <PlaceChooser open={open} usingFallback={usingFallback} onUse={onUsePlace} onFallback={onFallback} />;

  if (!user) {
    return (
      <div className="space-y-4 py-2">
        {chooser}
        <p className="text-sm text-yd-muted">Sign in to choose a saved delivery address. Checkout still uses the address you enter there.</p>
        <Button className="w-full" variant="outline" onClick={onSignIn}>
          Sign in
        </Button>
      </div>
    );
  }

  if (loading) return <Skeleton className="h-28" />;

  if (!items.length) {
    return (
      <div className="space-y-4 py-2">
        {chooser}
        <p className="text-sm text-yd-muted">You don’t have any saved addresses yet.</p>
        <Button className="w-full" onClick={onAddAddress}>
          Add an address
        </Button>
      </div>
    );
  }

  return (
    <>
      {chooser}
      <ul className="mt-3 space-y-2">
        {items.map((address) => {
          const id = entityId(address);
          const selected = preferenceId === id;
          return (
            <li key={id}>
              <button
                type="button"
                className={`w-full rounded-[14px] border p-3 text-left transition ${
                  selected ? "border-yd-green ring-1 ring-yd-green/30" : "border-yd-border hover:border-yd-green/40"
                }`}
                onClick={() => onSelect(address)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold capitalize text-yd-ink">
                      {address.addressType}
                      {address.isDefault ? <span className="ml-2 text-xs font-semibold text-yd-green">Default</span> : null}
                    </p>
                    <p className="mt-0.5 text-sm text-yd-ink">{formatDeliveryLabel(address)}</p>
                    <p className="mt-1 text-xs text-yd-muted">{addressSummary(address)}</p>
                  </div>
                  <span
                    className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                      selected ? "border-yd-green bg-yd-green" : "border-yd-border"
                    }`}
                    aria-hidden
                  >
                    {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 border-t border-yd-border pt-3">
        <Link to="/addresses" className="text-sm font-semibold text-yd-green" onClick={onClose}>
          Manage addresses
        </Link>
      </div>
    </>
  );
}

function DesktopPopover({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointer = (event: MouseEvent) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(event.target as Node)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    // Defer so the opening click does not immediately close the popover.
    const timer = window.setTimeout(() => document.addEventListener("mousedown", onPointer), 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Deliver to"
      className="absolute left-0 top-[calc(100%+8px)] z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-card border border-yd-border bg-white shadow-card"
    >
      <div className="flex items-center justify-between border-b border-yd-border px-4 py-3">
        <h2 className="font-display text-lg text-yd-forest">Deliver to</h2>
        <button type="button" className="min-h-9 px-2 text-sm font-semibold text-yd-muted" onClick={onClose}>
          Done
        </button>
      </div>
      <div className="max-h-[min(420px,70vh)] overflow-y-auto p-4">{children}</div>
    </div>
  );
}

export function DeliverToTrigger({
  variant = "pill",
  className = "",
}: {
  variant?: "pill" | "text";
  className?: string;
}) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const preference = useDeliveryPreferenceStore((s) => s.preference);
  const setFromAddress = useDeliveryPreferenceStore((s) => s.setFromAddress);
  const setPlace = useDeliveryPreferenceStore((s) => s.setPlace);
  const clear = useDeliveryPreferenceStore((s) => s.clear);
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const addresses = useQuery({
    queryKey: ["addresses"],
    queryFn: () => addressApi.list(),
    enabled: Boolean(user),
  });

  const items = addresses.data?.data || [];
  const label = preference?.label || "Select location";

  useEffect(() => {
    if (preference) return;
    if (user && (addresses.isLoading || !addresses.data)) return;
    if (user && items.length > 0) return;
    if (sessionStorage.getItem("yd_location_prompt_seen")) return;
    sessionStorage.setItem("yd_location_prompt_seen", "1");
    setOpen(true);
  }, [preference, user, addresses.isLoading, addresses.data, items.length]);

  useEffect(() => {
    if (!user || addresses.isLoading || !addresses.data) return;
    const list = addresses.data.data || [];
    if (!preference) {
      const fallback = list.find((item) => item.isDefault) || list[0];
      if (fallback) setFromAddress(fallback);
      return;
    }
    // A typed place is not one of the saved addresses, so don't swap it back.
    if (preference.source && preference.source !== "address") return;
    if (preference.addressId === "manual" || preference.addressId === "ip" || preference.addressId === "fallback") return;
    const stillExists = list.some((item) => entityId(item) === preference.addressId);
    if (list.length && !stillExists) {
      const fallback = list.find((item) => item.isDefault) || list[0];
      if (fallback) setFromAddress(fallback);
      else clear();
    }
  }, [user, addresses.isLoading, addresses.data, preference, setFromAddress, clear]);

  const close = () => setOpen(false);

  const body = (
    <PickerBody
      user={user}
      loading={addresses.isLoading}
      items={items}
      preferenceId={preference?.addressId}
      open={open}
      usingFallback={preference?.source === "fallback"}
      onUsePlace={(place, keepOpen) => {
        setPlace(place);
        if (!keepOpen) close();
      }}
      onFallback={() => {
        setPlace({ label: "Toronto", city: "Toronto", source: "fallback" });
        close();
      }}
      onSelect={(address) => {
        setFromAddress(address);
        close();
      }}
      onClose={close}
      onSignIn={() => {
        close();
        navigate("/login");
      }}
      onAddAddress={() => {
        close();
        navigate("/addresses");
      }}
    />
  );

  const baseClass =
    variant === "pill"
      ? "flex max-w-[180px] items-center gap-1.5 rounded-full border border-yd-border bg-white px-3 py-2 text-left text-xs transition hover:border-yd-green/50"
      : "mt-1.5 flex min-w-0 items-center gap-1 text-xs text-yd-muted";

  return (
    <div className="relative">
      <button
        type="button"
        className={`${baseClass} ${className}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 text-yd-green" aria-hidden />
        {variant === "pill" ? (
          <span className="truncate text-yd-muted">
            Deliver to <span className="font-semibold text-yd-ink">{label}</span>
          </span>
        ) : (
          <span className="truncate">Deliver to {label}</span>
        )}
      </button>

      {/* Desktop: anchored dropdown under the pill */}
      {isDesktop ? (
        <DesktopPopover open={open} onClose={close}>
          {body}
        </DesktopPopover>
      ) : (
        <BottomSheet open={open} title="Deliver to" onClose={close}>
          {body}
        </BottomSheet>
      )}
    </div>
  );
}
