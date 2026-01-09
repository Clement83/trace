import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Modal, ModalFooter } from "../components/Modal";
import { MapCard } from "../components/map/MapCard";
import {
  KMLNodeInfoCard,
  VideoOverlayOptions,
} from "../components/map/KMLNodeInfoCard";
import { TimelineSection } from "../components/timeline/TimelineSection";
import { VideoPlayerCard } from "../components/video/VideoPlayerCard";
import { VideoList } from "../components/video/VideoList";
import { JobsCard } from "../components/jobs/JobsCard";
import { UploadVideoModal } from "../components/workspace/UploadVideoModal";
import { Upload, Trash2 } from "lucide-react";
import { useWorkspaceData } from "../hooks/useWorkspaceData";
import { useJobManager } from "../hooks/useJobManager";
import { useTimelinePlayer } from "../hooks/useTimelinePlayer";
import { fetchJSON, getApiUrl } from "../utils/api";
import type { VideoMeta } from "../types";

export function WorkspaceViewPage() {
  const params = useParams<{ projectName: string }>();
  const navigate = useNavigate();
  const projectName = params.projectName!;

  // Redirect if no project name
  if (!params.projectName) {
    navigate("/workspaces");
    return null;
  }

  const { meta, loading, error, setError, loadMeta } =
    useWorkspaceData(projectName);
  const { jobStates, lastJobActivity, attachJobSSE } = useJobManager(() =>
    loadMeta(true),
  );
  const {
    currentTime,
    setCurrentTime,
    playing,
    setPlaying,
    currentPosition,
    handleStepMouseDown,
    handleStepMouseUp,
  } = useTimelinePlayer(meta?.kmlSummary);

  const [showUpload, setShowUpload] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentVideoName, setCurrentVideoName] = useState<string | null>(null);
  const [jobsCollapsed, setJobsCollapsed] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [overlayOptions, setOverlayOptions] = useState<VideoOverlayOptions>({
    showSpeed: true,
    showAltitude: false,
    showCoordinates: false,
    showTime: false,
    showMap: false,
  });

  // Persisted lock state for video editing (stored per-workspace in meta.json)
  const [videoEditingLocked, setVideoEditingLocked] = useState<boolean>(false);

  // Load persisted lock state when the workspace/meta is available
  useEffect(() => {
    let mounted = true;
    async function loadLock() {
      if (!projectName) return;
      try {
        const resp = await fetchJSON(
          `/api/workspaces/${encodeURIComponent(projectName)}/lock`,
        );
        if (mounted && resp && typeof resp.locked === "boolean") {
          setVideoEditingLocked(!!resp.locked);
        }
      } catch (err: any) {
        // Non-fatal: show warning in console and optionally surface to UI via setError
        console.warn("Failed to load workspace lock state:", err);
      }
    }
    loadLock();
    return () => {
      mounted = false;
    };
  }, [projectName]);

  // Persist lock state to server and update local state
  async function persistVideoEditingLocked(locked: boolean) {
    try {
      await fetchJSON(
        `/api/workspaces/${encodeURIComponent(projectName)}/lock`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locked }),
        },
      );
      setVideoEditingLocked(locked);
    } catch (err: any) {
      console.error("Failed to persist video editing lock:", err);
      // Surface error to user if workspace hook exposes setError
      try {
        setError?.(err?.message ?? String(err));
      } catch {
        // ignore if setError unavailable
      }
      // keep local state unchanged on failure (or optionally revert)
    }
  }

  // Reconnect to running encode jobs after loading metadata
  useEffect(() => {
    if (!meta?.videos) return;

    for (const video of meta.videos) {
      if (video.encodeStatus === "running" && video.encodeJobId) {
        if (!jobStates.has(video.encodeJobId)) {
          console.log(
            `[Encode] Reconnecting to job ${video.encodeJobId} for ${video.name}`,
          );
          attachJobSSE(video.encodeJobId, video.name);
        }
      }
    }
  }, [meta?.videos]);

  // Determine which video should be playing at current time
  const currentVideo = useMemo(() => {
    if (!meta?.videos || meta.videos.length === 0) return null;

    const video = meta.videos.find(
      (v) =>
        v.timelineStart !== undefined &&
        v.timelineEnd !== undefined &&
        currentTime >= v.timelineStart &&
        currentTime < v.timelineEnd,
    );

    return video || null;
  }, [currentTime, meta?.videos]);

  // Update currentVideoName when currentVideo changes
  useEffect(() => {
    if (currentVideo) {
      setCurrentVideoName(currentVideo.name);
    }
  }, [currentVideo]);

  // Get video URL for current video
  const currentVideoUrl = useMemo(() => {
    if (!currentVideo || !currentVideo.sdPath) return undefined;
    return getApiUrl(
      `/api/workspaces/${encodeURIComponent(
        projectName,
      )}/videos/${encodeURIComponent(currentVideo.name)}/sd`,
    );
  }, [currentVideo, projectName]);

  // Handle video position update
  async function handleVideoPositionChange(
    videoName: string,
    newStart: number,
  ) {
    try {
      await fetchJSON(
        `/api/workspaces/${encodeURIComponent(
          projectName,
        )}/videos/${encodeURIComponent(videoName)}/position`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timelineStart: newStart }),
        },
      );
      await loadMeta(true);
    } catch (err: any) {
      console.error("Failed to update video position:", err);
    }
  }

  // Handle video click (jump to video start)
  function handleVideoClick(videoName: string) {
    const video = meta?.videos?.find((v) => v.name === videoName);
    if (video && video.timelineStart !== undefined) {
      setCurrentTime(video.timelineStart);
      setCurrentVideoName(videoName);
    }
  }

  // Add video to timeline
  async function addVideoToTimeline(videoName: string, timelineStart?: number) {
    try {
      await fetchJSON(
        `/api/workspaces/${encodeURIComponent(
          projectName,
        )}/videos/${encodeURIComponent(videoName)}/add-to-timeline`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timelineStart }),
        },
      );
      await loadMeta(true);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  }

  // Remove video from timeline
  async function removeVideoFromTimeline(videoName: string) {
    try {
      await fetchJSON(
        `/api/workspaces/${encodeURIComponent(
          projectName,
        )}/videos/${encodeURIComponent(videoName)}/remove-from-timeline`,
        { method: "PATCH" },
      );
      await loadMeta(true);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  }

  // Delete video completely
  async function deleteVideo(videoName: string) {
    if (
      !confirm(
        `Êtes-vous sûr de vouloir supprimer définitivement la vidéo "${videoName}" ?\n\nCette action est irréversible.`,
      )
    ) {
      return;
    }

    try {
      await fetchJSON(
        `/api/workspaces/${encodeURIComponent(
          projectName,
        )}/videos/${encodeURIComponent(videoName)}`,
        { method: "DELETE" },
      );
      await loadMeta(true);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  }

  // Upload videos
  async function uploadVideos(files: FileList) {
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("file", f));

    setUploading(true);
    setUploadProgress(0);
    setShowUpload(false);

    try {
      const url = getApiUrl(
        `/api/workspaces/${encodeURIComponent(projectName)}/videos`,
      );
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      const uploadPromise = new Promise<string>((resolve, reject) => {
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.responseText);
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.addEventListener("abort", () =>
          reject(new Error("Upload aborted")),
        );
      });

      xhr.open("POST", url);
      xhr.send(form);

      const text = await uploadPromise;
      const data = JSON.parse(text);

      if (data.jobs && Array.isArray(data.jobs)) {
        data.jobs.forEach((j: any) => {
          attachJobSSE(j.jobId, j.videoName);
        });
      }
      loadMeta(true);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  // Encode video
  async function encodeVideo(videoName: string) {
    try {
      const video = meta?.videos?.find((v) => v.name === videoName);
      if (!video) {
        throw new Error("Vidéo introuvable");
      }

      if (!video.timelineStart || !meta?.kmlSummary) {
        throw new Error(
          "La vidéo doit être placée sur la timeline avant l'encodage",
        );
      }

      const offsetSeconds =
        (video.timelineStart - (meta.kmlSummary.start ?? 0)) / 1000;

      const response = await fetch(getApiUrl("/api/encode"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace: projectName,
          video_name: videoName,
          offset: offsetSeconds,
          kml_offset_seconds: offsetSeconds,
          show_speed: overlayOptions.showSpeed,
          show_altitude: overlayOptions.showAltitude,
          show_coordinates: overlayOptions.showCoordinates,
          show_time: overlayOptions.showTime,
          show_map: overlayOptions.showMap,
          speed_unit: "kmh",
          speed_pos: "bottom-right",
          speed_size: "medium",
          verbose: 1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Échec du démarrage de l'encodage");
      }

      const { jobId } = await response.json();
      console.log(`[Encode] Job démarré: ${jobId} pour ${videoName}`);
      attachJobSSE(jobId, videoName);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[Encode] Erreur:`, error);
      setError(`Erreur d'encodage: ${errorMessage}`);
    }
  }

  // Delete workspace
  async function handleDeleteWorkspace() {
    setDeleting(true);
    try {
      await fetchJSON(`/api/workspaces/${encodeURIComponent(projectName)}`, {
        method: "DELETE",
      });
      navigate("/workspaces");
    } catch (err: any) {
      setError(err.message || "Failed to delete workspace");
    } finally {
      setDeleting(false);
    }
  }

  if (loading && !meta) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const videos = meta?.videos ?? [];
  const jobsArray = Array.from(jobStates.values()).sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/workspaces")}
            className="mb-4"
          >
            ← Back to Workspaces
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {projectName}
              </h1>
              <p className="text-gray-600">Workspace overview and controls</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
                icon={<Trash2 className="w-4 h-4" />}
              >
                Delete Workspace
              </Button>
              <Button
                onClick={() => setShowUpload(true)}
                icon={<Upload className="w-4 h-4" />}
                disabled={uploading}
              >
                {uploading ? "Upload en cours..." : "Upload Video"}
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="inline-block w-5 h-5 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-indigo-900 font-medium">
                Upload en cours... {uploadProgress.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-indigo-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            <MapCard
              kmlSummary={meta?.kmlSummary}
              currentPosition={currentPosition}
              videos={videos}
            />
            <TimelineSection
              kmlSummary={meta?.kmlSummary}
              videos={videos}
              currentTime={currentTime}
              playing={playing}
              currentVideoName={currentVideoName}
              projectName={projectName}
              jobStates={jobStates}
              onTimeChange={setCurrentTime}
              onPlayingChange={setPlaying}
              onVideoPositionChange={handleVideoPositionChange}
              onVideoClick={handleVideoClick}
              onStepMouseDown={handleStepMouseDown}
              onStepMouseUp={handleStepMouseUp}
              onEncodeVideo={encodeVideo}
              videoEditingLocked={videoEditingLocked}
              onToggleVideoEditingLocked={persistVideoEditingLocked}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <VideoPlayerCard
              currentVideo={currentVideo}
              currentVideoUrl={currentVideoUrl}
              currentTime={currentTime}
              isPlaying={playing}
              projectName={projectName}
            />
            <KMLNodeInfoCard
              currentPosition={currentPosition}
              overlayOptions={overlayOptions}
              onOverlayOptionsChange={setOverlayOptions}
            />
          </div>
        </div>

        {/* Videos Section */}
        <VideoList
          videos={videos}
          projectName={projectName}
          jobStates={jobStates}
          onVideoClick={handleVideoClick}
          onAddToTimeline={addVideoToTimeline}
          onRemoveFromTimeline={removeVideoFromTimeline}
          onDeleteVideo={deleteVideo}
          onEncodeVideo={encodeVideo}
          currentTime={currentTime}
        />
      </div>

      {/* Jobs Bar - Fixed at bottom */}
      <JobsCard
        jobs={jobsArray}
        collapsed={jobsCollapsed}
        onToggleCollapse={() => setJobsCollapsed(!jobsCollapsed)}
      />

      {/* Upload Modal */}
      {showUpload && (
        <UploadVideoModal
          onClose={() => setShowUpload(false)}
          onUpload={(files) => {
            uploadVideos(files);
            setShowUpload(false);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setShowDeleteConfirm(false)}
          title="Delete Workspace"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">
                Are you sure you want to delete this workspace?
              </p>
              <p className="text-red-700 text-sm mt-2">
                This will permanently delete:
              </p>
              <ul className="list-disc list-inside text-red-700 text-sm mt-1 space-y-1">
                <li>
                  All uploaded videos ({videos.length} file
                  {videos.length !== 1 ? "s" : ""})
                </li>
                <li>Generated SD versions</li>
                <li>KML file and metadata</li>
              </ul>
              <p className="text-red-800 font-medium text-sm mt-3">
                This action cannot be undone!
              </p>
            </div>

            <ModalFooter>
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteWorkspace}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Permanently"}
              </Button>
            </ModalFooter>
          </div>
        </Modal>
      )}
    </div>
  );
}
