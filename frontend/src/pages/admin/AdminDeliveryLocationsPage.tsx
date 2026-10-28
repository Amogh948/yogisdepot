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
import { Download, Plus, Trash2 } from "lucide-react";
import { CsvDropzone } from "../../components/ui/CsvDropzone";
import { AdminBackLink } from "../../components/admin/AdminBackLink";
import { useAdminBack } from "../../hooks/useAdminBack";

export function AdminDeliveryLocationsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-delivery-locations"], queryFn: () => adminApi.deliveryLocations() });
  const toast = useToastStore((s) => s.push);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{
    total: number;
    created: number;
    updated: number;
    failed: number;
    rows: Array<{ rowNumber: number; postalCodePrefix?: string; ok: boolean; errors: string[] }>;
  } | null>(null);
  const items = query.data?.data || [];

  async function downloadTemplate() {
    const blob = await adminApi.downloadDeliveryCsvTemplate();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "yogisdepot-delivery-areas-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function previewCsv() {
    if (!csvFile) return;
    setCsvBusy(true);
    try {
      const result = await adminApi.previewDeliveryCsv(csvFile);
      setCsvPreview(result.data);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not read that CSV", "error");
    } finally {
      setCsvBusy(false);
    }
  }

  async function importCsv() {
    if (!csvFile) return;
    setCsvBusy(true);
    try {
      const result = await adminApi.importDeliveryCsv(csvFile);
      setCsvPreview(result.data);
      if (result.data.failed) toast("Some rows could not be imported", "error");
      else toast("Delivery areas imported");
      setCsvFile(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-delivery-locations"] });
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "CSV import failed", "error");
    } finally {
      setCsvBusy(false);
    }
  }

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
        Configure postal codes, covered area names, and standard + Superfast delivery fees. Checkout matches the
        customer postal code and applies that area&apos;s fees.
      </p>
      <section className="mb-5 rounded-2xl border border-yd-border/60 bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-yd-ink">Import from CSV</p>
            <p className="mt-0.5 text-sm text-yd-muted">
              Fees are in cents. Separate area names with a pipe, for example Woodbine|Woodlands. A matching postal
              prefix is updated.
            </p>
          </div>
          <button
            type="button"
            disabled={csvBusy}
            onClick={() => void downloadTemplate()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-yd-green hover:underline disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download template
          </button>
        </div>
        <CsvDropzone
          file={csvFile}
          disabled={csvBusy}
          onFile={(next) => {
            setCsvFile(next);
            setCsvPreview(null);
          }}
        />
        {csvFile ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={csvBusy} onClick={() => void previewCsv()}>
              {csvBusy ? "Working…" : "Preview"}
            </Button>
            <Button type="button" disabled={csvBusy} onClick={() => void importCsv()}>
              Import
            </Button>
          </div>
        ) : null}
        {csvPreview ? (
          <div className="mt-4 space-y-2 border-t border-yd-border/70 pt-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge tone="muted">{csvPreview.total} rows</Badge>
              <Badge tone="sage">{csvPreview.created} create</Badge>
              <Badge tone="sage">{csvPreview.updated} update</Badge>
              <Badge tone={csvPreview.failed ? "red" : "sage"}>{csvPreview.failed} failed</Badge>
            </div>
            {csvPreview.rows.some((row) => !row.ok) ? (
              <ul className="max-h-36 space-y-1 overflow-y-auto text-yd-error">
                {csvPreview.rows
                  .filter((row) => !row.ok)
                  .slice(0, 12)
                  .map((row) => (
                    <li key={row.rowNumber}>
                      Row {row.rowNumber}
                      {row.postalCodePrefix ? ` · ${row.postalCodePrefix}` : ""}: {row.errors.join("; ")}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-yd-muted">All rows look valid.</p>
            )}
          </div>
        ) : null}
      </section>
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
                  {formatCadFromCents(item.deliveryFeeCents ?? 0)} standard
                  <span className="font-normal text-yd-muted">
                    {" "}
                    · {formatCadFromCents(item.superfastDeliveryFeeCents ?? 999)} Superfast
                  </span>
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
  const goBack = useAdminBack("/admin/delivery-locations");
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
    superfastDeliveryFeeCents: number | "";
    isActive: boolean;
  }>({
    postalCodePrefix: "",
    areaNames: [""],
    deliveryFeeCents: 499,
    superfastDeliveryFeeCents: 999,
    isActive: true,
  });

  useEffect(() => {
    const data = existing.data?.data as AdminDeliveryLocation | undefined;
    if (!data) return;
    setForm({
      postalCodePrefix: data.postalCodePrefix || "",
      areaNames: data.areaNames?.length ? [...data.areaNames] : [""],
      deliveryFeeCents: data.deliveryFeeCents ?? 499,
      superfastDeliveryFeeCents: data.superfastDeliveryFeeCents ?? 999,
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
  const superfastFeeCents =
    form.superfastDeliveryFeeCents === "" || !Number.isFinite(Number(form.superfastDeliveryFeeCents))
      ? 0
      : Math.max(0, Math.round(Number(form.superfastDeliveryFeeCents)));

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
        superfastDeliveryFeeCents: superfastFeeCents,
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
    <div className="w-full space-y-4">
      <PageHeader
        title={isNew ? "Add delivery area" : "Edit delivery area"}
        action={<AdminBackLink fallback="/admin/delivery-locations" />}
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
          label="Standard delivery fee (CAD cents)"
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
        <Input
          label="Superfast delivery surcharge (CAD cents)"
          type="number"
          min={0}
          step={1}
          value={form.superfastDeliveryFeeCents}
          onChange={(e) => {
            const raw = e.target.value;
            setForm((p) => ({
              ...p,
              superfastDeliveryFeeCents: raw === "" ? "" : Number(raw),
            }));
          }}
        />
        <p className="text-xs text-yd-muted">
          Added on top of the standard fee (or free-shipping base) for this postal area. Preview:{" "}
          {form.superfastDeliveryFeeCents === "" ? "—" : formatCadFromCents(superfastFeeCents)}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />{" "}
          Active
        </label>
        <p className="text-xs text-yd-muted">Areas are matched by postal code for Canada checkout (Calgary, AB).</p>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" disabled={saving} onClick={goBack}>
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
