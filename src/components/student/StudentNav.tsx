"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { BookOpen, User, LogOut, Calendar } from "lucide-react";

interface StudentNavProps {
  studentName: string;
  rollNo: string;
}

export function StudentNav({ studentName, rollNo }: StudentNavProps) {
  const pathname = usePathname();

  const navItems = [
    { label: "My Subjects", href: "/student", icon: BookOpen },
    { label: "Class Timetable", href: "/student/timetable", icon: Calendar },
    { label: "Profile", href: "/student/profile", icon: User },
  ];

  const initials = studentName
    ? studentName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "ST";

  return (
    <header className="bg-white border-b border-[#E7E0D2] sticky top-0 z-40 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-6">
            <Link href="/student" className="flex items-center space-x-3">
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
            </Link>

            <nav className="hidden sm:flex space-x-1.5" aria-label="Student Navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[#0F766E] text-white shadow-xs"
                        : "text-[#6B7280] hover:text-[#0F766E] hover:bg-[#CCFBF1]/50"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-[#6B7280]"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#CCFBF1] text-[#0F766E] font-bold text-xs flex items-center justify-center border border-[#0F766E]/20">
                {initials}
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-[#1F2937]">{studentName}</div>
                <div className="text-[11px] text-[#6B7280] font-mono">{rollNo}</div>
              </div>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E7E0D2] text-xs font-semibold rounded-[10px] text-[#B91C1C] bg-white hover:bg-red-50 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar for ultra-fast, smooth navigation */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#E7E0D2] z-50 px-2 py-1.5 flex justify-around items-center shadow-lg"
        aria-label="Mobile Student Navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-[8px] text-[11px] font-semibold transition-colors ${
                isActive
                  ? "text-[#0F766E]"
                  : "text-[#6B7280] hover:text-[#0F766E]"
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? "text-[#0F766E]" : "text-[#6B7280]"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
