import { prisma } from "@/lib/prisma";

export interface StorageDashboardStats {
  totalBytes: number;
  totalFiles: number;
  last30DaysBytes: number;
  last30DaysCount: number;
  sectionBreakdown: {
    sectionId: string;
    sectionName: string;
    year: number;
    semester: number;
    isArchived: boolean;
    fileCount: number;
    totalBytes: number;
  }[];
  subjectBreakdown: {
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    year: number;
    semester: number;
    fileCount: number;
    totalBytes: number;
  }[];
}

export async function getStorageDashboardStats(): Promise<StorageDashboardStats> {
  // 1. Total storage: SUM(file_size_bytes) where status = 'ready' and archived = false
  const totalResult = await prisma.$queryRaw<
    { total_bytes: bigint | null; file_count: bigint }[]
  >`
    SELECT
      COALESCE(SUM(file_size_bytes), 0) AS total_bytes,
      COUNT(id) AS file_count
    FROM resources
    WHERE status = 'ready'::resource_status AND archived = false;
  `;

  const totalBytes = Number(totalResult[0]?.total_bytes ?? BigInt(0));
  const totalFiles = Number(totalResult[0]?.file_count ?? BigInt(0));

  // 2. Uploaded in last 30 days
  const recentResult = await prisma.$queryRaw<
    { last_30_bytes: bigint | null; last_30_count: bigint }[]
  >`
    SELECT
      COALESCE(SUM(file_size_bytes), 0) AS last_30_bytes,
      COUNT(id) AS last_30_count
    FROM resources
    WHERE status = 'ready'::resource_status
      AND archived = false
      AND created_at >= (NOW() - INTERVAL '30 days');
  `;

  const last30DaysBytes = Number(recentResult[0]?.last_30_bytes ?? BigInt(0));
  const last30DaysCount = Number(recentResult[0]?.last_30_count ?? BigInt(0));

  // 3. Section breakdown
  const sectionResult = await prisma.$queryRaw<
    {
      section_id: string;
      section_name: string;
      year: number;
      semester: number;
      is_archived: boolean;
      file_count: bigint;
      total_bytes: bigint | null;
    }[]
  >`
    SELECT
      s.id AS section_id,
      s.name AS section_name,
      s.year,
      s.semester,
      s.is_archived,
      COUNT(r.id) AS file_count,
      COALESCE(SUM(r.file_size_bytes), 0) AS total_bytes
    FROM sections s
    LEFT JOIN class_subjects cs ON cs.section_id = s.id
    LEFT JOIN components c ON c.class_subject_id = cs.id
    LEFT JOIN resources r ON r.component_id = c.id
      AND r.status = 'ready'::resource_status
      AND r.archived = false
    GROUP BY s.id, s.name, s.year, s.semester, s.is_archived
    ORDER BY s.year ASC, s.semester ASC, s.name ASC;
  `;

  const sectionBreakdown = sectionResult.map((row) => ({
    sectionId: row.section_id,
    sectionName: row.section_name,
    year: row.year,
    semester: row.semester,
    isArchived: row.is_archived,
    fileCount: Number(row.file_count),
    totalBytes: Number(row.total_bytes ?? BigInt(0)),
  }));

  // 4. Subject breakdown
  const subjectResult = await prisma.$queryRaw<
    {
      subject_id: string;
      subject_code: string;
      subject_name: string;
      year: number;
      semester: number;
      file_count: bigint;
      total_bytes: bigint | null;
    }[]
  >`
    SELECT
      sub.id AS subject_id,
      sub.code AS subject_code,
      sub.name AS subject_name,
      sub.year,
      sub.semester,
      COUNT(r.id) AS file_count,
      COALESCE(SUM(r.file_size_bytes), 0) AS total_bytes
    FROM subjects sub
    LEFT JOIN class_subjects cs ON cs.subject_id = sub.id
    LEFT JOIN components c ON c.class_subject_id = cs.id
    LEFT JOIN resources r ON r.component_id = c.id
      AND r.status = 'ready'::resource_status
      AND r.archived = false
    GROUP BY sub.id, sub.code, sub.name, sub.year, sub.semester
    ORDER BY sub.semester ASC, sub.code ASC;
  `;

  const subjectBreakdown = subjectResult.map((row) => ({
    subjectId: row.subject_id,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    year: row.year,
    semester: row.semester,
    fileCount: Number(row.file_count),
    totalBytes: Number(row.total_bytes ?? BigInt(0)),
  }));

  return {
    totalBytes,
    totalFiles,
    last30DaysBytes,
    last30DaysCount,
    sectionBreakdown,
    subjectBreakdown,
  };
}
