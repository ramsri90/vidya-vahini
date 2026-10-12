import Image from "next/image";

export default function StudentLoading() {
  return (
    <div className="min-h-screen bg-[#FBF7EF]">
      {/* Header Skeleton */}
      <header className="bg-white border-b border-[#E7E0D2] sticky top-0 z-40 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3">
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
                <div className="font-heading font-bold text-base text-[#1F2937]">Vidya Vahini</div>
                <div className="text-[10px] text-[#6B7280]">A Class PDF Platform</div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="h-8 w-24 bg-[#E7E0D2]/50 rounded-[8px] animate-pulse hidden sm:block" />
              <div className="w-8 h-8 rounded-full bg-[#CCFBF1] animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        {/* Welcome Banner Skeleton */}
        <div className="mb-8 space-y-2">
          <div className="h-7 w-64 bg-[#E7E0D2]/70 rounded-[8px] animate-pulse" />
          <div className="h-4 w-96 bg-[#E7E0D2]/40 rounded-[6px] animate-pulse" />
        </div>

        {/* 4 Stat Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-study p-5">
              <div className="w-10 h-10 rounded-[10px] bg-[#E7E0D2]/50 animate-pulse mb-3" />
              <div className="h-7 w-12 bg-[#E7E0D2]/70 rounded-[6px] animate-pulse" />
              <div className="h-3 w-28 bg-[#E7E0D2]/40 rounded-[4px] mt-2 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Subject Grid Skeleton */}
        <div className="space-y-4">
          <div className="h-5 w-36 bg-[#E7E0D2]/60 rounded-[6px] animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card-study p-6 flex flex-col justify-between min-h-[190px]">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-6 w-16 bg-[#CCFBF1] rounded-full animate-pulse" />
                    <div className="h-4 w-20 bg-[#E7E0D2]/40 rounded animate-pulse" />
                  </div>
                  <div className="h-5 w-48 bg-[#E7E0D2]/70 rounded-[6px] animate-pulse mb-2" />
                  <div className="h-4 w-32 bg-[#E7E0D2]/40 rounded-[4px] animate-pulse" />
                </div>
                <div className="pt-4 border-t border-[#E7E0D2] flex justify-between items-center">
                  <div className="h-3 w-28 bg-[#E7E0D2]/40 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-[#E7E0D2]/40 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
