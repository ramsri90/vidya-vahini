import Link from "next/link";
import { HelpCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#FBF7EF] flex items-center justify-center p-6">
      <div className="bg-white rounded-[16px] border border-[#E7E0D2] shadow-sm max-w-md w-full p-8 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center mx-auto border border-[#0F766E]/20">
          <HelpCircle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="font-heading font-bold text-xl text-[#1F2937]">
            Page Not Found (404)
          </h1>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            The requested page does not exist, or you may not have authorization to view it.
          </p>
        </div>

        <div className="pt-2">
          <Button
            asChild
            className="h-10 px-6 bg-[#0F766E] hover:bg-[#0F766E]/90 text-white font-semibold text-xs"
          >
            <Link href="/">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Return to Portal Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
