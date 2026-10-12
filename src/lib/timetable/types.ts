export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export interface ParsedSlot {
  id?: string;
  day: DayOfWeek;
  startTime: string; // e.g. "09:00 AM" or "09:00"
  endTime: string;   // e.g. "10:00 AM" or "10:00"
  subjectCode: string;
  subjectName: string;
  facultyName?: string;
  roomNumber?: string;
  sessionType: "theory" | "lab";
  sectionName?: string;
  sortOrder?: number;
}

export interface ValidationErrorItem {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationWarningItem {
  row: number;
  message: string;
}

export interface ParseResult {
  slots: ParsedSlot[];
  errors: ValidationErrorItem[];
  warnings: ValidationWarningItem[];
  totalRows: number;
  validRows: number;
}

export interface TimetableDetail {
  id: string;
  sectionId: string;
  sectionName: string;
  year: number;
  semester: number;
  academicYear: string;
  department: string | null;
  effectiveFrom: string | null;
  effectiveTill: string | null;
  status: "draft" | "published" | "archived";
  version: number;
  attachmentKey: string | null;
  attachmentName: string | null;
  slots: ParsedSlot[];
  createdAt: string;
  updatedAt: string;
}
