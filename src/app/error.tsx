"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to internal telemetry if available, but never display stack trace to user
    console.error("Application error captured:", error.message);
  }, [error]);

  const isProduction = process.env.NODE_ENV === "production";

  return (
    <div className="min-h-screen bg-[#FBF7EF] flex items-center justify-center p-6">
      <div className="bg-white rounded-[16px] border border-[#E7E0D2] shadow-sm max-w-md w-full p-8 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="font-heading font-bold text-xl text-[#1F2937]">
            Something Went Wrong
          </h1>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            An unexpected error occurred while processing your request. Please try again or return
            to your dashboard.
          </p>

          {/* Strict guard: Never show stack trace in production */}
          {!isProduction && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-left text-xs font-mono text-gray-700 overflow-x-auto border border-gray-200">
              <p className="font-semibold text-red-600 mb-1">Development Trace:</p>
              <p className="whitespace-pre-wrap">{error.message}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            onClick={() => reset()}
            className="w-full sm:w-auto h-10 px-5 bg-[#0F766E] hover:bg-[#0F766E]/90 text-white font-semibold text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Try Again
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto h-10 px-5 border-[#E7E0D2] text-[#4B5563] text-xs"
          >
            <Link href="/">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Return Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
