import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type ExhibitionLead } from "../../services/api/admin.api";
import { PageHeader } from "../../layouts/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { ConfirmDialog } from "../../components/ui/Overlay";
import { entityId } from "../../types";
import { useToastStore } from "../../store/toast.store";
import { ApiError } from "../../services/api/client";

const QUADRANT_LABEL: Record<string, string> = {
  NW: "Northwest",
  NE: "Northeast",
  SW: "Southwest",
  SE: "Southeast",
  Other: "Outside Calgary",
};

function downloadCsv(leads: ExhibitionLead[]) {
  const header = ["Name", "Phone", "Email", "Quadrant", "Submitted"];
  const rows = leads.map((lead) => [
    lead.name,
    lead.phone,
    lead.email,
    QUADRANT_LABEL[lead.quadrant] || lead.quadrant,
    lead.createdAt ? new Date(lead.createdAt).toISOString() : "",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "exhibition-leads.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminExhibitionLeadsPage() {
  const query = useQuery({ queryKey: ["admin-exhibition-leads"], queryFn: () => adminApi.exhibitionLeads() });
  const toast = useToastStore((s) => s.push);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const leads = query.data?.data || [];

  return (
    <div>
      <PageHeader
        title="Exhibition leads"
        action={
          <Button size="sm" variant="outline" disabled={!leads.length} onClick={() => downloadCsv(leads)}>
            Download CSV
          </Button>
        }
      />
      <p className="mb-4 text-sm text-yd-muted">
        Details submitted from the home page exhibition form.
      </p>
      {query.isLoading ? <Skeleton className="h-40" /> : null}
      {!query.isLoading && !leads.length ? (
        <EmptyState title="No submissions yet" body="Leads from the home page form will show up here." />
      ) : null}
      <div className="space-y-3">
        {leads.map((lead) => {
          const id = entityId(lead);
          return (
            <article
              key={id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-yd-border/60 bg-white p-4 shadow-soft"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-charcoal-900">{lead.name}</p>
                  <Badge tone="sage">{QUADRANT_LABEL[lead.quadrant] || lead.quadrant}</Badge>
                </div>
                <p className="text-sm text-yd-muted">{lead.phone}</p>
                <p className="text-sm text-yd-muted">{lead.email}</p>
                {lead.createdAt ? (
                  <p className="text-xs text-yd-muted">{new Date(lead.createdAt).toLocaleString()}</p>
                ) : null}
              </div>
              <Button size="sm" variant="outline" onClick={() => setDeleteId(id)}>
                Delete
              </Button>
            </article>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete lead"
        body="This removes the submission. It cannot be undone."
        confirmLabel="Delete"
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            await adminApi.deleteExhibitionLead(deleteId);
            toast("Lead deleted");
            setDeleteId(null);
            await query.refetch();
          } catch (error) {
            toast(error instanceof ApiError ? error.message : "Could not delete lead", "error");
          }
        }}
      />
    </div>
  );
}
