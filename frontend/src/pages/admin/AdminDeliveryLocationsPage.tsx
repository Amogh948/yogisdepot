import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type AdminDeliveryLocation } from "../../services/api/admin.api";
import { PageHeader } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { ConfirmDialog } from "../../components/ui/Overlay";
import { entityId } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";

const CA_PROVINCES = [
  ["AB", "Alberta"],
  ["BC", "British Columbia"],
  ["MB", "Manitoba"],
  ["NB", "New Brunswick"],
  ["NL", "Newfoundland and Labrador"],
  ["NS", "Nova Scotia"],
  ["NT", "Northwest Territories"],
  ["NU", "Nunavut"],
  ["ON", "Ontario"],
  ["PE", "Prince Edward Island"],
  ["QC", "Quebec"],
  ["SK", "Saskatchewan"],
  ["YT", "Yukon"],
] as const;

export function AdminDeliveryLocationsPage() {
  const query = useQuery({ queryKey: ["admin-delivery-locations"], queryFn: () => adminApi.deliveryLocations() });
  const toast = useToastStore((s) => s.push);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const items = query.data?.data || [];

  return (
    <div>
      <PageHeader
        title="Delivery locations"
        action={
          <Link to="/admin/delivery-locations/new" className="text-sm font-semibold text-yd-green">
            Add location
          </Link>
        }
      />
      <p className="mb-4 text-sm text-yd-muted">
        Configure Canada launch areas. When at least one active location exists, checkout only allows matching addresses.
      </p>
      {query.isLoading ? <Skeleton className="h-40" /> : null}
      {!query.isLoading && !items.length ? (
        <EmptyState title="No delivery locations" body="Add a province, city, or postal area to start restricting delivery." />
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const id = entityId(item);
          return (
            <article key={id} className="relative rounded-2xl border border-yd-border/60 bg-white p-4 shadow-soft">
              <Link to={`/admin/delivery-locations/${id}`} className="block space-y-1">
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-yd-muted">
                  {item.province}
                  {item.city ? ` · ${item.city}` : " · province-wide"}
                  {item.postalCodePrefix ? ` · ${item.postalCodePrefix}` : ""}
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
        title="Delete delivery location"
        body="Customers in this area will no longer match this delivery zone."
        confirmLabel="Delete"
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            await adminApi.deleteDeliveryLocation(deleteId);
            toast("Location deleted");
            setDeleteId(null);
            await query.refetch();
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Could not delete location", "error");
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
  const toast = useToastStore((s) => s.push);
  const existing = useQuery({
    queryKey: ["admin-delivery-location", id],
    queryFn: () => adminApi.deliveryLocation(id!),
    enabled: !isNew,
  });

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    province: "ON",
    city: "",
    postalCodePrefix: "",
    sortOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    const data = existing.data?.data as AdminDeliveryLocation | undefined;
    if (!data) return;
    setForm({
      name: data.name || "",
      province: data.province || "ON",
      city: data.city || "",
      postalCodePrefix: data.postalCodePrefix || "",
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive !== false,
    });
  }, [existing.data]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        country: "Canada",
        province: form.province,
        city: form.city || undefined,
        postalCodePrefix: form.postalCodePrefix || undefined,
        sortOrder: Number(form.sortOrder),
        isActive: form.isActive,
      };
      if (isNew) {
        await adminApi.createDeliveryLocation(payload);
        toast("Delivery location created");
      } else {
        await adminApi.updateDeliveryLocation(id!, payload);
        toast("Delivery location saved");
      }
      navigate("/admin/delivery-locations");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not save location", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && existing.isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader
        title={isNew ? "Add delivery location" : "Edit delivery location"}
        action={
          <Link to="/admin/delivery-locations" className="text-sm font-semibold text-yd-muted">
            Back
          </Link>
        }
      />
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <Input label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="GTA launch zone" />
        <Select label="Province / territory" value={form.province} onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))}>
          {CA_PROVINCES.map(([code, label]) => (
            <option key={code} value={code}>
              {code} — {label}
            </option>
          ))}
        </Select>
        <Input
          label="City (optional)"
          value={form.city}
          onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
          placeholder="Leave blank for province-wide"
        />
        <Input
          label="Postal prefix (optional)"
          value={form.postalCodePrefix}
          onChange={(e) => setForm((p) => ({ ...p, postalCodePrefix: e.target.value }))}
          placeholder="e.g. M5V"
        />
        <Input
          label="Sort order"
          type="number"
          value={form.sortOrder}
          onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} /> Active
        </label>
        <p className="text-xs text-yd-muted">Country is fixed to Canada for the current launch.</p>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" disabled={saving} onClick={() => navigate("/admin/delivery-locations")}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={saving || !form.name.trim()} onClick={() => void save()}>
            {saving ? "Saving…" : isNew ? "Create location" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
