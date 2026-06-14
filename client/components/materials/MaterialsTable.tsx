"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Download,
  FileText,
  FileVideo,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UploadDropzone } from "@/lib/uploadthing";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

const GEMINI_FILE_TTL_MS = 48 * 60 * 60 * 1000;

interface LessonOption {
  id: string;
  title: string;
  moduleTitle: string;
}

interface UploadedThingFile {
  name: string;
  size: number;
  type?: string;
  url?: string;
  ufsUrl?: string;
}

interface CourseModuleForLessons {
  id: string;
  title: string;
  orderIndex: number;
  lessons: Array<{
    id: string;
    title: string;
    orderIndex: number;
  }>;
}

export interface CourseMaterialRow {
  id: string;
  title: string;
  materialType: "PDF" | "VIDEO" | "LINK" | "OTHER";
  fileUrl: string;
  fileSizeBytes: string | number | null;
  geminiFileUri: string | null;
  geminiFileName: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  lesson: {
    id: string;
    title: string;
    module: {
      id: string;
      title: string;
    };
  };
}

interface MaterialsTableProps {
  courseId: string;
  lessons: LessonOption[];
}

function formatBytes(bytes: string | number | null): string {
  if (bytes === null || bytes === undefined) return "0 B";
  const n = typeof bytes === "string" ? Number.parseInt(bytes, 10) : bytes;
  if (Number.isNaN(n)) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function bytesToNumber(bytes: string | number | null) {
  if (bytes === null || bytes === undefined) return 0;
  const n = typeof bytes === "string" ? Number.parseInt(bytes, 10) : bytes;
  return Number.isNaN(n) ? 0 : n;
}

function isGeminiSyncFresh(material: CourseMaterialRow) {
  if (!material.geminiFileName || !material.geminiFileUri) return false;
  const updatedAt = new Date(material.updatedAt).getTime();
  return Date.now() - updatedAt < GEMINI_FILE_TTL_MS;
}

function compactTitle(title: string) {
  return title
    .replace(/\bModule\s+(\d+)\s*:?/i, "M$1:")
    .replace(/\bLesson\s+(\d+)\s*:?/i, "L$1:")
    .replace(/\s+/g, " ")
    .trim();
}

function formatLocation(moduleTitle: string, lessonTitle: string) {
  return `${compactTitle(moduleTitle)} > ${compactTitle(lessonTitle)}`;
}

function MaterialTypeBadge({
  type,
}: {
  type: CourseMaterialRow["materialType"];
}) {
  if (type === "PDF") {
    return (
      <Badge
        variant="outline"
        className="border-red-200 bg-red-50 text-red-700"
      >
        PDF
      </Badge>
    );
  }

  if (type === "VIDEO") {
    return (
      <Badge
        variant="outline"
        className="border-violet-200 bg-violet-50 text-violet-700"
      >
        VIDEO
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-slate-200 bg-slate-50 text-slate-600"
    >
      {type}
    </Badge>
  );
}

function MaterialIcon({ type }: { type: CourseMaterialRow["materialType"] }) {
  if (type === "VIDEO")
    return <FileVideo size={16} className="text-violet-500" />;
  if (type === "PDF") return <FileText size={16} className="text-red-500" />;
  return <Archive size={16} className="text-slate-400" />;
}

export function MaterialsTable({ courseId, lessons }: MaterialsTableProps) {
  const api = useApi();
  const router = useRouter();
  const [materials, setMaterials] = useState<CourseMaterialRow[]>([]);
  const [availableLessons, setAvailableLessons] =
    useState<LessonOption[]>(lessons);
  const [isLoading, setIsLoading] = useState(true);
  const [resyncingId, setResyncingId] = useState<string | null>(null);
  const [isBulkResyncing, setIsBulkResyncing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState(
    lessons[0]?.id ?? "",
  );
  const [isSavingUpload, setIsSavingUpload] = useState(false);

  const totalBytes = useMemo(
    () =>
      materials.reduce(
        (sum, material) => sum + bytesToNumber(material.fileSizeBytes),
        0,
      ),
    [materials],
  );
  const expiredMaterials = useMemo(
    () => materials.filter((material) => !isGeminiSyncFresh(material)),
    [materials],
  );
  const selectedLessonLabel = useMemo(() => {
    const lesson = availableLessons.find(
      (item) => item.id === selectedLessonId,
    );
    return lesson ? formatLocation(lesson.moduleTitle, lesson.title) : "";
  }, [availableLessons, selectedLessonId]);

  const loadMaterials = useCallback(async () => {
    setIsLoading(true);
    const res = await api.get<CourseMaterialRow[]>(
      `/api/courses/${courseId}/materials`,
    );

    if (res.success && res.data) {
      setMaterials(res.data);
    } else {
      toast.error(
        res.error ?? res.message ?? "Không thể tải tài liệu khóa học.",
      );
    }

    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const loadLessonOptions = useCallback(async () => {
    const res = await api.get<CourseModuleForLessons[]>(
      `/api/courses/${courseId}/modules`,
    );

    if (!res.success || !res.data) {
      toast.error(
        res.error ?? res.message ?? "Không thể làm mới danh sách bài học.",
      );
      return;
    }

    const nextLessons = res.data
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .flatMap((module) =>
        module.lessons
          .slice()
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            moduleTitle: module.title,
          })),
      );

    setAvailableLessons(nextLessons);
    setSelectedLessonId((current) => {
      if (current && nextLessons.some((lesson) => lesson.id === current)) {
        return current;
      }

      return nextLessons[0]?.id ?? "";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  useEffect(() => {
    setAvailableLessons(lessons);
    if (!selectedLessonId && lessons[0]) {
      setSelectedLessonId(lessons[0].id);
    }
  }, [lessons, selectedLessonId]);

  useEffect(() => {
    if (isUploadOpen) {
      void loadLessonOptions();
    }
  }, [isUploadOpen, loadLessonOptions]);

  async function handleResync(materialId: string) {
    setResyncingId(materialId);
    const toastId = toast.loading("Đang đồng bộ tài liệu lên Gemini...");

    const res = await api.post<CourseMaterialRow>(
      `/api/courses/${courseId}/materials/${materialId}/resync`,
    );

    if (res.success && res.data) {
      setMaterials((current) =>
        current.map((material) =>
          material.id === materialId
            ? (res.data as CourseMaterialRow)
            : material,
        ),
      );
      toast.success("Đã đồng bộ tài liệu với AI.", { id: toastId });
      window.dispatchEvent(new CustomEvent("course-materials-changed"));
      window.dispatchEvent(new CustomEvent("course-ai-settings-changed"));
      router.refresh();
    } else {
      toast.error(res.error ?? res.message ?? "Không thể đồng bộ tài liệu.", {
        id: toastId,
      });
    }

    setResyncingId(null);
  }

  async function handleBulkResyncExpired() {
    const targets = materials.filter(
      (material) => !isGeminiSyncFresh(material),
    );

    if (targets.length === 0) {
      toast.info("Không có tài liệu hết hạn hoặc chưa đồng bộ.");
      return;
    }

    setIsBulkResyncing(true);
    const toastId = toast.loading(
      `Đang đồng bộ ${targets.length} tài liệu hết hạn...`,
    );
    let successCount = 0;
    let skippedCount = 0;

    for (const material of targets) {
      setResyncingId(material.id);
      const res = await api.post<CourseMaterialRow>(
        `/api/courses/${courseId}/materials/${material.id}/resync`,
      );

      if (res.success && res.data) {
        successCount += 1;
        setMaterials((current) =>
          current.map((item) =>
            item.id === material.id ? (res.data as CourseMaterialRow) : item,
          ),
        );
      } else {
        skippedCount += 1;
        continue;
      }
    }

    setResyncingId(null);
    setIsBulkResyncing(false);

    if (successCount > 0) {
      await loadMaterials();
      window.dispatchEvent(new CustomEvent("course-materials-changed"));
      window.dispatchEvent(new CustomEvent("course-ai-settings-changed"));
      router.refresh();
    }

    if (successCount > 0 && skippedCount === 0) {
      toast.success(`Đã đồng bộ thành công ${successCount} tệp.`, {
        id: toastId,
      });
    } else if (successCount > 0 && skippedCount > 0) {
      toast.info(
        `Đã đồng bộ ${successCount} tệp. Bỏ qua ${skippedCount} tệp do định dạng chưa hỗ trợ.`,
        { id: toastId },
      );
    } else {
      toast.error("Không thể đồng bộ tệp. Định dạng có thể chưa được hỗ trợ.", {
        id: toastId,
      });
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;

    setIsDeleting(true);
    const toastId = toast.loading("Deleting material...");
    const res = await api.del(`/api/materials/${deletingId}`);

    if (res.success) {
      setMaterials((current) =>
        current.filter((material) => material.id !== deletingId),
      );
      toast.success("Đã xóa tài liệu.", { id: toastId });
      window.dispatchEvent(new CustomEvent("course-materials-changed"));
      router.refresh();
    } else {
      toast.error(res.error ?? res.message ?? "Không thể xóa tài liệu.", {
        id: toastId,
      });
    }

    setIsDeleting(false);
    setDeletingId(null);
  }

  async function persistUploadedFile(uploaded: UploadedThingFile) {
    if (!selectedLessonId) {
      toast.error("Vui lòng chọn bài học trước khi tải lên.");
      return;
    }

    const fileUrl = uploaded.url ?? uploaded.ufsUrl;
    if (!fileUrl) {
      toast.error("Tải lên hoàn tất nhưng UploadThing không trả về URL tệp.");
      return;
    }

    setIsSavingUpload(true);
    const res = await api.post<CourseMaterialRow>(
      `/api/lessons/${selectedLessonId}/materials/upload`,
      {
        name: uploaded.name,
        url: fileUrl,
        size: uploaded.size,
        type: uploaded.type,
      },
    );

    if (res.success) {
      toast.success(`Đã tải lên "${uploaded.name}".`);
      await loadMaterials();
      setIsUploadOpen(false);
      window.dispatchEvent(new CustomEvent("course-materials-changed"));
      router.refresh();
    } else {
      toast.error(
        res.error ??
          res.message ??
          "Tệp đã tải lên nhưng chưa lưu được vào cơ sở dữ liệu.",
      );
    }

    setIsSavingUpload(false);
  }

  return (
    <div className="space-y-5 pt-8">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Tổng số tệp
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">
              {materials.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Dung lượng đã dùng
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">
              {formatBytes(totalBytes)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger
              render={
                <Button className="gap-2 rounded-xl bg-sky-500 text-white hover:bg-sky-600" />
              }
            >
              <Plus size={16} />
              Tải lên tài liệu
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl overflow-hidden p-6 sm:max-w-2xl md:max-w-3xl">
              <DialogHeader className="min-w-0">
                <DialogTitle>Tải tài liệu khóa học</DialogTitle>
                <DialogDescription>
                  Chọn bài học chứa tài liệu này, sau đó tải lên qua
                  UploadThing.
                </DialogDescription>
              </DialogHeader>

              <div className="min-w-0 space-y-5 overflow-hidden">
                <div className="min-w-0 space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Bài học đích
                  </label>
                  <Select
                    value={selectedLessonId}
                    onValueChange={(value) => {
                      if (value) setSelectedLessonId(value);
                    }}
                  >
                    <SelectTrigger className="h-10 w-full min-w-0 max-w-full overflow-hidden">
                      <SelectValue className="min-w-0 truncate">
                        <span
                          className="block min-w-0 max-w-full truncate"
                          title={selectedLessonLabel}
                        >
                          {selectedLessonLabel || "Chọn bài học"}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="start" className="max-h-80">
                      {availableLessons.map((lesson) => (
                        <SelectItem key={lesson.id} value={lesson.id}>
                          {formatLocation(lesson.moduleTitle, lesson.title)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative min-w-0 max-w-full overflow-hidden">
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
                      toast.error(error.message || "Tải lên thất bại.");
                    }}
                    appearance={{
                      container:
                        "box-border min-h-64 w-full min-w-0 max-w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/30 px-6 py-12 transition-all hover:cursor-pointer hover:border-sky-500/40 hover:bg-sky-500/5 ut-state-dragover:border-sky-500 ut-state-dragover:bg-sky-500/10",
                      uploadIcon: "size-12 text-sky-500",
                      label:
                        "cursor-pointer text-sm font-medium text-sky-500 transition-colors hover:cursor-pointer hover:text-primary/80",
                      allowedContent: "text-xs text-muted-foreground",
                      button:
                        "inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:cursor-pointer hover:bg-primary/90",
                    }}
                    content={{
                      allowedContent:
                        "Tệp PDF, video và hình ảnh sẽ được lưu trên UploadThing.",
                    }}
                  />
                  {(isSavingUpload || availableLessons.length === 0) && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/75 backdrop-blur-sm">
                      <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                        {isSavingUpload ? (
                          <Loader2
                            size={15}
                            className="animate-spin text-sky-600"
                          />
                        ) : (
                          <UploadCloud size={15} className="text-slate-400" />
                        )}
                        {isSavingUpload
                          ? "Đang lưu tài liệu..."
                          : "Hãy tạo bài học trước khi tải tài liệu lên."}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin text-sky-500" />
            Đang tải tài liệu...
          </div>
        ) : materials.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <UploadCloud size={28} className="text-slate-300" />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Chưa có tài liệu nào.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Tải tệp lên từ bảng này hoặc từ trình chỉnh sửa bài học.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4 py-3">Tên</TableHead>
                <TableHead className="px-4 py-3">Loại</TableHead>
                <TableHead className="px-4 py-3">Dung lượng</TableHead>
                <TableHead className="px-4 py-3">Bài học</TableHead>
                <TableHead className="px-4 py-3">Trạng thái AI</TableHead>
                <TableHead className="px-4 py-3 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material) => {
                const isFresh = isGeminiSyncFresh(material);
                const isResyncing = resyncingId === material.id;
                const fullLocation = `${material.lesson.module.title} > ${material.lesson.title}`;

                return (
                  <TableRow key={material.id}>
                    <TableCell className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <MaterialIcon type={material.materialType} />
                        <span
                          className="max-w-37.5 truncate font-medium text-slate-800"
                          title={material.title}
                        >
                          {material.title}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <MaterialTypeBadge type={material.materialType} />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {formatBytes(material.fileSizeBytes)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className="block max-w-40 truncate text-muted-foreground"
                        title={fullLocation}
                      >
                        {compactTitle(material.lesson.title)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1.5",
                          isFresh
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            isFresh ? "bg-emerald-500" : "bg-amber-500",
                          )}
                        />
                        {isFresh ? "Đã đồng bộ" : "Hết hạn / Chưa đồng bộ"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <a
                          href={`/api/materials/${material.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-slate-500 hover:bg-sky-50 hover:text-sky-600"
                            aria-label={`Tải xuống ${material.title}`}
                          >
                            <Download size={15} />
                          </Button>
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isResyncing || isBulkResyncing}
                          onClick={() => void handleResync(material.id)}
                          className="gap-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          {isResyncing ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Sparkles size={14} />
                          )}
                          Đồng bộ AI
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeletingId(material.id)}
                          className="text-slate-500 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Xóa ${material.title}`}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={isBulkResyncing || expiredMaterials.length === 0}
          onClick={() => void handleBulkResyncExpired()}
          className="gap-2 px-4 rounded-xl text-white bg-indigo-600 hover:text-white hover:bg-indigo-700 cursor-pointer"
        >
          {isBulkResyncing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          Đồng bộ lại tất cả
        </Button>
      </div>

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa tài liệu?</AlertDialogTitle>
            <AlertDialogDescription>
              Thao tác này xóa tệp khỏi UploadThing và xóa bản ghi trong cơ sở
              dữ liệu. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              className="gap-2"
            >
              {isDeleting && <Loader2 size={14} className="animate-spin" />}
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
