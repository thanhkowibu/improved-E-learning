"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AITutorAttachment {
  id: string;
  name: string;
  url: string;
  geminiFileUri: string | null;
}

interface AITutorSettingsProps {
  courseId: string;
  isAIEnabled: boolean;
  attachments: AITutorAttachment[];
}

type OverallStatus = "active" | "out-of-sync" | "disabled";

function getOverallStatus(
  isAIEnabled: boolean,
  attachments: AITutorAttachment[],
): OverallStatus {
  if (!isAIEnabled) return "disabled";
  if (attachments.length === 0) return "out-of-sync";
  return attachments.every((attachment) => attachment.geminiFileUri)
    ? "active"
    : "out-of-sync";
}

export function AITutorSettings({
  courseId,
  isAIEnabled,
  attachments,
}: AITutorSettingsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [displayIsAIEnabled, setDisplayIsAIEnabled] = useState(isAIEnabled);
  const [displayAttachments, setDisplayAttachments] = useState(attachments);

  useEffect(() => {
    setDisplayIsAIEnabled(isAIEnabled);
    setDisplayAttachments(attachments);
  }, [attachments, isAIEnabled]);

  const status = useMemo(
    () => getOverallStatus(displayIsAIEnabled, displayAttachments),
    [displayAttachments, displayIsAIEnabled],
  );

  const syncedCount = displayAttachments.filter(
    (attachment) => attachment.geminiFileUri,
  ).length;

  async function handleSync() {
    setIsLoading(true);
    const toastId = toast.loading("Syncing course materials with Gemini...");

    try {
      const response = await fetch(`/api/courses/${courseId}/setup-ai`, {
        method: "POST",
      });
      const body = (await response.json()) as {
        success?: boolean;
        message?: string;
        data?: { uploadedCount?: number; skippedCount?: number };
      };

      if (!response.ok || !body.success) {
        throw new Error(body.message ?? "Không thể đồng bộ tài liệu cho Trợ giảng AI.");
      }

      const uploadedCount = body.data?.uploadedCount ?? 0;
      toast.success(
        uploadedCount > 0
          ? `Trợ giảng AI đã đồng bộ ${uploadedCount} tài liệu mới.`
          : "Tài liệu cho Trợ giảng AI đã được đồng bộ.",
        { id: toastId },
      );
      setDisplayIsAIEnabled(true);
      setDisplayAttachments((currentAttachments) =>
        currentAttachments.map((attachment) => ({
          ...attachment,
          geminiFileUri: attachment.geminiFileUri ?? `synced:${attachment.id}`,
        })),
      );
      window.dispatchEvent(new CustomEvent("course-ai-settings-changed"));
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể đồng bộ tài liệu cho Trợ giảng AI.",
        { id: toastId },
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="border-indigo-100 bg-white shadow-sm">
      <CardHeader className="gap-3 border-b border-slate-100 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-slate-900">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Sparkles size={16} />
              </span>
              Cấu hình Trợ giảng AI
              {status === "active" && (
                <Badge className="bg-emerald-100 text-emerald-700">
                  Đang hoạt động
                </Badge>
              )}
              {status === "out-of-sync" && (
                <Badge className="bg-amber-100 text-amber-700">
                  Cần đồng bộ
                </Badge>
              )}
              {status === "disabled" && (
                <Badge variant="secondary" className="text-slate-600">
                  Đã tắt
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Quản lý đồng bộ Gemini File API cho tài liệu dùng bởi Trợ giảng AI.
            </CardDescription>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-800">{syncedCount}</span>
            {" / "}
            <span>{displayAttachments.length}</span> synced
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {displayAttachments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="mx-auto max-w-lg text-sm text-slate-500">
              Chưa có tài liệu khóa học. Hãy thêm bài học và tài liệu đính kèm
              để đồng bộ với Trợ giảng AI.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <div className="hidden grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:grid">
              <span>Attachment</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-slate-100">
              {displayAttachments.map((attachment) => {
                const isSynced = Boolean(attachment.geminiFileUri);

                return (
                  <div
                    key={attachment.id}
                    className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-700 hover:text-sky-600"
                      title={attachment.name}
                    >
                      <FileText size={15} className="shrink-0 text-slate-400" />
                      <span className="truncate">{attachment.name}</span>
                    </a>
                    <Badge
                      variant="outline"
                      className={cn(
                        "w-fit gap-1",
                        isSynced
                          ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                          : "bg-slate-50 text-slate-600",
                      )}
                    >
                      {isSynced ? (
                        <>
                          Đã đồng bộ <CheckCircle2 size={12} />
                        </>
                      ) : (
                        <>
                          Chưa đồng bộ <XCircle size={12} />
                        </>
                      )}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-3 bg-indigo-50/30 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Đồng bộ các tài liệu chưa xử lý lên Gemini và bật Trợ giảng AI cho
          khóa học này.
        </p>
        <Button
          type="button"
          onClick={handleSync}
          disabled={isLoading || displayAttachments.length === 0}
          className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Đồng bộ lại tài liệu
        </Button>
      </CardFooter>
    </Card>
  );
}
