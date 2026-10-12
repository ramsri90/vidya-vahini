"use client";

import * as React from "react";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  FileText,
  CalendarDays,
} from "lucide-react";
import { getTimetableDownloadUrlAction } from "@/lib/timetable/actions";

interface SlotItem {
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
}

interface StudentTimetableProps {
  sectionName: string;
  year: number;
  semester: number;
  timetable: {
    id: string;
    academicYear: string;
    department: string | null;
    version: number;
    effectiveFrom: Date | null;
    effectiveTill: Date | null;
    attachmentKey: string | null;
    attachmentName: string | null;
    slots: SlotItem[];
  } | null;
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function StudentTimetable({ sectionName, year, semester, timetable }: StudentTimetableProps) {
  const [viewMode, setViewMode] = React.useState<"today" | "week">("today");
  const [selectedDayFilter, setSelectedDayFilter] = React.useState<string>("all");
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  // Determine current day of week (e.g. "Monday")
  const todayName = React.useMemo(() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const current = days[new Date().getDay()];
    return current === "Sunday" ? "Monday" : current;
  }, []);

  const handleDownloadAttachment = async () => {
    if (!timetable) return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const res = await getTimetableDownloadUrlAction(timetable.id);
      if (res.error) {
        setDownloadError(res.error);
      } else if (res.data?.url) {
        window.open(res.data.url, "_blank");
      }
    } catch {
      setDownloadError("Failed to open official attachment.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!timetable || timetable.slots.length === 0) {
    return (
      <div className="card-study p-12 text-center max-w-xl mx-auto my-12">
        <div className="w-14 h-14 rounded-2xl bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-7 h-7" />
        </div>
        <h2 className="font-heading text-lg font-bold text-[#1F2937]">No Timetable Published Yet</h2>
        <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
          The official academic schedule for <strong className="text-[#1F2937]">Section {sectionName}</strong> (Year {year}, Semester {semester}) has not been published by the administration.
        </p>
        <p className="text-[11px] text-[#6B7280] mt-4">
          Please check back later or consult your department coordinator for details.
        </p>
      </div>
    );
  }

  // Filter slots
  const displayedDays =
    viewMode === "today"
      ? [todayName]
      : selectedDayFilter === "all"
      ? DAYS_OF_WEEK
      : [selectedDayFilter];

  return (
    <div className="space-y-6">
      {/* Top Banner & Info Card */}
      <div className="card-study p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0F766E]">
              <CalendarDays className="w-4 h-4" />
              <span>Section Schedule &bull; {timetable.academicYear}</span>
            </div>
            <h1 className="font-heading text-2xl font-bold text-[#1F2937] mt-1">
              Class Timetable &mdash; Section {sectionName}
            </h1>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Year {year}, Semester {semester} &bull; {timetable.department || "Academic Coursework"} (v{timetable.version})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Today vs Full Week Toggle */}
            <div className="inline-flex rounded-[10px] border border-[#E7E0D2] bg-[#FDFBF6] p-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("today")}
                className={`px-3 py-1.5 rounded-[8px] font-semibold transition ${
                  viewMode === "today"
                    ? "bg-[#0F766E] text-white shadow-xs"
                    : "text-[#6B7280] hover:text-[#1F2937]"
                }`}
              >
                Today ({todayName})
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`px-3 py-1.5 rounded-[8px] font-semibold transition ${
                  viewMode === "week"
                    ? "bg-[#0F766E] text-white shadow-xs"
                    : "text-[#6B7280] hover:text-[#1F2937]"
                }`}
              >
                Full Week
              </button>
            </div>

            {/* Official Attachment Button */}
            {timetable.attachmentKey && (
              <button
                type="button"
                onClick={handleDownloadAttachment}
                disabled={isDownloading}
                className="btn-secondary text-xs h-10 px-4 inline-flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-[#0F766E]" />
                <span>{isDownloading ? "Opening..." : "View Official Timetable PDF"}</span>
              </button>
            )}
          </div>
        </div>

        {downloadError && (
          <p className="text-xs text-[#B91C1C] mt-3 font-semibold">{downloadError}</p>
        )}
      </div>

      {/* Week Day Filter (When Full Week view is active) */}
      {viewMode === "week" && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[#6B7280] font-semibold shrink-0">Filter Day:</span>
          <button
            onClick={() => setSelectedDayFilter("all")}
            className={`px-3 py-1.5 rounded-full font-medium transition shrink-0 ${
              selectedDayFilter === "all"
                ? "bg-[#0F766E] text-white"
                : "bg-white border border-[#E7E0D2] text-[#6B7280] hover:bg-[#CCFBF1]/50 hover:text-[#0F766E]"
            }`}
          >
            All Days
          </button>
          {DAYS_OF_WEEK.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDayFilter(d)}
              className={`px-3 py-1.5 rounded-full font-medium transition shrink-0 ${
                selectedDayFilter === d
                  ? "bg-[#0F766E] text-white"
                  : "bg-white border border-[#E7E0D2] text-[#6B7280] hover:bg-[#CCFBF1]/50 hover:text-[#0F766E]"
              }`}
            >
              {d} {d === todayName ? "(Today)" : ""}
            </button>
          ))}
        </div>
      )}

      {/* Grid or Cards Layout */}
      <div className="space-y-6">
        {displayedDays.map((day) => {
          const daySlots = timetable.slots.filter((s) => s.day === day);
          const isToday = day === todayName;

          return (
            <div key={day} className="card-study p-6">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E7E0D2]">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-heading text-base font-bold text-[#1F2937]">{day}</h2>
                  {isToday && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#CCFBF1] text-[#0F766E] px-2 py-0.5 rounded-full border border-[#0F766E]/20">
                      Today
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-[#6B7280]">
                  {daySlots.length} Session{daySlots.length === 1 ? "" : "s"}
                </span>
              </div>

              {daySlots.length === 0 ? (
                <div className="py-8 text-center text-[#6B7280]">
                  <p className="text-xs">No classes scheduled for {day}.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {daySlots.map((slot) => {
                    const isTheory = slot.sessionType === "theory";

                    return (
                      <div
                        key={slot.id}
                        className={`rounded-[12px] p-4.5 border transition-all ${
                          isTheory
                            ? "bg-white border-[#C7D2FE]/70 hover:border-[#4F46E5] shadow-xs"
                            : "bg-white border-[#FDE68A]/80 hover:border-[#D97706] shadow-xs"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`font-mono text-xs font-bold ${
                              isTheory ? "text-[#4F46E5]" : "text-[#D97706]"
                            }`}
                          >
                            {slot.subjectCode}
                          </span>
                          <span className={isTheory ? "badge-theory" : "badge-lab"}>
                            {slot.sessionType}
                          </span>
                        </div>

                        <h3 className="font-heading text-sm font-bold text-[#1F2937] line-clamp-2 mb-3">
                          {slot.subjectName}
                        </h3>

                        <div className="space-y-1.5 text-xs text-[#6B7280]">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 shrink-0 text-[#0F766E]" />
                            <span className="font-mono text-[11px] font-semibold text-[#1F2937]">
                              {slot.startTime} &ndash; {slot.endTime}
                            </span>
                          </div>

                          {slot.roomNumber && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 shrink-0 text-[#6B7280]" />
                              <span>{slot.roomNumber}</span>
                            </div>
                          )}

                          {slot.facultyName && (
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 shrink-0 text-[#6B7280]" />
                              <span className="truncate">{slot.facultyName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
