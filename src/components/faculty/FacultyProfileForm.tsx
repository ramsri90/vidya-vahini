"use client";

import { useState, useTransition } from "react";
import { updateFacultyProfile } from "@/lib/faculty/actions";
import Link from "next/link";

interface FacultyProfileFormProps {
  initialEmail: string;
  initialPhone: string | null;
  name: string;
}

export function FacultyProfileForm({ initialEmail, initialPhone, name }: FacultyProfileFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone || "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("email", email);
    formData.append("phone", phone);

    startTransition(async () => {
      const res = await updateFacultyProfile(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Profile contact details updated successfully.");
      }
    });
  };

  return (
    <div className="rounded-[14px] border border-[#E7E0D2] bg-white p-6 sm:p-8 shadow-xs max-w-xl">
      <h2 className="font-heading text-lg font-bold text-[#1F2937]">Contact Information</h2>
      <p className="text-xs text-[#6B7280] mt-0.5">Update your email and contact number.</p>

      {error && (
        <div className="mt-4 rounded-[10px] bg-[#FEE2E2] border border-[#FECACA] p-3 text-xs text-[#B91C1C]">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-[10px] bg-[#DCFCE7] border border-[#BBF7D0] p-3 text-xs text-[#15803D]">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">Full Name</label>
          <input
            type="text"
            disabled
            value={name}
            className="w-full h-10 rounded-[10px] border border-[#E7E0D2] bg-[#FDFBF6] px-3 text-xs font-semibold text-[#6B7280] cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">Email Address *</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-study w-full text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">Phone Number (Optional)</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 9876543210"
            className="input-study w-full text-xs"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="btn-primary text-xs h-10 px-5 inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <div className="mt-8 border-t border-[#E7E0D2] pt-6">
        <h3 className="font-heading text-sm font-bold text-[#1F2937]">Security &amp; Credentials</h3>
        <p className="mt-1 text-xs text-[#6B7280]">
          To update your account password, use the secure password change flow.
        </p>
        <div className="mt-3">
          <Link
            href="/change-password"
            className="btn-secondary text-xs h-9 inline-flex items-center gap-1.5"
          >
            Change Account Password &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
