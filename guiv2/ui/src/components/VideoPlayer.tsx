import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl?: string;
  currentTime?: number; // Current position in timeline (epoch ms)
  videoStartTime?: number; // When this video starts on timeline (epoch ms)
  isPlaying?: boolean;
  onVideoTimeUpdate?: (videoTimeMs: number) => void;
  className?: string;
}

export function VideoPlayer({
  videoUrl,
  currentTime,
  videoStartTime,
  isPlaying = false,
  onVideoTimeUpdate,
  className = '',
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  // Sync video playback with timeline position
  useEffect(() => {
    if (!videoRef.current || !videoUrl || !videoReady) return;
    if (currentTime === undefined || videoStartTime === undefined) return;

    const video = videoRef.current;
    const elapsedMs = currentTime - videoStartTime;
    const targetVideoTime = Math.max(0, elapsedMs / 1000); // seconds

    // Only seek if difference is significant (>0.5s) to avoid jitter
    const currentVideoTime = video.currentTime;
    const diff = Math.abs(currentVideoTime - targetVideoTime);

    if (diff > 0.5) {
      video.currentTime = targetVideoTime;
    }

    // Sync play/pause
    if (isPlaying && video.paused) {
      video.play().catch(() => {
        // Ignore play errors (user interaction required, etc.)
      });
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [currentTime, videoStartTime, isPlaying, videoUrl, videoReady]);

  // Handle video loaded
  const handleLoadedMetadata = () => {
    setVideoReady(true);
  };

  // Handle video time update
  const handleTimeUpdate = () => {
    if (videoRef.current && onVideoTimeUpdate) {
      const videoTimeMs = videoRef.current.currentTime * 1000;
      onVideoTimeUpdate(videoTimeMs);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  if (!videoUrl) {
    return (
      <div
        className={`w-full h-full bg-gray-900 rounded-lg flex items-center justify-center ${className}`}
      >
        <div className="text-center text-gray-400">
          <Play className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No video selected</p>
          <p className="text-xs mt-1">Upload a video and position it on the timeline</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full bg-black rounded-lg overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        playsInline
        muted={muted}
      />

      {/* Video controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mute toggle */}
            <button
              onClick={toggleMute}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Video info */}
          {videoReady && videoRef.current && (
            <div className="text-white text-xs">
              {formatTime(videoRef.current.currentTime)} /{' '}
              {formatTime(videoRef.current.duration)}
            </div>
          )}
        </div>
      </div>

      {/* Loading indicator */}
      {!videoReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white text-sm">Loading video...</div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
