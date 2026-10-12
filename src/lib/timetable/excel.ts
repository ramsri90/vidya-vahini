import * as XLSX from "xlsx";
import { DayOfWeek, ParsedSlot, ParseResult, ValidationErrorItem, ValidationWarningItem } from "./types";

const VALID_DAYS: Record<string, DayOfWeek> = {
  monday: "Monday",
  mon: "Monday",
  tuesday: "Tuesday",
  tue: "Tuesday",
  tues: "Tuesday",
  wednesday: "Wednesday",
  wed: "Wednesday",
  thursday: "Thursday",
  thu: "Thursday",
  thur: "Thursday",
  thurs: "Thursday",
  friday: "Friday",
  fri: "Friday",
  saturday: "Saturday",
  sat: "Saturday",
  sunday: "Sunday",
  sun: "Sunday",
};

// Normalize Excel time value (could be string "09:00 AM", "09:00", or Excel fraction like 0.375)
export function normalizeTime(val: unknown): { formatted: string; minutes: number } | null {
  if (val === undefined || val === null || val === "") return null;

  // If number (Excel fractional day)
  if (typeof val === "number") {
    const totalMinutes = Math.round(val * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    const period = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    const formatted = `${String(h12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${period}`;
    return { formatted, minutes: hours * 60 + mins };
  }

  const str = String(val).trim();

  // Match "HH:MM AM/PM" or "H:MM AM/PM"
  const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/i);
  if (match12) {
    const hours = parseInt(match12[1], 10);
    const mins = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();

    if (hours < 1 || hours > 12 || mins < 0 || mins > 59) return null;
    let total24 = hours % 12;
    if (period === "PM") total24 += 12;
    const minutes = total24 * 60 + mins;
    const formatted = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${period}`;
    return { formatted, minutes };
  }

  // Match 24h format "HH:MM" or "H:MM"
  const match24 = str.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const mins = parseInt(match24[2], 10);
    if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return null;
    const period = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    const formatted = `${String(h12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${period}`;
    return { formatted, minutes: hours * 60 + mins };
  }

  return null;
}

export function parseExcelBuffer(buffer: Buffer | ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      slots: [],
      errors: [{ row: 0, field: "File", message: "Excel workbook is empty. No sheets found." }],
      warnings: [],
      totalRows: 0,
      validRows: 0,
    };
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });

  if (rawData.length === 0) {
    return {
      slots: [],
      errors: [{ row: 0, field: "File", message: "No data rows found in worksheet." }],
      warnings: [],
      totalRows: 0,
      validRows: 0,
    };
  }

  const slots: ParsedSlot[] = [];
  const errors: ValidationErrorItem[] = [];
  const warnings: ValidationWarningItem[] = [];

  // Helper to find case-insensitive keys
  const getKey = (row: Record<string, unknown>, ...aliases: string[]): unknown => {
    for (const key of Object.keys(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/[\s_-]+/g, "");
      for (const alias of aliases) {
        if (cleanKey === alias.toLowerCase().replace(/[\s_-]+/g, "")) {
          return row[key];
        }
      }
    }
    return undefined;
  };

  const timeIntervals: Array<{
    row: number;
    day: DayOfWeek;
    startMin: number;
    endMin: number;
    room?: string;
    faculty?: string;
    type: "theory" | "lab";
  }> = [];

  rawData.forEach((row, index) => {
    const rowNum = index + 2; // Row 1 is header

    // 1. Day validation
    const rawDay = String(getKey(row, "day", "dayofweek", "weekday") ?? "").trim().toLowerCase();
    const normalizedDay = VALID_DAYS[rawDay];
    if (!normalizedDay) {
      errors.push({
        row: rowNum,
        field: "Day",
        message: `Invalid or missing Day "${rawDay}". Allowed: Monday to Saturday.`,
        value: rawDay,
      });
      return;
    }

    // 2. Start and End Time validation
    const rawStart = getKey(row, "starttime", "start_time", "start", "from");
    const rawEnd = getKey(row, "endtime", "end_time", "end", "to");

    const parsedStart = normalizeTime(rawStart);
    if (!parsedStart) {
      errors.push({
        row: rowNum,
        field: "Start Time",
        message: `Invalid Start Time "${String(rawStart)}". Format like "09:00 AM" or "09:00".`,
        value: rawStart,
      });
      return;
    }

    const parsedEnd = normalizeTime(rawEnd);
    if (!parsedEnd) {
      errors.push({
        row: rowNum,
        field: "End Time",
        message: `Invalid End Time "${String(rawEnd)}". Format like "10:00 AM" or "10:00".`,
        value: rawEnd,
      });
      return;
    }

    if (parsedEnd.minutes <= parsedStart.minutes) {
      errors.push({
        row: rowNum,
        field: "Time Range",
        message: `End time (${parsedEnd.formatted}) must be after start time (${parsedStart.formatted}).`,
        value: `${parsedStart.formatted} - ${parsedEnd.formatted}`,
      });
      return;
    }

    // 3. Subject Code & Name
    const rawSubjectCode = String(getKey(row, "subjectcode", "code", "subcode") ?? "").trim();
    if (!rawSubjectCode) {
      errors.push({
        row: rowNum,
        field: "Subject Code",
        message: "Subject Code is required.",
      });
      return;
    }

    const rawSubjectName = String(getKey(row, "subjectname", "subject", "name") ?? "").trim();
    if (!rawSubjectName) {
      errors.push({
        row: rowNum,
        field: "Subject Name",
        message: "Subject Name is required.",
      });
      return;
    }

    // 4. Session Type (Theory vs Lab)
    const rawType = String(getKey(row, "sessiontype", "type", "componenttype") ?? "")
      .trim()
      .toLowerCase();
    const sessionType: "theory" | "lab" = rawType.includes("lab") ? "lab" : "theory";

    // 5. Optional metadata
    const faculty = String(getKey(row, "faculty", "facultyname", "teacher", "instructor") ?? "").trim() || undefined;
    const room = String(getKey(row, "roomnumber", "room", "roomno", "classroom", "hall") ?? "").trim() || undefined;
    const sectionName = String(getKey(row, "section", "sectionname", "sec") ?? "").trim() || undefined;

    // 6. Overlap detection
    const overlap = timeIntervals.find(
      (ti) =>
        ti.day === normalizedDay &&
        ((parsedStart.minutes >= ti.startMin && parsedStart.minutes < ti.endMin) ||
          (parsedEnd.minutes > ti.startMin && parsedEnd.minutes <= ti.endMin) ||
          (parsedStart.minutes <= ti.startMin && parsedEnd.minutes >= ti.endMin))
    );

    if (overlap) {
      if (sessionType === "lab" && overlap.type === "lab") {
        warnings.push({
          row: rowNum,
          message: `Notice: Parallel Lab block with row ${overlap.row} on ${normalizedDay} (${parsedStart.formatted} - ${parsedEnd.formatted}).`,
        });
      } else {
        warnings.push({
          row: rowNum,
          message: `Possible time conflict with row ${overlap.row} on ${normalizedDay} (${parsedStart.formatted} - ${parsedEnd.formatted}). Verify room/batch.`,
        });
      }
    }

    timeIntervals.push({
      row: rowNum,
      day: normalizedDay,
      startMin: parsedStart.minutes,
      endMin: parsedEnd.minutes,
      room,
      faculty,
      type: sessionType,
    });

    slots.push({
      day: normalizedDay,
      startTime: parsedStart.formatted,
      endTime: parsedEnd.formatted,
      subjectCode: rawSubjectCode.toUpperCase(),
      subjectName: rawSubjectName,
      facultyName: faculty,
      roomNumber: room,
      sessionType,
      sectionName,
      sortOrder: parsedStart.minutes,
    });
  });

  return {
    slots,
    errors,
    warnings,
    totalRows: rawData.length,
    validRows: slots.length,
  };
}

export function generateTemplateBuffer(): Buffer {
  const templateData = [
    {
      Day: "Monday",
      "Start Time": "09:00 AM",
      "End Time": "10:00 AM",
      "Subject Code": "CS501",
      "Subject Name": "Operating Systems",
      Faculty: "Dr. Arvind Sharma",
      "Room Number": "LH-101",
      "Session Type": "Theory",
      Section: "A",
    },
    {
      Day: "Monday",
      "Start Time": "10:00 AM",
      "End Time": "11:00 AM",
      "Subject Code": "CS502",
      "Subject Name": "Database Management Systems",
      Faculty: "Prof. Sunita Rao",
      "Room Number": "LH-101",
      "Session Type": "Theory",
      Section: "A",
    },
    {
      Day: "Monday",
      "Start Time": "11:15 AM",
      "End Time": "01:15 PM",
      "Subject Code": "CS505",
      "Subject Name": "DBMS & OS Laboratory",
      Faculty: "Dr. Arvind Sharma & Lab Assistants",
      "Room Number": "Computing Lab 2",
      "Session Type": "Lab",
      Section: "A",
    },
    {
      Day: "Tuesday",
      "Start Time": "09:00 AM",
      "End Time": "10:00 AM",
      "Subject Code": "CS503",
      "Subject Name": "Computer Networks",
      Faculty: "Dr. Ramesh Verma",
      "Room Number": "LH-101",
      "Session Type": "Theory",
      Section: "A",
    },
    {
      Day: "Tuesday",
      "Start Time": "10:00 AM",
      "End Time": "11:00 AM",
      "Subject Code": "CS504",
      "Subject Name": "Theory of Computation",
      Faculty: "Dr. K. N. Murthy",
      "Room Number": "LH-101",
      "Session Type": "Theory",
      Section: "A",
    },
    {
      Day: "Wednesday",
      "Start Time": "09:00 AM",
      "End Time": "10:00 AM",
      "Subject Code": "CS501",
      "Subject Name": "Operating Systems",
      Faculty: "Dr. Arvind Sharma",
      "Room Number": "LH-101",
      "Session Type": "Theory",
      Section: "A",
    },
    {
      Day: "Thursday",
      "Start Time": "09:00 AM",
      "End Time": "10:00 AM",
      "Subject Code": "CS502",
      "Subject Name": "Database Management Systems",
      Faculty: "Prof. Sunita Rao",
      "Room Number": "LH-101",
      "Session Type": "Theory",
      Section: "A",
    },
    {
      Day: "Friday",
      "Start Time": "09:00 AM",
      "End Time": "10:00 AM",
      "Subject Code": "CS503",
      "Subject Name": "Computer Networks",
      Faculty: "Dr. Ramesh Verma",
      "Room Number": "LH-101",
      "Session Type": "Theory",
      Section: "A",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  // Auto-width columns
  ws["!cols"] = [
    { wch: 12 }, // Day
    { wch: 14 }, // Start Time
    { wch: 14 }, // End Time
    { wch: 16 }, // Subject Code
    { wch: 30 }, // Subject Name
    { wch: 25 }, // Faculty
    { wch: 16 }, // Room Number
    { wch: 14 }, // Session Type
    { wch: 10 }, // Section
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Class Timetable Template");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
