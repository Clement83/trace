import React, { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";

interface TimelineProps {
  startTime?: number;
  endTime?: number;
  currentTime: number;
  onTimeChange: (time: number) => void;
  playing?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  className?: string;
}

export function Timeline({
  startTime = 0,
  endTime = 100,
  currentTime,
  onTimeChange,
  playing = false,
  onPlayingChange,
  className = "",
}: TimelineProps) {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const duration = endTime - startTime;
  const percentage =
    duration > 0 ? ((currentTime - startTime) / duration) * 100 : 0;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updatePosition(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      updatePosition(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updatePosition = (clientX: number) => {
    if (!trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = x / rect.width;
    const newTime = startTime + duration * percent;
    onTimeChange(newTime);
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if (
      e.target === trackRef.current ||
      (e.target as HTMLElement).closest(".timeline-track")
    ) {
      updatePosition(e.clientX);
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className={`w-full select-none ${className}`}>
      {/* Timeline Controls */}
      <div className="flex items-center gap-4">
        {/* Play/Pause Button */}
        {onPlayingChange && (
          <button
            onClick={() => onPlayingChange(!playing)}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg"
          >
            {playing ? (
              <Pause className="w-5 h-5" fill="currentColor" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
            )}
          </button>
        )}

        {/* Timeline Track */}
        <div className="flex-1 relative">
          <div
            ref={trackRef}
            className="timeline-track relative h-2 bg-gray-200 rounded-full cursor-pointer group"
            onClick={handleTrackClick}
          >
            {/* Progress Bar */}
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
            />

            {/* Scrubber Handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all cursor-grab active:cursor-grabbing"
              style={{ left: `${Math.min(100, Math.max(0, percentage))}%` }}
              onMouseDown={handleMouseDown}
            >
              <div className="relative">
                {/* Outer glow on hover/drag */}
                <div
                  className={`absolute inset-0 w-5 h-5 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 bg-indigo-400 rounded-full blur-sm transition-opacity ${
                    isDragging || "opacity-0 group-hover:opacity-100"
                  }`}
                />

                {/* Main handle */}
                <div
                  className={`relative w-4 h-4 bg-white border-2 border-indigo-600 rounded-full shadow-lg transition-transform ${
                    isDragging ? "scale-125" : "group-hover:scale-110"
                  }`}
                >
                  <div className="absolute inset-1 bg-indigo-600 rounded-full" />
                </div>
              </div>

              {/* Time tooltip */}
              {isDragging && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap shadow-lg">
                  {formatTime(currentTime)}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900" />
                </div>
              )}
            </div>
          </div>

          {/* Time markers (optional, for visual reference) */}
          <div className="flex justify-between mt-1 px-0.5 text-xs text-gray-400">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
