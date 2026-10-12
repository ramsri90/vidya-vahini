"use client";

import { useState, useTransition } from "react";
import { createSubject, deleteSubject } from "@/lib/academic/actions";
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
import { MoreHorizontal, AlertCircle, CheckCircle, Trash2 } from "lucide-react";
import Link from "next/link";

interface SubjectItem {
  id: string;
  code: string;
  name: string;
  year: number;
  semester: number;
  classSubjects: {
    section: {
      name: string;
    };
  }[];
}

export function SubjectManager({ initialSubjects }: { initialSubjects: SubjectItem[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Hard delete state
  const [deleteTarget, setDeleteTarget] = useState<SubjectItem | null>(null);
  const [confirmInput, setConfirmInput] = useState("");

  const handleCreate = (formData: FormData) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await createSubject(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Subject added to catalog successfully.");
        const form = document.getElementById("create-subject-form") as HTMLFormElement;
        form?.reset();
      }
    });
  };

  const handleDeleteSubmit = () => {
    if (!deleteTarget) return;
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.append("subjectId", deleteTarget.id);
    formData.append("confirmCode", confirmInput);

    startTransition(async () => {
      const res = await deleteSubject(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(`Subject "${deleteTarget.code}" deleted successfully.`);
        setDeleteTarget(null);
        setConfirmInput("");
      }
    });
  };

  const isLinked = deleteTarget && deleteTarget.classSubjects.length > 0;
  const linkedSectionNames = deleteTarget
    ? deleteTarget.classSubjects.map((cs) => cs.section.name)
    : [];

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

      {/* Create Subject Form */}
      <div className="rounded-[14px] border border-[#E7E0D2] bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold font-heading text-[#1F2937]">Add Subject to Catalog</h2>
        <form id="create-subject-form" action={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div>
            <label className="block text-xs font-medium text-[#6B7280]">Code</label>
            <input
              name="code"
              type="text"
              required
              placeholder="e.g. CS101, EC202"
              className="mt-1 block w-full rounded-[10px] border border-[#E7E0D2] px-3 py-2 text-xs font-mono text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#6B7280]">Name</label>
            <input
              name="name"
              type="text"
              required
              placeholder="e.g. Data Structures & Algorithms"
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
          <div className="sm:col-span-5 flex justify-end">
            <Button
              type="submit"
              disabled={isPending}
              className="h-9 px-6 rounded-[10px] bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-medium"
            >
              {isPending ? "Adding..." : "Add Subject"}
            </Button>
          </div>
        </form>
      </div>

      {/* Subjects Table */}
      <div className="rounded-[14px] border border-[#E7E0D2] bg-white shadow-sm overflow-hidden">
        <div className="border-b border-[#E7E0D2] bg-[#FDFBF6] px-6 py-4">
          <h2 className="text-sm font-semibold font-heading text-[#1F2937]">Curriculum Subject Catalog</h2>
        </div>

        {initialSubjects.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6B7280]">
            No subjects defined yet. Add one using the catalog form above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E7E0D2] bg-[#FDFBF6] text-[11px] font-semibold text-[#6B7280]">
                <tr>
                  <th className="px-6 py-3">Code</th>
                  <th className="px-6 py-3">Subject Name</th>
                  <th className="px-6 py-3">Year / Sem</th>
                  <th className="px-6 py-3">Assigned Sections</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0D2]">
                {initialSubjects.map((sub) => {
                  const sectionsUsing = sub.classSubjects.map((cs) => cs.section.name);
                  return (
                    <tr key={sub.id} className="hover:bg-[#FDFBF6] transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-[#1F2937]">{sub.code}</td>
                      <td className="px-6 py-4 font-medium text-[#1F2937]">{sub.name}</td>
                      <td className="px-6 py-4 text-[#6B7280]">
                        Year {sub.year}, Sem {sub.semester}
                      </td>
                      <td className="px-6 py-4 text-[#6B7280]">
                        {sectionsUsing.length === 0 ? (
                          <span className="italic text-gray-400">Not assigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {sectionsUsing.map((secName, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-[11px] font-medium text-teal-800"
                              >
                                {secName}
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
                                setDeleteTarget(sub);
                                setConfirmInput("");
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete subject</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hard Delete AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subject: {deleteTarget?.code}</AlertDialogTitle>
            <AlertDialogDescription>
              {isLinked ? (
                <div className="space-y-3 pt-2">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-[10px] text-xs text-[#B91C1C] space-y-1">
                    <p className="font-semibold">Cannot delete subject while linked to cohorts:</p>
                    <p>
                      This subject is currently assigned to <strong>{deleteTarget?.classSubjects.length}</strong> section(s):{" "}
                      <span className="font-semibold font-mono">{linkedSectionNames.join(", ")}</span>.
                    </p>
                    <p className="pt-1 text-[11px]">
                      Please unlink this subject from all sections on the Section Subjects page first before deleting.
                    </p>
                  </div>
                  <div className="pt-1">
                    <Link
                      href="/admin/class-subjects"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F766E] hover:underline"
                    >
                      Go to Section Subjects &rarr;
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-[#6B7280]">
                    This subject is not assigned to any section. To confirm deletion, type the subject code{" "}
                    <strong className="text-[#1F2937] font-mono">{deleteTarget?.code}</strong> below:
                  </p>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={deleteTarget?.code}
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
                isLinked ||
                !confirmInput ||
                confirmInput.trim().toUpperCase() !== deleteTarget?.code.toUpperCase() ||
                isPending
              }
              onClick={handleDeleteSubmit}
            >
              {isPending ? "Deleting..." : "Delete Subject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
