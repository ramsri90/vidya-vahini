"use client";

import * as React from "react";
import {
  Calendar,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit,
  Plus,
  Clock,
  Filter,
  RefreshCw,
  Archive,
  Send,
  X,
} from "lucide-react";
import {
  parseTimetableFileAction,
  saveTimetableAction,
  publishTimetableAction,
  unpublishTimetableAction,
  archiveTimetableAction,
  deleteTimetableAction,
  getTimetableDownloadUrlAction,
} from "@/lib/timetable/actions";
import { DayOfWeek, ParsedSlot, ParseResult } from "@/lib/timetable/types";

interface SectionOption {
  id: string;
  name: string;
  year: number;
  semester: number;
}

interface ExistingTimetable {
  id: string;
  sectionId: string;
  academicYear: string;
  department: string | null;
  effectiveFrom: Date | null;
  effectiveTill: Date | null;
  status: "draft" | "published" | "archived";
  version: number;
  attachmentKey: string | null;
  attachmentName: string | null;
  createdAt: Date;
  updatedAt: Date;
  section: {
    id: string;
    name: string;
    year: number;
    semester: number;
  };
  slots: Array<{
    id: string;
    day: string;
    startTime: string;
    endTime: string;
    subjectCode: string;
    subjectName: string;
    facultyName: string | null;
    roomNumber: string | null;
    sessionType: "theory" | "lab";
    sectionName: string | null;
    sortOrder: number;
  }>;
}

interface TimetableManagerProps {
  sections: SectionOption[];
  timetables: ExistingTimetable[];
}

