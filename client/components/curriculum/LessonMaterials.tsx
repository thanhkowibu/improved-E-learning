"use client";

/**
 * components/curriculum/LessonMaterials.tsx
 *
 * Handles all Material operations for a single lesson:
 *   - Fetch: GET /api/lessons/:lessonId/materials
 *   - Upload: POST /api/lessons/:lessonId/materials/upload  (via XHR for progress)
 *   - Download: GET /api/materials/:materialId/download
 *   - Delete: DELETE /api/materials/:materialId  (with AlertDialog confirmation)
 *
 * XHR vs fetch for upload:
 *   The native fetch() API does not expose upload progress events. We use
 *   XMLHttpRequest instead, which fires xhr.upload.onprogress with loaded/total
 *   byte counts so we can drive the Progress bar in real-time.
 *   See ADR-009 in docs/04-architecture-decisions.md.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  FileVideo,
  Archive,
  File,
  Download,
  Trash2,
  UploadCloud,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Material {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSizeBytes: string | number | null;
}

interface Props {
  lessonId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Return the appropriate Lucide icon component based on MIME type. */
function FileIcon({ mimeType }: { mimeType?: string }) {
  // Safe fallback: If mimeType is undefined (empty), automatically assign an empty string
  const safeType = mimeType || "";

  if (safeType.startsWith("video/")) {
    return <FileVideo size={16} className="text-violet-500 shrink-0" />;
  }
  if (safeType.includes("zip") || safeType.includes("rar") || safeType.includes("tar")) {
    return <Archive size={16} className="text-orange-500 shrink-0" />;
  }
  if (safeType.includes("pdf")) {
    return <FileText size={16} className="text-red-500 shrink-0" />;
  }

  // Icon default for remaining files (docx, xlsx, txt, or when mimeType is not available)
  return <File size={16} className="text-blue-500 shrink-0" />;
}

