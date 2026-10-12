import { requireRole } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";
import { StorageDashboard } from "@/components/admin/StorageDashboard";
import { getStorageDashboardStats } from "@/lib/storage/dashboard";

export const dynamic = "force-dynamic";

export default async function AdminStoragePage() {
  await requireRole("super_admin");

  const stats = await getStorageDashboardStats();

  return (
    <div className="min-h-screen bg-[#FBF7EF] lg:ml-[248px] pt-20 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-[1200px] mx-auto">
        <AdminNav
          title="Storage Dashboard"
          description="Monitor active storage footprint, file volume, and usage breakdown across sections and subjects."
        />

        <StorageDashboard stats={stats} />
      </div>
    </div>
  );
}
