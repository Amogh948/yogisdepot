import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../services/api/admin.api";
import { PageHeader } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Input, Select, Textarea } from "../../components/ui/Input";
import { Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { ConfirmDialog } from "../../components/ui/Overlay";
import { entityId, mediaUrl, type Vendor } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";

const CA_PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"] as const;

type VendorFormState = {
  businessName: string;
  description: string;
  email: string;
  phone: string;
  logo: string;
  commissionRate: number;
  status: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  firstName: string;
  lastName: string;
  password: string;
};

const emptyForm: VendorFormState = {
  businessName: "",
  description: "",
  email: "",
  phone: "",
  logo: "",
  commissionRate: 10,
  status: "active",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "ON",
  postalCode: "",
  country: "Canada",
  firstName: "",
  lastName: "",
  password: "",
};

function adminCardImage(src?: string, alt?: string) {
  if (!src) {
    return <div className="flex aspect-[4/3] items-center justify-center bg-yd-cream text-xs text-yd-muted">No image</div>;
  }
  return <img src={mediaUrl(src)} alt={alt || ""} className="aspect-[4/3] w-full object-cover" loading="lazy" />;
}

export function AdminVendorsPage() {
  const [status, setStatus] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["admin-vendors", status],
    queryFn: () => adminApi.vendors(status ? { status } : undefined),
  });
  const toast = useToastStore((s) => s.push);
  const items = query.data?.items || [];

  return (
    <div>
      <PageHeader
        title="Vendors"
        action={
          <Link to="/admin/vendors/new" className="text-sm font-semibold text-yd-green">
            Add vendor
          </Link>
        }
      />
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {["", "pending", "active", "rejected", "suspended"].map((value) => (
          <button
            key={value}
            className={`rounded-full px-3 py-1 text-sm ${status === value ? "bg-saffron-600 text-white" : "bg-white"}`}
            onClick={() => setStatus(value)}
            type="button"
          >
            {value || "all"}
          </button>
        ))}
      </div>
      {query.isLoading ? <Skeleton className="h-40" /> : null}
      {!query.isLoading && !items.length ? <EmptyState title="No vendors" body="Create a vendor or wait for applications." /> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((vendor) => {
          const id = entityId(vendor);
          return (
            <article key={id} className="relative overflow-hidden rounded-2xl border border-yd-border/60 bg-white shadow-soft">
              <Link to={`/admin/vendors/${id}`} className="block transition hover:border-yd-green/40">
                {adminCardImage(vendor.logo, vendor.businessName)}
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold">{vendor.businessName}</p>
                  <p className="truncate text-xs text-yd-muted">{vendor.email}</p>
                  <Badge>{vendor.status}</Badge>
                </div>
              </Link>
              <button
                type="button"
                className="absolute right-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-yd-error shadow-soft"
                onClick={(event) => {
                  event.preventDefault();
                  setDeleteId(id);
                }}
              >
                Delete
              </button>
            </article>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete vendor"
        body="This permanently removes the vendor. Vendors with products cannot be deleted until those products are removed."
        confirmLabel="Delete"
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            await adminApi.deleteVendor(deleteId);
            toast("Vendor deleted");
            setDeleteId(null);
            await query.refetch();
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Could not delete vendor", "error");
          }
        }}
      />
    </div>
  );
}

