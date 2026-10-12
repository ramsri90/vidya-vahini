import Image from "next/image";

export default function FacultyLoading() {
  return (
    <div className="min-h-screen bg-[#FBF7EF] p-6 sm:p-10">
      <div className="mx-auto max-w-6xl">
        {/* Header Skeleton */}
        <header className="bg-white rounded-[14px] border border-[#E7E0D2] shadow-[0_1px_2px_rgba(0,0,0,0.04)] px-6 py-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FBF7EF] border border-[#E7E0D2] flex items-center justify-center p-1 shadow-xs shrink-0 overflow-hidden">
                <Image
                  src="/black_sketch_logo_exact.svg"
                  alt="Vidya Vahini Logo"
                  width={36}
                  height={36}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold text-base text-[#1F2937]">Vidya Vahini</span>
                  <span className="text-xs bg-[#EEF2FF] text-[#4F46E5] font-semibold px-2 py-0.5 rounded-full border border-[#C7D2FE]">
                    Faculty
                  </span>
                </div>
                <div className="h-3 w-40 bg-[#E7E0D2]/50 rounded mt-1 animate-pulse" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="h-8 w-28 bg-[#E7E0D2]/40 rounded-[10px] animate-pulse" />
              <div className="h-8 w-20 bg-[#E7E0D2]/40 rounded-[10px] animate-pulse" />
            </div>
          </div>
        </header>

        {/* Title Skeleton */}
        <div className="mb-6 flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-7 w-56 bg-[#E7E0D2]/70 rounded-[8px] animate-pulse" />
            <div className="h-3.5 w-80 bg-[#E7E0D2]/40 rounded animate-pulse" />
          </div>
          <div className="h-6 w-24 bg-[#CCFBF1] rounded-full animate-pulse" />
        </div>

        {/* Components Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-study p-6 flex flex-col justify-between min-h-[200px]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-6 w-20 bg-[#EEF2FF] rounded-full animate-pulse" />
                  <div className="h-4 w-16 bg-[#E7E0D2]/50 rounded animate-pulse" />
                </div>
                <div className="h-5 w-44 bg-[#E7E0D2]/70 rounded-[6px] animate-pulse mb-2" />
                <div className="h-4 w-32 bg-[#E7E0D2]/40 rounded animate-pulse" />
              </div>
              <div className="pt-4 border-t border-[#E7E0D2] flex justify-between items-center">
                <div className="h-4 w-28 bg-[#E7E0D2]/40 rounded animate-pulse" />
                <div className="h-8 w-28 bg-[#0F766E]/20 rounded-[8px] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
