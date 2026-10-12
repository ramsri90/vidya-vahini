"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldAlert,
  Search,
  Filter,
  Calendar,
  Eye,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { SerializedAuditLog } from "@/lib/audit/query";

interface AuditLogsManagerProps {
  logs: SerializedAuditLog[];
  totalCount: number;
  page: number;
  totalPages: number;
  distinctActions: string[];
  currentAction?: string;
  currentActor?: string;
  currentStartDate?: string;
  currentEndDate?: string;
}

export function AuditLogsManager({
  logs,
  totalCount,
  page,
  totalPages,
  distinctActions,
  currentAction = "all",
  currentActor = "",
  currentStartDate = "",
  currentEndDate = "",
}: AuditLogsManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [actionFilter, setActionFilter] = useState(currentAction);
  const [actorSearch, setActorSearch] = useState(currentActor);
  const [startDate, setStartDate] = useState(currentStartDate);
  const [endDate, setEndDate] = useState(currentEndDate);

  const [selectedMetaLog, setSelectedMetaLog] = useState<SerializedAuditLog | null>(null);

  function applyFilters(newPage = 1) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));

    if (actionFilter && actionFilter !== "all") {
      params.set("action", actionFilter);
    } else {
      params.delete("action");
    }

    if (actorSearch.trim()) {
      params.set("actor", actorSearch.trim());
    } else {
      params.delete("actor");
    }

    if (startDate) {
      params.set("startDate", startDate);
    } else {
      params.delete("startDate");
    }

    if (endDate) {
      params.set("endDate", endDate);
    } else {
      params.delete("endDate");
    }

    router.push(`/admin/audit-logs?${params.toString()}`);
  }

  function handleReset() {
    setActionFilter("all");
    setActorSearch("");
    setStartDate("");
    setEndDate("");
    router.push("/admin/audit-logs");
  }

  function getActionBadgeStyle(action: string) {
    if (action.includes("delete")) {
      return "bg-red-50 text-red-700 border-red-200";
    }
    if (action.includes("failed") || action.includes("reject")) {
      return "bg-amber-50 text-amber-700 border-amber-200";
    }
    if (action.includes("upload") || action.includes("create")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (action.includes("reset") || action.includes("reassign")) {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }
    return "bg-[#CCFBF1] text-[#0F766E] border-[#0F766E]/20";
  }

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <div className="bg-white rounded-[14px] border border-[#E7E0D2] p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          {/* Action Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-[#1F2937] mb-1.5 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#0F766E]" />
              Action Filter
            </label>
            <Select
              value={actionFilter}
              onValueChange={(val) => setActionFilter(val)}
            >
              <SelectTrigger className="w-full h-10 border-[#E7E0D2] bg-white text-xs">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {distinctActions.map((act) => (
                  <SelectItem key={act} value={act}>
                    {act}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actor Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-[#1F2937] mb-1.5 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[#0F766E]" />
              Actor (Email or Name)
            </label>
            <input
              type="text"
              value={actorSearch}
              onChange={(e) => setActorSearch(e.target.value)}
              placeholder="Search by actor email..."
              className="w-full h-10 px-3 border border-[#E7E0D2] rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#0F766E] bg-white"
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters(1);
              }}
            />
          </div>

          {/* Date Range Start */}
          <div className="w-full md:w-36">
            <label className="block text-xs font-semibold text-[#1F2937] mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#0F766E]" />
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-10 px-3 border border-[#E7E0D2] rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#0F766E] bg-white"
            />
          </div>

          {/* Date Range End */}
          <div className="w-full md:w-36">
            <label className="block text-xs font-semibold text-[#1F2937] mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#0F766E]" />
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-10 px-3 border border-[#E7E0D2] rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#0F766E] bg-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 md:pt-0">
            <Button
              onClick={() => applyFilters(1)}
              className="h-10 px-4 bg-[#0F766E] hover:bg-[#0F766E]/90 text-white font-semibold text-xs"
            >
              Filter
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="h-10 px-3 border-[#E7E0D2] text-[#6B7280] hover:text-[#1F2937] text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-[14px] border border-[#E7E0D2] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#E7E0D2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#0F766E]" />
            <h2 className="font-heading font-bold text-base text-[#1F2937]">
              Immutable Audit Trail
            </h2>
          </div>
          <span className="text-xs text-[#6B7280]">
            Showing {logs.length} of {totalCount} records (50 per page)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAF7F2] border-b border-[#E7E0D2] text-[#6B7280] text-xs font-semibold uppercase">
              <tr>
                <th className="px-6 py-3.5">Timestamp (UTC)</th>
                <th className="px-6 py-3.5">Action</th>
                <th className="px-6 py-3.5">Actor</th>
                <th className="px-6 py-3.5">Target</th>
                <th className="px-6 py-3.5 text-right">Sanitized Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0D2]/60">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#6B7280]">
                    No audit records found matching the specified criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAF7F2]/50 transition-colors">
                    <td className="px-6 py-4 text-xs font-mono text-[#6B7280] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "medium",
                        timeZone: "UTC",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getActionBadgeStyle(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {log.actorEmail ? (
                        <div>
                          <div className="font-semibold text-xs text-[#1F2937]">
                            {log.actorName || log.actorEmail}
                          </div>
                          <div className="text-[11px] text-[#6B7280]">
                            {log.actorEmail} &bull; {log.actorRole}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-[#9CA3AF] italic">System / Anonymous</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-[#4B5563]">
                      {log.targetType ? (
                        <span>
                          <strong className="text-[#1F2937]">{log.targetType}</strong>
                          {log.targetId && (
                            <span className="text-[#6B7280] font-mono ml-1">
                              ({log.targetId.slice(0, 8)}...)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[#9CA3AF]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMetaLog(log)}
                          className="h-7 px-2.5 text-xs border-[#E7E0D2] text-[#0F766E] hover:bg-[#CCFBF1]/40"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View Details
                        </Button>
                      ) : (
                        <span className="text-xs text-[#9CA3AF] italic">None</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#E7E0D2] flex items-center justify-between">
            <div className="text-xs text-[#6B7280]">
              Page <span className="font-semibold text-[#1F2937]">{page}</span> of{" "}
              <span className="font-semibold text-[#1F2937]">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => applyFilters(page - 1)}
                className="h-8 border-[#E7E0D2] text-xs"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => applyFilters(page + 1)}
                className="h-8 border-[#E7E0D2] text-xs"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Metadata Viewer Dialog */}
      <Dialog
        open={!!selectedMetaLog}
        onOpenChange={(open) => {
          if (!open) setSelectedMetaLog(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#1F2937]">Audit Metadata Inspection</DialogTitle>
            <DialogDescription className="text-[#6B7280] text-xs">
              Action: <strong className="text-[#0F766E]">{selectedMetaLog?.action}</strong> &bull;
              All passwords, secrets, and auth tokens have been permanently sanitized.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-[#1F2937] text-[#F3F4F6] p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-96">
            <pre>
              {selectedMetaLog?.metadata
                ? JSON.stringify(selectedMetaLog.metadata, null, 2)
                : "{}"}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
