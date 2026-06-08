import { cn } from "@/lib/utils";

interface PdfViewerProps {
  url: string;
  title?: string;
  className?: string;
}

export function PdfViewer({ url, title = "PDF preview", className }: PdfViewerProps) {
  return (
    <iframe
      src={url}
      title={title}
      className={cn(
        "h-[50rem] w-full rounded-xl border border-slate-200 bg-white",
        className,
      )}
    />
  );
}
