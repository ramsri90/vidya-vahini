"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { changePasswordAction } from "@/lib/auth/actions";
import { Eye, EyeOff } from "lucide-react";

export default function ChangePasswordPage() {
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    null
  );
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF7EF] p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#E7E0D2] bg-white p-8 shadow-md">
        <div className="mb-6 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-white border border-[#E7E0D2] flex items-center justify-center p-1 shadow-xs mb-3 overflow-hidden">
            <Image
              src="/black_sketch_logo_exact.svg"
              alt="Vidya Vahini Logo"
              width={56}
              height={56}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <h1 className="text-xl font-heading font-bold text-[#1F2937]">Change Password</h1>
          <p className="mt-1 text-xs text-[#6B7280]">
            You must set a new password before accessing the portal.
          </p>
        </div>

        {state?.error && (
          <div className="mb-4 rounded-[10px] bg-[#FEE2E2] p-3 text-xs text-[#B91C1C] border border-[#FECACA]">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-xs font-semibold text-[#1F2937] mb-1.5"
            >
              Current Password
            </label>
            <div className="relative">
              <input
                id="currentPassword"
                name="currentPassword"
                type={showCurrent ? "text" : "password"}
                required
                autoComplete="current-password"
                className="input-study w-full text-xs pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((p) => !p)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6B7280] hover:text-[#0F766E] transition-colors cursor-pointer"
                aria-label={showCurrent ? "Hide current password" : "Show current password"}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="block text-xs font-semibold text-[#1F2937] mb-1.5"
            >
              New Password (minimum 8 characters)
            </label>
            <div className="relative">
              <input
                id="newPassword"
                name="newPassword"
                type={showNew ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                className="input-study w-full text-xs pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6B7280] hover:text-[#0F766E] transition-colors cursor-pointer"
                aria-label={showNew ? "Hide new password" : "Show new password"}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-semibold text-[#1F2937] mb-1.5"
            >
              Confirm New Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                className="input-study w-full text-xs pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6B7280] hover:text-[#0F766E] transition-colors cursor-pointer"
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full h-10 rounded-[10px] bg-[#0F766E] hover:bg-[#0d655e] text-xs font-semibold text-white shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isPending ? "Updating password..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
