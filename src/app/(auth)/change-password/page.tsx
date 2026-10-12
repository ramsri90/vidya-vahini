"use client";

import { useActionState } from "react";
import Image from "next/image";
import { changePasswordAction } from "@/lib/auth/actions";

export default function ChangePasswordPage() {
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    null
  );

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
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium text-gray-700"
            >
              Current Password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-gray-700"
            >
              New Password (minimum 8 characters)
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700"
            >
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isPending ? "Updating password..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
