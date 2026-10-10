import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../services/api/admin.api";
import { PageHeader } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { entityId } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";

const PROVINCES = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
] as const;

const TAX_NAMES = ["GST", "HST", "PST", "QST"] as const;

function bpsToPercent(bps: number) {
  return (bps / 100).toFixed(bps % 100 === 0 ? 0 : 2);
}

function percentToBps(percent: number) {
  return Math.round(percent * 100);
}

function isCurrent(rate: { isActive: boolean; effectiveFrom: string; effectiveTo?: string | null }) {
  if (!rate.isActive) return false;
  const now = Date.now();
  const from = new Date(rate.effectiveFrom).getTime();
  if (Number.isNaN(from) || from > now) return false;
  if (!rate.effectiveTo) return true;
  const to = new Date(rate.effectiveTo).getTime();
  return Number.isNaN(to) || to > now;
}

export function AdminTaxRatesPage() {
  const queryClient = useQueryClient();
  const toast = useToastStore((s) => s.push);
  const ratesQuery = useQuery({ queryKey: ["admin-tax-rates"], queryFn: () => adminApi.taxRates() });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    province: "AB",
    component: "GST" as (typeof TAX_NAMES)[number],
    ratePercent: "5",
  });

  const rates = ratesQuery.data?.data || [];
  const grouped = useMemo(() => {
    const map = new Map<string, typeof rates>();
    for (const province of PROVINCES) map.set(province.code, []);
    for (const rate of rates) {
      const list = map.get(rate.province) || [];
      list.push(rate);
      map.set(rate.province, list);
    }
    return PROVINCES.map((province) => ({
      ...province,
      rates: (map.get(province.code) || []).filter(isCurrent).sort((a, b) => a.component.localeCompare(b.component)),
      historyCount: (map.get(province.code) || []).length,
    }));
  }, [rates]);

  const save = async () => {
    const percent = Number(form.ratePercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      toast("Enter a tax rate between 0 and 100%", "error");
      return;
    }
    setSaving(true);
    try {
      await adminApi.createTaxRate({
        province: form.province,
        component: form.component,
        rateBps: percentToBps(percent),
        supersedePrevious: true,
      });
      toast(`${form.component} rate saved for ${form.province}`);
      await queryClient.invalidateQueries({ queryKey: ["admin-tax-rates"] });
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not save tax rate", "error");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id: string) => {
    try {
      await adminApi.updateTaxRate(id, { isActive: false, effectiveTo: new Date().toISOString() });
      toast("Tax rate deactivated");
      await queryClient.invalidateQueries({ queryKey: ["admin-tax-rates"] });
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not update tax rate", "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Provincial taxes" />
      <p className="text-sm text-yd-muted">
        Configure GST, PST, HST, or QST by province. Checkout applies these rates using the customer&apos;s delivery
        province. Multiple components per province are supported (for example GST + PST in BC).
      </p>

      <section className="rounded-2xl border border-yd-border/60 bg-white p-4 shadow-soft">
        <h2 className="font-display text-xl text-yd-forest">Add or update a rate</h2>
        <p className="mt-1 text-xs text-yd-muted">
          Saving a new rate closes the previous open rate for the same province and tax name.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Province" value={form.province} onChange={(e) => setForm((prev) => ({ ...prev, province: e.target.value }))}>
            {PROVINCES.map((province) => (
              <option key={province.code} value={province.code}>
                {province.name} ({province.code})
              </option>
            ))}
          </Select>
          <Select
            label="Tax name"
            value={form.component}
            onChange={(e) => setForm((prev) => ({ ...prev, component: e.target.value as (typeof TAX_NAMES)[number] }))}
          >
            {TAX_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <Input
            label="Tax rate (%)"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={form.ratePercent}
            onChange={(e) => setForm((prev) => ({ ...prev, ratePercent: e.target.value }))}
          />
          <div className="flex items-end">
            <Button className="w-full" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save rate"}
            </Button>
          </div>
        </div>
      </section>

      {ratesQuery.isLoading ? <Skeleton className="h-40" /> : null}
      {!ratesQuery.isLoading && !rates.length ? (
        <EmptyState title="No tax rates configured" body="Add a provincial tax rate above, or run the Canadian tax seed script." />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {grouped.map((province) => (
          <article key={province.code} className="rounded-2xl border border-yd-border/60 bg-white p-4 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-yd-ink">{province.name}</p>
                <p className="text-xs text-yd-muted">{province.code}</p>
              </div>
              <Badge tone={province.rates.length ? "sage" : "muted"}>
                {province.rates.length ? `${province.rates.length} active` : "No active rates"}
              </Badge>
            </div>
            <ul className="mt-3 space-y-2">
              {province.rates.length ? (
                province.rates.map((rate) => {
                  const id = entityId(rate);
                  return (
                    <li key={id} className="flex items-center justify-between gap-2 rounded-xl bg-yd-cream/50 px-3 py-2 text-sm">
                      <span>
                        <span className="font-semibold">{rate.component}</span>
                        <span className="text-yd-muted"> · {bpsToPercent(rate.rateBps)}%</span>
                      </span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-yd-error"
                        onClick={() => void deactivate(id)}
                      >
                        Deactivate
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="text-sm text-yd-muted">No current rates for this province.</li>
              )}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
