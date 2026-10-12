"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  GraduationCap,
  Users,
  UserCheck,
  HardDrive,
  ShieldAlert,
  FileText,
  RotateCcw,
  LogOut,
  Menu,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

interface AdminNavProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  groupName: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupName: "Overview",
    items: [
      {
        label: "Overview",
        href: "/admin",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    groupName: "Setup",
    items: [
      {
        label: "Sections",
        href: "/admin/sections",
        icon: Layers,
      },
      {
        label: "Subjects",
        href: "/admin/subjects",
        icon: GraduationCap,
      },
      {
        label: "Section Subjects",
        href: "/admin/class-subjects",
        icon: BookOpen,
      },
    ],
  },
  {
    groupName: "People",
    items: [
      {
        label: "Faculty",
        href: "/admin/faculty",
        icon: Users,
      },
      {
        label: "Students",
        href: "/admin/students",
        icon: UserCheck,
      },
    ],
  },
  {
    groupName: "Monitoring",
    items: [
      {
        label: "Storage",
        href: "/admin/storage",
        icon: HardDrive,
      },
      {
        label: "Audit Logs",
        href: "/admin/audit-logs",
        icon: ShieldAlert,
      },
      {
        label: "Moderation",
        href: "/admin/resources",
        icon: FileText,
      },
      {
        label: "Rollover",
        href: "/admin/rollover",
        icon: RotateCcw,
      },
    ],
  },
];

export function AdminNav({
  title = "Admin Portal",
  description = "Manage academic hierarchy, faculty assignments, and student onboarding.",
  action,
}: AdminNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Close sheet on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isItemActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Reusable nav group list for desktop sidebar and mobile sheet
  const renderNavList = (onNavigate?: () => void) => (
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.groupName}>
          <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-[#6B7280] uppercase">
            {group.groupName}
          </div>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = isItemActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3 h-10 rounded-[10px] text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#0F766E] text-white"
                      : "text-[#6B7280] hover:bg-[#CCFBF1] hover:text-[#0F766E]"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-[#6B7280]"}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const renderLogout = () => (
    <div className="p-3 border-t border-[#E7E0D2]">
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center gap-3 px-3 h-10 rounded-[10px] text-sm font-medium text-[#6B7280] hover:text-[#B91C1C] hover:bg-red-50 transition-colors w-full cursor-pointer"
      >
        <LogOut className="w-4 h-4 shrink-0" />
        <span>Logout</span>
      </button>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Left Sidebar (1024px and up) */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 w-[248px] bg-[#FBF7EF] border-r border-[#E7E0D2] z-40 flex-col"
        aria-label="Admin Navigation Sidebar"
      >
        {/* Top Logo & Title with Admin badge */}
        <div className="h-16 px-4 border-b border-[#E7E0D2] flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white border border-[#E7E0D2] flex items-center justify-center p-0.5 shadow-xs shrink-0 overflow-hidden">
            <Image
              src="/black_sketch_logo_exact.svg"
              alt="Vidya Vahini Logo"
              width={32}
              height={32}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <span className="font-heading font-bold text-base text-[#1F2937] whitespace-nowrap">
              Vidya Vahini
            </span>
            <span className="text-[10px] bg-[#CCFBF1] text-[#0F766E] font-semibold px-1.5 py-0.5 rounded-full border border-[#0F766E]/20 shrink-0">
              Admin
            </span>
          </div>
        </div>

        {/* Groups */}
        {renderNavList()}

        {/* Bottom Logout */}
        {renderLogout()}
      </aside>

      {/* 2. Mobile Top Bar (Below 1024px) */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-16 bg-[#FBF7EF] border-b border-[#E7E0D2] z-30 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-[#E7E0D2] flex items-center justify-center p-0.5 shadow-xs shrink-0 overflow-hidden">
            <Image
              src="/black_sketch_logo_exact.svg"
              alt="Vidya Vahini Logo"
              width={32}
              height={32}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-base text-[#1F2937]">
              Vidya Vahini
            </span>
            <span className="text-[10px] bg-[#CCFBF1] text-[#0F766E] font-semibold px-1.5 py-0.5 rounded-full border border-[#0F766E]/20">
              Admin
            </span>
          </div>
        </div>

        {/* Mobile Sheet Trigger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open Navigation Menu"
              className="p-2 rounded-lg text-[#1F2937] hover:bg-[#CCFBF1]/50 transition-colors cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[280px] p-0 bg-[#FBF7EF] border-r border-[#E7E0D2] flex flex-col"
          >
            <div className="h-16 px-5 border-b border-[#E7E0D2] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-[#E7E0D2] flex items-center justify-center p-0.5 shadow-xs shrink-0 overflow-hidden">
                <Image
                  src="/black_sketch_logo_exact.svg"
                  alt="Vidya Vahini Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                />
              </div>
              <SheetTitle className="font-heading font-bold text-base text-[#1F2937] flex items-center gap-2 m-0 text-left">
                <span>Vidya Vahini</span>
                <span className="text-[10px] bg-[#CCFBF1] text-[#0F766E] font-semibold px-2 py-0.5 rounded-full border border-[#0F766E]/20">
                  Admin
                </span>
              </SheetTitle>
            </div>

            {renderNavList(() => setMobileOpen(false))}
            {renderLogout()}
          </SheetContent>
        </Sheet>
      </header>

      {/* Page Header (Title + Plain One-line English Description + Action Button) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-[#E7E0D2]/50">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1F2937] tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">{description}</p>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </>
  );
}
