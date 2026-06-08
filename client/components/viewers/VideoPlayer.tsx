"use client";

import { useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  src: string;
  title?: string;
  className?: string;
}

const PLAYBACK_SPEEDS = ["0.5", "0.75", "1", "1.25", "1.5", "2"] as const;

export function VideoPlayer({ src, title = "Video material", className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackRate, setPlaybackRate] = useState<(typeof PLAYBACK_SPEEDS)[number]>("1");

  function handlePlaybackRateChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextRate = event.target.value as (typeof PLAYBACK_SPEEDS)[number];
    setPlaybackRate(nextRate);

    if (videoRef.current) {
      videoRef.current.playbackRate = Number(nextRate);
    }
  }

  async function handleFullscreen() {
    if (!videoRef.current) return;
    await videoRef.current.requestFullscreen().catch(() => undefined);
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm",
        className,
      )}
    >
      <video
        ref={videoRef}
        src={src}
        title={title}
        controls
        preload="metadata"
        className="aspect-video w-full bg-black"
      >
        <track kind="captions" />
        Your browser does not support the video tag.
      </video>

      <div className="flex flex-col gap-3 border-t border-white/10 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-xs text-slate-300">HTML5 video player</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-300" htmlFor="video-playback-rate">
            Speed
          </label>
          <NativeSelect
            id="video-playback-rate"
            size="sm"
            value={playbackRate}
            onChange={handlePlaybackRateChange}
            className="text-slate-900"
          >
            {PLAYBACK_SPEEDS.map((speed) => (
              <NativeSelectOption key={speed} value={speed}>
                {speed}x
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleFullscreen}
            className="gap-1.5 bg-white text-slate-900 hover:bg-slate-100"
          >
            <Maximize2 size={14} />
            Fullscreen
          </Button>
        </div>
      </div>
    </div>
  );
}
