"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FileText,
  Mail,
  Phone,
  AlertCircle,
} from "lucide-react";

export interface FacultyCardInfo {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  showContactToStudents: boolean;
  tags: ("Theory" | "Lab")[];
}

export interface AnnouncementItem {
  id: string;
  message: string;
  createdAt: string;
  componentType: "theory" | "lab";
  facultyName: string;
}

export interface ResourceItem {
  id: string;
  category:
    | "unit_1"
    | "unit_2"
    | "unit_3"
    | "unit_4"
    | "unit_5"
    | "mid_paper"
    | "previous_paper"
    | "important_questions"
    | "reference";
  title: string;
  message: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  createdAt: string;
  componentType: "theory" | "lab";
}

interface SubjectDetailViewerProps {
  subjectName: string;
  subjectCode: string;
  facultyCards: FacultyCardInfo[];
  announcements: AnnouncementItem[];
  resources: ResourceItem[];
}

const CATEGORY_TABS = [
  { key: "unit_1", label: "Unit 1" },
  { key: "unit_2", label: "Unit 2" },
  { key: "unit_3", label: "Unit 3" },
  { key: "unit_4", label: "Unit 4" },
  { key: "unit_5", label: "Unit 5" },
  { key: "mid_paper", label: "Mid paper" },
  { key: "previous_paper", label: "Previous paper" },
  { key: "important_questions", label: "Important questions" },
  { key: "reference", label: "Reference" },
] as const;

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function SubjectDetailViewer({
  subjectName,
  subjectCode,
  facultyCards,
  announcements,
  resources,
}: SubjectDetailViewerProps) {
  const [activeTab, setActiveTab] = useState<typeof CATEGORY_TABS[number]["key"]>("unit_1");
  const [componentFilter, setComponentFilter] = useState<"all" | "theory" | "lab">("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const filteredResources = resources.filter((r) => {
    if (r.category !== activeTab) return false;
    if (componentFilter !== "all" && r.componentType !== componentFilter) return false;
    return true;
  });

  const handleDownload = async (resourceId: string) => {
    try {
      setDownloadingId(resourceId);
      setDownloadError(null);

      const res = await fetch("/api/resources/presign-download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resourceId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate secure download link.");
      }

      const data = await res.json();
      if (!data.downloadUrl) {
        throw new Error("No download URL returned.");
      }

      // Trigger download via temporary anchor
      const link = document.createElement("a");
      link.href = data.downloadUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Download failed";
      setDownloadError(msg);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb & Page Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7280] mb-2">
          <Link href="/student" className="hover:text-[#0F766E] transition-colors">
            My Subjects
          </Link>
          <span>&gt;</span>
          <span className="text-[#1F2937] font-bold">{subjectName}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link
              href="/student"
              className="p-2 rounded-[10px] bg-white border border-[#E7E0D2] text-[#6B7280] hover:text-[#1F2937] hover:border-[#0F766E] transition-all shadow-xs mt-1"
              title="Back to Subjects"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1F2937]">
                  {subjectName}
                </h1>
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#CCFBF1] text-[#0F766E] border border-[#0F766E]/20">
                  {subjectCode}
                </span>
              </div>
              <p className="text-xs text-[#6B7280] mt-1 font-medium">
                Academic Curriculum &bull; Subject Code: <span className="font-mono">{subjectCode}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Two Faculty Cards Side by Side (Theory indigo accent, Lab amber accent) */}
      <div>
        <h2 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3">
          Course Instructors
        </h2>
        {facultyCards.length === 0 ? (
          <div className="card-study p-6 text-center text-xs text-[#6B7280] italic">
            No faculty members assigned yet for this course subject.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {facultyCards.map((faculty) => {
              const hasTheory = faculty.tags.includes("Theory");
              const hasLab = faculty.tags.includes("Lab");
              const isBoth = hasTheory && hasLab;

              // Border & accent colors
              const accentColor = isBoth
                ? "border-l-4 border-l-[#0F766E]"
                : hasTheory
                ? "border-l-4 border-l-[#4F46E5]"
                : "border-l-4 border-l-[#D97706]";

              const initialsBg = isBoth
                ? "bg-[#CCFBF1] text-[#0F766E]"
                : hasTheory
                ? "bg-[#EEF2FF] text-[#4F46E5]"
                : "bg-[#FEF3C7] text-[#D97706]";

              return (
                <div
                  key={faculty.id}
                  className={`card-study p-5 ${accentColor} flex items-start gap-4 transition-all`}
                >
                  <div
                    className={`w-12 h-12 rounded-full ${initialsBg} font-bold text-sm flex items-center justify-center flex-shrink-0 border border-[#E7E0D2]`}
                  >
                    {getInitials(faculty.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      {faculty.tags.map((tag) => (
                        <span
                          key={tag}
                          className={tag === "Theory" ? "badge-theory" : "badge-lab"}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <h3 className="font-heading text-base font-bold text-[#1F2937] truncate">
                      {faculty.name}
                    </h3>

                    <div className="mt-2 space-y-1 text-xs text-[#6B7280]">
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-[#6B7280] flex-shrink-0" />
                        <a
                          href={`mailto:${faculty.email}`}
                          className="hover:text-[#0F766E] truncate"
                        >
                          {faculty.email}
                        </a>
                      </div>

                      {faculty.showContactToStudents && faculty.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-[#6B7280] flex-shrink-0" />
                          <a
                            href={`tel:${faculty.phone}`}
                            className="font-mono hover:text-[#0F766E]"
                          >
                            {faculty.phone}
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Announcements (newest first from both components) */}
      {announcements.length > 0 && (
        <div className="card-study p-6 border-l-4 border-l-[#D97706] bg-[#FFFBEB]/40">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-[#D97706]" />
            <h2 className="font-heading text-sm font-bold text-[#92400E]">
              Faculty Announcements
            </h2>
          </div>

          <div className="space-y-3">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className="bg-white rounded-[10px] p-4 border border-[#E7E0D2] shadow-xs"
              >
                <p className="text-sm text-[#1F2937] whitespace-pre-wrap">{ann.message}</p>
                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-[#6B7280]">
                  <span className="font-medium text-[#1F2937] flex items-center gap-1.5">
                    <span
                      className={ann.componentType === "theory" ? "badge-theory" : "badge-lab"}
                    >
                      {ann.componentType === "theory" ? "Theory" : "Lab"}
                    </span>
                    <span>Posted by {ann.facultyName}</span>
                  </span>
                  <span>{new Date(ann.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resource Materials Card */}
      <div className="card-study overflow-hidden">
        {/* Category Tabs: Unit 1, Unit 2, Mid paper, Previous paper, Important questions, Reference */}
        <div className="border-b border-[#E7E0D2] bg-[#FDFBF6] px-4 sm:px-6 pt-3">
          <nav
            className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none"
            aria-label="Category Tabs"
          >
            {CATEGORY_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = resources.filter((r) => r.category === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-xs font-semibold rounded-[10px] whitespace-nowrap transition-all flex items-center gap-2 ${
                    isActive
                      ? "bg-[#0F766E] text-white shadow-xs"
                      : "text-[#6B7280] hover:text-[#1F2937] hover:bg-white/80"
                  }`}
                >
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? "bg-white text-[#0F766E]" : "bg-[#E7E0D2] text-[#1F2937]"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Component Filter: All / Theory / Lab */}
        <div className="p-4 sm:px-6 border-b border-[#E7E0D2] flex flex-wrap items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#6B7280]">Component Filter:</span>
            <div className="inline-flex rounded-[8px] border border-[#E7E0D2] p-0.5 bg-[#FDFBF6]">
              {(["all", "theory", "lab"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setComponentFilter(filter)}
                  className={`px-3 py-1 text-xs font-semibold capitalize rounded-[6px] transition-all ${
                    componentFilter === filter
                      ? "bg-[#0F766E] text-white shadow-xs"
                      : "text-[#6B7280] hover:text-[#1F2937]"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-[#6B7280] font-medium">
            Showing {filteredResources.length} of{" "}
            {resources.filter((r) => r.category === activeTab).length} file(s)
          </div>
        </div>

        {/* Download Error Alert */}
        {downloadError && (
          <div className="mx-6 mt-4 p-3.5 bg-red-50 border border-red-200 rounded-[10px] text-xs text-[#B91C1C] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{downloadError}</span>
            </div>
            <button
              onClick={() => setDownloadError(null)}
              className="text-[#B91C1C] font-bold hover:opacity-75"
            >
              &times;
            </button>
          </div>
        )}

        {/* File List / Table */}
        <div className="p-6">
          {filteredResources.length === 0 ? (
            <div className="text-center py-14">
              <div className="w-14 h-14 rounded-full bg-[#CCFBF1] text-[#0F766E] mx-auto flex items-center justify-center mb-4">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="font-heading text-base font-bold text-[#1F2937]">Not uploaded yet</h3>
              <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
                No materials have been uploaded for {CATEGORY_TABS.find((t) => t.key === activeTab)?.label} in this section yet.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setComponentFilter("all")}
                  className="btn-secondary text-xs h-9"
                >
                  Reset Filter
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[10px] border border-[#E7E0D2]">
              <table className="table-study">
                <thead>
                  <tr>
                    <th className="w-12 text-center">#</th>
                    <th>Title &amp; Message</th>
                    <th>Type</th>
                    <th>Uploaded Date</th>
                    <th>File Size</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResources.map((res, index) => {
                    const isDownloading = downloadingId === res.id;
                    return (
                      <tr key={res.id}>
                        <td className="text-center font-mono text-xs text-[#6B7280]">
                          {index + 1}
                        </td>
                        <td>
                          <div className="font-semibold text-[#1F2937]">{res.title}</div>
                          {res.message && (
                            <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">
                              {res.message}
                            </p>
                          )}
                        </td>
                        <td>
                          <span
                            className={
                              res.componentType === "theory" ? "badge-theory" : "badge-lab"
                            }
                          >
                            {res.componentType === "theory" ? "Theory" : "Lab"}
                          </span>
                        </td>
                        <td className="text-xs text-[#6B7280]">
                          {new Date(res.createdAt).toLocaleDateString()}
                        </td>
                        <td className="font-mono text-xs text-[#6B7280]">
                          {formatBytes(res.fileSizeBytes)}
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => handleDownload(res.id)}
                            disabled={isDownloading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{isDownloading ? "Preparing..." : "Download"}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
