import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../services/api/admin.api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { entityId, type Product } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";
import { formatCad } from "../../utils/money";

type ChildLink = { productId: string; quantity: number; name?: string; price?: number };

export function AdminProductChildren({ productId }: { productId: string }) {
  const toast = useToastStore((s) => s.push);
  const stack = useQuery({
    queryKey: ["admin-product-stack", productId],
    queryFn: async () => (await adminApi.productStack(productId)).data as { childProducts?: ChildLink[]; sellIndependently?: boolean },
    enabled: Boolean(productId),
  });
  const [links, setLinks] = useState<ChildLink[]>([]);
  const [sellIndependently, setSellIndependently] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const data = stack.data;
    if (!data) return;
    setLinks(data.childProducts || []);
    setSellIndependently(data.sellIndependently !== false);
  }, [stack.data]);

  const results = useQuery({
    queryKey: ["admin-product-child-search", search],
    queryFn: () => adminApi.products({ search, limit: 8 }),
    enabled: search.trim().length >= 2,
  });

  const add = (product: Product) => {
    const id = entityId(product);
    if (!id || id === productId || links.some((link) => link.productId === id)) return;
    setLinks((prev) => [...prev, { productId: id, quantity: 1, name: product.name, price: product.price }]);
    setSearch("");
  };

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateProductStack(productId, {
        sellIndependently,
        childProducts: links.map((link) => ({ productId: link.productId, quantity: link.quantity })),
      });
      toast("Included products saved");
      await stack.refetch();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not save included products", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-soft">
      <h2 className="font-display text-lg">Included products</h2>
      <p className="text-xs text-yd-muted">
        When this product is added to the cart, these items are added under it. Customers can only change the parent.
        The parent keeps its own price, and each included item is charged at its own price. Set the parent to $0 if the
        kit price should only be the included items, or price a fee on the child if it should be added on top.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={sellIndependently}
          onChange={(event) => setSellIndependently(event.target.checked)}
        />
        <span>
          <span className="font-medium">Can be sold on its own</span>
          <span className="mt-0.5 block text-xs text-yd-muted">
            Turn this off for fees and kit contents that should only appear when a parent product is added.
          </span>
        </span>
      </label>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.productId} className="flex items-center gap-2 rounded-xl border border-yd-border px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{link.name || "Product"}</p>
              <p className="text-xs text-yd-muted">{formatCad(link.price || 0)}</p>
            </div>
            <input
              type="number"
              min={1}
              max={99}
              aria-label="Quantity per parent"
              value={link.quantity}
              onChange={(event) => {
                const quantity = Math.max(1, Number(event.target.value) || 1);
                setLinks((prev) => prev.map((row) => (row.productId === link.productId ? { ...row, quantity } : row)));
              }}
              className="h-10 w-16 rounded-xl border border-yd-border px-2 text-sm"
            />
            <button
              type="button"
              className="text-sm font-semibold text-yd-error"
              onClick={() => setLinks((prev) => prev.filter((row) => row.productId !== link.productId))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <Input label="Add a product" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" />
      {results.data?.items?.length ? (
        <ul className="space-y-1">
          {results.data.items.map((product) => (
            <li key={entityId(product)}>
              <button type="button" className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-yd-cream" onClick={() => add(product)}>
                {product.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button type="button" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save included products"}
      </Button>
    </section>
  );
}
