import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../Card";
import { Button } from "../Button";
import { Timeline } from "../Timeline";
import { VideoTimeline } from "../VideoTimeline";
import { Clock, Plus, Minus, Video, Film, Download } from "lucide-react";
import { formatDuration } from "../../utils/formatters";
import type { KmlSummary, VideoMeta, JobState } from "../../types";

interface TimelineSectionProps {
  kmlSummary?: KmlSummary;
  videos: VideoMeta[];
  currentTime: number;
  playing: boolean;
  currentVideoName: string | null;
  projectName: string;
  jobStates: Map<string, JobState>;
  onTimeChange: (time: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onVideoPositionChange: (videoName: string, newStart: number) => void;
  onVideoClick: (videoName: string) => void;
  onStepMouseDown: (direction: 1 | -1) => void;
  onStepMouseUp: () => void;
  onEncodeVideo: (videoName: string) => void;
  // Persisted workspace-level lock state for video editing (stored in meta.json)
  videoEditingLocked?: boolean;
  onToggleVideoEditingLocked?: (locked: boolean) => void;
}

export function TimelineSection({
  kmlSummary,
  videos,
  currentTime,
  playing,
  currentVideoName,
  projectName,
  jobStates,
  onTimeChange,
  onPlayingChange,
  onVideoPositionChange,
  onVideoClick,
  onStepMouseDown,
  onStepMouseUp,
  onEncodeVideo,
  // forwarded persisted lock state + toggle handler
  videoEditingLocked,
  onToggleVideoEditingLocked,
}: TimelineSectionProps) {
  const kml = kmlSummary;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          {/* Left: Title + Duration */}
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Timeline
            {kml && kml.durationMs && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({formatDuration(kml.durationMs)})
              </span>
            )}
          </CardTitle>

          {/* Center: Step buttons + Current time */}
          {kml && kml.start && kml.end && (
            <div className="flex items-center gap-2">
              <button
                onMouseDown={() => onStepMouseDown(-1)}
                onMouseUp={onStepMouseUp}
                onMouseLeave={onStepMouseUp}
                disabled={currentTime <= kml.start}
                className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:bg-gray-400"
                title="Reculer d'1 seconde (maintenir pour continu)"
              >
                <Minus className="w-4 h-4" />
              </button>

              <span className="font-mono text-sm font-semibold text-gray-900 min-w-[90px] text-center">
                {new Date(currentTime).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}
              </span>

              <button
                onMouseDown={() => onStepMouseDown(1)}
                onMouseUp={onStepMouseUp}
                onMouseLeave={onStepMouseUp}
                disabled={currentTime >= kml.end}
                className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:bg-gray-400"
                title="Avancer d'1 seconde (maintenir pour continu)"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Right: Start and End times */}
          {kml && kml.start && kml.end && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                Début: {new Date(kml.start).toLocaleTimeString("fr-FR")}
              </span>
              <span>•</span>
              <span>Fin: {new Date(kml.end).toLocaleTimeString("fr-FR")}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {kml && kml.start && kml.end ? (
          <>
            <Timeline
              startTime={kml.start}
              endTime={kml.end}
              currentTime={currentTime}
              onTimeChange={onTimeChange}
              playing={playing}
              onPlayingChange={onPlayingChange}
            />
            {/* Video Timeline - synchronized below main timeline */}
            {videos.length > 0 && (
              <VideoTimeline
                videos={videos.map((v) => ({
                  name: v.name,
                  timelineStart: v.timelineStart,
                  timelineEnd: v.timelineEnd,
                  durationMs: v.durationMs || undefined,
                  color: v.color,
                }))}
                startTime={kml.start}
                endTime={kml.end}
                currentTime={currentTime}
                onVideoPositionChange={onVideoPositionChange}
                onVideoClick={onVideoClick}
                onEncodeVideo={onEncodeVideo}
                currentVideoName={currentVideoName ?? undefined}
                // Forward persisted lock state and toggle handler to the VideoTimeline component
                locked={videoEditingLocked ?? false}
                onToggleLocked={(locked: boolean) => {
                  // Prefer calling the provided toggle handler if present
                  if (onToggleVideoEditingLocked) {
                    onToggleVideoEditingLocked(locked);
                  }
                }}
              />
            )}
          </>
        ) : (
          <p className="text-gray-500 text-sm">No timeline data available</p>
        )}
      </CardContent>
    </Card>
  );
}
