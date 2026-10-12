import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { StudentNav } from "@/components/student/StudentNav";
import { redirect } from "next/navigation";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";

export default async function StudentProfilePage() {
  const user = await requireRole("student");

  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    include: {
      user: true,
      section: true,
    },
  });

  if (!student) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#FBF7EF] flex flex-col">
      <StudentNav studentName={student.user.name} rollNo={student.rollNo} />

      <main className="flex-1 max-w-[800px] w-full mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6">
          <Link
            href="/student"
            className="text-xs font-semibold text-[#0F766E] hover:underline inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Subjects</span>
          </Link>
          <h1 className="font-heading text-2xl font-bold text-[#1F2937] mt-2">Student Profile</h1>
          <p className="text-xs text-[#6B7280]">Your registered academic cohort and account credentials</p>
        </div>

        <div className="card-study overflow-hidden">
          <div className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Full Name
                </label>
                <div className="mt-1 text-sm font-semibold text-[#1F2937]">{student.user.name}</div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Roll Number
                </label>
                <div className="mt-1 text-sm font-mono font-bold text-[#1F2937]">{student.rollNo}</div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Email Address
                </label>
                <div className="mt-1 text-sm font-medium text-[#1F2937]">{student.user.email}</div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Section
                </label>
                <div className="mt-1 text-sm font-semibold text-[#1F2937]">
                  {student.section.name} (Year {student.section.year}, Sem {student.section.semester})
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Phone
                </label>
                <div className="mt-1 text-sm text-[#1F2937]">
                  {student.user.phone || <span className="text-[#6B7280] italic">Not provided</span>}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Account Status
                </label>
                <div className="mt-1">
                  <span className={student.user.isActive ? "badge-ready" : "badge-failed"}>
                    {student.user.isActive ? "Active Account" : "Inactive Account"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-[#E7E0D2] space-y-4">
              <h2 className="font-heading text-sm font-bold text-[#1F2937] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0F766E]" />
                <span>Security &amp; Password</span>
              </h2>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FDFBF6] p-4 rounded-[10px] border border-[#E7E0D2]">
                <div>
                  <div className="text-sm font-semibold text-[#1F2937]">Password Management</div>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    To reset a forgotten password, contact the super admin.
                  </p>
                </div>
                <Link
                  href="/change-password"
                  className="btn-secondary text-xs h-9 inline-flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Change Password</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
