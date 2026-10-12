export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-[#FBF7EF] lg:ml-[248px] pt-20 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-[1200px] mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8 space-y-2">
          <div className="h-7 w-48 bg-[#E7E0D2]/70 rounded-[8px] animate-pulse" />
          <div className="h-4 w-96 bg-[#E7E0D2]/40 rounded-[6px] animate-pulse" />
        </div>

        {/* Action Buttons Skeleton */}
        <div className="flex gap-3 mb-8">
          <div className="h-10 w-36 bg-[#0F766E]/20 rounded-[10px] animate-pulse" />
          <div className="h-10 w-32 bg-[#E7E0D2]/50 rounded-[10px] animate-pulse" />
        </div>

        {/* Overview Table Skeleton */}
        <div className="card-study p-6">
          <div className="h-6 w-44 bg-[#E7E0D2]/70 rounded-[6px] animate-pulse mb-6" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-[#E7E0D2]/50 last:border-0">
                <div className="space-y-1.5">
                  <div className="h-4 w-40 bg-[#E7E0D2]/60 rounded animate-pulse" />
                  <div className="h-3 w-28 bg-[#E7E0D2]/40 rounded animate-pulse" />
                </div>
                <div className="h-6 w-24 bg-[#E7E0D2]/40 rounded-full animate-pulse" />
                <div className="h-4 w-32 bg-[#E7E0D2]/40 rounded animate-pulse hidden sm:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
