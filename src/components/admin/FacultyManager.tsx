"use client";

import { useState, useTransition } from "react";
import {
  createSingleFaculty,
  importFacultyExcel,
  resetUserPassword,
  deleteFaculty,
  deleteFacultyUploads,
  SkippedImportItem,
} from "@/lib/onboarding/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  MoreHorizontal,
  AlertCircle,
  CheckCircle,
  Trash2,
  KeyRound,
  Eye,
  Copy,
  Upload,
} from "lucide-react";
import Link from "next/link";

interface FacultyItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  _count?: {
    resourcesUploaded: number;
    announcements: number;
  };
  componentsTaught: {
    id: string;
    type: string;
    classSubject: {
      section: { name: string };
      subject: { code: string; name: string };
    };
  }[];
}

interface FacultyManagerProps {
  initialFaculty: FacultyItem[];
}

export function FacultyManager({ initialFaculty }: FacultyManagerProps) {
  const [facultyList] = useState<FacultyItem[]>(initialFaculty);
  const [isPending, startTransition] = useTransition();

  // Alert banner messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Single create state

  // Bulk import state
  const [importResult, setImportResult] = useState<{
    createdCount: number;
    skipped: SkippedImportItem[];
  } | null>(null);
  const [bulkFile, setBulkFile] = useState<File | null>(null);

  // View Slots and Uploads modal
  const [viewTarget, setViewTarget] = useState<FacultyItem | null>(null);

  // Password reset modal state
  const [resetModal, setResetModal] = useState<{
    userName: string;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Hard Delete state
  const [deleteTarget, setDeleteTarget] = useState<FacultyItem | null>(null);
  const [confirmEmailInput, setConfirmEmailInput] = useState("");

  const handleSingleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await createSingleFaculty(formData);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setSuccess(`Faculty "${res.data.faculty.name}" created successfully. Temporary password: ${res.data.tempPassword}`);
        form.reset();
      }
    });
  };

  const handleBulkImport = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setImportResult(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await importFacultyExcel(formData);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setImportResult(res.data);
        setSuccess(`Import completed: ${res.data.createdCount} faculty member(s) created.`);
        form.reset();
        setBulkFile(null);
      }
    });
  };

  const handleResetPassword = (userId: string, userName: string) => {
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.append("userId", userId);

    startTransition(async () => {
      const res = await resetUserPassword(formData);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setResetModal({
          userName,
          tempPassword: res.data.tempPassword,
        });
        setCopied(false);
      }
    });
  };

  const handleDeleteUploads = () => {
    if (!deleteTarget) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await deleteFacultyUploads(deleteTarget.id);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Faculty uploads deleted successfully from storage and database.");
        setDeleteTarget(null);
      }
    });
  };

  const handleDeleteSubmit = () => {
    if (!deleteTarget) return;
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.append("facultyId", deleteTarget.id);
    formData.append("confirmEmail", confirmEmailInput);

    startTransition(async () => {
      const res = await deleteFaculty(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(`Faculty "${deleteTarget.name}" deleted successfully.`);
        setDeleteTarget(null);
        setConfirmEmailInput("");
      }
    });
  };

  const slotCount = deleteTarget?.componentsTaught.length ?? 0;
  const resourceCount = deleteTarget?._count?.resourcesUploaded ?? 0;
  const announcementCount = deleteTarget?._count?.announcements ?? 0;
  const hasBlockers = slotCount > 0 || resourceCount > 0 || announcementCount > 0;

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-[10px] border border-red-200 bg-red-50 p-4 text-xs text-[#B91C1C] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="rounded-[10px] border border-[#BBF7D0] bg-[#DCFCE7] p-4 text-xs text-[#15803D] flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Creation Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Single Faculty Onboarding */}
        <div className="rounded-[14px] border border-[#E7E0D2] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold font-heading text-[#1F2937]">Create Single Faculty Member</h2>
          <form onSubmit={handleSingleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280]">Full Name</label>
              <input
                name="name"
                type="text"
                required
                placeholder="e.g. Dr. Jane Smith"
                className="mt-1 block w-full rounded-[10px] border border-[#E7E0D2] px-3 py-2 text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280]">Institutional Email</label>
              <input
                name="email"
                type="email"
                required
                placeholder="faculty@institution.edu"
                className="mt-1 block w-full rounded-[10px] border border-[#E7E0D2] px-3 py-2 text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280]">Phone (Optional)</label>
              <input
                name="phone"
                type="tel"
                placeholder="+91 9876543210"
                className="mt-1 block w-full rounded-[10px] border border-[#E7E0D2] px-3 py-2 text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
              />
            </div>
            <div className="pt-2">
              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-10 rounded-[10px] bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-medium"
              >
                {isPending ? "Creating..." : "Create Faculty Member"}
              </Button>
            </div>
          </form>
        </div>

        {/* Bulk Excel Import */}
        <div className="rounded-[14px] border border-[#E7E0D2] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold font-heading text-[#1F2937]">Bulk Faculty Import</h2>
          <form onSubmit={handleBulkImport} className="space-y-4">
            <p className="text-xs text-[#6B7280]">
              Upload an Excel (.xlsx, .xls) or CSV sheet with column headers:{" "}
              <strong className="font-mono text-[#1F2937]">name, email, phone</strong>.
            </p>

            <div className="relative border-2 border-dashed border-[#E7E0D2] hover:border-[#0F766E] rounded-[10px] p-6 text-center transition-colors">
              <Upload className="w-6 h-6 mx-auto text-[#0F766E] mb-2" />
              <label className="cursor-pointer text-xs font-semibold text-[#0F766E] hover:underline">
                <span>{bulkFile ? bulkFile.name : "Choose an Excel or CSV file"}</span>
                <input
                  type="file"
                  name="file"
                  accept=".xlsx,.xls,.csv"
                  required
                  onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                  className="sr-only"
                />
              </label>
              <p className="text-[11px] text-[#9CA3AF] mt-1">Maximum file size: 2 MB</p>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isPending || !bulkFile}
                className="w-full h-10 rounded-[10px] bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-medium"
              >
                {isPending ? "Importing..." : "Upload & Process Sheet"}
              </Button>
            </div>
          </form>

          {importResult && (
            <div className="mt-4 rounded-[10px] bg-[#FDFBF6] border border-[#E7E0D2] p-3 text-xs space-y-1">
              <p className="font-semibold text-green-700">Created: {importResult.createdCount} faculty member(s)</p>
              {importResult.skipped.length > 0 && (
                <div className="text-amber-800 space-y-1">
                  <p className="font-semibold">Skipped rows ({importResult.skipped.length}):</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {importResult.skipped.map((s, idx) => (
                      <li key={idx}>
                        Row {s.row} ({s.identifier}): {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Faculty Directory Table */}
      <div className="rounded-[14px] border border-[#E7E0D2] bg-white shadow-sm overflow-hidden">
        <div className="border-b border-[#E7E0D2] bg-[#FDFBF6] px-6 py-4">
          <h2 className="text-sm font-semibold font-heading text-[#1F2937]">Teaching Faculty Directory</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E7E0D2] bg-[#FDFBF6] text-[11px] font-semibold text-[#6B7280]">
              <tr>
                <th className="px-6 py-3">Faculty Name</th>
                <th className="px-6 py-3">Contact Email</th>
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3">Assigned Slots</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0D2]">
              {facultyList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-xs text-[#6B7280]">
                    No faculty members found. Use the forms above to onboard faculty.
                  </td>
                </tr>
              ) : (
                facultyList.map((fac) => (
                  <tr key={fac.id} className="hover:bg-[#FDFBF6] transition-colors">
                    <td className="px-6 py-4 font-semibold text-[#1F2937]">{fac.name}</td>
                    <td className="px-6 py-4 font-mono text-[#6B7280]">{fac.email}</td>
                    <td className="px-6 py-4 text-[#6B7280]">{fac.phone || "—"}</td>
                    <td className="px-6 py-4 text-[#6B7280]">
                      {fac.componentsTaught.length === 0 ? (
                        <span className="italic text-gray-400">0 slots assigned</span>
                      ) : (
                        <span className="font-medium text-[#1F2937]">
                          {fac.componentsTaught.length} slot(s)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="action"
                            className="h-9 px-2.5 gap-1.5 text-xs text-[#1F2937] border-[#E7E0D2]"
                          >
                            <MoreHorizontal className="w-4 h-4 text-[#6B7280]" />
                            <span>Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewTarget(fac)}>
                            <Eye className="w-3.5 h-3.5 text-[#0F766E]" />
                            <span>View slots and uploads</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => handleResetPassword(fac.id, fac.name)}>
                            <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                            <span>Reset password</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            destructive
                            onClick={() => {
                              setDeleteTarget(fac);
                              setConfirmEmailInput("");
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete faculty</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Slots & Uploads Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewTarget?.name}</DialogTitle>
            <DialogDescription>{viewTarget?.email} &bull; Teaching Assignments</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <span className="font-semibold text-[#1F2937]">Assigned Academic Slots:</span>
              {(viewTarget?.componentsTaught.length ?? 0) === 0 ? (
                <p className="text-[#6B7280] italic mt-1">No components assigned to this faculty member.</p>
              ) : (
                <ul className="mt-2 space-y-1.5 pl-1">
                  {viewTarget?.componentsTaught.map((c) => (
                    <li key={c.id} className="flex items-center justify-between p-2 rounded-[8px] bg-[#FDFBF6] border border-[#E7E0D2]">
                      <span className="font-medium text-[#1F2937]">
                        {c.classSubject.section.name} &bull; {c.classSubject.subject.code} ({c.classSubject.subject.name})
                      </span>
                      <span
                        className={`capitalize font-semibold text-[10px] px-2 py-0.5 rounded-full ${
                          c.type === "theory"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {c.type}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-3 bg-[#FDFBF6] border border-[#E7E0D2] rounded-[10px] flex items-center justify-between">
              <span className="text-[#6B7280]">Total Resource Uploads:</span>
              <span className="font-mono font-bold text-[#1F2937]">
                {viewTarget?._count?.resourcesUploaded ?? 0} file(s)
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setViewTarget(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Modal */}
      <Dialog open={!!resetModal} onOpenChange={(open) => !open && setResetModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary Password Generated</DialogTitle>
            <DialogDescription>
              New temporary password for <strong>{resetModal?.userName}</strong>. This password is shown only once and cannot be recovered.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-3 rounded-[10px] bg-[#FDFBF6] border border-[#E7E0D2] flex items-center justify-between font-mono text-sm text-[#0F766E] font-bold">
              <span>{resetModal?.tempPassword}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (resetModal?.tempPassword) {
                    navigator.clipboard.writeText(resetModal.tempPassword);
                    setCopied(true);
                  }
                }}
                className="h-8 gap-1 text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? "Copied!" : "Copy"}</span>
              </Button>
            </div>
            <p className="text-[11px] text-[#6B7280]">
              The user will be required to change this password on their next login attempt.
            </p>
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setResetModal(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard Delete AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Faculty: {deleteTarget?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              {hasBlockers ? (
                <div className="space-y-3 pt-2">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-[10px] text-xs text-[#B91C1C] space-y-1">
                    <p className="font-semibold">Cannot delete faculty member with active records:</p>
                    {slotCount > 0 && (
                      <p>
                        &bull; Assigned to <strong>{slotCount}</strong> academic slot(s). Reassign them first.
                      </p>
                    )}
                    {resourceCount > 0 && (
                      <p>
                        &bull; Uploaded <strong>{resourceCount}</strong> resource(s) to the platform.
                      </p>
                    )}
                    {announcementCount > 0 && (
                      <p>
                        &bull; Posted <strong>{announcementCount}</strong> announcement(s).
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-1">
                    {slotCount > 0 && (
                      <div className="p-2.5 rounded-[8px] border border-[#E7E0D2] bg-[#FDFBF6] flex items-center justify-between">
                        <span className="text-xs text-[#1F2937]">Reassign slots:</span>
                        <Link
                          href="/admin/class-subjects"
                          className="text-xs font-semibold text-[#0F766E] hover:underline"
                        >
                          Go to Section Subjects &rarr;
                        </Link>
                      </div>
                    )}

                    {resourceCount > 0 && (
                      <div className="p-2.5 rounded-[8px] border border-[#E7E0D2] bg-[#FDFBF6] flex items-center justify-between">
                        <span className="text-xs text-[#1F2937]">Delete uploaded resources:</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isPending}
                          onClick={handleDeleteUploads}
                          className="h-7 text-[11px]"
                        >
                          Delete {resourceCount} upload(s) (B2 & DB)
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-[#6B7280]">
                    This faculty member has zero slots, uploads, or announcements. To confirm deletion, type their email{" "}
                    <strong className="text-[#1F2937] font-mono">{deleteTarget?.email}</strong> below:
                  </p>
                  <input
                    type="text"
                    value={confirmEmailInput}
                    onChange={(e) => setConfirmEmailInput(e.target.value)}
                    placeholder={deleteTarget?.email}
                    className="w-full rounded-[10px] border border-[#E7E0D2] px-3 py-2 text-xs text-[#1F2937] font-mono focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
                  />
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              destructive
              disabled={
                hasBlockers ||
                !confirmEmailInput ||
                confirmEmailInput.trim().toLowerCase() !== deleteTarget?.email.toLowerCase() ||
                isPending
              }
              onClick={handleDeleteSubmit}
            >
              {isPending ? "Deleting..." : "Delete Faculty"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
