"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FacultyAssignmentModal,
  SectionItem,
  SubjectItem,
  FacultyItem,
} from "./FacultyAssignmentModal";
import {
  BookOpen,
  FlaskConical,
  UserPlus,
  FileSpreadsheet,
  Layers,
  GraduationCap,
  CheckCircle,
  X,
  Users,
} from "lucide-react";

export interface SummaryRow {
  id: string;
  sectionName: string;
  sectionYear: number;
  sectionSemester: number;
  subjectCode: string;
  subjectName: string;
  theoryFacultyName: string | null;
  theoryFacultyEmail: string | null;
  labFacultyName: string | null;
  labFacultyEmail: string | null;
  studentCount: number;
}

interface AdminOverviewManagerProps {
  sections: SectionItem[];
  subjects: SubjectItem[];
  facultyList: FacultyItem[];
  summaryRows: SummaryRow[];
}

export function AdminOverviewManager({
  sections,
  subjects,
  facultyList,
  summaryRows,
}: AdminOverviewManagerProps) {
  const [modalType, setModalType] = useState<"theory" | "lab" | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleOpenAssign = (type: "theory" | "lab") => {
    setModalType(type);
  };

  const handleAssignmentSuccess = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 6000);
  };

  return (
    <div className="space-y-8">
      {/* Top-Right Success Toast with colored left border */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-3 duration-200">
          <div className="toast-study border-l-4 border-[#0F766E] bg-white p-4 max-w-md shadow-lg rounded-r-[10px] flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-[#0F766E] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">Assignment Successful</h4>
              <p className="text-sm font-medium text-[#1F2937] mt-0.5">{toastMessage}</p>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-[#6B7280] hover:text-[#1F2937] p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Overview Action Cards at Top */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-3">
          Quick Academic Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Assign Faculty to Theory */}
          <button
            type="button"
            onClick={() => handleOpenAssign("theory")}
            className="card-study p-5 text-left hover:border-[#4F46E5] hover:shadow-md transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-[10px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#1F2937] group-hover:text-[#4F46E5] transition-colors">
                Assign Faculty to Theory
              </h3>
              <p className="text-xs text-[#6B7280] mt-1">
                Allocate a lecture instructor for class syllabus and theory notes.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E7E0D2] flex items-center justify-between text-xs font-semibold text-[#4F46E5]">
              <span>Open Theory Form</span>
              <span>&rarr;</span>
            </div>
          </button>

          {/* 2. Assign Faculty to Lab */}
          <button
            type="button"
            onClick={() => handleOpenAssign("lab")}
            className="card-study p-5 text-left hover:border-[#D97706] hover:shadow-md transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-[10px] bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <FlaskConical className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#1F2937] group-hover:text-[#D97706] transition-colors">
                Assign Faculty to Lab
              </h3>
              <p className="text-xs text-[#6B7280] mt-1">
                Allocate a practical or laboratory instructor for hands-on slots.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E7E0D2] flex items-center justify-between text-xs font-semibold text-[#D97706]">
              <span>Open Lab Form</span>
              <span>&rarr;</span>
            </div>
          </button>

          {/* 3. Add Faculty */}
          <Link
            href="/admin/faculty"
            prefetch={true}
            className="card-study p-5 text-left hover:border-[#0F766E] hover:shadow-md transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-[10px] bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <UserPlus className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#1F2937] group-hover:text-[#0F766E] transition-colors">
                Add Faculty
              </h3>
              <p className="text-xs text-[#6B7280] mt-1">
                Create teaching staff accounts individually or via bulk roster.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E7E0D2] flex items-center justify-between text-xs font-semibold text-[#0F766E]">
              <span>Faculty Management</span>
              <span>&rarr;</span>
            </div>
          </Link>

          {/* 4. Import Students (Excel) */}
          <Link
            href="/admin/students"
            prefetch={true}
            className="card-study p-5 text-left hover:border-[#0F766E] hover:shadow-md transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-[10px] bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#1F2937] group-hover:text-[#0F766E] transition-colors">
                Import Students (Excel)
              </h3>
              <p className="text-xs text-[#6B7280] mt-1">
                Bulk upload student enrollments with one-time credentials.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E7E0D2] flex items-center justify-between text-xs font-semibold text-[#0F766E]">
              <span>Student Onboarding</span>
              <span>&rarr;</span>
            </div>
          </Link>

          {/* 5. Create Section */}
          <Link
            href="/admin/sections"
            prefetch={true}
            className="card-study p-5 text-left hover:border-[#0F766E] hover:shadow-md transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-[10px] bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#1F2937] group-hover:text-[#0F766E] transition-colors">
                Create Section
              </h3>
              <p className="text-xs text-[#6B7280] mt-1">
                Set up department branches and semester cohorts (e.g. CSE-1).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E7E0D2] flex items-center justify-between text-xs font-semibold text-[#0F766E]">
              <span>Manage Sections</span>
              <span>&rarr;</span>
            </div>
          </Link>

          {/* 6. Create Subject */}
          <Link
            href="/admin/subjects"
            prefetch={true}
            className="card-study p-5 text-left hover:border-[#0F766E] hover:shadow-md transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-[10px] bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#1F2937] group-hover:text-[#0F766E] transition-colors">
                Create Subject
              </h3>
              <p className="text-xs text-[#6B7280] mt-1">
                Add courses, curriculum codes, and semester syllabus entries.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E7E0D2] flex items-center justify-between text-xs font-semibold text-[#0F766E]">
              <span>Manage Subjects</span>
              <span>&rarr;</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Summary Table: Section | Subject | Theory Faculty | Lab Faculty | Students */}
      <div className="card-study p-6">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-heading text-lg font-bold text-[#1F2937]">
              Academic Allocation Summary
            </h2>
            <p className="text-xs text-[#6B7280]">
              Current status of subjects, teaching faculty, and enrolled student counts across sections.
            </p>
          </div>
          <Link
            href="/admin/class-subjects"
            prefetch={true}
            className="text-xs font-semibold text-[#0F766E] hover:underline flex items-center gap-1"
          >
            <span>Manage Section Subjects &rarr;</span>
          </Link>
        </div>

        {summaryRows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-[#CCFBF1] text-[#0F766E] mx-auto flex items-center justify-center mb-3">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-[#1F2937]">No subjects linked to sections yet</h3>
            <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
              Link subjects to sections to start assigning theory and lab faculty members.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-[#E7E0D2]">
            <table className="table-study">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Subject</th>
                  <th>Theory Faculty</th>
                  <th>Lab Faculty</th>
                  <th>Students</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold text-[#1F2937]">
                      {row.sectionName}
                      <span className="block text-[11px] text-[#6B7280] font-normal">
                        Year {row.sectionYear}, Sem {row.sectionSemester}
                      </span>
                    </td>
                    <td>
                      <span className="font-semibold text-[#1F2937]">{row.subjectName}</span>
                      <span className="block font-mono text-[11px] text-[#6B7280]">
                        {row.subjectCode}
                      </span>
                    </td>
                    <td>
                      {row.theoryFacultyName ? (
                        <div>
                          <span className="font-medium text-[#1F2937] flex items-center gap-1.5">
                            <span className="badge-theory">Theory</span>
                            {row.theoryFacultyName}
                          </span>
                          <span className="text-[11px] text-[#6B7280] block">
                            {row.theoryFacultyEmail}
                          </span>
                        </div>
                      ) : (
                        <span className="text-amber-700 font-medium text-xs">Not assigned</span>
                      )}
                    </td>
                    <td>
                      {row.labFacultyName ? (
                        <div>
                          <span className="font-medium text-[#1F2937] flex items-center gap-1.5">
                            <span className="badge-lab">Lab</span>
                            {row.labFacultyName}
                          </span>
                          <span className="text-[11px] text-[#6B7280] block">
                            {row.labFacultyEmail}
                          </span>
                        </div>
                      ) : (
                        <span className="text-amber-700 font-medium text-xs">Not assigned</span>
                      )}
                    </td>
                    <td>
                      <span className="font-semibold text-[#1F2937] flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#6B7280]" />
                        {row.studentCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {modalType && (
        <FacultyAssignmentModal
          isOpen={Boolean(modalType)}
          onClose={() => setModalType(null)}
          type={modalType}
          sections={sections}
          subjects={subjects}
          facultyList={facultyList}
          onAssignmentSuccess={handleAssignmentSuccess}
        />
      )}
    </div>
  );
}
