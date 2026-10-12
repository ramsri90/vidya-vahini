"use client";

import { useState, useTransition } from "react";
import {
  linkClassSubject,
  assignComponent,
  reassignComponentFaculty,
  removeComponentSafely,
  unlinkSubjectFromSection,
} from "@/lib/academic/actions";
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
  UserCheck,
  Unlink,
  Filter,
} from "lucide-react";

interface SectionOption {
  id: string;
  name: string;
  year: number;
  semester: number;
  isArchived: boolean;
}

interface SubjectOption {
  id: string;
  code: string;
  name: string;
  year: number;
  semester: number;
}

interface FacultyOption {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

interface ComponentData {
  id: string;
  type: string;
  _count?: {
    resources: number;
  };
  faculty: {
    id: string;
    name: string;
    email: string;
  };
}

interface ClassSubjectData {
  id: string;
  isActive: boolean;
  section: {
    id: string;
    name: string;
    year: number;
    semester: number;
  };
  subject: {
    id: string;
    code: string;
    name: string;
  };
  components: ComponentData[];
}

export function ClassSubjectManager({
  sections,
  subjects,
  facultyList,
  classSubjects,
}: {
  sections: SectionOption[];
  subjects: SubjectOption[];
  facultyList: FacultyOption[];
  classSubjects: ClassSubjectData[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>("ALL");

  // Link Subject Form state
  const [linkSectionId, setLinkSectionId] = useState("");
  const [linkSubjectId, setLinkSubjectId] = useState("");

  // Slot Faculty Assignment / Reassignment Dialog state
  const [assignModal, setAssignModal] = useState<{
    classSubjectId: string;
    type: "theory" | "lab";
    componentId?: string;
    currentFacultyName?: string;
    subjectName: string;
  } | null>(null);
  const [selectedFacultyId, setSelectedFacultyId] = useState("");

  // Remove Slot AlertDialog state
  const [removeSlotTarget, setRemoveSlotTarget] = useState<{
    component: ComponentData;
    classSubject: ClassSubjectData;
  } | null>(null);
  const [removeConfirmCode, setRemoveConfirmCode] = useState("");

  // Unlink Subject AlertDialog state
  const [unlinkTarget, setUnlinkTarget] = useState<ClassSubjectData | null>(null);

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkSectionId || !linkSubjectId) {
      setError("Please select both a Section and a Subject.");
      return;
    }
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.append("sectionId", linkSectionId);
    formData.append("subjectId", linkSubjectId);

    startTransition(async () => {
      const res = await linkClassSubject(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Subject linked to section successfully.");
        setLinkSectionId("");
        setLinkSubjectId("");
      }
    });
  };

  const handleAssignFacultySubmit = () => {
    if (!assignModal || !selectedFacultyId) return;
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    if (assignModal.componentId) {
      // Reassign existing component
      formData.append("componentId", assignModal.componentId);
      formData.append("toFacultyId", selectedFacultyId);

      startTransition(async () => {
        const res = await reassignComponentFaculty(formData);
        if (res.error) {
          setError(res.error);
        } else {
          setSuccess(`Faculty reassigned to ${assignModal.type} slot successfully.`);
          setAssignModal(null);
          setSelectedFacultyId("");
        }
      });
    } else {
      // Assign new component slot
      formData.append("classSubjectId", assignModal.classSubjectId);
      formData.append("type", assignModal.type);
      formData.append("facultyId", selectedFacultyId);

      startTransition(async () => {
        const res = await assignComponent(formData);
        if (res.error) {
          setError(res.error);
        } else {
          setSuccess(`Faculty assigned to ${assignModal.type} slot successfully.`);
          setAssignModal(null);
          setSelectedFacultyId("");
        }
      });
    }
  };

  const handleRemoveSlotSubmit = () => {
    if (!removeSlotTarget) return;
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.append("componentId", removeSlotTarget.component.id);
    formData.append("confirmCode", removeConfirmCode);

    startTransition(async () => {
      const res = await removeComponentSafely(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(`${removeSlotTarget.component.type} slot removed successfully.`);
        setRemoveSlotTarget(null);
        setRemoveConfirmCode("");
      }
    });
  };

  const handleUnlinkSubmit = () => {
    if (!unlinkTarget) return;
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.append("classSubjectId", unlinkTarget.id);

    startTransition(async () => {
      const res = await unlinkSubjectFromSection(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(`Subject "${unlinkTarget.subject.code}" unlinked from ${unlinkTarget.section.name}.`);
        setUnlinkTarget(null);
      }
    });
  };

  const filteredClassSubjects =
    selectedSectionFilter === "ALL"
      ? classSubjects
      : classSubjects.filter((cs) => cs.section.id === selectedSectionFilter);

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

      {/* Link Subject to Section Form */}
      <div className="rounded-[14px] border border-[#E7E0D2] bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold font-heading text-[#1F2937]">Link Subject to Cohort Section</h2>
        <form onSubmit={handleLinkSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Target Section</label>
            <Select value={linkSectionId} onValueChange={setLinkSectionId}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="-- Select Section --" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((sec) => (
                  <SelectItem key={sec.id} value={sec.id}>
                    {sec.name} (Year {sec.year}, Sem {sec.semester})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Curriculum Subject</label>
            <Select value={linkSubjectId} onValueChange={setLinkSubjectId}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="-- Select Subject --" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.code} - {sub.name} (Year {sub.year}, Sem {sub.semester})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              disabled={isPending || !linkSectionId || !linkSubjectId}
              className="w-full h-10 rounded-[10px] bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs font-medium"
            >
              {isPending ? "Linking..." : "Link Subject"}
            </Button>
          </div>
        </form>
      </div>

      {/* Section Subjects Table & Filter */}
      <div className="rounded-[14px] border border-[#E7E0D2] bg-white shadow-sm overflow-hidden">
        <div className="border-b border-[#E7E0D2] bg-[#FDFBF6] px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-sm font-semibold font-heading text-[#1F2937]">Configured Section Curriculum & Faculty Slots</h2>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#6B7280]" />
            <div className="w-48">
              <Select value={selectedSectionFilter} onValueChange={setSelectedSectionFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Sections</SelectItem>
                  {sections.map((sec) => (
                    <SelectItem key={sec.id} value={sec.id}>
                      {sec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {filteredClassSubjects.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6B7280]">
            No section subject mappings found for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E7E0D2] bg-[#FDFBF6] text-[11px] font-semibold text-[#6B7280]">
                <tr>
                  <th className="px-6 py-3">Section</th>
                  <th className="px-6 py-3">Subject</th>
                  <th className="px-6 py-3">Theory Slot</th>
                  <th className="px-6 py-3">Lab Slot</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0D2]">
                {filteredClassSubjects.map((cs) => {
                  const theoryComp = cs.components.find((c) => c.type === "theory");
                  const labComp = cs.components.find((c) => c.type === "lab");

                  return (
                    <tr key={cs.id} className="hover:bg-[#FDFBF6] transition-colors">
                      <td className="px-6 py-4 font-semibold text-[#1F2937]">
                        {cs.section.name}
                        <span className="block text-[11px] font-normal text-[#6B7280]">
                          Year {cs.section.year}, Sem {cs.section.semester}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-[#1F2937]">{cs.subject.code}</span>
                        <span className="block text-[11px] text-[#6B7280]">{cs.subject.name}</span>
                      </td>

                      {/* Theory Slot */}
                      <td className="px-6 py-4">
                        {theoryComp ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                Theory
                              </span>
                              <span className="font-medium text-[#1F2937]">{theoryComp.faculty.name}</span>
                            </div>
                            <span className="block text-[11px] font-mono text-[#6B7280]">
                              {theoryComp.faculty.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-amber-600 font-medium">Not assigned</span>
                        )}
                      </td>

                      {/* Lab Slot */}
                      <td className="px-6 py-4">
                        {labComp ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                Lab
                              </span>
                              <span className="font-medium text-[#1F2937]">{labComp.faculty.name}</span>
                            </div>
                            <span className="block text-[11px] font-mono text-[#6B7280]">
                              {labComp.faculty.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-amber-600 font-medium">Not assigned</span>
                        )}
                      </td>

                      {/* Row Actions */}
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
                            {/* Change / Assign Theory Faculty */}
                            <DropdownMenuItem
                              onClick={() => {
                                setAssignModal({
                                  classSubjectId: cs.id,
                                  type: "theory",
                                  componentId: theoryComp?.id,
                                  currentFacultyName: theoryComp?.faculty.name,
                                  subjectName: `${cs.subject.code} - ${cs.subject.name}`,
                                });
                                setSelectedFacultyId(theoryComp?.faculty.id || "");
                              }}
                            >
                              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{theoryComp ? "Change theory faculty" : "Assign theory faculty"}</span>
                            </DropdownMenuItem>

                            {/* Change / Assign Lab Faculty */}
                            <DropdownMenuItem
                              onClick={() => {
                                setAssignModal({
                                  classSubjectId: cs.id,
                                  type: "lab",
                                  componentId: labComp?.id,
                                  currentFacultyName: labComp?.faculty.name,
                                  subjectName: `${cs.subject.code} - ${cs.subject.name}`,
                                });
                                setSelectedFacultyId(labComp?.faculty.id || "");
                              }}
                            >
                              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                              <span>{labComp ? "Change lab faculty" : "Assign lab faculty"}</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Remove Theory Slot */}
                            {theoryComp && (
                              <DropdownMenuItem
                                destructive
                                onClick={() => {
                                  setRemoveSlotTarget({
                                    component: theoryComp,
                                    classSubject: cs,
                                  });
                                  setRemoveConfirmCode("");
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove theory slot</span>
                              </DropdownMenuItem>
                            )}

                            {/* Remove Lab Slot */}
                            {labComp && (
                              <DropdownMenuItem
                                destructive
                                onClick={() => {
                                  setRemoveSlotTarget({
                                    component: labComp,
                                    classSubject: cs,
                                  });
                                  setRemoveConfirmCode("");
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove lab slot</span>
                              </DropdownMenuItem>
                            )}

                            {/* Unlink Subject */}
                            <DropdownMenuItem
                              destructive
                              onClick={() => setUnlinkTarget(cs)}
                            >
                              <Unlink className="w-3.5 h-3.5" />
                              <span>Unlink subject from section</span>
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

      {/* Assign / Change Faculty Dialog */}
      <Dialog open={!!assignModal} onOpenChange={(open) => !open && setAssignModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assignModal?.componentId ? "Change Faculty Assignment" : "Assign Faculty to Slot"}
            </DialogTitle>
            <DialogDescription>
              {assignModal?.subjectName} &bull;{" "}
              <span className="font-semibold capitalize text-[#1F2937]">{assignModal?.type} Slot</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {assignModal?.currentFacultyName && (
              <p className="text-xs text-[#6B7280]">
                Current Faculty:{" "}
                <strong className="text-[#1F2937]">{assignModal.currentFacultyName}</strong>
              </p>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#6B7280]">Select Faculty Member</label>
              <Select value={selectedFacultyId} onValueChange={setSelectedFacultyId}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="-- Choose Faculty --" />
                </SelectTrigger>
                <SelectContent>
                  {facultyList.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} ({f.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAssignModal(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedFacultyId || isPending}
              onClick={handleAssignFacultySubmit}
              className="bg-[#0F766E] hover:bg-[#0d655e] text-white"
            >
              {isPending ? "Saving..." : "Confirm Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Slot AlertDialog */}
      <AlertDialog open={!!removeSlotTarget} onOpenChange={(open) => !open && setRemoveSlotTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {removeSlotTarget?.component.type ? removeSlotTarget.component.type.toUpperCase() : ""} Slot
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(removeSlotTarget?.component._count?.resources ?? 0) > 0 ? (
                <div className="space-y-3 pt-2">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-[10px] text-xs text-[#B91C1C] space-y-1">
                    <p className="font-semibold">Active uploads detected on this component:</p>
                    <p>
                      This slot contains <strong>{removeSlotTarget?.component._count?.resources}</strong> uploaded resource(s).
                    </p>
                    <p className="text-[11px] pt-1">
                      Removing this slot will permanently delete all associated storage objects from Backblaze B2 and archive the records in the database.
                    </p>
                  </div>
                  <p className="text-xs text-[#6B7280]">
                    To confirm slot removal and cleanup, type the subject code{" "}
                    <strong className="text-[#1F2937] font-mono">
                      {removeSlotTarget?.classSubject.subject.code}
                    </strong>{" "}
                    below:
                  </p>
                  <input
                    type="text"
                    value={removeConfirmCode}
                    onChange={(e) => setRemoveConfirmCode(e.target.value)}
                    placeholder={removeSlotTarget?.classSubject.subject.code}
                    className="w-full rounded-[10px] border border-[#E7E0D2] px-3 py-2 text-xs text-[#1F2937] font-mono focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
                  />
                </div>
              ) : (
                <div className="space-y-2 pt-2 text-xs text-[#6B7280]">
                  <p>
                    Are you sure you want to remove the {removeSlotTarget?.component.type} slot for{" "}
                    <strong className="text-[#1F2937]">
                      {removeSlotTarget?.classSubject.subject.name}
                    </strong>{" "}
                    in {removeSlotTarget?.classSubject.section.name}?
                  </p>
                  <p>No resources have been uploaded to this slot. Removal is safe.</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRemoveSlotTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              destructive
              disabled={
                ((removeSlotTarget?.component._count?.resources ?? 0) > 0 &&
                  (!removeConfirmCode ||
                    removeConfirmCode.trim().toUpperCase() !==
                      removeSlotTarget?.classSubject.subject.code.toUpperCase())) ||
                isPending
              }
              onClick={handleRemoveSlotSubmit}
            >
              {isPending ? "Removing..." : "Remove Slot"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlink Subject AlertDialog */}
      <AlertDialog open={!!unlinkTarget} onOpenChange={(open) => !open && setUnlinkTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Subject from Section</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlink{" "}
              <strong className="text-[#1F2937]">
                {unlinkTarget?.subject.code} - {unlinkTarget?.subject.name}
              </strong>{" "}
              from section <strong>{unlinkTarget?.section.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUnlinkTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive disabled={isPending} onClick={handleUnlinkSubmit}>
              {isPending ? "Unlinking..." : "Unlink Subject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
