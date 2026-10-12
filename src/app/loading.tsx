import Image from "next/image";

export default function GlobalLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FBF7EF] p-4">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-white border border-[#E7E0D2] flex items-center justify-center p-2 shadow-sm animate-pulse overflow-hidden">
          <Image
            src="/black_sketch_logo_exact.svg"
            alt="Vidya Vahini Logo"
            width={48}
            height={48}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <div className="text-center space-y-1">
          <div className="font-heading text-lg font-bold text-[#1F2937]">Vidya Vahini</div>
          <p className="text-xs text-[#6B7280]">Loading portal content...</p>
        </div>
      </div>
    </div>
  );
}
