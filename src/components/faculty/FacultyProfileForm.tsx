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
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm max-w-xl">
      <h2 className="text-lg font-bold text-gray-900">Contact Information</h2>
      <p className="text-xs text-gray-500">Update your email and contact number.</p>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-md bg-green-50 p-3 text-xs text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700">Full Name</label>
          <input
            type="text"
            disabled
            value={name}
            className="mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700">Email Address *</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700">Phone Number (Optional)</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 9876543210"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <div className="mt-8 border-t border-gray-100 pt-6">
        <h3 className="text-sm font-bold text-gray-900">Security &amp; Credentials</h3>
        <p className="mt-1 text-xs text-gray-500">
          To update your account password, use the secure password change flow.
        </p>
        <div className="mt-3">
          <Link
            href="/change-password"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Change Account Password &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
