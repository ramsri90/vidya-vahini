"use client";

import { useState, useTransition } from "react";
import { assignFacultyToSectionSubject } from "@/lib/academic/actions";
import { X, AlertCircle } from "lucide-react";

export interface SectionItem {
  id: string;
  name: string;
  year: number;
  semester: number;
}

export interface SubjectItem {
  id: string;
  code: string;
  name: string;
  year: number;
  semester: number;
}

export interface FacultyItem {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

interface FacultyAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "theory" | "lab";
  sections: SectionItem[];
  subjects: SubjectItem[];
  facultyList: FacultyItem[];
  onAssignmentSuccess?: (message: string) => void;
}

export function FacultyAssignmentModal({
  isOpen,
  onClose,
  type,
  sections,
  subjects,
  facultyList,
  onAssignmentSuccess,
}: FacultyAssignmentModalProps) {
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedSectionId || !selectedSubjectId || !selectedFacultyId) {
      setError("Please complete all three steps: Section, Subject, and Faculty.");
      return;
    }

    const formData = new FormData();
    formData.append("sectionId", selectedSectionId);
    formData.append("subjectId", selectedSubjectId);
    formData.append("type", type);
    formData.append("facultyId", selectedFacultyId);

    startTransition(async () => {
      const res = await assignFacultyToSectionSubject(formData);
      if (res.error) {
        setError(res.error);
      } else {
        const sec = sections.find((s) => s.id === selectedSectionId);
        const sub = subjects.find((s) => s.id === selectedSubjectId);
        const fac = facultyList.find((f) => f.id === selectedFacultyId);
        const typeLabel = type === "theory" ? "Theory" : "Lab";
        const successMessage = `${fac?.name || "Faculty"} is now ${typeLabel} faculty for ${sec?.name || "Section"} ${sub?.name || "Subject"}.`;

        if (onAssignmentSuccess) {
          onAssignmentSuccess(successMessage);
        }
        onClose();
      }
    });
  };

  const isTheory = type === "theory";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-[14px] border border-[#E7E0D2] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#E7E0D2] flex items-center justify-between bg-[#FDFBF6]">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isTheory
                  ? "bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE]"
                  : "bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]"
              }`}
            >
              {isTheory ? "Theory Slot" : "Lab Slot"}
            </span>
            <h2 className="font-heading text-lg font-bold text-[#1F2937]">
              {isTheory ? "Assign Faculty to Theory" : "Assign Faculty to Lab"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#6B7280] hover:text-[#1F2937] p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="rounded-[10px] bg-red-50 border border-red-200 p-3.5 text-xs text-[#B91C1C] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Choose Section */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#1F2937] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0F766E] text-white text-[11px] flex items-center justify-center font-bold">
                1
              </span>
              <span>Choose Section</span>
            </label>
            <div className="relative">
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                required
                className="w-full rounded-[10px] border border-[#E7E0D2] bg-white px-3.5 py-2.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              >
                <option value="">-- Select Section --</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name} (Year {sec.year}, Sem {sec.semester})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-[#6B7280]">
              Select the student section receiving this instruction.
            </p>
          </div>

          {/* Step 2: Choose Subject */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#1F2937] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0F766E] text-white text-[11px] flex items-center justify-center font-bold">
                2
              </span>
              <span>Choose Subject</span>
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              required
              className="w-full rounded-[10px] border border-[#E7E0D2] bg-white px-3.5 py-2.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            >
              <option value="">-- Select Subject --</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} - {sub.name} (Sem {sub.semester})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#6B7280]">
              Select the academic course being taught.
            </p>
          </div>

          {/* Step 3: Choose Faculty */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#1F2937] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0F766E] text-white text-[11px] flex items-center justify-center font-bold">
                3
              </span>
              <span>Choose Faculty</span>
            </label>
            <select
              value={selectedFacultyId}
              onChange={(e) => setSelectedFacultyId(e.target.value)}
              required
              className="w-full rounded-[10px] border border-[#E7E0D2] bg-white px-3.5 py-2.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            >
              <option value="">-- Select Faculty Member --</option>
              {facultyList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.email})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#6B7280]">
              Assign teaching responsibility for this {type} component.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#E7E0D2] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="h-10 px-4 rounded-[10px] border border-[#E7E0D2] bg-white text-sm font-semibold text-[#1F2937] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={`h-10 px-5 rounded-[10px] text-sm font-semibold text-white transition-all shadow-sm ${
                isTheory
                  ? "bg-[#4F46E5] hover:bg-[#4338CA] focus:ring-2 focus:ring-[#4F46E5]"
                  : "bg-[#D97706] hover:bg-[#B45309] focus:ring-2 focus:ring-[#D97706]"
              }`}
            >
              {isPending
                ? "Saving..."
                : isTheory
                ? "Save as Theory faculty"
                : "Save as Lab faculty"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
