"use client";

import { useState, useTransition } from "react";
import {
  createSection,
  deleteSection,
  moveSectionStudents,
} from "@/lib/academic/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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
import { MoreHorizontal, AlertCircle, CheckCircle, Trash2, ArrowRight } from "lucide-react";

interface ClassSubjectInfo {
  id: string;
  subject: {
    code: string;
    name: string;
  };
  components: {
    type: string;
    faculty: {
      name: string;
    };
  }[];
}

interface SectionItem {
  id: string;
  name: string;
  year: number;
  semester: number;
  isArchived: boolean;
  classSubjects: ClassSubjectInfo[];
  _count?: {
    students: number;
    classSubjects: number;
  };
}

export function SectionManager({ initialSections }: { initialSections: SectionItem[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Hard delete state
  const [deleteTarget, setDeleteTarget] = useState<SectionItem | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [moveDestinationId, setMoveDestinationId] = useState("");
  const [showMovePicker, setShowMovePicker] = useState(false);

  const handleCreate = (formData: FormData) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await createSection(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Section created successfully.");
        const form = document.getElementById("create-section-form") as HTMLFormElement;
        form?.reset();
      }
    });
  };

  const handleDeleteSubmit = () => {
    if (!deleteTarget) return;
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.append("sectionId", deleteTarget.id);
    formData.append("confirmName", confirmInput);

    startTransition(async () => {
      const res = await deleteSection(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(`Section "${deleteTarget.name}" deleted successfully.`);
        setDeleteTarget(null);
        setConfirmInput("");
      }
    });
  };

  const handleMoveStudents = () => {
    if (!deleteTarget || !moveDestinationId) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await moveSectionStudents(deleteTarget.id, moveDestinationId);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Students moved successfully. You may now proceed with deletion.");
        setShowMovePicker(false);
      }
    });
  };

  const otherSections = initialSections.filter(
    (s) => deleteTarget && s.id !== deleteTarget.id
  );

  const hasBlockers =
    deleteTarget &&
    ((deleteTarget._count?.students ?? 0) > 0 ||
      (deleteTarget._count?.classSubjects ?? 0) > 0);

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

      {/* Create Section Form */}
      <div className="rounded-[14px] border border-[#E7E0D2] bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold font-heading text-[#1F2937]">Create New Section</h2>
        <form id="create-section-form" action={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-[#6B7280]">Section Name</label>
            <input
              name="name"
              type="text"
              required
              placeholder="e.g. CSE-A, ECE-B"
              className="mt-1 block w-full rounded-[10px] border border-[#E7E0D2] px-3 py-2 text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280]">Year</label>
            <input
              name="year"
              type="number"
              min="1"
              max="4"
              defaultValue="1"
              required
              className="mt-1 block w-full rounded-[10px] border border-[#E7E0D2] px-3 py-2 text-xs text-[#1F2937] focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280]">Semester</label>
            <input
              name="semester"
              type="number"
              min="1"
              max="8"
              defaultValue="1"
              required
              className="mt-1 block w-full rounded-[10px] border border-[#E7E0D2] px-3 py-2 text-xs text-[#1F2937] focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              disabled={isPending}
              className="w-full h-9 rounded-[10px] bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-medium"
            >
              {isPending ? "Creating..." : "Create Section"}
            </Button>
          </div>
        </form>
      </div>

      {/* Sections Table */}
      <div className="rounded-[14px] border border-[#E7E0D2] bg-white shadow-sm overflow-hidden">
        <div className="border-b border-[#E7E0D2] bg-[#FDFBF6] px-6 py-4">
          <h2 className="text-sm font-semibold font-heading text-[#1F2937]">Configured Cohort Sections</h2>
        </div>

        {initialSections.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6B7280]">
            No sections found. Create one using the form above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E7E0D2] bg-[#FDFBF6] text-[11px] font-semibold text-[#6B7280]">
                <tr>
                  <th className="px-6 py-3">Section Name</th>
                  <th className="px-6 py-3">Year / Sem</th>
                  <th className="px-6 py-3">Students</th>
                  <th className="px-6 py-3">Linked Subjects</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0D2]">
                {initialSections.map((sec) => (
                  <tr key={sec.id} className="hover:bg-[#FDFBF6] transition-colors">
                    <td className="px-6 py-4 font-semibold text-[#1F2937]">{sec.name}</td>
                    <td className="px-6 py-4 text-[#6B7280]">
                      Year {sec.year}, Sem {sec.semester}
                    </td>
                    <td className="px-6 py-4 text-[#6B7280]">
                      <span className="font-mono">{sec._count?.students ?? 0}</span> students
                    </td>
                    <td className="px-6 py-4 text-[#6B7280]">
                      {sec.classSubjects.length === 0 ? (
                        <span className="italic text-gray-400">None linked yet</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {sec.classSubjects.map((cs) => (
                            <span
                              key={cs.id}
                              className="inline-flex items-center rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-[11px] font-medium text-teal-800"
                            >
                              {cs.subject.code}
                            </span>
                          ))}
                        </div>
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
                          <DropdownMenuItem
                            destructive
                            onClick={() => {
                              setDeleteTarget(sec);
                              setConfirmInput("");
                              setShowMovePicker(false);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete section</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hard Delete AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section: {deleteTarget?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              {hasBlockers ? (
                <div className="space-y-3 pt-2">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-[10px] text-xs text-[#B91C1C] space-y-1">
                    <p className="font-semibold">Cannot delete section due to active dependencies:</p>
                    {(deleteTarget?._count?.students ?? 0) > 0 && (
                      <p>
                        &bull; This section has <strong>{deleteTarget?._count?.students}</strong> student(s). Move them to another section first.
                      </p>
                    )}
                    {(deleteTarget?._count?.classSubjects ?? 0) > 0 && (
                      <p>
                        &bull; This section is linked to <strong>{deleteTarget?._count?.classSubjects}</strong> subject(s). Unlink them first on Section Subjects page.
                      </p>
                    )}
                  </div>

                  {(deleteTarget?._count?.students ?? 0) > 0 && (
                    <div className="p-3 border border-[#E7E0D2] rounded-[10px] space-y-2 bg-[#FDFBF6]">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-[#1F2937]">Move students to another section:</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowMovePicker(!showMovePicker)}
                          className="h-7 text-[11px]"
                        >
                          {showMovePicker ? "Cancel" : "Move students"}
                        </Button>
                      </div>

                      {showMovePicker && (
                        <div className="space-y-2 pt-1">
                          <Select value={moveDestinationId} onValueChange={setMoveDestinationId}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="-- Select Destination Section --" />
                            </SelectTrigger>
                            <SelectContent>
                              {otherSections.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name} (Year {s.year}, Sem {s.semester})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={handleMoveStudents}
                            disabled={!moveDestinationId || isPending}
                            className="w-full h-8 text-xs bg-[#0F766E] hover:bg-[#0d655e] text-white"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Confirm Student Transfer</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-[#6B7280]">
                    This section has no active students or subjects. To confirm deletion, type the section name{" "}
                    <strong className="text-[#1F2937] font-mono">{deleteTarget?.name}</strong> below:
                  </p>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={deleteTarget?.name}
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
                !confirmInput ||
                confirmInput.trim().toLowerCase() !== deleteTarget?.name.toLowerCase() ||
                isPending
              }
              onClick={handleDeleteSubmit}
            >
              {isPending ? "Deleting..." : "Delete Section"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
