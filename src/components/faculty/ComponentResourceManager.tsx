"use client";

import { useState, useTransition } from "react";
import {
  deleteOwnResource,
  replaceResource,
  createAnnouncement,
} from "@/lib/faculty/actions";
import { useRouter } from "next/navigation";

interface ResourceItem {
  id: string;
  category: string;
  title: string;
  message: string | null;
  fileSizeBytes: bigint | number | null;
  mimeType: string | null;
  status: string;
  archived: boolean;
  createdAt: Date;
}

interface AnnouncementItem {
  id: string;
  message: string;
  createdAt: Date;
  poster: { name: string };
}

interface ComponentResourceManagerProps {
  componentId: string;
  componentType: string;
  initialResources: ResourceItem[];
  initialAnnouncements: AnnouncementItem[];
}

const CATEGORIES = [
  { value: "unit_1", label: "Unit 1 Notes" },
  { value: "unit_2", label: "Unit 2 Notes" },
  { value: "mid_paper", label: "Mid Exam Paper" },
  { value: "previous_paper", label: "Previous Year Paper" },
  { value: "important_questions", label: "Important Questions" },
  { value: "reference", label: "Reference Material" },
];

export function ComponentResourceManager({
  componentId,
  componentType,
  initialResources,
  initialAnnouncements,
}: ComponentResourceManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Upload Form State
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Replace Modal State
  const [replacingResource, setReplacingResource] = useState<ResourceItem | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);

  // Announcement State
  const [announcementMsg, setAnnouncementMsg] = useState("");
  const [announcementError, setAnnouncementError] = useState<string | null>(null);

  const [notification, setNotification] = useState<string | null>(null);

  // Two-Phase Upload Handler
  const handleUploadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploadError(null);
    setUploadStatus(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      setUploadError("Please select a file to upload.");
      return;
    }

    if (file.size > 52428800) {
      setUploadError("File exceeds maximum allowed size of 50 MB.");
      return;
    }

    const category = formData.get("category") as string;
    const title = formData.get("title") as string;
    const message = (formData.get("message") as string) || "";

    setIsUploading(true);
    try {
      // Phase 1: Request presigned PUT URL
      setUploadStatus("Requesting secure upload authorization...");
      const presignRes = await fetch("/api/resources/presign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componentId,
          category,
          title,
          message,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok || !presignData.uploadUrl) {
        throw new Error(presignData.error || "Failed to obtain upload authorization");
      }

      // Phase 2: Direct browser PUT to Backblaze B2 storage
      setUploadStatus("Uploading file directly to secure storage...");
      const putRes = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error(`Direct storage upload failed with status ${putRes.status}`);
      }

      // Phase 3: Confirm upload completion and verify storage object
      setUploadStatus("Verifying object integrity in storage...");
      const confirmRes = await fetch("/api/resources/confirm-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: presignData.resourceId }),
      });

      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) {
        throw new Error(confirmData.error || "Upload verification failed");
      }

      setNotification(`Resource "${title}" uploaded and verified successfully!`);
      form.reset();
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload error";
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      setUploadStatus(null);
    }
  };

  // Replace File Handler
  const handleReplaceSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!replacingResource) return;

    setReplaceError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      setReplaceError("Please select a replacement file.");
      return;
    }

    setIsReplacing(true);
    try {
      // 1. Presign upload for new file
      const presignRes = await fetch("/api/resources/presign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componentId,
          category: replacingResource.category,
          title: replacingResource.title,
          message: replacingResource.message || "",
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok) throw new Error(presignData.error || "Failed to authorize replacement");

      // 2. Direct PUT to storage
      const putRes = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Storage upload failed");

      // 3. Confirm new upload
      const confirmRes = await fetch("/api/resources/confirm-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: presignData.resourceId }),
      });
      if (!confirmRes.ok) throw new Error("Confirmation of new file failed");

      // 4. Atomic replacement: archive old, delete old storage object
      const repFormData = new FormData();
      repFormData.append("oldResourceId", replacingResource.id);
      repFormData.append("newResourceId", presignData.resourceId);

      const repRes = await replaceResource(repFormData);
      if (repRes.error) throw new Error(repRes.error);

      setNotification(`File for "${replacingResource.title}" was successfully replaced!`);
      setReplacingResource(null);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Replacement error";
      setReplaceError(msg);
    } finally {
      setIsReplacing(false);
    }
  };

  // Delete Resource Handler
  const handleDeleteResource = (resourceId: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}"?`)) {
      return;
    }

    const formData = new FormData();
    formData.append("resourceId", resourceId);

    startTransition(async () => {
      const res = await deleteOwnResource(formData);
      if (res.error) {
        setNotification(`Delete error: ${res.error}`);
      } else {
        setNotification(`Resource "${title}" was deleted.`);
        router.refresh();
      }
    });
  };

  // Announcement Submit Handler
  const handleAnnouncementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementMsg.trim()) return;

    setAnnouncementError(null);
    const formData = new FormData();
    formData.append("componentId", componentId);
    formData.append("message", announcementMsg);

    startTransition(async () => {
      const res = await createAnnouncement(formData);
      if (res.error) {
        setAnnouncementError(res.error);
      } else {
        setAnnouncementMsg("");
        setNotification("Announcement posted successfully!");
        router.refresh();
      }
    });
  };

  const formatBytes = (bytes: bigint | number | null) => {
    if (!bytes) return "0 B";
    const n = Number(bytes);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-8">
      {notification && (
        <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700 flex justify-between items-center">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="font-bold underline text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Replace File Modal */}
      {replacingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Replace Resource File</h3>
            <p className="mt-1 text-sm text-gray-600">
              Upload a new file to replace <strong>{replacingResource.title}</strong>. The old file will be deleted from storage once the new file is verified.
            </p>

            {replaceError && (
              <div className="mt-3 rounded-md bg-red-50 p-2 text-xs text-red-700">
                {replaceError}
              </div>
            )}

            <form onSubmit={handleReplaceSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  New File (.pdf, .ppt, .pptx, images, max 50 MB) *
                </label>
                <input
                  name="file"
                  type="file"
                  required
                  accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
                  className="mt-1 w-full rounded border border-gray-300 p-1.5 text-xs text-gray-600"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  disabled={isReplacing}
                  onClick={() => setReplacingResource(null)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReplacing}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isReplacing ? "Replacing..." : "Upload & Replace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grid: Upload Form & Announcements */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Resource Upload Form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-900">Upload Study Material</h2>
          <p className="text-xs text-gray-500">
            Files upload directly to secure cloud storage. Supports PDF, PPT, PPTX, and Images up to 50 MB.
          </p>

          {uploadError && (
            <div className="mt-3 rounded-md bg-red-50 p-3 text-xs text-red-700">
              {uploadError}
            </div>
          )}

          {uploadStatus && (
            <div className="mt-3 rounded-md bg-blue-50 p-3 text-xs text-blue-700 flex items-center space-x-2">
              <span className="animate-spin inline-block h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
              <span>{uploadStatus}</span>
            </div>
          )}

          <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-700">Category *</label>
                <select
                  name="category"
                  required
                  defaultValue="unit_1"
                  className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">Component Tag</label>
                <input
                  type="text"
                  disabled
                  value={componentType.toUpperCase()}
                  className="mt-1 w-full rounded-md border border-gray-200 bg-gray-100 p-2 text-sm font-semibold uppercase text-gray-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Title *</label>
              <input
                name="title"
                required
                maxLength={150}
                placeholder="e.g. Unit 1 Complete Notes - Arrays and Linked Lists"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Instructions / Message (Optional)</label>
              <textarea
                name="message"
                rows={2}
                maxLength={500}
                placeholder="Important topics to focus on for semester exam..."
                className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">
                File (.pdf, .ppt, .pptx, .png, .jpg, .webp - max 50 MB) *
              </label>
              <input
                name="file"
                type="file"
                required
                accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
                className="mt-1 w-full rounded-md border border-gray-300 p-2 text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <button
              type="submit"
              disabled={isUploading}
              className="w-full rounded-md bg-blue-600 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
            >
              {isUploading ? "Uploading to Cloud..." : "Upload Material"}
            </button>
          </form>
        </div>

        {/* Announcements Column */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Post Announcement</h2>
            <p className="text-xs text-gray-500">Announcements appear on students&apos; course subject page.</p>

            {announcementError && (
              <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">
                {announcementError}
              </div>
            )}

            <form onSubmit={handleAnnouncementSubmit} className="mt-3 space-y-2">
              <textarea
                value={announcementMsg}
                onChange={(e) => setAnnouncementMsg(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Write an announcement for this component..."
                className="w-full rounded-md border border-gray-300 p-2 text-xs focus:border-blue-500 focus:outline-none"
              />
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span>{announcementMsg.length}/500</span>
                <button
                  type="submit"
                  disabled={isPending || !announcementMsg.trim()}
                  className="rounded bg-gray-900 px-3 py-1.5 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {isPending ? "Posting..." : "Post Message"}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Recent Announcements</h3>
            <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
              {initialAnnouncements.length === 0 ? (
                <p className="text-xs text-gray-400">No announcements posted yet.</p>
              ) : (
                initialAnnouncements.map((ann) => (
                  <div key={ann.id} className="rounded bg-gray-50 p-2 text-xs">
                    <p className="text-gray-800 whitespace-pre-line">{ann.message}</p>
                    <span className="mt-1 block text-[10px] text-gray-400">
                      {new Date(ann.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Uploaded Resources List */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Uploaded Study Materials</h2>
            <p className="text-xs text-gray-500">All materials visible to students enrolled in this section.</p>
          </div>
          <span className="text-xs font-semibold text-gray-500">
            {initialResources.length} file(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Title &amp; Notes</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Size</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {initialResources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    No resources uploaded yet. Use the upload form above to add study materials.
                  </td>
                </tr>
              ) : (
                initialResources.map((res) => (
                  <tr key={res.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{res.title}</div>
                      {res.message && (
                        <div className="text-xs text-gray-500 italic mt-0.5">{res.message}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 capitalize">
                        {res.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-600">
                      {formatBytes(res.fileSizeBytes)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          res.status === "ready"
                            ? "bg-green-100 text-green-800"
                            : res.status === "uploading"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {res.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(res.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setReplacingResource(res)}
                        className="rounded px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        Replace
                      </button>
                      <button
                        onClick={() => handleDeleteResource(res.id, res.title)}
                        disabled={isPending}
                        className="rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
