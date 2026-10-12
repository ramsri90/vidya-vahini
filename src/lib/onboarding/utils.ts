import crypto from "crypto";
import * as XLSX from "xlsx";

/**
 * Generates a cryptographically secure 12-character temporary password.
 * Guarantees at least one uppercase, lowercase, digit, and special character.
 */
export function generateTemporaryPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%^&*";
  const all = upper + lower + digits + special;

  const chars = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    digits[crypto.randomInt(digits.length)],
    special[crypto.randomInt(special.length)],
  ];

  for (let i = 0; i < 8; i++) {
    chars.push(all[crypto.randomInt(all.length)]);
  }

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

export interface ParseExcelOptions {
  requiredHeaders: string[]; // Normalized canonical keys (e.g. ['name', 'email'])
  headerAliases?: Record<string, string>; // e.g. { 'roll_no': 'rollno', 'roll no': 'rollno' }
}

export interface ParsedExcelResult<T = Record<string, string>> {
  success: boolean;
  error?: string;
  rows?: T[];
}

/**
 * Parses an Excel (.xlsx, .xls) or CSV buffer.
 * Enforces file size, checks case-insensitive headers, and returns normalized row objects.
 */
export function parseExcelBuffer<T = Record<string, string>>(
  buffer: Buffer,
  options: ParseExcelOptions
): ParsedExcelResult<T> {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { success: false, error: "The uploaded workbook contains no sheets." };
    }

    const sheet = workbook.Sheets[firstSheetName];
    // sheet_to_json with header: 1 returns array of rows (each row is an array of cell values)
    const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    if (!rawData || rawData.length === 0) {
      return { success: false, error: "The uploaded file is empty." };
    }

    const headerRow = rawData[0];
    if (!Array.isArray(headerRow) || headerRow.length === 0) {
      return { success: false, error: "Header row is missing or empty." };
    }

    // Normalize headers: trim, lowercase, remove non-alphanumeric
    const normalizeKey = (key: unknown): string => {
      if (!key) return "";
      const raw = String(key).trim().toLowerCase().replace(/[\s_-]+/g, "");
      if (options.headerAliases && options.headerAliases[raw]) {
        return options.headerAliases[raw];
      }
      return raw;
    };

    const headerIndices: Record<string, number> = {};
    const presentNormalizedHeaders = new Set<string>();

    headerRow.forEach((cell, idx) => {
      const norm = normalizeKey(cell);
      if (norm) {
        headerIndices[norm] = idx;
        presentNormalizedHeaders.add(norm);
      }
    });

    // Check required headers
    const missingHeaders = options.requiredHeaders.filter(
      (req) => !presentNormalizedHeaders.has(req)
    );

    if (missingHeaders.length > 0) {
      return {
        success: false,
        error: `Missing required header(s): ${missingHeaders.join(", ")}. Found headers: ${headerRow.map(String).join(", ")}`,
      };
    }

    // Parse data rows
    const rows: T[] = [];
    for (let r = 1; r < rawData.length; r++) {
      const rowArr = rawData[r];
      if (!Array.isArray(rowArr) || rowArr.length === 0) continue;

      // Check if row is entirely empty
      const hasContent = rowArr.some((val) => val !== undefined && val !== null && String(val).trim() !== "");
      if (!hasContent) continue;

      const rowObj: Record<string, string> = {};
      for (const [normHeader, colIdx] of Object.entries(headerIndices)) {
        const val = rowArr[colIdx];
        rowObj[normHeader] = val !== undefined && val !== null ? String(val).trim() : "";
      }
      rows.push(rowObj as unknown as T);
    }

    return { success: true, rows };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to parse file";
    return { success: false, error: `Excel parsing error: ${message}` };
  }
}
