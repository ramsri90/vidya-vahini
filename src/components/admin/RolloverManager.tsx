"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  RotateCcw,
  Archive,
  Layers,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { archiveSingleSection, rolloverRun } from "@/lib/rollover/actions";

export interface RolloverSectionItem {
  id: string;
  name: string;
  year: number;
  semester: number;
  isArchived: boolean;
  studentCount: number;
  classSubjectCount: number;
}

interface RolloverManagerProps {
  sections: RolloverSectionItem[];
}

export function RolloverManager({ sections }: RolloverManagerProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  // Single Archive modal
  const [singleArchiveTarget, setSingleArchiveTarget] = useState<RolloverSectionItem | null>(null);
  const [singleConfirmName, setSingleConfirmName] = useState("");

  // Batch Rollover modal
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchConfirmText, setBatchConfirmText] = useState("");

  const activeSections = sections.filter((s) => !s.isArchived);
  const archivedSections = sections.filter((s) => s.isArchived);

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === activeSections.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(activeSections.map((s) => s.id));
    }
  }

  async function handleSingleArchive() {
    if (!singleArchiveTarget) return;

    setLoading(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append("sectionId", singleArchiveTarget.id);

    try {
      const result = await archiveSingleSection(formData);
      if (result.error) {
        setFeedback({ type: "error", message: result.error });
      } else {
        setFeedback({
          type: "success",
          message: `Section "${singleArchiveTarget.name}" has been successfully archived.`,
        });
        setSingleArchiveTarget(null);
        setSingleConfirmName("");
        router.refresh();
      }
    } catch {
      setFeedback({ type: "error", message: "Failed to archive section." });
    } finally {
      setLoading(false);
    }
  }

  async function handleBatchRollover() {
    if (selectedIds.length === 0) return;

    setLoading(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append("sectionIds", JSON.stringify(selectedIds));

    try {
      const result = await rolloverRun(formData);
      if (result.error) {
        setFeedback({ type: "error", message: result.error });
      } else {
        setFeedback({
          type: "success",
          message: `Semester rollover complete: ${selectedIds.length} sections archived.`,
        });
        setSelectedIds([]);
        setBatchModalOpen(false);
        setBatchConfirmText("");
        router.refresh();
      }
    } catch {
      setFeedback({ type: "error", message: "Failed to run semester rollover." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-[12px] border text-xs font-medium flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-[#CCFBF1] text-[#0F766E] border-[#0F766E]/20"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-gray-400 hover:text-gray-600 font-bold ml-4"
          >
            &times;
          </button>
        </div>
      )}

      {/* Rollover Process Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[14px] border border-[#E7E0D2] p-5 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center mb-3">
            <Archive className="w-4 h-4" />
          </div>
          <h3 className="font-heading font-bold text-sm text-[#1F2937] mb-1">
            1. Archive Outgoing Term
          </h3>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            Archiving locks uploaded notes as <strong>read-only</strong>. Students retain download access
            for supplementary exams, while faculty cannot add or delete files.
          </p>
        </div>

        <div className="bg-white rounded-[14px] border border-[#E7E0D2] p-5 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-[#E0E7FF] text-[#4338CA] flex items-center justify-center mb-3">
            <Layers className="w-4 h-4" />
          </div>
          <h3 className="font-heading font-bold text-sm text-[#1F2937] mb-1">
            2. Create Next-Semester Sections
          </h3>
          <p className="text-xs text-[#6B7280] leading-relaxed mb-3">
            New semester cohorts are created manually to maintain precise catalog control. No automatic
            duplication takes place.
          </p>
          <Link
            href="/admin/sections"
            className="inline-flex items-center text-xs font-semibold text-[#0F766E] hover:underline"
          >
            Go to Sections <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        <div className="bg-white rounded-[14px] border border-[#E7E0D2] p-5 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#B45309] flex items-center justify-center mb-3">
            <UserCheck className="w-4 h-4" />
          </div>
          <h3 className="font-heading font-bold text-sm text-[#1F2937] mb-1">
            3. Transfer Students
          </h3>
          <p className="text-xs text-[#6B7280] leading-relaxed mb-3">
            Students are migrated into their next semester section using the existing individual or
            cohort Transfer action in Students.
          </p>
          <Link
            href="/admin/students"
            className="inline-flex items-center text-xs font-semibold text-[#0F766E] hover:underline"
          >
            Go to Students <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>
      </div>

      {/* Active Sections Table */}
      <div className="bg-white rounded-[14px] border border-[#E7E0D2] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#E7E0D2] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-[#0F766E]" />
              <h2 className="font-heading font-bold text-base text-[#1F2937]">
                Active Cohort Rollover
              </h2>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Select sections concluding their current semester term to archive in bulk or individually.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeSections.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                className="text-xs border-[#E7E0D2]"
              >
                {selectedIds.length === activeSections.length ? "Deselect All" : "Select All Active"}
              </Button>
            )}

            <Button
              disabled={selectedIds.length === 0}
              onClick={() => {
                setBatchModalOpen(true);
                setBatchConfirmText("");
              }}
              className="text-xs bg-[#0F766E] hover:bg-[#0F766E]/90 text-white font-semibold"
            >
              <Archive className="w-3.5 h-3.5 mr-1.5" />
              Archive Selected ({selectedIds.length})
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAF7F2] border-b border-[#E7E0D2] text-[#6B7280] text-xs font-semibold uppercase">
              <tr>
                <th className="px-6 py-3.5 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={
                      activeSections.length > 0 && selectedIds.length === activeSections.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-[#E7E0D2] text-[#0F766E] focus:ring-[#0F766E]"
                  />
                </th>
                <th className="px-6 py-3.5">Section Name</th>
                <th className="px-6 py-3.5">Academic Term</th>
                <th className="px-6 py-3.5">Enrolled Students</th>
                <th className="px-6 py-3.5">Assigned Subjects</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0D2]/60">
              {activeSections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#6B7280]">
                    All sections have already been archived. Create new sections in the Sections tab.
                  </td>
                </tr>
              ) : (
                activeSections.map((sec) => {
                  const isSelected = selectedIds.includes(sec.id);
                  return (
                    <tr
                      key={sec.id}
                      className={`transition-colors ${
                        isSelected ? "bg-[#CCFBF1]/20" : "hover:bg-[#FAF7F2]/50"
                      }`}
                    >
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(sec.id)}
                          className="rounded border-[#E7E0D2] text-[#0F766E] focus:ring-[#0F766E]"
                        />
                      </td>
                      <td className="px-6 py-4 font-semibold text-xs text-[#1F2937]">
                        {sec.name}
                      </td>
                      <td className="px-6 py-4 text-xs text-[#4B5563]">
                        Year {sec.year}, Sem {sec.semester}
                      </td>
                      <td className="px-6 py-4 text-xs text-[#1F2937] font-medium">
                        {sec.studentCount} students
                      </td>
                      <td className="px-6 py-4 text-xs text-[#1F2937] font-medium">
                        {sec.classSubjectCount} subjects
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#CCFBF1] text-[#0F766E] border border-[#0F766E]/20">
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="w-9 h-9 border-[#E7E0D2] hover:bg-[#FAF7F2]"
                            >
                              <MoreHorizontal className="w-4 h-4 text-[#4B5563]" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => {
                                setSingleArchiveTarget(sec);
                                setSingleConfirmName("");
                              }}
                              className="text-xs text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                            >
                              <Archive className="w-4 h-4 mr-2 text-red-600" />
                              Archive section
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Archived Cohorts Table */}
      {archivedSections.length > 0 && (
        <div className="bg-white rounded-[14px] border border-[#E7E0D2] overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#E7E0D2] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-[#6B7280]" />
              <h2 className="font-heading font-bold text-base text-[#1F2937]">
                Historical & Archived Cohorts
              </h2>
            </div>
            <span className="text-xs text-[#6B7280]">
              {archivedSections.length} archived sections (Read-only for downloads)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF7F2] border-b border-[#E7E0D2] text-[#6B7280] text-xs font-semibold uppercase">
                <tr>
                  <th className="px-6 py-3.5">Section Name</th>
                  <th className="px-6 py-3.5">Academic Term</th>
                  <th className="px-6 py-3.5">Enrolled Students</th>
                  <th className="px-6 py-3.5">Assigned Subjects</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0D2]/60">
                {archivedSections.map((sec) => (
                  <tr key={sec.id} className="hover:bg-[#FAF7F2]/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-xs text-[#1F2937]">
                      {sec.name}
                    </td>
                    <td className="px-6 py-4 text-xs text-[#4B5563]">
                      Year {sec.year}, Sem {sec.semester}
                    </td>
                    <td className="px-6 py-4 text-xs text-[#6B7280]">
                      {sec.studentCount} students
                    </td>
                    <td className="px-6 py-4 text-xs text-[#6B7280]">
                      {sec.classSubjectCount} subjects
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                        Archived
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single Section Archive Dialog with Type-to-Confirm */}
      <AlertDialog
        open={!!singleArchiveTarget}
        onOpenChange={(open) => {
          if (!open) {
            setSingleArchiveTarget(null);
            setSingleConfirmName("");
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Archive Section
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#6B7280] space-y-2">
              <p>
                Archiving <strong>{singleArchiveTarget?.name}</strong> transitions all class
                materials into <strong>read-only mode</strong>.
              </p>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-800 text-xs">
                <Info className="w-4 h-4 inline mr-1 text-amber-600" />
                Students can still download existing resources. Faculty cannot upload, replace, or
                delete resources in this section.
              </div>
              <p>
                To confirm archiving, please type the exact section name{" "}
                <strong>&quot;{singleArchiveTarget?.name}&quot;</strong> below:
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2">
            <input
              type="text"
              value={singleConfirmName}
              onChange={(e) => setSingleConfirmName(e.target.value)}
              placeholder={singleArchiveTarget?.name}
              className="w-full px-3 py-2 border border-[#E7E0D2] rounded-[10px] text-xs focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-mono"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs border-[#E7E0D2] rounded-[10px]">Cancel</AlertDialogCancel>
            <Button
              disabled={loading || singleConfirmName !== singleArchiveTarget?.name}
              onClick={handleSingleArchive}
              className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold rounded-[10px]"
            >
              {loading ? "Archiving..." : "Confirm Archive Section"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Rollover Confirmation Dialog */}
      <AlertDialog
        open={batchModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBatchModalOpen(false);
            setBatchConfirmText("");
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Execute Semester Rollover
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#6B7280] space-y-2">
              <p>
                You are about to archive <strong>{selectedIds.length}</strong> active sections.
              </p>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-800 text-xs">
                All resources in these sections will become read-only. Faculty uploads and deletions
                will be blocked immediately.
              </div>
              <p>
                To confirm rollover, please type <strong>&quot;ROLLOVER&quot;</strong> below:
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2">
            <input
              type="text"
              value={batchConfirmText}
              onChange={(e) => setBatchConfirmText(e.target.value)}
              placeholder="ROLLOVER"
              className="w-full px-3 py-2 border border-[#E7E0D2] rounded-[10px] text-xs focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-mono"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs border-[#E7E0D2] rounded-[10px]">Cancel</AlertDialogCancel>
            <Button
              disabled={loading || batchConfirmText !== "ROLLOVER"}
              onClick={handleBatchRollover}
              className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold rounded-[10px]"
            >
              {loading ? "Processing..." : `Archive ${selectedIds.length} Sections`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