export function AdminVendorFormPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<VendorFormState>(emptyForm);

  const existing = useQuery({
    queryKey: ["admin-vendor", id],
    queryFn: () => adminApi.vendor(id!),
    enabled: !isNew,
  });

  useEffect(() => {
    const vendor = existing.data?.data as Vendor | undefined;
    if (!vendor) return;
    const owner = typeof vendor.userId === "object" ? vendor.userId : undefined;
    setForm({
      businessName: vendor.businessName || "",
      description: vendor.description || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      logo: vendor.logo || "",
      commissionRate: vendor.commissionRate ?? 10,
      status: vendor.status || "active",
      addressLine1: vendor.address?.addressLine1 || "",
      addressLine2: vendor.address?.addressLine2 || "",
      city: vendor.address?.city || "",
      state: vendor.address?.state || "ON",
      postalCode: vendor.address?.postalCode || "",
      country: vendor.address?.country || "Canada",
      firstName: owner?.firstName || "",
      lastName: owner?.lastName || "",
      password: "",
    });
  }, [existing.data]);

  const statusMutate = useMutation({
    mutationFn: (status: string) => adminApi.vendorStatus(id!, { status }),
    onSuccess: async () => {
      toast("Status updated");
      await queryClient.invalidateQueries({ queryKey: ["admin-vendor", id] });
      await queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Status update failed", "error"),
  });

  const setField = <K extends keyof VendorFormState>(key: K, value: VendorFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        businessName: form.businessName,
        description: form.description || undefined,
        email: form.email,
        phone: form.phone,
        logo: form.logo || undefined,
        commissionRate: Number(form.commissionRate),
        status: form.status,
        address: {
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2 || undefined,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          country: form.country || "Canada",
        },
      };
      if (isNew) {
        const created = await adminApi.createVendor({
          ...payload,
          firstName: form.firstName,
          lastName: form.lastName,
          password: form.password || undefined,
        });
        toast("Vendor created");
        navigate(`/admin/vendors/${entityId(created.data)}`);
      } else {
        await adminApi.updateVendor(id!, payload);
        toast("Vendor saved");
        await queryClient.invalidateQueries({ queryKey: ["admin-vendor", id] });
        await queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      }
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not save vendor", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && existing.isLoading) return <Skeleton className="h-48" />;
  if (!isNew && (existing.isError || !existing.data?.data)) {
    return (
      <EmptyState
        title="Vendor not found"
        body="This vendor may have been removed."
        action={
          <Button variant="outline" onClick={() => navigate("/admin/vendors")}>
            Back
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <PageHeader
        title={isNew ? "Add vendor" : "Edit vendor"}
        action={
          <Link to="/admin/vendors" className="text-sm font-semibold text-yd-muted">
            Back
          </Link>
        }
      />

      {!isNew ? (
        <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-4 shadow-soft">
          <Button size="sm" onClick={() => statusMutate.mutate("approved")}>
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => statusMutate.mutate("rejected")}>
            Reject
          </Button>
          <Button size="sm" variant="danger" onClick={() => statusMutate.mutate("suspended")}>
            Suspend
          </Button>
          <Button size="sm" variant="secondary" onClick={() => statusMutate.mutate("active")}>
            Reactivate
          </Button>
        </div>
      ) : null}

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <h2 className="font-display text-lg">Store</h2>
        <Input label="Business name" value={form.businessName} onChange={(e) => setField("businessName", e.target.value)} />
        <Textarea label="Description" value={form.description} onChange={(e) => setField("description", e.target.value)} rows={3} />
        <Input label="Store email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
        <Input label="Phone" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
        <Input label="Logo URL" value={form.logo} onChange={(e) => setField("logo", e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Commission %"
            type="number"
            value={form.commissionRate}
            onChange={(e) => setField("commissionRate", Number(e.target.value))}
          />
          <Select label="Status" value={form.status} onChange={(e) => setField("status", e.target.value)}>
            {["pending", "active", "rejected", "suspended", "inactive"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
        <h2 className="font-display text-lg">Address</h2>
        <Input label="Address line 1" value={form.addressLine1} onChange={(e) => setField("addressLine1", e.target.value)} />
        <Input label="Address line 2" value={form.addressLine2} onChange={(e) => setField("addressLine2", e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="City" value={form.city} onChange={(e) => setField("city", e.target.value)} />
          <Select label="Province" value={form.state} onChange={(e) => setField("state", e.target.value)}>
            {CA_PROVINCES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
          <Input label="Postal code" value={form.postalCode} onChange={(e) => setField("postalCode", e.target.value)} />
          <Input label="Country" value={form.country} onChange={(e) => setField("country", e.target.value)} />
        </div>
      </section>

      {isNew ? (
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
          <h2 className="font-display text-lg">Owner account</h2>
          <p className="text-xs text-yd-muted">Creates a vendor login, or links an existing user with this email.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="First name" value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} />
            <Input label="Last name" value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} />
          </div>
          <Input
            label="Temporary password"
            type="password"
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
            placeholder="Defaults to Password@123 if blank"
          />
        </section>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 border-t border-yd-border bg-white p-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto flex max-w-2xl gap-2">
          {!isNew ? (
            <Button variant="danger" disabled={saving} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          ) : null}
          <Button variant="outline" disabled={saving} onClick={() => navigate("/admin/vendors")}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={
              saving ||
              !form.businessName.trim() ||
              !form.email.trim() ||
              !form.phone.trim() ||
              !form.addressLine1.trim() ||
              !form.city.trim() ||
              (isNew && (!form.firstName.trim() || !form.lastName.trim()))
            }
            onClick={() => void save()}
          >
            {saving ? "Saving…" : isNew ? "Create vendor" : "Save changes"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete vendor"
        body="This permanently removes the vendor. Vendors with products cannot be deleted until those products are removed."
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await adminApi.deleteVendor(id!);
            toast("Vendor deleted");
            navigate("/admin/vendors");
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Could not delete vendor", "error");
          }
        }}
      />
    </div>
  );
}
