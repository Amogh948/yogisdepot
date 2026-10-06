import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type AdminDeliveryLocation } from "../../services/api/admin.api";
import { PageHeader } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { ConfirmDialog } from "../../components/ui/Overlay";
import { entityId } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";
import { formatCadFromCents } from "../../utils/money";
import { Plus, Trash2 } from "lucide-react";

export function AdminDeliveryLocationsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-delivery-locations"], queryFn: () => adminApi.deliveryLocations() });
  const toast = useToastStore((s) => s.push);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const items = query.data?.data || [];

  return (
    <div>
      <PageHeader
        title="Delivery areas"
        action={
          <Link to="/admin/delivery-locations/new" className="text-sm font-semibold text-yd-green">
            Add area
          </Link>
        }
      />
      <p className="mb-4 text-sm text-yd-muted">
        Configure postal codes, covered area names, and delivery fees. Checkout matches the customer postal code and
        applies that area&apos;s fee.
      </p>
      {query.isLoading ? <Skeleton className="h-40" /> : null}
      {!query.isLoading && !items.length ? (
        <EmptyState title="No delivery areas" body="Add a postal code area to start restricting delivery and fees." />
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const id = entityId(item);
          const areas = item.areaNames?.length ? item.areaNames.join(", ") : item.city || "";
          return (
            <article key={id} className="relative rounded-2xl border border-yd-border/60 bg-white p-4 shadow-soft">
              <Link to={`/admin/delivery-locations/${id}`} className="block space-y-1">
                <p className="font-semibold">{item.postalCodePrefix || item.name}</p>
                <p className="line-clamp-2 text-sm text-yd-muted">{areas}</p>
                <p className="text-sm font-semibold text-yd-forest">
                  {formatCadFromCents(item.deliveryFeeCents ?? 0)} delivery
                </p>
                <Badge tone={item.isActive ? "sage" : "muted"}>{item.isActive ? "Active" : "Inactive"}</Badge>
              </Link>
              <button
                type="button"
                className="absolute right-3 top-3 text-xs font-semibold text-yd-error"
                onClick={() => setDeleteId(id)}
              >
                Delete
              </button>
            </article>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete delivery area"
        body="Customers in this postal area will no longer match this delivery zone."
        confirmLabel="Delete"
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            await adminApi.deleteDeliveryLocation(deleteId);
            toast("Area deleted");
            setDeleteId(null);
            await queryClient.invalidateQueries({ queryKey: ["admin-delivery-locations"] });
            await query.refetch();
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Could not delete area", "error");
          }
        }}
      />
    </div>
  );
}

export function AdminDeliveryLocationFormPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToastStore((s) => s.push);
  const existing = useQuery({
    queryKey: ["admin-delivery-location", id],
    queryFn: () => adminApi.deliveryLocation(id!),
    enabled: !isNew,
  });

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    postalCodePrefix: string;
    areaNames: string[];
    deliveryFeeCents: number | "";
    isActive: boolean;
  }>({
    postalCodePrefix: "",
    areaNames: [""],
    deliveryFeeCents: 499,
    isActive: true,
  });

  useEffect(() => {
    const data = existing.data?.data as AdminDeliveryLocation | undefined;
    if (!data) return;
    setForm({
      postalCodePrefix: data.postalCodePrefix || "",
      areaNames: data.areaNames?.length ? [...data.areaNames] : [""],
      deliveryFeeCents: data.deliveryFeeCents ?? 499,
      isActive: data.isActive !== false,
    });
  }, [existing.data]);

  const setAreaName = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      areaNames: prev.areaNames.map((name, i) => (i === index ? value : name)),
    }));
  };

  const addAreaName = () => {
    setForm((prev) => ({ ...prev, areaNames: [...prev.areaNames, ""] }));
  };

  const removeAreaName = (index: number) => {
    setForm((prev) => {
      const next = prev.areaNames.filter((_, i) => i !== index);
      return { ...prev, areaNames: next.length ? next : [""] };
    });
  };

  const cleanedAreaNames = form.areaNames.map((name) => name.trim()).filter(Boolean);
  const feeCents =
    form.deliveryFeeCents === "" || !Number.isFinite(Number(form.deliveryFeeCents))
      ? 0
      : Math.max(0, Math.round(Number(form.deliveryFeeCents)));

  const save = async () => {
    if (!form.postalCodePrefix.trim()) {
      toast("Postal code is required", "error");
      return;
    }
    if (!cleanedAreaNames.length) {
      toast("Enter at least one area name", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        postalCodePrefix: form.postalCodePrefix.trim().toUpperCase(),
        areaNames: cleanedAreaNames,
        deliveryFeeCents: feeCents,
        province: "AB",
        city: "Calgary",
        country: "Canada",
        isActive: form.isActive,
      };
      if (isNew) {
        await adminApi.createDeliveryLocation(payload);
        toast("Delivery area created");
      } else {
        await adminApi.updateDeliveryLocation(id!, payload);
        toast("Delivery area saved");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-delivery-locations"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-delivery-location"] });
      navigate("/admin/delivery-locations");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not save area", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && existing.isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader
        title={isNew ? "Add delivery area" : "Edit delivery area"}
        action={
          <Link to="/admin/delivery-locations" className="text-sm font-semibold text-yd-muted">
            Back
          </Link>
        }
      />
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <Input
          label="Postal code"
          value={form.postalCodePrefix}
          onChange={(e) => setForm((p) => ({ ...p, postalCodePrefix: e.target.value.toUpperCase() }))}
          placeholder="e.g. T2W"
          required
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-yd-ink">Area names</p>
            <Button type="button" size="sm" variant="outline" onClick={addAreaName}>
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
              Add area
            </Button>
          </div>
          <p className="text-xs text-yd-muted">Neighbourhoods covered by this postal code</p>
          <ul className="space-y-2">
            {form.areaNames.map((name, index) => (
              <li key={index} className="flex items-center gap-2">
                <input
                  value={name}
                  onChange={(e) => setAreaName(index, e.target.value)}
                  placeholder={`Area ${index + 1}`}
                  className="h-11 w-full rounded-xl border border-yd-border bg-white px-3 text-sm outline-none ring-yd-green/40 focus:ring-2"
                  aria-label={`Area name ${index + 1}`}
                />
                <button
                  type="button"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-yd-border text-yd-error hover:bg-yd-cream"
                  onClick={() => removeAreaName(index)}
                  aria-label={`Remove area ${index + 1}`}
                  disabled={form.areaNames.length === 1 && !form.areaNames[0].trim()}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <Input
          label="Delivery fee (CAD cents)"
          type="number"
          min={0}
          step={1}
          value={form.deliveryFeeCents}
          onChange={(e) => {
            const raw = e.target.value;
            setForm((p) => ({
              ...p,
              deliveryFeeCents: raw === "" ? "" : Number(raw),
            }));
          }}
        />
        <p className="text-xs text-yd-muted">
          Preview: {form.deliveryFeeCents === "" ? "—" : formatCadFromCents(feeCents)}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />{" "}
          Active
        </label>
        <p className="text-xs text-yd-muted">Areas are matched by postal code for Canada checkout (Calgary, AB).</p>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" disabled={saving} onClick={() => navigate("/admin/delivery-locations")}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={saving || !form.postalCodePrefix.trim() || !cleanedAreaNames.length}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : isNew ? "Create area" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
