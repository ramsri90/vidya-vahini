"use client";

import { useActionState, Suspense, useState } from "react";
import Image from "next/image";
import { loginAction } from "@/lib/auth/actions";
import { useSearchParams } from "next/navigation";
import { CheckCircle, AlertCircle, Lock, User, Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const passwordChanged = searchParams.get("passwordChanged") === "true";

  return (
    <div className="card-study w-full max-w-md p-8 sm:p-10 shadow-md">
      {/* Brand Logo & Header */}
      <div className="mb-8 text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-white border border-[#E7E0D2] flex items-center justify-center p-1.5 shadow-sm mb-4 overflow-hidden">
          <Image
            src="/black_sketch_logo_exact.svg"
            alt="Vidya Vahini Logo"
            width={64}
            height={64}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1F2937] tracking-tight">
          Vidya Vahini
        </h1>
        <p className="text-xs font-semibold text-[#0F766E] uppercase tracking-wider mt-1">
          A Class PDF Platform
        </p>
        <p className="text-xs text-[#6B7280] mt-1.5">
          From Faculty to Students, Knowledge for Everyone.
        </p>
      </div>

      {passwordChanged && (
        <div className="mb-5 rounded-[10px] bg-[#DCFCE7] p-3.5 text-xs text-[#15803D] border border-[#BBF7D0] flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>Password updated successfully. Please log in with your new password.</span>
        </div>
      )}

      {state?.error && (
        <div className="mb-5 rounded-[10px] bg-red-50 p-3.5 text-xs text-[#B91C1C] border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <form action={formAction} className="space-y-5">
        <div>
          <label
            htmlFor="identifier"
            className="block text-xs font-semibold uppercase tracking-wider text-[#1F2937] mb-1.5"
          >
            Roll Number or Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280]">
              <User className="w-4 h-4" />
            </div>
            <input
              id="identifier"
              name="identifier"
              type="text"
              required
              autoComplete="username"
              className="w-full rounded-[10px] border border-[#E7E0D2] bg-white pl-10 pr-3.5 py-2.5 text-sm text-[#1F2937] placeholder:text-[#6B7280]/60 outline-none focus:ring-2 focus:ring-[#0F766E] transition-all"
              placeholder="e.g. 23CSE001 or admin@college.edu"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold uppercase tracking-wider text-[#1F2937] mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              className="w-full rounded-[10px] border border-[#E7E0D2] bg-white pl-10 pr-10 py-2.5 text-sm text-[#1F2937] placeholder:text-[#6B7280]/60 outline-none focus:ring-2 focus:ring-[#0F766E] transition-all"
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#6B7280] hover:text-[#0F766E] transition-colors cursor-pointer"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="btn-primary w-full h-11 text-sm font-semibold mt-2 cursor-pointer"
        >
          {isPending ? "Signing in..." : "Sign in to Portal"}
        </button>
      </form>

      <div className="mt-8 pt-5 border-t border-[#E7E0D2] text-center">
        <p className="text-[11px] text-[#6B7280]">
          Forgot your password? Contact your department super administrator.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF7EF] p-4 sm:p-6">
      <Suspense fallback={<div className="text-xs text-[#6B7280]">Loading portal...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
