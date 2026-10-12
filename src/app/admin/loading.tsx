export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-[#FBF7EF] lg:ml-[248px] pt-20 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-[1200px] mx-auto animate-pulse">
        {/* Header Skeleton */}
        <div className="pb-4 mb-6 border-b border-[#E7E0D2]/50">
          <div className="h-8 w-48 bg-[#E7E0D2]/60 rounded-[10px]" />
          <div className="h-4 w-96 bg-[#E7E0D2]/40 rounded-[8px] mt-2" />
        </div>

        {/* Content Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="h-32 rounded-[14px] bg-white border border-[#E7E0D2]/60 p-6 shadow-xs" />
          <div className="h-32 rounded-[14px] bg-white border border-[#E7E0D2]/60 p-6 shadow-xs" />
          <div className="h-32 rounded-[14px] bg-white border border-[#E7E0D2]/60 p-6 shadow-xs" />
        </div>

        {/* Big Table Skeleton */}
        <div className="rounded-[14px] bg-white border border-[#E7E0D2]/60 p-6 shadow-xs space-y-4">
          <div className="h-6 w-56 bg-[#E7E0D2]/50 rounded-[8px]" />
          <div className="space-y-3 pt-2">
            <div className="h-10 bg-[#FDFBF6] rounded-[10px] border border-[#E7E0D2]/30" />
            <div className="h-10 bg-[#FDFBF6] rounded-[10px] border border-[#E7E0D2]/30" />
            <div className="h-10 bg-[#FDFBF6] rounded-[10px] border border-[#E7E0D2]/30" />
            <div className="h-10 bg-[#FDFBF6] rounded-[10px] border border-[#E7E0D2]/30" />
          </div>
        </div>
      </div>
    </div>
  );
}
