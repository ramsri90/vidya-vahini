import { prisma } from "@/lib/prisma";
import { sanitizeMetadata } from "@/lib/audit";
import { Prisma } from "@prisma/client";

export interface GetAuditLogsParams {
  page?: number;
  pageSize?: number;
  action?: string;
  actorSearch?: string;
  startDate?: string;
  endDate?: string;
}

export interface SerializedAuditLog {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Prisma.InputJsonValue | null;
  createdAt: string;
}

export interface AuditLogsResult {
  logs: SerializedAuditLog[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  distinctActions: string[];
}

export async function getAuditLogsQuery({
  page = 1,
  pageSize = 50,
  action,
  actorSearch,
  startDate,
  endDate,
}: GetAuditLogsParams): Promise<AuditLogsResult> {
  const where: Prisma.AuditLogWhereInput = {};

  if (action && action !== "all") {
    where.action = action;
  }

  if (actorSearch && actorSearch.trim() !== "") {
    where.actor = {
      OR: [
        { email: { contains: actorSearch.trim(), mode: "insensitive" } },
        { name: { contains: actorSearch.trim(), mode: "insensitive" } },
      ],
    };
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      // Set to end of day if only YYYY-MM-DD provided
      const end = new Date(endDate);
      if (endDate.length === 10) {
        end.setHours(23, 59, 59, 999);
      }
      where.createdAt.lte = end;
    }
  }

  const [totalCount, rows, distinctRows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.findMany({
      select: { action: true },
      distinct: ["action"],
      orderBy: { action: "asc" },
    }),
  ]);

  const distinctActions = distinctRows.map((r) => r.action);

  const logs: SerializedAuditLog[] = rows.map((log) => ({
    id: log.id,
    actorId: log.actorId,
    actorName: log.actor?.name ?? null,
    actorEmail: log.actor?.email ?? null,
    actorRole: log.actor?.role ?? null,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    metadata: sanitizeMetadata(log.metadata as Record<string, unknown> | null) ?? null,
    createdAt: log.createdAt.toISOString(),
  }));

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    logs,
    totalCount,
    page,
    pageSize,
    totalPages,
    distinctActions,
  };
}
