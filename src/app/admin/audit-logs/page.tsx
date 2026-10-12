import { requireRole } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";
import { AuditLogsManager } from "@/components/admin/AuditLogsManager";
import { getAuditLogsQuery } from "@/lib/audit/query";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    action?: string;
    actor?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function AdminAuditLogsPage({ searchParams }: PageProps) {
  await requireRole("super_admin");

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1", 10);
  const action = resolvedParams.action;
  const actorSearch = resolvedParams.actor;
  const startDate = resolvedParams.startDate;
  const endDate = resolvedParams.endDate;

  const result = await getAuditLogsQuery({
    page: isNaN(page) || page < 1 ? 1 : page,
    pageSize: 50,
    action,
    actorSearch,
    startDate,
    endDate,
  });

  return (
    <div className="min-h-screen bg-[#FBF7EF] lg:ml-[248px] pt-20 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-[1200px] mx-auto">
        <AdminNav
          title="Audit Logs"
          description="View immutable chronological record of academic actions, logins, resource modifications, and administrative events."
        />

        <AuditLogsManager
          logs={result.logs}
          totalCount={result.totalCount}
          page={result.page}
          totalPages={result.totalPages}
          distinctActions={result.distinctActions}
          currentAction={action}
          currentActor={actorSearch}
          currentStartDate={startDate}
          currentEndDate={endDate}
        />
      </div>
    </div>
  );
}
