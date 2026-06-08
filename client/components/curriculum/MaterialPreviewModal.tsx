"use client";

import { Download, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PdfViewer } from "@/components/viewers/PdfViewer";
import { VideoPlayer } from "@/components/viewers/VideoPlayer";

export interface PreviewMaterial {
  id: string;
  title: string;
  fileUrl: string;
  materialType: "PDF" | "VIDEO" | "LINK" | "OTHER";
}

interface MaterialPreviewModalProps {
  material: PreviewMaterial | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isImageUrl(fileUrl: string) {
  try {
    const pathname = new URL(fileUrl).pathname.toLowerCase();
    return /\.(jpe?g|png|gif|webp|avif)$/.test(pathname);
  } catch {
    return /\.(jpe?g|png|gif|webp|avif)$/i.test(fileUrl);
  }
}

function MaterialPreview({ material }: { material: PreviewMaterial }) {
  if (material.materialType === "PDF") {
    return (
      <PdfViewer
        url={material.fileUrl}
        title={material.title}
        className="h-[calc(90vh-11rem)] min-h-[32rem]"
      />
    );
  }

  if (material.materialType === "VIDEO") {
    return <VideoPlayer src={material.fileUrl} title={material.title} />;
  }

  if (isImageUrl(material.fileUrl)) {
    return (
      <div className="flex max-h-[calc(90vh-11rem)] items-center justify-center overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={material.fileUrl}
          alt={material.title}
          className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
        <FileWarning size={24} />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">
          Preview is not available for this file type.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Download the material to view it with the appropriate app.
        </p>
      </div>
      <a
        href={`/api/materials/${material.id}/download`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button type="button" className="gap-2">
          <Download size={15} />
          Download Material
        </Button>
      </a>
    </div>
  );
}

export function MaterialPreviewModal({
  material,
  open,
  onOpenChange,
}: MaterialPreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-6xl overflow-hidden p-0 sm:max-w-6xl">
        {material && (
          <>
            <DialogHeader className="border-b border-slate-100 px-5 py-4">
              <DialogTitle className="truncate pr-10">{material.title}</DialogTitle>
              <DialogDescription>
                Preview the uploaded material before students use it.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[calc(90vh-7rem)] overflow-auto p-4">
              <MaterialPreview material={material} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
