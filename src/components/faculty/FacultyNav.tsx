"use client";

import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { LogOut, BookOpen, User } from "lucide-react";

interface FacultyNavProps {
  userName?: string | null;
}

export function FacultyNav({ userName }: FacultyNavProps) {
  return (
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
            <p className="text-xs text-[#6B7280]">
              {userName ? `Welcome, ${userName}` : "Academic Resource Management"}
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-2 text-xs font-semibold">
          <Link
            href="/faculty"
            prefetch={true}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[#6B7280] hover:text-[#0F766E] hover:bg-[#CCFBF1]/50 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>My Components</span>
          </Link>
          <Link
            href="/faculty/profile"
            prefetch={true}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[#6B7280] hover:text-[#0F766E] hover:bg-[#CCFBF1]/50 transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile</span>
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[#B91C1C] hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer ml-1"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
