import React, { useState, useRef } from "react";
import {
  Film,
  ChevronLeft,
  ChevronRight,
  Video,
  Lock,
  Unlock,
} from "lucide-react";

interface VideoTimelineItem {
  name: string;
  timelineStart?: number; // epoch ms
  timelineEnd?: number; // epoch ms
  durationMs?: number;
  color?: string;
}

interface VideoTimelineProps {
  videos: VideoTimelineItem[];
  startTime: number; // timeline start (epoch ms)
  endTime: number; // timeline end (epoch ms)
  currentTime: number; // current position (epoch ms)
  onVideoPositionChange?: (videoName: string, newStart: number) => void;
  onVideoClick?: (videoName: string) => void;
  onEncodeVideo?: (videoName: string) => void;
  className?: string;
  currentVideoName?: string; // Currently selected video name

  // Persisted / parent-controlled lock state for edits (stored in workspace meta.json)
  locked?: boolean;
  // Called when user toggles lock; parent can persist the change
  onToggleLocked?: (locked: boolean) => void;
}

interface DragState {
  videoName: string;
  newStart: number;
}

export function VideoTimeline({
  videos,
  startTime,
  endTime,
  currentTime,
  onVideoPositionChange,
  onVideoClick,
  onEncodeVideo,
  className = "",
  currentVideoName,
  // parent-controlled lock props
  locked,
  onToggleLocked,
}: VideoTimelineProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  // Local lock fallback when parent doesn't control lock state
  const [localLocked, setLocalLocked] = useState(false);
  // resolved lock state: prefer parent prop when provided
  const lockedState = typeof locked !== "undefined" ? locked : localLocked;
  const trackRef = useRef<HTMLDivElement>(null);

  const duration = endTime - startTime;

  // Calculate position and width for each video
  const getVideoStyle = (video: VideoTimelineItem) => {
    if (!video.timelineStart || duration <= 0) {
      return { left: "0%", width: "0%", visible: false };
    }

    // Use drag state for temporary position during drag
    let start = video.timelineStart;
    if (dragState && dragState.videoName === video.name) {
      start = dragState.newStart;
    }

    const end = video.timelineEnd || start + (video.durationMs || 0);
    const videoDuration = end - start;

    // Calculate percentage positions
    const leftPercent = ((start - startTime) / duration) * 100;
    const widthPercent = (videoDuration / duration) * 100;

    // Check if video is within visible timeline range
    const visible = start < endTime && end > startTime;

    return {
      left: `${Math.max(0, Math.min(100, leftPercent))}%`,
      width: `${Math.max(1, Math.min(100, widthPercent))}%`,
      visible,
    };
  };

  const handleMouseDown = (e: React.MouseEvent, video: VideoTimelineItem) => {
    if (lockedState) return;
    if (!trackRef.current || !video.timelineStart) return;

    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    const clickTime = startTime + duration * clickPercent;

    // Calculate offset between click position and video start
    setDragOffset(clickTime - video.timelineStart);
    setDragState({ videoName: video.name, newStart: video.timelineStart });

    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragState || !trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const newTime = startTime + duration * percent - dragOffset;

    // Clamp to timeline bounds
    const clampedTime = Math.max(startTime, Math.min(endTime, newTime));

    // Update local drag state (visual feedback only, no HTTP call)
    setDragState({ videoName: dragState.videoName, newStart: clampedTime });
  };

  const handleMouseUp = () => {
    // Save position to backend only when drop happens (ONE HTTP call)
    if (dragState && onVideoPositionChange) {
      onVideoPositionChange(dragState.videoName, dragState.newStart);
    }

    setDragState(null);
    setDragOffset(0);
  };

  // Handle drag events
  React.useEffect(() => {
    if (dragState) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragState, dragOffset, startTime, endTime, duration]);

  const handleVideoClick = (videoName: string) => {
    // Clicking should always center/jump to the video even when edits are locked.
    // Only movement (drag/arrow changes) is blocked by the lock.
    if (onVideoClick) {
      onVideoClick(videoName);
    }
  };

  if (videos.length === 0) {
    return (
      <div
        className={`w-full h-16 bg-gray-100 rounded flex items-center justify-center ${className}`}
      >
        <div className="text-gray-400 text-sm flex items-center gap-2">
          <Film className="w-4 h-4" />
          <span>No videos added yet</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Label */}
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-gray-500 font-medium">Video Tracks</div>
        <button
          onClick={() => {
            // prefer parent handler if provided so it can persist state
            if (typeof onToggleLocked === "function") {
              onToggleLocked(!lockedState);
            } else {
              setLocalLocked((s) => !s);
            }
          }}
          title={lockedState ? "Unlock editing" : "Lock editing"}
          className={`ml-2 p-1 rounded ${
            lockedState
              ? "bg-gray-200 text-gray-700"
              : "bg-white text-gray-600 hover:bg-gray-50"
          } border border-gray-200`}
        >
          {lockedState ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 15v2m0-8a3 3 0 00-3 3v1h6v-1a3 3 0 00-3-3z"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          )}
        </button>
      </div>

      {/* Video timeline track */}
      <div
        ref={trackRef}
        className="relative h-16 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden select-none"
        style={{ cursor: dragState ? "grabbing" : "default" }}
      >
        {/* Grid lines for visual reference */}
        <div className="absolute inset-0 flex">
          {[0, 25, 50, 75, 100].map((percent) => (
            <div
              key={percent}
              className="absolute top-0 bottom-0 w-px bg-gray-300/30"
              style={{ left: `${percent}%` }}
            />
          ))}
        </div>

        {/* Video blocks */}
        {videos.map((video, idx) => {
          const style = getVideoStyle(video);
          if (!style.visible) return null;

          const isDragging = dragState?.videoName === video.name;

          return (
            <div
              key={video.name}
              className={`absolute top-1 bottom-1 rounded transition-all ${
                lockedState ? "" : "cursor-grab active:cursor-grabbing"
              } ${
                isDragging
                  ? "ring-2 ring-white ring-opacity-50 shadow-lg z-10"
                  : "hover:shadow-md"
              }`}
              style={{
                left: style.left,
                width: style.width,
                backgroundColor: video.color || "#4F46E5",
                opacity: isDragging ? 0.8 : lockedState ? 0.7 : 0.9,
              }}
              onMouseDown={(e) => {
                // Dragging is blocked when lockedState/local lock is enabled.
                if (!lockedState) handleMouseDown(e, video);
              }}
              onClick={() => {
                // Clicking still centers/jumps even when locked.
                handleVideoClick(video.name);
              }}
              title={`${video.name}\nDuration: ${formatDuration(
                video.durationMs || 0
              )}`}
            >
              {/* Drag tooltip */}
              {isDragging && dragState && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap z-50">
                  {new Date(dragState.newStart).toLocaleTimeString()}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900" />
                </div>
              )}
              {/* Video label */}
              <div className="absolute inset-0 flex items-center px-2 text-white text-xs font-medium overflow-hidden">
                <Film className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">{video.name}</span>
              </div>

              {/* Resize handles (optional - for future enhancement) */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/30 cursor-ew-resize" />
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/30 cursor-ew-resize" />
            </div>
          );
        })}

        {/* Current time indicator line (extends into video track) */}
        {currentTime >= startTime && currentTime <= endTime && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
            style={{
              left: `${((currentTime - startTime) / duration) * 100}%`,
            }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
          </div>
        )}
      </div>

      {/* Video Controls - Show controls for currently selected video */}
      {currentVideoName &&
        (() => {
          const currentVideo = videos.find((v) => v.name === currentVideoName);
          if (!currentVideo || !currentVideo.timelineStart) return null;

          return (
            <div className="mt-3 flex items-center justify-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div
                  className="w-3 h-3 rounded flex-shrink-0"
                  style={{ backgroundColor: currentVideo.color || "#4F46E5" }}
                />
                <span className="font-medium truncate max-w-[200px]">
                  {currentVideo.name}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (onVideoPositionChange && currentVideo.timelineStart) {
                      const newStart = currentVideo.timelineStart - 1000;
                      const clampedStart = Math.max(startTime, newStart);
                      onVideoPositionChange(currentVideo.name, clampedStart);
                    }
                  }}
                  className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Reculer la vidéo de 1 seconde"
                  disabled={
                    lockedState ||
                    !currentVideo.timelineStart ||
                    currentVideo.timelineStart <= startTime
                  }
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-xs text-gray-500 font-mono min-w-[80px] text-center">
                  {currentVideo.timelineStart
                    ? new Date(currentVideo.timelineStart).toLocaleTimeString(
                        "fr-FR",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        }
                      )
                    : "--:--:--"}
                </span>

                <button
                  onClick={() => {
                    if (onVideoPositionChange && currentVideo.timelineStart) {
                      const videoDuration = currentVideo.durationMs || 0;
                      const videoEnd =
                        currentVideo.timelineStart + videoDuration;
                      const newStart = currentVideo.timelineStart + 1000;
                      const maxStart = endTime - videoDuration;
                      const clampedStart = Math.min(maxStart, newStart);
                      onVideoPositionChange(currentVideo.name, clampedStart);
                    }
                  }}
                  className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Avancer la vidéo de 1 seconde"
                  disabled={
                    lockedState ||
                    !currentVideo.timelineStart ||
                    !currentVideo.durationMs ||
                    currentVideo.timelineStart + currentVideo.durationMs >=
                      endTime
                  }
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Encode button */}
              {onEncodeVideo && (
                <button
                  onClick={() => onEncodeVideo(currentVideo.name)}
                  className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Encoder cette vidéo avec l'overlay de vitesse"
                >
                  <Video className="w-4 h-4" />
                  Start Encode
                </button>
              )}
            </div>
          );
        })()}
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
}
