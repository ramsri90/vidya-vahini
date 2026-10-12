export default function FacultyLoading() {
  return (
    <div className="min-h-screen bg-[#FBF7EF] p-6 sm:p-10">
      <div className="mx-auto max-w-6xl animate-pulse">
        {/* Nav Skeleton */}
        <div className="h-16 rounded-[14px] bg-white border border-[#E7E0D2]/60 mb-6 shadow-xs" />

        {/* Title Skeleton */}
        <div className="mb-6 space-y-2">
          <div className="h-7 w-60 bg-[#E7E0D2]/60 rounded-[10px]" />
          <div className="h-4 w-96 bg-[#E7E0D2]/40 rounded-[8px]" />
        </div>

        {/* Grid Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="h-48 rounded-[14px] bg-white border border-[#E7E0D2]/60 p-6 shadow-xs" />
          <div className="h-48 rounded-[14px] bg-white border border-[#E7E0D2]/60 p-6 shadow-xs" />
          <div className="h-48 rounded-[14px] bg-white border border-[#E7E0D2]/60 p-6 shadow-xs" />
        </div>
      </div>
    </div>
  );
}
