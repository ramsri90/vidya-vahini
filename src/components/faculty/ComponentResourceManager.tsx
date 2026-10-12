"use client";

import { useState, useTransition, useRef } from "react";
import {
  deleteOwnResource,
  replaceResource,
  createAnnouncement,
} from "@/lib/faculty/actions";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Send,
  X,
  FileCheck,
} from "lucide-react";

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
  { value: "unit_3", label: "Unit 3 Notes" },
  { value: "unit_4", label: "Unit 4 Notes" },
  { value: "unit_5", label: "Unit 5 Notes" },
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
  const [selectedCategory, setSelectedCategory] = useState<string>("unit_1");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Replace Modal State
  const [replacingResource, setReplacingResource] = useState<ResourceItem | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

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

    const file = selectedFile || (formData.get("file") as File | null);
    if (!file || file.size === 0) {
      setUploadError("Please select a file to upload.");
      return;
    }

    if (file.size > 52428800) {
      setUploadError("File exceeds maximum allowed size of 50 MB.");
      return;
    }

    const category = selectedCategory;
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
          fileSizeBytes: file.size,
        }),
      });

      if (!presignRes.ok) {
        const errData = await presignRes.json();
        throw new Error(errData.error || "Failed to authorize upload.");
      }

      const { uploadUrl, resourceId, storageKey } = await presignRes.json();

      // Phase 2: Direct browser PUT to cloud storage
      setUploadStatus("Uploading file to secure cloud storage...");
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Direct upload to storage provider failed. Please retry.");
      }

      // Phase 3: Confirm upload with server
      setUploadStatus("Finalizing resource record...");
      const confirmRes = await fetch("/api/resources/confirm-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId,
          storageKey,
          fileSizeBytes: file.size,
        }),
      });

      if (!confirmRes.ok) {
        const confirmErr = await confirmRes.json();
        throw new Error(confirmErr.error || "Verification failed on server.");
      }

      // Success
      setNotification(`Study material "${title}" uploaded successfully.`);
      form.reset();
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSelectedCategory("unit_1");
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      if (msg.includes("Failed to fetch")) {
        setUploadError(
          "Direct upload to storage failed (Failed to fetch). This indicates CORS is not configured on your storage bucket, or R2 credentials are not set in Vercel environment variables."
        );
      } else {
        setUploadError(msg);
      }
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
    const file = replaceFile || (formData.get("file") as File | null);

    if (!file || file.size === 0) {
      setReplaceError("Please select a new replacement file.");
      return;
    }

    if (file.size > 52428800) {
      setReplaceError("File exceeds maximum allowed size of 50 MB.");
      return;
    }

    setIsReplacing(true);
    try {
      // Phase 1: Presigned upload
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
          fileSizeBytes: file.size,
        }),
      });

      if (!presignRes.ok) {
        const errData = await presignRes.json();
        throw new Error(errData.error || "Failed to authorize replacement upload.");
      }

      const { uploadUrl, storageKey } = await presignRes.json();

      // Phase 2: Direct upload
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Direct upload failed during replacement.");
      }

      // Phase 3: Atomic replace action
      const replaceFormData = new FormData();
      replaceFormData.append("resourceId", replacingResource.id);
      replaceFormData.append("newR2Key", storageKey);
      replaceFormData.append("newFileSizeBytes", file.size.toString());
      replaceFormData.append("newMimeType", file.type || "application/octet-stream");

      const res = await replaceResource(replaceFormData);
      if (res.error) {
        throw new Error(res.error);
      }

      setNotification(`File for "${replacingResource.title}" replaced successfully.`);
      setReplacingResource(null);
      setReplaceFile(null);
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Replace failed.";
      if (msg.includes("Failed to fetch")) {
        setReplaceError(
          "Direct upload to storage failed (Failed to fetch). This indicates CORS is not configured on your storage bucket, or R2 credentials are not set in Vercel environment variables."
        );
      } else {
        setReplaceError(msg);
      }
    } finally {
      setIsReplacing(false);
    }
  };

  // Delete Resource Handler
  const handleDeleteResource = async (resourceId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      return;
    }

    const formData = new FormData();
    formData.append("resourceId", resourceId);

    startTransition(async () => {
      const res = await deleteOwnResource(formData);
      if (res.error) {
        alert(res.error);
      } else {
        setNotification(`Resource "${title}" deleted.`);
        router.refresh();
      }
    });
  };

  // Post Announcement Handler
  const handleAnnouncementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementMsg.trim()) return;

    setAnnouncementError(null);
    const formData = new FormData();
    formData.append("componentId", componentId);
    formData.append("message", announcementMsg.trim());

    startTransition(async () => {
      const res = await createAnnouncement(formData);
      if (res.error) {
        setAnnouncementError(res.error);
      } else {
        setAnnouncementMsg("");
        setNotification("Announcement published to student view.");
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
        <div className="rounded-[10px] bg-[#CCFBF1] border border-[#99F6E4] p-3.5 text-xs text-[#0F766E] flex justify-between items-center shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-[#0F766E]" />
            <span className="font-medium">{notification}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-[#0F766E] hover:text-[#0D655E] p-1 rounded hover:bg-[#CCFBF1]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Replace File Modal */}
      <Dialog
        open={!!replacingResource}
        onOpenChange={(open) => {
          if (!open) {
            setReplacingResource(null);
            setReplaceFile(null);
            setReplaceError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace Resource File</DialogTitle>
            <DialogDescription>
              Upload a new file to replace <strong>{replacingResource?.title}</strong>. The previous file will be permanently purged once confirmed.
            </DialogDescription>
          </DialogHeader>

          {replaceError && (
            <div className="rounded-[10px] bg-red-50 border border-red-200 p-3 text-xs text-[#B91C1C] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{replaceError}</span>
            </div>
          )}

          <form onSubmit={handleReplaceSubmit} className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                New Replacement File (.pdf, .ppt, .pptx, images, max 50 MB) *
              </label>
              <div
                onClick={() => replaceFileInputRef.current?.click()}
                className="border-2 border-dashed border-[#E7E0D2] hover:border-[#0F766E] rounded-[10px] p-4 text-center cursor-pointer transition-colors bg-[#FDFBF6]"
              >
                <input
                  ref={replaceFileInputRef}
                  name="file"
                  type="file"
                  required
                  accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <UploadCloud className="w-6 h-6 text-[#0F766E]" />
                  {replaceFile ? (
                    <div className="text-xs font-medium text-[#0F766E] flex items-center gap-1">
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>{replaceFile.name} ({(replaceFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-[#1F2937]">Click to choose replacement file</p>
                      <p className="text-[11px] text-[#6B7280]">Supports PDF, PPT, PPTX, Images up to 50 MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isReplacing}
                onClick={() => setReplacingResource(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isReplacing}
                className="bg-[#0F766E] hover:bg-[#0D655E] text-white"
              >
                {isReplacing ? "Replacing File..." : "Upload & Replace"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Grid: Upload Form & Announcements */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Resource Upload Form */}
        <div className="rounded-[14px] border border-[#E7E0D2] bg-white p-6 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-[#E7E0D2]">
            <div>
              <h2 className="font-heading text-base font-bold text-[#1F2937]">Upload Study Material</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Upload notes, past question papers, and references directly to cloud storage.
              </p>
            </div>
            <span className="text-[11px] font-semibold font-mono uppercase bg-[#CCFBF1] text-[#0F766E] px-2.5 py-1 rounded-[6px] border border-[#99F6E4]">
              {componentType.toUpperCase()} Slot
            </span>
          </div>

          {uploadError && (
            <div className="mt-4 rounded-[10px] bg-red-50 border border-red-200 p-3 text-xs text-[#B91C1C] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadStatus && (
            <div className="mt-4 rounded-[10px] bg-[#CCFBF1] border border-[#99F6E4] p-3 text-xs text-[#0F766E] flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-[#0F766E]" />
              <span className="font-medium">{uploadStatus}</span>
            </div>
          )}

          <form onSubmit={handleUploadSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                  Category *
                </label>
                <input type="hidden" name="category" value={selectedCategory} />
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-10 text-xs font-medium">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                  Component Tag
                </label>
                <input
                  type="text"
                  disabled
                  value={componentType.toUpperCase()}
                  className="w-full h-10 rounded-[10px] border border-[#E7E0D2] bg-[#FDFBF6] px-3 py-2 text-xs font-semibold uppercase text-[#4B5563]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                Title *
              </label>
              <input
                name="title"
                required
                maxLength={150}
                placeholder="e.g. Unit 3 Complete Notes - Tree Data Structures"
                className="w-full h-10 rounded-[10px] border border-[#E7E0D2] bg-white px-3 py-2 text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                Instructions / Message (Optional)
              </label>
              <textarea
                name="message"
                rows={2}
                maxLength={500}
                placeholder="Important topics or key questions for this unit..."
                className="w-full rounded-[10px] border border-[#E7E0D2] bg-white p-3 text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                File (.pdf, .ppt, .pptx, .png, .jpg, .webp - max 50 MB) *
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#E7E0D2] hover:border-[#0F766E] rounded-[10px] p-5 text-center cursor-pointer transition-colors bg-[#FDFBF6]"
              >
                <input
                  ref={fileInputRef}
                  name="file"
                  type="file"
                  required={!selectedFile}
                  accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <UploadCloud className="w-7 h-7 text-[#0F766E]" />
                  {selectedFile ? (
                    <div className="text-xs font-semibold text-[#0F766E] flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4" />
                      <span>{selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-[#1F2937]">Click to select or drag and drop study material</p>
                      <p className="text-[11px] text-[#6B7280]">Supports PDF, PPT, PPTX, PNG, JPG up to 50 MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isUploading}
              className="w-full h-10 rounded-[10px] bg-[#0F766E] hover:bg-[#0D655E] text-white text-xs font-semibold shadow-xs"
            >
              {isUploading ? "Uploading to Cloud..." : "Upload Material"}
            </Button>
          </form>
        </div>

        {/* Announcements Column */}
        <div className="rounded-[14px] border border-[#E7E0D2] bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-[#E7E0D2]">
              <h2 className="font-heading text-base font-bold text-[#1F2937]">Post Announcement</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">Appears immediately on student subject page.</p>
            </div>

            {announcementError && (
              <div className="mt-3 rounded-[10px] bg-red-50 border border-red-200 p-2.5 text-xs text-[#B91C1C] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{announcementError}</span>
              </div>
            )}

            <form onSubmit={handleAnnouncementSubmit} className="mt-4 space-y-3">
              <textarea
                value={announcementMsg}
                onChange={(e) => setAnnouncementMsg(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Write an announcement for students in this component..."
                className="w-full rounded-[10px] border border-[#E7E0D2] bg-white p-3 text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#6B7280]">
                  {announcementMsg.length}/500
                </span>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || !announcementMsg.trim()}
                  className="bg-[#0F766E] hover:bg-[#0D655E] text-white text-xs gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Post Message</span>
                </Button>
              </div>
            </form>
          </div>

          <div className="mt-6 border-t border-[#E7E0D2] pt-4">
            <h3 className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">
              Recent Announcements
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {initialAnnouncements.length === 0 ? (
                <p className="text-xs text-[#6B7280] italic">No announcements posted yet.</p>
              ) : (
                initialAnnouncements.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-[10px] border border-[#E7E0D2] bg-[#FDFBF6] p-3 text-xs"
                  >
                    <p className="text-[#1F2937]">{a.message}</p>
                    <span className="mt-1 block text-[10px] text-[#6B7280]">
                      {new Date(a.createdAt).toLocaleDateString()} &bull; {a.poster.name}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Uploaded Resources List */}
      <div className="rounded-[14px] border border-[#E7E0D2] bg-white shadow-xs overflow-hidden">
        <div className="border-b border-[#E7E0D2] bg-[#FDFBF6] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-sm font-bold text-[#1F2937]">Uploaded Study Materials</h2>
            <p className="text-xs text-[#6B7280]">All materials visible to students enrolled in this section.</p>
          </div>
          <span className="text-xs font-semibold text-[#0F766E] bg-[#CCFBF1] px-2.5 py-0.5 rounded-full border border-[#99F6E4]">
            {initialResources.length} file(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#E7E0D2] text-xs">
            <thead className="bg-[#FDFBF6] text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Title &amp; Notes</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Size</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0D2] bg-white">
              {initialResources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-xs text-[#6B7280]">
                    No resources uploaded yet. Use the upload form above to add study materials.
                  </td>
                </tr>
              ) : (
                initialResources.map((res) => (
                  <tr key={res.id} className="hover:bg-[#FDFBF6] transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-[#1F2937] flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#0F766E] shrink-0" />
                        <span>{res.title}</span>
                      </div>
                      {res.message && (
                        <div className="text-[11px] text-[#6B7280] italic mt-0.5 ml-5">{res.message}</div>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="rounded-[6px] bg-[#CCFBF1] px-2 py-0.5 text-[11px] font-medium text-[#0F766E] capitalize border border-[#99F6E4]">
                        {res.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[#6B7280]">
                      {formatBytes(res.fileSizeBytes)}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={
                          res.status === "ready"
                            ? "badge-ready"
                            : res.status === "uploading"
                            ? "badge-lab"
                            : "badge-failed"
                        }
                      >
                        {res.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-[#6B7280]">
                      {new Date(res.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReplacingResource(res)}
                        className="h-7 text-[11px] text-[#0F766E] hover:bg-[#CCFBF1]/40 border-[#E7E0D2]"
                      >
                        Replace
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteResource(res.id, res.title)}
                        disabled={isPending}
                        className="h-7 text-[11px] text-red-600 hover:bg-red-50 border-red-200"
                      >
                        Delete
                      </Button>
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