export function TimetableManager({ sections, timetables }: TimetableManagerProps) {
  // Form State
  const [selectedSectionId, setSelectedSectionId] = React.useState<string>(sections[0]?.id || "");
  const [academicYear, setAcademicYear] = React.useState<string>("2024-2025");
  const [department, setDepartment] = React.useState<string>("Computer Science & Engineering");
  const [effectiveFrom, setEffectiveFrom] = React.useState<string>("");
  const [effectiveTill, setEffectiveTill] = React.useState<string>("");

  // Upload & Parse State
  const [file, setFile] = React.useState<File | null>(null);
  const [isParsing, setIsParsing] = React.useState(false);
  const [parseResult, setParseResult] = React.useState<ParseResult | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);

  // Attachment State (PDF / Image)
  const [attachmentUploading, setAttachmentUploading] = React.useState(false);
  const [attachmentData, setAttachmentData] = React.useState<{ key: string; name: string } | null>(null);

  // Editable Slots
  const [slots, setSlots] = React.useState<ParsedSlot[]>([]);
  const [editingTimetableId, setEditingTimetableId] = React.useState<string | null>(null);

  // Status & Notifications
  const [isSaving, setIsSaving] = React.useState(false);
  const [actionMessage, setActionMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filter existing timetables list
  const [filterSection, setFilterSection] = React.useState<string>("all");
  const [filterStatus, setFilterStatus] = React.useState<string>("all");

  // Slot modal editor state
  const [editingSlotIndex, setEditingSlotIndex] = React.useState<number | null>(null);
  const [slotFormData, setSlotFormData] = React.useState<ParsedSlot>({
    day: "Monday",
    startTime: "09:00 AM",
    endTime: "10:00 AM",
    subjectCode: "",
    subjectName: "",
    facultyName: "",
    roomNumber: "",
    sessionType: "theory",
  });
  const [showSlotModal, setShowSlotModal] = React.useState(false);

  // Clear notice after 6 seconds
  React.useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setParseError(null);
    setParseResult(null);

    const formData = new FormData();
    formData.append("file", selected);

    setIsParsing(true);
    try {
      const res = await parseTimetableFileAction(formData);
      if (res.error) {
        setParseError(res.error);
      } else if (res.data) {
        setParseResult(res.data);
        setSlots(res.data.slots);
      }
    } catch {
      setParseError("An unexpected error occurred while parsing the file.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleAttachmentUpload = async (fileToUpload: File) => {
    setAttachmentUploading(true);
    try {
      // 1. Get presigned upload URL
      const presignRes = await fetch("/api/timetable/presign-attachment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: fileToUpload.name,
          mimeType: fileToUpload.type,
          sizeBytes: fileToUpload.size,
        }),
      });

      if (!presignRes.ok) {
        const err = await presignRes.json();
        throw new Error(err.error || "Failed to initialize attachment upload.");
      }

      const { uploadUrl, storageKey, filename } = await presignRes.json();

      // 2. Upload file directly to R2
      const s3Res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": fileToUpload.type },
        body: fileToUpload,
      });

      if (!s3Res.ok) {
        throw new Error("Failed to upload attachment to cloud storage.");
      }

      setAttachmentData({ key: storageKey, name: filename });
      setActionMessage({ type: "success", text: `Official attachment "${filename}" uploaded.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Attachment upload failed.";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setAttachmentUploading(false);
    }
  };

  const handleSave = async (status: "draft" | "published") => {
    if (!selectedSectionId) {
      setActionMessage({ type: "error", text: "Please choose a valid Section." });
      return;
    }
    if (slots.length === 0) {
      setActionMessage({ type: "error", text: "Please add or upload at least one timetable slot." });
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveTimetableAction({
        timetableId: editingTimetableId || undefined,
        sectionId: selectedSectionId,
        academicYear,
        department,
        effectiveFrom: effectiveFrom || undefined,
        effectiveTill: effectiveTill || undefined,
        status,
        attachmentKey: attachmentData?.key,
        attachmentName: attachmentData?.name,
        slots,
      });

      if (res.error) {
        setActionMessage({ type: "error", text: res.error });
      } else {
        setActionMessage({
          type: "success",
          text: `Timetable successfully ${status === "published" ? "published" : "saved as draft"}!`,
        });
        // Reset form
        setEditingTimetableId(null);
        setSlots([]);
        setFile(null);
        setParseResult(null);
        setAttachmentData(null);
      }
    } catch {
      setActionMessage({ type: "error", text: "Unexpected error while saving timetable." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditExisting = (tt: ExistingTimetable) => {
    setEditingTimetableId(tt.id);
    setSelectedSectionId(tt.sectionId);
    setAcademicYear(tt.academicYear);
    setDepartment(tt.department || "Computer Science & Engineering");
    setEffectiveFrom(tt.effectiveFrom ? new Date(tt.effectiveFrom).toISOString().split("T")[0] : "");
    setEffectiveTill(tt.effectiveTill ? new Date(tt.effectiveTill).toISOString().split("T")[0] : "");
    setAttachmentData(
      tt.attachmentKey ? { key: tt.attachmentKey, name: tt.attachmentName || "attachment" } : null
    );
    setSlots(
      tt.slots.map((s) => ({
        id: s.id,
        day: s.day as DayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        facultyName: s.facultyName || undefined,
        roomNumber: s.roomNumber || undefined,
        sessionType: s.sessionType,
        sectionName: s.sectionName || undefined,
        sortOrder: s.sortOrder,
      }))
    );
    // Scroll to editor
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDownloadAttachment = async (timetableId: string) => {
    try {
      const res = await getTimetableDownloadUrlAction(timetableId);
      if (res.error) {
        setActionMessage({ type: "error", text: res.error });
      } else if (res.data?.url) {
        window.open(res.data.url, "_blank");
      }
    } catch {
      setActionMessage({ type: "error", text: "Failed to download attachment." });
    }
  };

  const filteredTimetables = timetables.filter((t) => {
    if (filterSection !== "all" && t.sectionId !== filterSection) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {actionMessage && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm shadow-md transition-all ${
            actionMessage.type === "success"
              ? "bg-[#DCFCE7] text-[#15803D] border-l-4 border-[#15803D]"
              : "bg-[#FEE2E2] text-[#B91C1C] border-l-4 border-[#B91C1C]"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="font-medium">{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="p-1 hover:opacity-75 transition"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1F2937]">Class Timetable Management</h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Create, upload, preview, validate, and publish official section timetables from structured Excel files.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/api/timetable/template"
            download="vidya_vahini_timetable_template.xlsx"
            className="btn-secondary text-xs h-10 px-4 inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-[#0F766E]" />
            <span>Download Excel Template</span>
          </a>
        </div>
      </div>

      {/* Section 1: Timetable Editor / Upload Card */}
      <div className="card-study p-6">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#E7E0D2]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-heading text-base font-bold text-[#1F2937]">
                {editingTimetableId ? "Edit Timetable" : "Create or Upload Timetable"}
              </h2>
              <p className="text-xs text-[#6B7280]">
                Configure class details, parse your timetable spreadsheet, and verify class sessions.
              </p>
            </div>
          </div>
          {editingTimetableId && (
            <button
              onClick={() => {
                setEditingTimetableId(null);
                setSlots([]);
                setFile(null);
                setParseResult(null);
              }}
              className="text-xs text-[#6B7280] hover:text-[#B91C1C] flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Edit</span>
            </button>
          )}
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
              Target Section <span className="text-[#B91C1C]">*</span>
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="input-study w-full text-xs"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  Section {s.name} (Year {s.year}, Sem {s.semester})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
              Academic Year <span className="text-[#B91C1C]">*</span>
            </label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="e.g. 2024-2025"
              className="input-study w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Computer Science"
              className="input-study w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">Effective Date Range</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="input-study w-full text-xs"
                title="Effective From"
              />
              <input
                type="date"
                value={effectiveTill}
                onChange={(e) => setEffectiveTill(e.target.value)}
                className="input-study w-full text-xs"
                title="Effective Till"
              />
            </div>
          </div>
        </div>

        {/* Upload Dropzones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* 1. Excel File Upload */}
          <div className="rounded-[10px] border-2 border-dashed border-[#E7E0D2] bg-[#FDFBF6] p-5 text-center transition hover:border-[#0F766E]/50">
            <FileSpreadsheet className="w-8 h-8 text-[#0F766E] mx-auto mb-2" />
            <h3 className="text-xs font-bold text-[#1F2937]">Structured Excel Timetable (.xlsx)</h3>
            <p className="text-[11px] text-[#6B7280] mt-1 mb-3">
              Upload your completed schedule spreadsheet with sessions, times, subjects, and rooms.
            </p>
            <label className="btn-secondary text-xs h-9 px-4 cursor-pointer inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>{isParsing ? "Parsing Spreadsheet..." : "Choose Excel File"}</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                disabled={isParsing}
                className="hidden"
              />
            </label>
            {file && (
              <p className="text-xs font-mono text-[#0F766E] mt-2 truncate">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* 2. Official PDF / Image Attachment */}
          <div className="rounded-[10px] border-2 border-dashed border-[#E7E0D2] bg-[#FDFBF6] p-5 text-center transition hover:border-[#0F766E]/50">
            <FileText className="w-8 h-8 text-[#4F46E5] mx-auto mb-2" />
            <h3 className="text-xs font-bold text-[#1F2937]">Official PDF or Image Attachment (Optional)</h3>
            <p className="text-[11px] text-[#6B7280] mt-1 mb-3">
              Attach the signed official notice or photo (.pdf, .png, .jpg) for students to download.
            </p>
            <label className="btn-secondary text-xs h-9 px-4 cursor-pointer inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-[#4F46E5]" />
              <span>{attachmentUploading ? "Uploading..." : "Attach Official Document"}</span>
              <input
                type="file"
                accept=".pdf, image/png, image/jpeg, image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    handleAttachmentUpload(f);
                  }
                }}
                disabled={attachmentUploading}
                className="hidden"
              />
            </label>
            {attachmentData && (
              <p className="text-xs font-mono text-[#15803D] mt-2 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Attached: {attachmentData.name}
              </p>
            )}
          </div>
        </div>

        {/* Parse Feedback: Errors & Warnings */}
        {parseError && (
          <div className="rounded-[10px] bg-[#FEE2E2] border border-[#FECACA] p-4 text-[#B91C1C] text-xs flex items-start gap-2.5 mb-6">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Spreadsheet Validation Error</p>
              <p className="mt-0.5">{parseError}</p>
            </div>
          </div>
        )}

        {parseResult && parseResult.errors.length > 0 && (
          <div className="rounded-[10px] bg-[#FEE2E2] border border-[#FECACA] p-4 mb-6">
            <div className="flex items-center gap-2 text-[#B91C1C] font-bold text-xs mb-2">
              <AlertCircle className="w-4 h-4" />
              <span>Found {parseResult.errors.length} formatting error(s) in Excel:</span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs text-[#B91C1C]">
              {parseResult.errors.map((err, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-mono font-semibold bg-white/70 px-1.5 py-0.5 rounded">Row {err.row}</span>
                  <span>[{err.field}]: {err.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {parseResult && parseResult.warnings.length > 0 && (
          <div className="rounded-[10px] bg-[#FEF3C7] border border-[#FDE68A] p-4 mb-6">
            <div className="flex items-center gap-2 text-[#D97706] font-bold text-xs mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{parseResult.warnings.length} Schedule Notice(s) / Overlap Note(s):</span>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto text-xs text-[#B45309]">
              {parseResult.warnings.map((warn, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-mono bg-white/70 px-1.5 py-0.5 rounded">Row {warn.row}</span>
                  <span>{warn.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Slot Table & Controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-sm font-bold text-[#1F2937]">
                Configured Class Slots ({slots.length})
              </h3>
              {slots.length > 0 && (
                <span className="text-[11px] bg-[#CCFBF1] text-[#0F766E] font-semibold px-2 py-0.5 rounded-full">
                  Valid
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setEditingSlotIndex(null);
                setSlotFormData({
                  day: "Monday",
                  startTime: "09:00 AM",
                  endTime: "10:00 AM",
                  subjectCode: "",
                  subjectName: "",
                  facultyName: "",
                  roomNumber: "",
                  sessionType: "theory",
                });
                setShowSlotModal(true);
              }}
              className="btn-secondary text-xs h-8 px-3 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>Add Custom Slot</span>
            </button>
          </div>

          {slots.length === 0 ? (
            <div className="rounded-[10px] border border-[#E7E0D2] bg-[#FDFBF6] py-10 text-center">
              <Clock className="w-8 h-8 text-[#6B7280] mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-[#1F2937]">No slots loaded</p>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                Upload an Excel file above or click &ldquo;Add Custom Slot&rdquo; to begin.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[10px] border border-[#E7E0D2]">
              <table className="table-study">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Subject</th>
                    <th>Type</th>
                    <th>Faculty</th>
                    <th>Room</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot, idx) => (
                    <tr key={idx}>
                      <td className="font-semibold text-[#1F2937] text-xs">{slot.day}</td>
                      <td className="font-mono text-xs text-[#6B7280]">
                        {slot.startTime} - {slot.endTime}
                      </td>
                      <td>
                        <div className="font-semibold text-xs text-[#1F2937]">{slot.subjectName}</div>
                        <div className="font-mono text-[11px] text-[#0F766E]">{slot.subjectCode}</div>
                      </td>
                      <td>
                        <span className={slot.sessionType === "theory" ? "badge-theory" : "badge-lab"}>
                          {slot.sessionType}
                        </span>
                      </td>
                      <td className="text-xs text-[#6B7280]">{slot.facultyName || "—"}</td>
                      <td className="text-xs font-mono text-[#6B7280]">{slot.roomNumber || "—"}</td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingSlotIndex(idx);
                              setSlotFormData({ ...slot });
                              setShowSlotModal(true);
                            }}
                            className="p-1.5 hover:bg-[#CCFBF1] text-[#0F766E] rounded-[8px] transition cursor-pointer"
                            title="Edit Slot"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSlots(slots.filter((_, i) => i !== idx));
                            }}
                            className="p-1.5 hover:bg-red-50 text-[#B91C1C] rounded-[8px] transition cursor-pointer"
                            title="Remove Slot"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-5 border-t border-[#E7E0D2] flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-[#6B7280]">
            {slots.length > 0 ? `${slots.length} session(s) ready to save.` : "Ready for input."}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSave("draft")}
              disabled={isSaving || slots.length === 0}
              className="btn-secondary text-xs h-10 px-5"
            >
              {isSaving ? "Saving..." : "Save as Draft"}
            </button>
            <button
              onClick={() => handleSave("published")}
              disabled={isSaving || slots.length === 0}
              className="btn-primary text-xs h-10 px-5 inline-flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSaving ? "Publishing..." : "Publish Timetable"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 2: Existing Timetables List */}
      <div className="card-study p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-[#E7E0D2]">
          <div>
            <h2 className="font-heading text-base font-bold text-[#1F2937]">Published &amp; Saved Timetables</h2>
            <p className="text-xs text-[#6B7280]">
              Review all active, draft, and archived timetable versions across college sections.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Filter by Section */}
            <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              <Filter className="w-3.5 h-3.5" />
              <span>Section:</span>
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="input-study h-8 text-xs py-1"
              >
                <option value="all">All Sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Y{s.year}-S{s.semester})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Status */}
            <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              <span>Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-study h-8 text-xs py-1"
              >
                <option value="all">All</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {filteredTimetables.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar className="w-10 h-10 text-[#6B7280] mx-auto mb-2 opacity-40" />
            <h3 className="font-heading text-sm font-bold text-[#1F2937]">No Timetables Found</h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              No schedules match your current filter criteria or none have been created yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-[#E7E0D2]">
            <table className="table-study">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Academic Year</th>
                  <th>Version</th>
                  <th>Slots</th>
                  <th>Attachment</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTimetables.map((tt) => (
                  <tr key={tt.id}>
                    <td>
                      <span className="font-bold text-xs text-[#1F2937]">
                        Section {tt.section.name}
                      </span>
                      <span className="text-[11px] text-[#6B7280] block">
                        Year {tt.section.year}, Semester {tt.section.semester}
                      </span>
                    </td>
                    <td className="text-xs font-mono text-[#6B7280]">{tt.academicYear}</td>
                    <td className="text-xs font-mono text-[#1F2937]">v{tt.version}</td>
                    <td className="text-xs text-[#1F2937] font-semibold">{tt.slots.length} slots</td>
                    <td>
                      {tt.attachmentKey ? (
                        <button
                          onClick={() => handleDownloadAttachment(tt.id)}
                          className="inline-flex items-center gap-1.5 text-xs text-[#0F766E] hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[120px]">{tt.attachmentName || "View File"}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-[#6B7280]">—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          tt.status === "published"
                            ? "badge-ready"
                            : tt.status === "draft"
                            ? "badge-lab"
                            : "badge-archived"
                        }
                      >
                        {tt.status}
                      </span>
                    </td>
                    <td className="text-xs text-[#6B7280] font-mono">
                      {new Date(tt.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleEditExisting(tt)}
                          className="p-1.5 hover:bg-[#CCFBF1] text-[#0F766E] rounded-[8px] transition cursor-pointer"
                          title="Edit Slots"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {tt.status !== "published" && (
                          <button
                            onClick={async () => {
                              const res = await publishTimetableAction(tt.id);
                              if (res.error) setActionMessage({ type: "error", text: res.error });
                              else setActionMessage({ type: "success", text: "Timetable published!" });
                            }}
                            className="p-1.5 hover:bg-emerald-50 text-[#15803D] rounded-[8px] transition cursor-pointer"
                            title="Publish"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {tt.status === "published" && (
                          <button
                            onClick={async () => {
                              const res = await unpublishTimetableAction(tt.id);
                              if (res.error) setActionMessage({ type: "error", text: res.error });
                              else setActionMessage({ type: "success", text: "Timetable moved to draft." });
                            }}
                            className="p-1.5 hover:bg-amber-50 text-[#B45309] rounded-[8px] transition cursor-pointer"
                            title="Unpublish (Move to Draft)"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {tt.status !== "archived" && (
                          <button
                            onClick={async () => {
                              const res = await archiveTimetableAction(tt.id);
                              if (res.error) setActionMessage({ type: "error", text: res.error });
                              else setActionMessage({ type: "success", text: "Timetable archived." });
                            }}
                            className="p-1.5 hover:bg-gray-100 text-[#6B7280] rounded-[8px] transition cursor-pointer"
                            title="Archive"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={async () => {
                            if (confirm("Are you sure you want to delete this timetable version?")) {
                              const res = await deleteTimetableAction(tt.id);
                              if (res.error) setActionMessage({ type: "error", text: res.error });
                              else setActionMessage({ type: "success", text: "Timetable deleted." });
                            }
                          }}
                          className="p-1.5 hover:bg-red-50 text-[#B91C1C] rounded-[8px] transition cursor-pointer"
                          title="Delete Timetable"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slot Modal Editor */}
      {showSlotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-study w-full max-w-lg p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E7E0D2]">
              <h3 className="font-heading text-sm font-bold text-[#1F2937]">
                {editingSlotIndex !== null ? "Edit Timetable Slot" : "Add Timetable Slot"}
              </h3>
              <button
                onClick={() => setShowSlotModal(false)}
                className="text-[#6B7280] hover:text-[#1F2937]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">Day</label>
                  <select
                    value={slotFormData.day}
                    onChange={(e) => setSlotFormData({ ...slotFormData, day: e.target.value as DayOfWeek })}
                    className="input-study w-full text-xs"
                  >
                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">Session Type</label>
                  <select
                    value={slotFormData.sessionType}
                    onChange={(e) =>
                      setSlotFormData({ ...slotFormData, sessionType: e.target.value as "theory" | "lab" })
                    }
                    className="input-study w-full text-xs"
                  >
                    <option value="theory">Theory (Indigo)</option>
                    <option value="lab">Lab (Amber)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">Start Time</label>
                  <input
                    type="text"
                    value={slotFormData.startTime}
                    onChange={(e) => setSlotFormData({ ...slotFormData, startTime: e.target.value })}
                    placeholder="09:00 AM"
                    className="input-study w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">End Time</label>
                  <input
                    type="text"
                    value={slotFormData.endTime}
                    onChange={(e) => setSlotFormData({ ...slotFormData, endTime: e.target.value })}
                    placeholder="10:00 AM"
                    className="input-study w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">Subject Code</label>
                <input
                  type="text"
                  value={slotFormData.subjectCode}
                  onChange={(e) => setSlotFormData({ ...slotFormData, subjectCode: e.target.value })}
                  placeholder="e.g. CS501"
                  className="input-study w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">Subject Name</label>
                <input
                  type="text"
                  value={slotFormData.subjectName}
                  onChange={(e) => setSlotFormData({ ...slotFormData, subjectName: e.target.value })}
                  placeholder="e.g. Operating Systems"
                  className="input-study w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">Faculty Name</label>
                  <input
                    type="text"
                    value={slotFormData.facultyName || ""}
                    onChange={(e) => setSlotFormData({ ...slotFormData, facultyName: e.target.value })}
                    placeholder="e.g. Dr. A. Sharma"
                    className="input-study w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">Room Number</label>
                  <input
                    type="text"
                    value={slotFormData.roomNumber || ""}
                    onChange={(e) => setSlotFormData({ ...slotFormData, roomNumber: e.target.value })}
                    placeholder="e.g. LH-101"
                    className="input-study w-full text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#E7E0D2] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSlotModal(false)}
                className="btn-secondary text-xs h-9 px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!slotFormData.subjectCode || !slotFormData.subjectName) {
                    alert("Please provide both Subject Code and Subject Name.");
                    return;
                  }
                  if (editingSlotIndex !== null) {
                    const updated = [...slots];
                    updated[editingSlotIndex] = { ...slotFormData };
                    setSlots(updated);
                  } else {
                    setSlots([...slots, { ...slotFormData }]);
                  }
                  setShowSlotModal(false);
                }}
                className="btn-primary text-xs h-9 px-4"
              >
                {editingSlotIndex !== null ? "Save Changes" : "Add Slot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
