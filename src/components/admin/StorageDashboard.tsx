"use client";

import { HardDrive, FileText, Calendar, Layers, GraduationCap } from "lucide-react";
import type { StorageDashboardStats } from "@/lib/storage/dashboard";

interface StorageDashboardProps {
  stats: StorageDashboardStats;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function StorageDashboard({ stats }: StorageDashboardProps) {
  // Configured storage capacity allocation (10 GB standard pool for testing / college tier)
  const quotaBytes = 10 * 1024 * 1024 * 1024;
  const usedPercentage = Math.min(
    100,
    parseFloat(((stats.totalBytes / quotaBytes) * 100).toFixed(2))
  );

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Storage with Progress */}
        <div className="bg-white rounded-[14px] border border-[#E7E0D2] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              Active Storage Used
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#CCFBF1] flex items-center justify-center text-[#0F766E]">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-heading font-bold text-[#1F2937]">
              {formatBytes(stats.totalBytes)}
            </span>
            <span className="text-xs text-[#6B7280]">of {formatBytes(quotaBytes)}</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#E5E7EB] rounded-full h-3 overflow-hidden">
            <div
              className="bg-[#0F766E] h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(usedPercentage, 1)}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-2 text-xs text-[#6B7280]">
            <span>{usedPercentage}% capacity utilized</span>
            <span>{formatBytes(Math.max(0, quotaBytes - stats.totalBytes))} free</span>
          </div>
        </div>

        {/* File Count Card */}
        <div className="bg-white rounded-[14px] border border-[#E7E0D2] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              Total Active Files
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#E0E7FF] flex items-center justify-center text-[#4338CA]">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-heading font-bold text-[#1F2937]">
              {stats.totalFiles.toLocaleString()}
            </span>
            <span className="text-xs text-[#6B7280]">ready resources</span>
          </div>
          <p className="text-xs text-[#6B7280]">
            Across {stats.sectionBreakdown.length} sections and {stats.subjectBreakdown.length} subjects
          </p>
        </div>

        {/* Last 30 Days Card */}
        <div className="bg-white rounded-[14px] border border-[#E7E0D2] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              Last 30 Days Growth
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#FEF3C7] flex items-center justify-center text-[#B45309]">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-heading font-bold text-[#1F2937]">
              {formatBytes(stats.last30DaysBytes)}
            </span>
            <span className="text-xs text-[#6B7280]">({stats.last30DaysCount} uploads)</span>
          </div>
          <p className="text-xs text-[#6B7280]">
            Resources uploaded by faculty within the past month
          </p>
        </div>
      </div>

      {/* Section Breakdown */}
      <div className="bg-white rounded-[14px] border border-[#E7E0D2] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#E7E0D2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#0F766E]" />
            <h2 className="font-heading font-bold text-base text-[#1F2937]">
              Storage by Section
            </h2>
          </div>
          <span className="text-xs text-[#6B7280]">
            {stats.sectionBreakdown.length} sections registered
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAF7F2] border-b border-[#E7E0D2] text-[#6B7280] text-xs font-semibold uppercase">
              <tr>
                <th className="px-6 py-3.5">Section</th>
                <th className="px-6 py-3.5">Academic Term</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Active Files</th>
                <th className="px-6 py-3.5">Storage Used</th>
                <th className="px-6 py-3.5">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0D2]/60">
              {stats.sectionBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#6B7280]">
                    No sections found.
                  </td>
                </tr>
              ) : (
                stats.sectionBreakdown.map((sec) => {
                  const percentOfTotal =
                    stats.totalBytes > 0
                      ? ((sec.totalBytes / stats.totalBytes) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <tr key={sec.sectionId} className="hover:bg-[#FAF7F2]/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-[#1F2937]">
                        {sec.sectionName}
                      </td>
                      <td className="px-6 py-4 text-[#4B5563]">
                        Year {sec.year}, Sem {sec.semester}
                      </td>
                      <td className="px-6 py-4">
                        {sec.isArchived ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                            Archived
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#CCFBF1] text-[#0F766E] border border-[#0F766E]/20">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[#1F2937] font-medium">
                        {sec.fileCount}
                      </td>
                      <td className="px-6 py-4 text-[#1F2937] font-semibold">
                        {formatBytes(sec.totalBytes)}
                      </td>
                      <td className="px-6 py-4 text-[#6B7280]">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-[#E5E7EB] rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-[#0F766E] h-1.5 rounded-full"
                              style={{ width: `${percentOfTotal}%` }}
                            />
                          </div>
                          <span className="text-xs">{percentOfTotal}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subject Breakdown */}
      <div className="bg-white rounded-[14px] border border-[#E7E0D2] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#E7E0D2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#0F766E]" />
            <h2 className="font-heading font-bold text-base text-[#1F2937]">
              Storage by Subject
            </h2>
          </div>
          <span className="text-xs text-[#6B7280]">
            {stats.subjectBreakdown.length} courses cataloged
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAF7F2] border-b border-[#E7E0D2] text-[#6B7280] text-xs font-semibold uppercase">
              <tr>
                <th className="px-6 py-3.5">Code</th>
                <th className="px-6 py-3.5">Subject Name</th>
                <th className="px-6 py-3.5">Term</th>
                <th className="px-6 py-3.5">Active Files</th>
                <th className="px-6 py-3.5">Storage Used</th>
                <th className="px-6 py-3.5">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0D2]/60">
              {stats.subjectBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#6B7280]">
                    No subjects found.
                  </td>
                </tr>
              ) : (
                stats.subjectBreakdown.map((sub) => {
                  const percentOfTotal =
                    stats.totalBytes > 0
                      ? ((sub.totalBytes / stats.totalBytes) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <tr key={sub.subjectId} className="hover:bg-[#FAF7F2]/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-semibold text-[#0F766E]">
                        {sub.subjectCode}
                      </td>
                      <td className="px-6 py-4 font-semibold text-[#1F2937]">
                        {sub.subjectName}
                      </td>
                      <td className="px-6 py-4 text-[#4B5563]">
                        Year {sub.year}, Sem {sub.semester}
                      </td>
                      <td className="px-6 py-4 text-[#1F2937] font-medium">
                        {sub.fileCount}
                      </td>
                      <td className="px-6 py-4 text-[#1F2937] font-semibold">
                        {formatBytes(sub.totalBytes)}
                      </td>
                      <td className="px-6 py-4 text-[#6B7280]">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-[#E5E7EB] rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-[#0F766E] h-1.5 rounded-full"
                              style={{ width: `${percentOfTotal}%` }}
                            />
                          </div>
                          <span className="text-xs">{percentOfTotal}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
