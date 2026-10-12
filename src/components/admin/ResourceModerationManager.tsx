"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Search,
  MoreHorizontal,
  Archive,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { archiveResource, deleteResourceModeration } from "@/lib/moderation/actions";

export interface ModerationResourceItem {
  id: string;
  title: string;
  category: string;
  status: "uploading" | "ready" | "failed";
  archived: boolean;
  fileSizeBytes: number | null;
  createdAt: string;
  uploaderName: string;
  uploaderEmail: string;
  sectionName: string;
  subjectCode: string;
  subjectName: string;
  componentType: "theory" | "lab";
}

interface ResourceModerationManagerProps {
  resources: ModerationResourceItem[];
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function ResourceModerationManager({ resources }: ResourceModerationManagerProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  // Archive modal state
  const [archiveTarget, setArchiveTarget] = useState<ModerationResourceItem | null>(null);
  const [archiveReason, setArchiveReason] = useState("");

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<ModerationResourceItem | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  const filteredResources = resources.filter((res) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      res.title.toLowerCase().includes(term) ||
      res.sectionName.toLowerCase().includes(term) ||
      res.subjectCode.toLowerCase().includes(term) ||
      res.subjectName.toLowerCase().includes(term) ||
      res.uploaderName.toLowerCase().includes(term) ||
      res.uploaderEmail.toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "archived" && res.archived) ||
      (statusFilter === "active" && !res.archived && res.status === "ready") ||
      (statusFilter === "failed" && res.status === "failed") ||
      (statusFilter === "uploading" && res.status === "uploading");

    return matchesSearch && matchesStatus;
  });

  async function handleArchiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!archiveTarget || !archiveReason.trim()) return;

    setLoading(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append("resourceId", archiveTarget.id);
    formData.append("reason", archiveReason.trim());

    try {
      const result = await archiveResource(formData);
      if (result.error) {
        setFeedback({ type: "error", message: result.error });
      } else {
        setFeedback({
          type: "success",
          message: `Resource "${archiveTarget.title}" archived successfully.`,
        });
        setArchiveTarget(null);
        setArchiveReason("");
        router.refresh();
      }
    } catch {
      setFeedback({ type: "error", message: "Failed to archive resource." });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSubmit() {
    if (!deleteTarget) return;

    setLoading(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append("resourceId", deleteTarget.id);

    try {
      const result = await deleteResourceModeration(formData);
      if (result.error) {
        setFeedback({ type: "error", message: result.error });
      } else {
        setFeedback({
          type: "success",
          message: `Resource "${deleteTarget.title}" and its storage object were permanently deleted.`,
        });
        setDeleteTarget(null);
        setDeleteConfirmationText("");
        router.refresh();
      }
    } catch {
      setFeedback({ type: "error", message: "Failed to delete resource." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
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

      {/* Toolbar */}
      <div className="bg-white rounded-[14px] border border-[#E7E0D2] p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[#6B7280]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, section, subject, uploader..."
              className="w-full h-10 pl-9 pr-3 border border-[#E7E0D2] rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#0F766E] bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-[#6B7280]">Status:</span>
            <div className="flex items-center gap-1 bg-[#FAF7F2] p-1 rounded-lg border border-[#E7E0D2]">
              {["all", "active", "archived", "failed"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                    statusFilter === st
                      ? "bg-[#0F766E] text-white shadow-xs"
                      : "text-[#6B7280] hover:text-[#1F2937]"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Resources Table */}
      <div className="bg-white rounded-[14px] border border-[#E7E0D2] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#E7E0D2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0F766E]" />
            <h2 className="font-heading font-bold text-base text-[#1F2937]">
              Academic Resources Moderation
            </h2>
          </div>
          <span className="text-xs text-[#6B7280]">
            {filteredResources.length} of {resources.length} resources
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAF7F2] border-b border-[#E7E0D2] text-[#6B7280] text-xs font-semibold uppercase">
              <tr>
                <th className="px-6 py-3.5">Title & Category</th>
                <th className="px-6 py-3.5">Section & Subject</th>
                <th className="px-6 py-3.5">Component</th>
                <th className="px-6 py-3.5">Uploader</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Size</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0D2]/60">
              {filteredResources.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#6B7280]">
                    No resources match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredResources.map((res) => {
                  const canHardDelete = res.status === "failed" || res.archived;

                  return (
                    <tr key={res.id} className="hover:bg-[#FAF7F2]/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-xs text-[#1F2937] max-w-xs truncate">
                          {res.title}
                        </div>
                        <div className="text-[11px] text-[#6B7280] capitalize">
                          {res.category.replace("_", " ")}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="font-semibold text-[#1F2937]">{res.sectionName}</div>
                        <div className="text-[#6B7280]">
                          <span className="font-mono text-[#0F766E]">{res.subjectCode}</span> &bull;{" "}
                          {res.subjectName}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            res.componentType === "theory"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-teal-50 text-teal-700 border border-teal-200"
                          }`}
                        >
                          {res.componentType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="font-semibold text-[#1F2937]">{res.uploaderName}</div>
                        <div className="text-[#6B7280] text-[11px]">{res.uploaderEmail}</div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="flex flex-col gap-1 items-start">
                          {res.archived ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                              <Archive className="w-3 h-3" />
                              Archived
                            </span>
                          ) : res.status === "ready" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Ready
                            </span>
                          ) : res.status === "failed" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                              <XCircle className="w-3 h-3" />
                              Failed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              Uploading
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-[#6B7280] font-mono">
                        {formatBytes(res.fileSizeBytes)}
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
                          <DropdownMenuContent align="end" className="w-52">
                            {/* Archive Option */}
                            {!res.archived && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setArchiveTarget(res);
                                  setArchiveReason("");
                                }}
                                className="text-xs cursor-pointer"
                              >
                                <Archive className="w-4 h-4 mr-2 text-[#4B5563]" />
                                Archive resource
                              </DropdownMenuItem>
                            )}

                            {/* Separator if delete is available */}
                            {!res.archived && <DropdownMenuSeparator />}

                            {/* Hard Delete Option */}
                            {canHardDelete ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  setDeleteTarget(res);
                                  setDeleteConfirmationText("");
                                }}
                                className="text-xs text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4 mr-2 text-red-600" />
                                Delete resource
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                disabled
                                className="text-xs text-[#9CA3AF] cursor-not-allowed"
                              >
                                <Trash2 className="w-4 h-4 mr-2 text-[#9CA3AF]" />
                                Delete (archive or failed first)
                              </DropdownMenuItem>
                            )}
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

      {/* Archive Reason Dialog */}
      <Dialog
        open={!!archiveTarget}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null);
            setArchiveReason("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <form onSubmit={handleArchiveSubmit}>
            <DialogHeader>
              <DialogTitle className="text-[#1F2937]">Archive Resource</DialogTitle>
              <DialogDescription className="text-xs text-[#6B7280]">
                Archiving removes this resource from the active student catalog. A reason is required
                for immutable audit tracking.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <div className="bg-[#FAF7F2] p-3 rounded-lg border border-[#E7E0D2] text-xs">
                <span className="font-semibold text-[#1F2937]">{archiveTarget?.title}</span>
                <div className="text-[#6B7280] text-[11px] mt-1">
                  Section: {archiveTarget?.sectionName} &bull; Subject: {archiveTarget?.subjectCode}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                  Archive Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="e.g. Outdated lecture syllabus notes, replaced by faculty update..."
                  className="w-full px-3 py-2 border border-[#E7E0D2] rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setArchiveTarget(null)}
                className="text-xs border-[#E7E0D2]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || archiveReason.trim().length < 3}
                className="text-xs bg-[#0F766E] hover:bg-[#0F766E]/90 text-white font-semibold"
              >
                {loading ? "Archiving..." : "Confirm Archive"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Hard Delete Type-To-Confirm Alert Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteConfirmationText("");
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Hard Delete Resource
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#6B7280] space-y-2">
              <p>
                This action is <strong>irreversible</strong>. The file object in Backblaze B2 storage
                will be permanently purged first, followed by the database record.
              </p>
              <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-red-800 text-xs">
                Resource: <strong>{deleteTarget?.title}</strong>
              </div>
              <p>
                To confirm deletion, please type the exact title of the resource below:
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2">
            <input
              type="text"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder={deleteTarget?.title}
              className="w-full px-3 py-2 border border-[#E7E0D2] rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs border-[#E7E0D2]">Cancel</AlertDialogCancel>
            <Button
              disabled={loading || deleteConfirmationText !== deleteTarget?.title}
              onClick={handleDeleteSubmit}
              className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {loading ? "Deleting..." : "Permanently Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
