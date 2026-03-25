"use client";

/**
 * DecisionHistoryTable — Story 4.4
 *
 * Paginated table of decision records fetched from GET /api/underwriting/history.
 * Columns: Time | Decision | Credit Limit | APR | Segment | Rules Triggered | Detail
 *
 * Features:
 * - 10 records per page with prev/next pagination
 * - Decision filter (all | approve | review | reject)
 * - Row click opens a detail Sheet showing full JSON audit trail
 */

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Eye, RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DecisionBadge } from "@/components/shared/DecisionBadge";
import { apiClient, type ApiError } from "@/lib/api";
import type { DecisionRecord, Decision } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMoney(value: number | null | undefined): string {
  if (value == null) return "—";
  return `$${value.toLocaleString()}`;
}

function formatAPR(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, HH:mm");
  } catch {
    return iso;
  }
}

function segmentLabel(segment: string): string {
  return segment.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Detail Sheet ──────────────────────────────────────────────────────────────

interface DetailSheetProps {
  record: DecisionRecord | null;
  open: boolean;
  onClose: () => void;
}

function DetailSheet({ record, open, onClose }: DetailSheetProps) {
  if (!record) return null;
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full max-w-[520px] border-surface-border bg-surface-base text-zinc-200 sm:w-[520px]"
      >
        <SheetHeader className="border-b border-surface-border pb-3">
          <SheetTitle className="flex items-center gap-2 text-zinc-100">
            Decision Detail
            <DecisionBadge decision={record.decision} />
          </SheetTitle>
          <SheetDescription className="font-mono text-xs text-zinc-600">
            {record.id}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 overflow-y-auto">
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Credit Limit", value: formatMoney(record.credit_limit) },
              { label: "APR", value: formatAPR(record.apr) },
              { label: "Confidence", value: `${(record.confidence_score * 100).toFixed(0)}%` },
              { label: "Segment", value: segmentLabel(record.risk_segment) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-surface-border bg-surface-raised p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{label}</p>
                <p className="mt-1 font-mono text-sm font-semibold text-zinc-200">{value}</p>
              </div>
            ))}
          </div>

          {/* Reason codes */}
          {record.reason_codes?.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Reason Codes</p>
              <div className="flex flex-wrap gap-1">
                {record.reason_codes.map((rc) => (
                  <Badge key={rc} variant="outline" className="border-surface-border font-mono text-xs text-zinc-400">
                    {rc}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Rules triggered */}
          {record.rules_triggered?.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Rules Triggered</p>
              <div className="flex flex-wrap gap-1">
                {record.rules_triggered.map((r) => (
                  <Badge key={r} variant="outline" className="border-amber-700/50 bg-amber-950/30 font-mono text-xs text-amber-400">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Full JSON */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Raw Audit Record</p>
            <pre className="max-h-80 overflow-auto rounded-lg border border-surface-border bg-surface-base p-3 font-mono text-xs leading-relaxed text-zinc-400">
              {JSON.stringify(record, null, 2)}
            </pre>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Table skeleton ────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-md bg-surface-overlay" />
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type FilterDecision = Decision | "all";

const PAGE_SIZE = 10;

export function DecisionHistoryTable() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterDecision>("all");
  const [records, setRecords] = useState<DecisionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DecisionRecord | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.underwriting.history({
        page,
        page_size: PAGE_SIZE,
        decision: filter,
      });
      setRecords(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err) {
      setError((err as ApiError).detail || "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Reset page when filter changes
  const handleFilterChange = (val: FilterDecision) => {
    setFilter(val);
    setPage(1);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => handleFilterChange(v as FilterDecision)}>
            <SelectTrigger className="h-8 w-36 border-surface-border bg-surface-overlay text-sm text-zinc-300">
              <SelectValue placeholder="All decisions" />
            </SelectTrigger>
            <SelectContent className="border-surface-border bg-surface-overlay text-zinc-200">
              <SelectItem value="all">All decisions</SelectItem>
              <SelectItem value="approve">Approve</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="reject">Reject</SelectItem>
            </SelectContent>
          </Select>
          <span className="font-mono text-xs text-zinc-600">{total} records</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetch}
          disabled={loading}
          className="h-8 gap-1.5 px-2 text-xs text-zinc-500 hover:text-zinc-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-reject-base/30 bg-reject-muted p-4 text-sm text-reject-base">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : records.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-surface-border text-zinc-600">
          <p className="text-sm">No decisions found</p>
          <p className="text-xs">Make a decision in the Underwriting or Copilot tab to see records here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-border">
          <Table>
            <TableHeader>
              <TableRow className="border-surface-border bg-surface-raised hover:bg-surface-raised">
                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Time</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Decision</TableHead>
                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Credit Limit</TableHead>
                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-600">APR</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Segment</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Rules Hit</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600" aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((rec, idx) => (
                <TableRow
                  key={rec.id}
                  className={`cursor-pointer border-surface-border hover:bg-surface-overlay ${
                    idx % 2 === 0 ? "bg-surface-base" : "bg-surface-raised/40"
                  }`}
                  onClick={() => setSelected(rec)}
                >
                  <TableCell className="font-mono text-xs text-zinc-500">
                    {formatDate(rec.created_at)}
                  </TableCell>
                  <TableCell>
                    <DecisionBadge decision={rec.decision} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-zinc-300">
                    {formatMoney(rec.credit_limit)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-zinc-300">
                    {formatAPR(rec.apr)}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-400">
                    {segmentLabel(rec.risk_segment)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-600">
                    {rec.rules_triggered?.length ?? 0}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-zinc-600 hover:text-zinc-200"
                      onClick={(e) => { e.stopPropagation(); setSelected(rec); }}
                      aria-label="View details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-zinc-600">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              className="h-7 gap-1 border-surface-border bg-surface-raised px-2 text-xs text-zinc-400 hover:text-zinc-200"
            >
              <ChevronLeft className="h-3 w-3" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 gap-1 border-surface-border bg-surface-raised px-2 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail sheet */}
      <DetailSheet
        record={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
