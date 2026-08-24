import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, Phone, UserRound } from "lucide-react";

import { MatchChecks, MatchScoreBadge } from "@/components/MatchBits";
import { Button } from "@/components/ui/button";
import {
  bestMatch,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_TONE,
  fetchCustomers,
  fetchRequirements,
  MATCH_THRESHOLD,
  REQ_OWNERSHIP_LABELS,
  REQ_TRANSACTION_LABELS,
} from "@/lib/customers";
import { faDigits } from "@/lib/fa";
import type { Property } from "@/lib/properties";

/** Customers whose registered needs fit this property file. Admin only. */
export function MatchingCustomers({ property }: { property: Property }) {
  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
  });
  const { data: requirements } = useQuery({
    queryKey: ["customer_requirements"],
    queryFn: () => fetchRequirements(),
  });

  const rows = (customers ?? [])
    .filter((customer) => customer.status === "active")
    .map((customer) => {
      const reqs = (requirements ?? []).filter((r) => r.customer_id === customer.id);
      const match = bestMatch(property, reqs);
      return match ? { customer, ...match } : null;
    })
    .filter(
      (row): row is NonNullable<typeof row> =>
        row !== null && row.result.score >= MATCH_THRESHOLD,
    )
    .sort((a, b) => b.result.score - a.result.score);

  return (
    <section className="surface-card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <UserRound className="size-4 text-primary" />
          مشتری‌های مناسب این فایل
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {faDigits(rows.length)} مورد
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : rows.length ? (
        rows.map(({ customer, requirement, result }) => (
          <div key={customer.id} className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-start gap-2">
              <Link
                to="/customers/$id"
                params={{ id: customer.id }}
                className="min-w-0 flex-1 truncate text-sm font-bold text-primary"
              >
                {customer.full_name}
              </Link>
              <MatchScoreBadge score={result.score} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span
                className={`rounded-lg px-2 py-0.5 font-medium ${CUSTOMER_STATUS_TONE[customer.status]}`}
              >
                {CUSTOMER_STATUS_LABELS[customer.status]}
              </span>
              <span className="rounded-lg bg-secondary px-2 py-0.5 text-muted-foreground">
                {REQ_TRANSACTION_LABELS[requirement.transaction_type]} •{" "}
                {REQ_OWNERSHIP_LABELS[requirement.ownership_type]}
              </span>
            </div>
            <MatchChecks checks={result.checks} />
            {customer.phone ? (
              <a
                href={`tel:${customer.phone}`}
                className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
              >
                <Phone className="size-4" />
                <span dir="ltr">{faDigits(customer.phone)}</span>
              </a>
            ) : null}
            <Button asChild variant="secondary" className="h-9 w-full">
              <Link to="/customers/$id" params={{ id: customer.id }}>
                مشاهده مشتری
              </Link>
            </Button>
          </div>
        ))
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          فعلاً مشتری منطبق با این فایل ثبت نشده است.
        </p>
      )}
    </section>
  );
}
