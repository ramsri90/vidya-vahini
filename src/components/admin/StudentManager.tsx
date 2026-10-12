"use client";

import { useState, useTransition } from "react";
import {
  createSingleStudent,
  importStudentsExcel,
  transferStudent,
  deleteStudent,
  resetUserPassword,
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  MoreHorizontal,
  AlertCircle,
  CheckCircle,
  Trash2,
  KeyRound,
  ArrowRightLeft,
  Copy,
  Upload,
  Download,
  Filter,
} from "lucide-react";

interface SectionItem {
  id: string;
  name: string;
  year: number;
  semester: number;
  isArchived: boolean;
}

interface StudentItem {
  id: string;
  rollNo: string;
  sectionId: string;
  section: { name: string; year: number; semester: number };
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    isActive: boolean;
  };
}

interface StudentManagerProps {
  sections: SectionItem[];
  initialStudents: StudentItem[];
  selectedSectionId?: string;
}

export function StudentManager({
  sections,
  initialStudents,
  selectedSectionId: defaultSectionId,
}: StudentManagerProps) {
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    defaultSectionId || (sections[0]?.id ?? "")
  );

  // Form section pickers synchronized with the filter section
  const [addStudentSectionId, setAddStudentSectionId] = useState<string>(
    defaultSectionId || (sections[0]?.id ?? "")
  );
  const [importTargetSectionId, setImportTargetSectionId] = useState<string>(
    defaultSectionId || (sections[0]?.id ?? "")
  );

  const [students] = useState<StudentItem[]>(initialStudents);
  const [isPending, startTransition] = useTransition();

  // Alert banner states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Bulk import state
  const [importReport, setImportReport] = useState<{
    createdCount: number;
    skipped: SkippedImportItem[];
  } | null>(null);
  const [oneTimeCsv, setOneTimeCsv] = useState<string | null>(null);
  const [bulkFile, setBulkFile] = useState<File | null>(null);

  // Password Reset Modal state
  const [resetModal, setResetModal] = useState<{
    userName: string;
    rollNo: string;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Transfer Modal state
  const [transferModal, setTransferModal] = useState<{
    studentId: string;
    studentName: string;
    rollNo: string;
    currentSectionId: string;
  } | null>(null);
  const [transferDestinationId, setTransferDestinationId] = useState<string>("");

  // Hard Delete Modal state
  const [deleteTarget, setDeleteTarget] = useState<StudentItem | null>(null);
  const [confirmRollNoInput, setConfirmRollNoInput] = useState("");

  // When filter changes, update default section on create & import pickers
  const handleFilterSectionChange = (newSecId: string) => {
    setSelectedSectionId(newSecId);
    if (newSecId !== "ALL") {
      setAddStudentSectionId(newSecId);
      setImportTargetSectionId(newSecId);
    }
  };

  const filteredStudents = selectedSectionId && selectedSectionId !== "ALL"
    ? students.filter((s) => s.sectionId === selectedSectionId)
    : students;

  const activeSections = sections.filter((s) => !s.isArchived);

  const handleSingleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("sectionId", addStudentSectionId);

    startTransition(async () => {
      const res = await createSingleStudent(formData);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setSuccess(
          `Student "${res.data.student.name}" (${res.data.student.rollNo}) enrolled successfully.`
        );
        form.reset();
      }
    });
  };

  const handleBulkImport = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setImportReport(null);
    setOneTimeCsv(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("sectionId", importTargetSectionId);

    startTransition(async () => {
      const res = await importStudentsExcel(formData);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setImportReport({
          createdCount: res.data.createdCount,
          skipped: res.data.skipped,
        });
        if (res.data.csvContent) {
          setOneTimeCsv(res.data.csvContent);
        }
        setSuccess(`Bulk import complete: ${res.data.createdCount} student(s) enrolled.`);
        form.reset();
        setBulkFile(null);
      }
    });
  };

  const handleTransferSubmit = () => {
    if (!transferModal || !transferDestinationId) return;
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.append("studentId", transferModal.studentId);
    formData.append("newSectionId", transferDestinationId);

    startTransition(async () => {
      const res = await transferStudent(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(`Student ${transferModal.rollNo} transferred successfully.`);
        setTransferModal(null);
        setTransferDestinationId("");
      }
    });
  };

  const handleResetPassword = (userId: string, userName: string, rollNo: string) => {
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
          rollNo,
          tempPassword: res.data.tempPassword,
        });
        setCopied(false);
      }
    });
  };

  const handleDeleteSubmit = () => {
    if (!deleteTarget) return;
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.append("studentId", deleteTarget.id);
    formData.append("confirmRollNo", confirmRollNoInput);

    startTransition(async () => {
      const res = await deleteStudent(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(`Student "${deleteTarget.rollNo}" deleted successfully.`);
        setDeleteTarget(null);
        setConfirmRollNoInput("");
      }
    });
  };

  const handleDownloadCsv = () => {
    if (!oneTimeCsv) return;
    const blob = new Blob([oneTimeCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `student-credentials-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setOneTimeCsv(null);
  };

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

      {/* Onboarding Cards Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Single Student Card */}
        <div className="rounded-[14px] border border-[#E7E0D2] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold font-heading text-[#1F2937]">Add Individual Student</h2>
          <form onSubmit={handleSingleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Target Section</label>
              <Select value={addStudentSectionId} onValueChange={setAddStudentSectionId}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="-- Select Section --" />
                </SelectTrigger>
                <SelectContent>
                  {activeSections.map((sec) => (
                    <SelectItem key={sec.id} value={sec.id}>
                      {sec.name} (Year {sec.year}, Sem {sec.semester})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6B7280]">Roll Number</label>
              <input
                name="rollNo"
                type="text"
                required
                placeholder="e.g. 21CS042"
                className="mt-1 block w-full rounded-[10px] border border-[#E7E0D2] px-3 py-2 text-xs font-mono text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6B7280]">Full Name</label>
              <input
                name="name"
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                className="mt-1 block w-full rounded-[10px] border border-[#E7E0D2] px-3 py-2 text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6B7280]">Email Address</label>
              <input
                name="email"
                type="email"
                required
                placeholder="student@institution.edu"
                className="mt-1 block w-full rounded-[10px] border border-[#E7E0D2] px-3 py-2 text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isPending || !addStudentSectionId}
                className="w-full h-10 rounded-[10px] bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-medium"
              >
                {isPending ? "Enrolling..." : "Enroll Student"}
              </Button>
            </div>
          </form>
        </div>

        {/* Bulk Student Import Card */}
        <div className="rounded-[14px] border border-[#E7E0D2] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold font-heading text-[#1F2937]">Bulk Student Import</h2>
          <form onSubmit={handleBulkImport} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Target Section</label>
              <Select value={importTargetSectionId} onValueChange={setImportTargetSectionId}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="-- Select Section --" />
                </SelectTrigger>
                <SelectContent>
                  {activeSections.map((sec) => (
                    <SelectItem key={sec.id} value={sec.id}>
                      {sec.name} (Year {sec.year}, Sem {sec.semester})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs text-[#6B7280] mb-2">
                Upload an Excel (.xlsx, .xls) or CSV sheet. Required headers:
              </p>
              <div className="flex gap-2 mb-3">
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-800">
                  roll_no
                </span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-800">
                  name
                </span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-800">
                  email
                </span>
              </div>
            </div>

            {/* Styled Dropzone */}
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
                disabled={isPending || !bulkFile || !importTargetSectionId}
                className="w-full h-10 rounded-[10px] bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-medium"
              >
                {isPending ? "Importing..." : "Upload & Enroll Cohort"}
              </Button>
            </div>
          </form>

          {importReport && (
            <div className="mt-4 rounded-[10px] bg-[#FDFBF6] border border-[#E7E0D2] p-4 text-xs space-y-3">
              <p className="font-semibold text-green-700">Enrolled: {importReport.createdCount} student(s)</p>
              {importReport.skipped.length > 0 && (
                <div className="text-amber-800 space-y-1">
                  <p className="font-semibold">Skipped rows ({importReport.skipped.length}):</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {importReport.skipped.map((s, idx) => (
                      <li key={idx}>
                        Row {s.row} ({s.identifier}): {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {oneTimeCsv && (
                <div className="pt-2 border-t border-[#E7E0D2]">
                  <Button
                    onClick={handleDownloadCsv}
                    className="w-full h-9 bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download One-Time Credentials CSV</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Student Directory Table & Section Filter */}
      <div className="rounded-[14px] border border-[#E7E0D2] bg-white shadow-sm overflow-hidden">
        <div className="border-b border-[#E7E0D2] bg-[#FDFBF6] px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-sm font-semibold font-heading text-[#1F2937]">Enrolled Students Directory</h2>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#6B7280]" />
            <div className="w-52">
              <Select value={selectedSectionId} onValueChange={handleFilterSectionChange}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Cohorts</SelectItem>
                  {sections.map((sec) => (
                    <SelectItem key={sec.id} value={sec.id}>
                      {sec.name} (Year {sec.year}, Sem {sec.semester})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E7E0D2] bg-[#FDFBF6] text-[11px] font-semibold text-[#6B7280]">
              <tr>
                <th className="px-6 py-3">Roll Number</th>
                <th className="px-6 py-3">Student Name</th>
                <th className="px-6 py-3">Institutional Email</th>
                <th className="px-6 py-3">Cohort Section</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0D2]">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-xs text-[#6B7280]">
                    No students found for this section.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => (
                  <tr key={st.id} className="hover:bg-[#FDFBF6] transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-[#1F2937]">{st.rollNo}</td>
                    <td className="px-6 py-4 font-medium text-[#1F2937]">{st.user.name}</td>
                    <td className="px-6 py-4 font-mono text-[#6B7280]">{st.user.email}</td>
                    <td className="px-6 py-4 text-[#6B7280]">{st.section.name}</td>
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
                          <DropdownMenuItem
                            onClick={() => {
                              setTransferModal({
                                studentId: st.id,
                                studentName: st.user.name,
                                rollNo: st.rollNo,
                                currentSectionId: st.sectionId,
                              });
                              setTransferDestinationId("");
                            }}
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Transfer section</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleResetPassword(st.user.id, st.user.name, st.rollNo)}
                          >
                            <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                            <span>Reset password</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            destructive
                            onClick={() => {
                              setDeleteTarget(st);
                              setConfirmRollNoInput("");
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete student</span>
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

      {/* Transfer Section Modal */}
      <Dialog open={!!transferModal} onOpenChange={(open) => !open && setTransferModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Cohort Section</DialogTitle>
            <DialogDescription>
              Transferring <strong>{transferModal?.studentName}</strong> (Roll:{" "}
              <span className="font-mono">{transferModal?.rollNo}</span>)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="block text-xs font-medium text-[#6B7280]">Select Destination Section</label>
            <Select value={transferDestinationId} onValueChange={setTransferDestinationId}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="-- Choose New Section --" />
              </SelectTrigger>
              <SelectContent>
                {activeSections
                  .filter((sec) => sec.id !== transferModal?.currentSectionId)
                  .map((sec) => (
                    <SelectItem key={sec.id} value={sec.id}>
                      {sec.name} (Year {sec.year}, Sem {sec.semester})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTransferModal(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!transferDestinationId || isPending}
              onClick={handleTransferSubmit}
              className="bg-[#0F766E] hover:bg-[#0d655e] text-white"
            >
              {isPending ? "Transferring..." : "Confirm Transfer"}
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
              New temporary password for <strong>{resetModal?.userName}</strong> (Roll:{" "}
              <span className="font-mono">{resetModal?.rollNo}</span>). This password is shown only once and cannot be recovered.
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
              The student will be forced to choose a new password on their next login attempt.
            </p>
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setResetModal(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Student AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student: {deleteTarget?.rollNo}</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3 pt-1">
                <p className="text-xs text-[#6B7280]">
                  This will permanently delete the student account for{" "}
                  <strong className="text-[#1F2937]">{deleteTarget?.user.name}</strong> from{" "}
                  <strong>{deleteTarget?.section.name}</strong>. Student will lose all platform access immediately. Historical audit logs will be preserved.
                </p>
                <p className="text-xs text-[#6B7280]">
                  To confirm deletion, type the student roll number{" "}
                  <strong className="text-[#1F2937] font-mono">{deleteTarget?.rollNo}</strong> below:
                </p>
                <input
                  type="text"
                  value={confirmRollNoInput}
                  onChange={(e) => setConfirmRollNoInput(e.target.value)}
                  placeholder={deleteTarget?.rollNo}
                  className="w-full rounded-[10px] border border-[#E7E0D2] px-3 py-2 text-xs text-[#1F2937] font-mono focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              destructive
              disabled={
                !confirmRollNoInput ||
                confirmRollNoInput.trim().toUpperCase() !== deleteTarget?.rollNo.toUpperCase() ||
                isPending
              }
              onClick={handleDeleteSubmit}
            >
              {isPending ? "Deleting..." : "Delete Student"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
