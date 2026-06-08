"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Archive,
  Download,
  File,
  FileText,
  FileVideo,
  Eye,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { UploadDropzone } from "@/lib/uploadthing";
import { MaterialPreviewModal } from "./MaterialPreviewModal";

interface Material {
  id: string;
  title: string;
  fileUrl: string;
  materialType: "PDF" | "VIDEO" | "LINK" | "OTHER";
  fileSizeBytes: string | number | null;
}

interface UploadedThingFile {
  name: string;
  size: number;
  type?: string;
  url?: string;
  ufsUrl?: string;
}

interface Props {
  lessonId: string;
}

function FileIcon({
  materialType,
}: {
  materialType?: Material["materialType"];
}) {
  if (materialType === "VIDEO") {
    return <FileVideo size={16} className="shrink-0 text-violet-500" />;
  }
  if (materialType === "PDF") {
    return <FileText size={16} className="shrink-0 text-red-500" />;
  }
  if (materialType === "OTHER") {
    return <Archive size={16} className="shrink-0 text-orange-500" />;
  }

  return <File size={16} className="shrink-0 text-blue-500" />;
}

function formatBytes(bytes: string | number | null): string {
  if (bytes === null || bytes === undefined) return "";
  const n = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (Number.isNaN(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lms_auth_token");
}

export default function LessonMaterials({ lessonId }: Props) {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSavingUpload, setIsSavingUpload] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);

  const loadMaterials = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const token = getToken();
      const res = await fetch(`/api/lessons/${lessonId}/materials`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: Material[];
        message?: string;
      } | null;

      if (res.ok && json?.success && json.data) {
        setMaterials(json.data);
      } else {
        setLoadError(json?.message ?? "Failed to load materials.");
      }
    } catch {
      setLoadError("Failed to load materials.");
    } finally {
      setIsLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  async function persistUploadedFile(uploaded: UploadedThingFile) {
    const fileUrl = uploaded.url ?? uploaded.ufsUrl;
    if (!fileUrl) {
      toast.error(
        "Upload completed, but UploadThing did not return a file URL.",
      );
      return;
    }

    setIsSavingUpload(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/lessons/${lessonId}/materials/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: uploaded.name,
          url: fileUrl,
          size: uploaded.size,
          type: uploaded.type,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: Material;
        message?: string;
      } | null;

      if (!res.ok || !json?.success || !json.data) {
        toast.error(
          json?.message ?? "Upload saved to cloud, but database sync failed.",
        );
        return;
      }

      setMaterials((prev) => [...prev, json.data as Material]);
      toast.success(`"${uploaded.name}" uploaded successfully.`);
      router.refresh();
      window.dispatchEvent(new CustomEvent("course-materials-changed"));
    } catch {
      toast.error("Upload saved to cloud, but database sync failed.");
    } finally {
      setIsSavingUpload(false);
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;

    setIsDeleting(true);
    const toastId = toast.loading("Deleting...");
    try {
      const token = getToken();
      const res = await fetch(`/api/materials/${deletingId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.status === 204 || res.ok) {
        toast.success("Material deleted.", { id: toastId });
        setMaterials((prev) => prev.filter((m) => m.id !== deletingId));
        router.refresh();
        window.dispatchEvent(new CustomEvent("course-materials-changed"));
      } else {
        const json = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        toast.error(json?.message ?? "Failed to delete material.", {
          id: toastId,
        });
      }
    } catch {
      toast.error("Network error during deletion.", { id: toastId });
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5 py-2">
      <div className="relative">
        <UploadDropzone
          endpoint="courseMaterialUploader"
          onClientUploadComplete={async (res) => {
            const uploaded = res[0];
            if (!uploaded) return;
            await persistUploadedFile({
              name: uploaded.name,
              size: uploaded.size,
              type: uploaded.type,
              url: uploaded.url,
              ufsUrl: uploaded.ufsUrl,
            });
          }}
          onUploadError={(error) => {
            toast.error(error.message || "Upload failed.");
          }}
          appearance={{
            container:
              "min-h-44 cursor-pointer rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-8 transition-all hover:cursor-pointer hover:border-sky-500/40 hover:bg-sky-500/5 " +
              "ut-state-dragover:border-sky-500 ut-state-dragover:bg-sky-500/10 ut-state-dragover:scale-[1.01]",
            uploadIcon: "size-10 text-sky-500",
            label:
              "cursor-pointer text-sm font-medium text-sky-500 transition-colors hover:cursor-pointer hover:text-primary/80",
            allowedContent: "text-xs text-muted-foreground",
            button:
              "inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:cursor-pointer hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          }}
          content={{
            allowedContent:
              "PDF, video, and image files are stored in UploadThing.",
          }}
        />
        {isSavingUpload && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
              <Loader2 size={15} className="animate-spin text-sky-600" />
              Saving material...
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-slate-100"
            />
          ))}
        </div>
      ) : loadError ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void loadMaterials()}
            className="ml-auto text-xs underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      ) : materials.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">
          No materials attached yet. Upload your first file above.
        </p>
      ) : (
        <ul className="space-y-2">
          {materials.map((mat) => (
            <li
              key={mat.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-xs transition-colors hover:bg-slate-50/80"
            >
              <FileIcon materialType={mat.materialType} />

              <div className="min-w-0 flex-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="block cursor-default truncate text-sm font-medium text-slate-800">
                          {mat.title}
                        </span>
                      }
                    />
                    <TooltipContent>{mat.title}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {mat.fileSizeBytes !== null && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatBytes(mat.fileSizeBytes)}
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setPreviewMaterial(mat)}
                className="shrink-0 text-slate-400 hover:bg-sky-50 hover:text-sky-600"
                aria-label={`Preview ${mat.title}`}
              >
                <Eye size={15} />
              </Button>

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
                  className="text-slate-400 hover:bg-sky-50 hover:text-sky-600"
                  aria-label={`Download ${mat.title}`}
                >
                  <Download size={15} />
                </Button>
              </a>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setDeletingId(mat.id)}
                className="shrink-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
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
                      <strong>&ldquo;{mat.title}&rdquo;</strong> from
                      UploadThing and remove it from the lesson. This cannot be
                      undone.
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

      <MaterialPreviewModal
        material={previewMaterial}
        open={previewMaterial !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewMaterial(null);
        }}
      />
    </div>
  );
}