/** Format a byte count into a human-readable string (KB / MB). */
function formatBytes(bytes: string | number | null): string {
  if (bytes === null || bytes === undefined) return "";
  const n = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (isNaN(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Read the stored JWT from localStorage for attaching to XHR headers. */
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lms_auth_token");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LessonMaterials({ lessonId }: Props) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Upload state
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null); // 0-100 or null
  const [uploadingName, setUploadingName] = useState<string | null>(null);

  // Deletion state — holds the material pending confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch materials ────────────────────────────────────────────────────────

  const loadMaterials = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const token = getToken();
      const res = await fetch(`/api/lessons/${lessonId}/materials`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (json.success && json.data) {
        setMaterials(json.data);
      } else {
        setLoadError(json.error ?? "Failed to load materials.");
      }
    } catch {
      setLoadError("Failed to load materials.");
    }
    setIsLoading(false);
    // lessonId is a stable primitive — the only thing that should re-trigger a fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  // ── Upload via XHR (required for progress tracking) ────────────────────────

  /**
   * XHR is the ONLY browser API that exposes upload progress via the
   * xhr.upload.onprogress event. The Fetch API provides no equivalent.
   * We attach the JWT manually since we bypass the useApi hook here.
   */
  function uploadFile(file: File) {
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);

    setUploadingName(file.name);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();

    // Real-time progress — called repeatedly as bytes are sent.
    xhr.upload.onprogress = (e: ProgressEvent) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      setUploadProgress(null);
      setUploadingName(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          if (json.success && json.data) {
            setMaterials((prev) => [...prev, json.data]);
            toast.success(`"${file.name}" uploaded successfully.`);
          } else {
            toast.error(json.error ?? "Upload failed.");
          }
        } catch {
          toast.error("Upload failed — unexpected response.");
        }
      } else {
        try {
          const json = JSON.parse(xhr.responseText);
          toast.error(json.error ?? `Upload failed (${xhr.status}).`);
        } catch {
          toast.error(`Upload failed (${xhr.status}).`);
        }
      }
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      setUploadingName(null);
      toast.error("Network error during upload.");
    };

    xhr.open("POST", `/api/lessons/${lessonId}/materials/upload`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  }

  // ── Drag-and-drop handlers ─────────────────────────────────────────────────

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset so the same file can be re-selected if needed
    e.target.value = "";
  }

  // ── Delete material ────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deletingId) return;
    setIsDeleting(true);
    const toastId = toast.loading("Deleting…");
    try {
      const token = getToken();
      const res = await fetch(`/api/materials/${deletingId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 204 || res.ok) {
        toast.success("Material deleted.", { id: toastId });
        setMaterials((prev) => prev.filter((m) => m.id !== deletingId));
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Failed to delete material.", { id: toastId });
      }
    } catch {
      toast.error("Network error during deletion.", { id: toastId });
    }
    setIsDeleting(false);
    setDeletingId(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isUploading = uploadProgress !== null;

  return (
    <div className="space-y-5 py-2">
      {/* ── Upload Zone ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !isUploading && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 px-4 transition-colors cursor-pointer select-none",
          isDragOver
            ? "border-sky-400 bg-sky-50"
            : "border-slate-200 bg-slate-50/50 hover:border-sky-300 hover:bg-sky-50/40",
          isUploading ? "pointer-events-none opacity-80" : "",
        ].join(" ")}
      >
        {isUploading ? (
          <>
            <Loader2 size={24} className="text-sky-500 animate-spin" />
            <p className="text-sm font-medium text-slate-700">
              Uploading <span className="text-sky-600">{uploadingName}</span>…
            </p>
            <div className="w-full max-w-xs">
              <Progress value={uploadProgress} className="h-2" />
            </div>
            <p className="text-xs text-slate-400 tabular-nums">{uploadProgress}%</p>
          </>
        ) : (
          <>
            <UploadCloud size={28} className="text-slate-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">
                Drop a file here, or{" "}
                <span className="text-sky-600 underline underline-offset-2">browse</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                PDF, video, ZIP, and other formats up to 100 MB
              </p>
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          onChange={handleFileInput}
          tabIndex={-1}
        />
      </div>

      {/* ── Material List ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      ) : loadError ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          <span>{loadError}</span>
          <button
            type="button"
            onClick={loadMaterials}
            className="ml-auto text-xs underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      ) : materials.length === 0 ? (
        <p className="text-center text-xs text-slate-400 py-4">
          No materials attached yet. Upload your first file above.
        </p>
      ) : (
        <ul className="space-y-2">
          {materials.map((mat) => (
            <li
              key={mat.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-xs hover:bg-slate-50/80 transition-colors"
            >
              <FileIcon mimeType={mat.mimeType} />

              {/* File info */}
              <div className="flex-1 min-w-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="block text-sm font-medium text-slate-800 truncate cursor-default">
                        {mat.title}
                      </span>
                    } />
                    <TooltipContent>
                      {mat.title}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {mat.fileSizeBytes !== null && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatBytes(mat.fileSizeBytes)}
                  </p>
                )}
              </div>

              {/* Download */}
              <a
                href={`/api/materials/${mat.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-slate-400 hover:text-sky-600 hover:bg-sky-50"
                  aria-label={`Download ${mat.title}`}
                >
                  <Download size={15} />
                </Button>
              </a>

              {/* Delete with AlertDialog */}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setDeletingId(mat.id)}
                className="shrink-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                aria-label={`Delete ${mat.title}`}
              >
                <Trash2 size={15} />
              </Button>

              <AlertDialog
                open={deletingId === mat.id}
                onOpenChange={(open) => {
                  if (!open) setDeletingId(null);
                }}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Material?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete{" "}
                      <strong>&ldquo;{mat.title}&rdquo;</strong> and remove
                      the physical file from storage. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={confirmDelete}
                      disabled={isDeleting}
                      className="gap-2"
                    >
                      {isDeleting && (
                        <Loader2 size={13} className="animate-spin" />
                      )}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
