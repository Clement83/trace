/**
 * klmToVideo Server - Main API
 * ============================
 *
 * Real-time Progress Tracking Architecture:
 * =========================================
 *
 * Video Encoding (klm_to_video):
 * -------------------------------
 * 1. Python (encode_with_overlay.py) orchestrates the encoding process:
 *    - Parses KML data (5%)
 *    - Generates map overlay (10%)
 *    - Synchronizes timestamps (15%)
 *    - Calls composer.compose_video_with_overlay() (20-95%)
 *    - Finalizes output (95-100%)
 *
 * 2. Composer (composer/video_io.py) handles video encoding:
 *    - Spawns FFmpeg subprocess with stdin pipe for raw frames
 *    - Dedicated thread monitors FFmpeg stderr in real-time
 *    - Parses "time=HH:MM:SS.ms" from FFmpeg progress output
 *    - Calculates progress: (current_time / total_duration) * 100
 *    - Calls progress_callback(0.0-1.0)
 *
 * 3. FFmpeg Utils (ffmpeg_utils.py) provides parsing utilities:
 *    - extract_time_from_progress_line(): Parse FFmpeg stderr
 *    - parse_ffmpeg_time(): Convert "HH:MM:SS.ms" to seconds
 *    - calculate_progress_percent(): Compute percentage from time
 *    - Auto-detect ffmpeg/ffprobe (imageio-ffmpeg or system)
 *
 * 4. Node.js Workers (encodeVideoWorker.ts) bridge Python to SSE:
 *    - Spawn Python process, capture stdout (JSON-lines)
 *    - Parse {"type": "progress", "percent": X, "message": "..."}
 *    - Emit typed events via EventEmitter
 *
 * 5. SSE Endpoints (this file) stream events to browser:
 *    - GET /api/encode/events/:jobId
 *    - sendSSE() writes "event: progress\ndata: {...}\n\n"
 *    - Browser EventSource receives real-time updates
 *
 * SD Generation (video_to_sd):
 * -----------------------------
 * 1. Python (video_to_sd/convert.py):
 *    - Probes video duration with ffprobe
 *    - Spawns FFmpeg for transcoding
 *    - Parses FFmpeg stderr for progress
 *    - Emits {"type": "progress", "percent": X, "time_seconds": Y}
 *
 * 2. Node.js (sdWorker.ts):
 *    - Spawns Python, parses JSON-lines
 *    - Emits progress/log/done/error events
 *    - Forwards to SSE clients
 *
 * Progress Flow:
 *   FFmpeg stderr → Python thread → progress_callback() → JSON stdout
 *   → Node.js EventEmitter → SSE → Browser EventSource
 */

import express from "express";
import cors from "cors";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { EncodeVideoWorker } from "./workers/encodeVideoWorker";
import multer from "multer";
import fs from "fs/promises";
import { mkdirSync, existsSync } from "fs";
import path from "path";
import workspace from "./workspace";

type ProgressEvent = { percent: number; message?: string };
type LogEvent = { message: string; stream?: "stdout" | "stderr" | "system" };
type DoneEvent = { success: boolean; exitCode?: number };
type ErrorEvent = { message: string };

type JobEvent =
  | { type: "progress"; data: ProgressEvent }
  | { type: "log"; data: LogEvent }
  | { type: "done"; data: DoneEvent }
  | { type: "error"; data: ErrorEvent };

interface Job {
  id: string;
  emitter: EventEmitter;
  worker?: any;
  status: "running" | "done" | "error";
  createdAt: number;
}

/**
 * Simple in-memory job manager.
 * For MVP we keep jobs in memory. Jobs are removed from memory shortly after completion.
 */
const jobs = new Map<string, Job>();

const app = express();

app.use(cors());
app.use(express.json());

const DEFAULT_PORT = 3001;
const PORT = Number(process.env.PORT || DEFAULT_PORT);

/**
 * Helper to send SSE formatted event
 */
function sendSSE(res: express.Response, event: string, data: object) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Start a worker (real or simulated) for a job using EncodeWorker abstraction.
 * This function creates an EncodeWorker, forwards its events to the job.emitter,
 * and ensures cleanup after completion.
 */
function startEncodeVideoWorker(
  job: Job,
  options: {
    workspaceName?: string;
    videoName?: string;
    kmlPath?: string;
    kmlSummary?: any;
    videoPath: string;
    outputPath: string;
    kmlOffsetSeconds?: number;
    showSpeed?: boolean;
    showAltitude?: boolean;
    showCoordinates?: boolean;
    showTime?: boolean;
    showMap?: boolean;
    speedUnit?: string;
    speedPos?: string;
    speedSize?: string;
    speedStyle?: string;
    map?: boolean;
    mapSize?: string;
    mapPos?: string;
    font?: string;
    fps?: number;
    verbose?: number;
  },
) {
  console.log("[startEncodeVideoWorker] Called with:", options);

  const worker = new EncodeVideoWorker({
    kmlPath: options.kmlPath,
    kmlSummary: options.kmlSummary,
    videoPath: options.videoPath,
    outputPath: options.outputPath,
    kmlOffsetSeconds: options.kmlOffsetSeconds,
    showSpeed: options.showSpeed,
    showAltitude: options.showAltitude,
    showCoordinates: options.showCoordinates,
    showTime: options.showTime,
    showMap: options.showMap,
    speedUnit: options.speedUnit as "kmh" | "ms" | undefined,
    speedPos: options.speedPos as any,
    speedSize: options.speedSize as any,
    speedStyle: options.speedStyle as any,
    map: options.map,
    mapSize: options.mapSize,
    mapPos: options.mapPos as any,
    font: options.font,
    fps: options.fps,
    verbose: options.verbose,
  });

  job.worker = worker;

  // Forward worker events to SSE emitter using our JobEvent shape
  worker.on("log", (l) => {
    console.log("[Worker] Log:", l.message);
    job.emitter.emit("event", {
      type: "log",
      data: { message: l.message, stream: l.stream },
    } as JobEvent);
  });

  worker.on("progress", async (p) => {
    console.log("[Worker] Progress:", p.percent, p.message);
    job.emitter.emit("event", {
      type: "progress",
      data: { percent: p.percent, message: p.message },
    } as JobEvent);

    // Persist progress in video metadata
    if (options.videoName && options.workspaceName && p.percent != null) {
      try {
        await workspace.setVideoEncodeStatus(
          options.workspaceName,
          options.videoName,
          {
            encodeProgress: Math.round(p.percent),
          },
        );
      } catch (err) {
        console.warn("[Worker] Failed to update encode progress:", err);
      }
    }
  });

  worker.on("done", async (d) => {
    console.log("[Worker] Done:", d.success, "exitCode:", d.exit_code);
    job.status = "done";
    job.emitter.emit("event", {
      type: "done",
      data: { success: d.success, exitCode: d.exit_code },
    } as JobEvent);

    // Persist final status in video metadata
    if (options.videoName && options.workspaceName) {
      try {
        const encodedRelPath = `encoded/${options.videoName}`;
        await workspace.setVideoEncodeStatus(
          options.workspaceName,
          options.videoName,
          {
            encodeStatus: d.success ? "done" : "error",
            encodeProgress: d.success ? 100 : undefined,
            encodedPath: d.success ? encodedRelPath : undefined,
            encodedExists: d.success ? true : undefined,
            encodeError: d.success ? undefined : "Encoding failed",
          },
        );
      } catch (err) {
        console.warn("[Worker] Failed to update encode status:", err);
      }
    }

    // schedule cleanup
    setTimeout(() => jobs.delete(job.id), 30_000);
  });

  worker.on("error", async (e) => {
    console.error("[Worker] Error:", e.message);
    job.status = "error";
    job.emitter.emit("event", {
      type: "error",
      data: { message: e.message },
    } as JobEvent);

    // Persist error in video metadata
    if (options.videoName && options.workspaceName) {
      try {
        await workspace.setVideoEncodeStatus(
          options.workspaceName,
          options.videoName,
          {
            encodeStatus: "error",
            encodeError: e.message,
          },
        );
      } catch (err) {
        console.warn("[Worker] Failed to update encode error:", err);
      }
    }

    setTimeout(() => jobs.delete(job.id), 30_000);
  });

  // Start the worker
  console.log("[startEncodeVideoWorker] Starting worker...");
  worker.start();
  console.log("[startEncodeVideoWorker] Worker started");
}

/**
 * POST /api/encode
 * Body: { workspace: string, video_name: string, offset: number, ... }
 * Response: 202 { jobId }
 */
app.post("/api/encode", async (req, res) => {
  try {
    const body = req.body ?? {};
    const { workspace: workspaceName, video_name, offset } = body;

    console.log(
      "[Encode] POST /api/encode - Request body:",
      JSON.stringify(body, null, 2),
    );

    // Validate required fields
    if (!workspaceName) {
      return res.status(400).json({ error: "workspace is required" });
    }
    if (!video_name) {
      return res.status(400).json({ error: "video_name is required" });
    }

    const numOffset = typeof offset === "string" ? Number(offset) : offset;
    if (numOffset == null || Number.isNaN(Number(numOffset))) {
      console.error("[Encode] Invalid offset:", offset);
      return res
        .status(400)
        .json({ error: "offset is required and must be a number" });
    }

    // Load workspace metadata to get video path
    const meta = await workspace.readMeta(workspaceName);
    if (!meta) {
      return res.status(404).json({ error: "workspace not found" });
    }

    // Find the video in workspace
    const video = meta.videos?.find((v) => v.name === video_name);
    if (!video) {
      return res
        .status(404)
        .json({ error: `video '${video_name}' not found in workspace` });
    }

    // Get pre-parsed KML summary from workspace (no need to re-parse!)
    const kmlSummary = meta.kmlSummary;
    if (!kmlSummary || !kmlSummary.coords || kmlSummary.coords.length === 0) {
      return res.status(400).json({ error: "workspace has no valid KML data" });
    }

    // Build paths using workspace helpers
    const kmlPath = workspace.getKmlPath(workspaceName);
    // Video is always in workspace/videos/ directory
    const videoPath = workspace.getVideoPath(workspaceName, video_name);
    const encodedDir = workspace.getEncodedDir(workspaceName);
    const outputPath = workspace.getEncodedVideoPath(workspaceName, video_name);

    // Ensure encoded directory exists
    await workspace.ensureDir(encodedDir);

    console.log("[Encode] Resolved paths:", {
      kmlPath,
      videoPath,
      outputPath,
    });

    // Build job and emitter
    const jobId = uuidv4();
    const emitter = new EventEmitter();

    const job: Job = {
      id: jobId,
      emitter,
      status: "running",
      createdAt: Date.now(),
    };

    jobs.set(jobId, job);
    console.log("[Encode] Job created:", jobId);

    // Update video metadata to mark encoding as started
    await workspace.setVideoEncodeStatus(workspaceName, video_name, {
      encodeJobId: jobId,
      encodeStatus: "running",
      encodeProgress: 0,
      encodeError: undefined,
    });

    // Extract encoding options from request body
    const {
      map,
      map_size,
      map_pos,
      show_speed,
      show_altitude,
      show_coordinates,
      show_time,
      show_map,
      speed_unit,
      font,
      speed_style,
      speed_pos,
      speed_size,
      kml_offset_seconds,
      fps,
      verbose,
    } = body;

    // Use explicit kml_offset_seconds if provided, otherwise use the top-level offset value
    const kmlOffset = kml_offset_seconds ?? numOffset;

    // Parse verbose to number
    let verboseCount = 0;
    if (verbose != null) {
      if (typeof verbose === "number") {
        verboseCount = verbose;
      } else if (verbose === true) {
        verboseCount = 1;
      } else if (typeof verbose === "string") {
        const nv = Number(verbose);
        if (!Number.isNaN(nv)) {
          verboseCount = nv;
        }
      }
    }

    console.log("[Encode] Options:", {
      workspace: workspaceName,
      videoName: video_name,
      kmlOffset,
      showSpeed: show_speed,
      speedUnit: speed_unit,
    });

    // Start the worker with EncodeVideoWorker
    startEncodeVideoWorker(job, {
      workspaceName,
      videoName: video_name,
      kmlPath,
      kmlSummary,
      videoPath,
      outputPath,
      kmlOffsetSeconds: kmlOffset,
      showSpeed: show_speed,
      showAltitude: show_altitude,
      showCoordinates: show_coordinates,
      showTime: show_time,
      showMap: show_map,
      speedUnit: speed_unit,
      speedPos: speed_pos,
      speedSize: speed_size,
      speedStyle: speed_style,
      map,
      mapSize: map_size,
      mapPos: map_pos,
      font,
      fps,
      verbose: verboseCount,
    });

    console.log("[Encode] Worker started, returning jobId:", jobId);
    res.status(202).json({ jobId });
  } catch (err) {
    console.error("[Encode] Error:", err);
    res.status(500).json({ error: String(err) });
  }
});

/**
 * SSE endpoint to stream events for a job
 * GET /api/encode/events/:jobId
 */
app.get("/api/encode/events/:jobId", (req, res) => {
  const { jobId } = req.params;
  if (!jobId || !jobs.has(jobId)) {
    return res.status(404).json({ error: "job not found" });
  }

  const job = jobs.get(jobId)!;

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // send an initial comment to establish the stream
  res.write(`:ok\n\n`);

  const onEvent = (evt: JobEvent) => {
    try {
      sendSSE(res, evt.type, evt.data);
    } catch (e) {
      // ignore write errors
    }
  };

  // Our internal emitter uses a single "event" channel with typed payloads
  const wrappedListener = (payload: JobEvent) => onEvent(payload);

  job.emitter.on("event", wrappedListener);

  // If the job already emitted done or error before client connected, send current state
  if (job.status === "done") {
    sendSSE(res, "done", { success: true } as DoneEvent);
  } else if (job.status === "error") {
    sendSSE(res, "error", { message: "job in error state" } as ErrorEvent);
  }

  // Keep-alive ping every 15 seconds to prevent proxies from closing the connection
  const keepAlive = setInterval(() => {
    try {
      res.write(":ping\n\n");
    } catch {
      // ignore
    }
  }, 15_000);

  req.on("close", () => {
    clearInterval(keepAlive);
    job.emitter.off("event", wrappedListener);
  });
});

/**
 * DELETE /api/encode/:jobId
 * Attempt to stop a running job. If a worker is attached we call its stop()
 * method which will emit the appropriate events (done/error) that are forwarded
 * to connected SSE clients. Returns 202 when stop request is accepted.
 */
app.delete("/api/encode/:jobId", (req, res) => {
  const { jobId } = req.params;
  if (!jobId || !jobs.has(jobId)) {
    return res.status(404).json({ error: "job not found" });
  }
  const job = jobs.get(jobId)!;

  // If a worker is running, attempt to stop it.
  if (job.worker) {
    try {
      // call worker.stop() which will attempt to kill the process or stop simulation
      job.worker.stop();
      // Mark job as done/stopping locally; the worker will emit events via job.emitter.
      job.status = "done";
      // Schedule a short cleanup to remove job from memory
      setTimeout(() => jobs.delete(job.id), 5_000);
      return res.status(202).json({ jobId, status: "stopping" });
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  }

  // No worker attached — cannot stop
  return res.status(400).json({ error: "no running worker to stop" });
});

/**
 * Optional: get job status quickly
 */
app.get("/api/encode/:jobId/status", (req, res) => {
  const { jobId } = req.params;
  if (!jobId || !jobs.has(jobId)) {
    return res.status(404).json({ error: "job not found" });
  }
  const job = jobs.get(jobId)!;
  res.json({ jobId: job.id, status: job.status, createdAt: job.createdAt });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

// Multer upload configuration: store temporary uploads inside server/uploads
const uploadsDir = path.join(__dirname, "..", "uploads");
try {
  // Create synchronously at startup to avoid top-level await and keep compatibility
  mkdirSync(uploadsDir, { recursive: true });
} catch (err) {
  // Ignore errors (concurrent creation or permission issues handled by runtime)
}
const upload = multer({ dest: uploadsDir });

/**
 * GET /api/workspaces
 * List available workspaces with basic meta information (projectName, createdAt)
 */
app.get("/api/workspaces", async (_req, res) => {
  try {
    const list = await workspace.listWorkspaces();
    // return light-weight summary
    const summary = list.map((w) => ({
      projectName: w.projectName,
      path: w.path,
      createdAt: w.createdAt,
      hasKml: !!w.meta?.kmlSummary,
      videoCount: w.meta?.videos?.length || 0,
    }));
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /api/workspaces
 * Create a new workspace. Accepts multipart/form-data:
 *  - projectName: string
 *  - kml: file (optional)
 *
 * On success returns the created workspace meta (201).
 */
app.post(
  "/api/workspaces",
  upload.single("kml"),
  async (req: express.Request, res: express.Response) => {
    try {
      const projectName =
        (req.body && (req.body as any).projectName) || undefined;

      // Safely resolve uploaded temporary path (if multer provided it)
      const uploadedPath =
        req.file && typeof (req.file as any).path === "string"
          ? (req.file as any).path
          : undefined;

      if (!projectName) {
        // cleanup uploaded file if present
        if (uploadedPath) {
          try {
            await fs.unlink(uploadedPath);
          } catch {
            // ignore cleanup errors
          }
        }
        return res.status(400).json({ error: "projectName is required" });
      }

      let kmlBuffer: Buffer | undefined = undefined;
      if (uploadedPath) {
        kmlBuffer = await fs.readFile(uploadedPath);
      }

      const meta = await workspace.createWorkspace(projectName, kmlBuffer);

      // cleanup tmp upload
      if (uploadedPath) {
        try {
          await fs.unlink(uploadedPath);
        } catch {
          // ignore
        }
      }

      res.status(201).json(meta);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  },
);

/**
 * GET /api/workspaces/:projectName
 * Return workspace meta.json (or 404 if not found)
 */
app.get("/api/workspaces/:projectName", async (req, res) => {
  try {
    const projectName = req.params.projectName;
    const meta = await workspace.readMeta(projectName);
    if (!meta) return res.status(404).json({ error: "workspace not found" });
    res.json(meta);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /api/workspaces/:projectName/lock
 * Return the current 'locked' flag for the workspace (persisted in meta.json).
 * Response: { locked: boolean }
 */
app.get("/api/workspaces/:projectName/lock", async (req, res) => {
  try {
    const projectName = req.params.projectName;
    const meta = await workspace.readMeta(projectName);
    if (!meta) return res.status(404).json({ error: "workspace not found" });

    // Support both top-level `locked` and nested `settings.locked`
    let locked = false;
    if (typeof meta.locked === "boolean") {
      locked = meta.locked;
    } else if (meta.settings && typeof meta.settings.locked === "boolean") {
      locked = meta.settings.locked;
    }

    res.json({ locked });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * PATCH /api/workspaces/:projectName/lock
 * Body: { locked: boolean }
 * Persist the workspace lock flag into meta.json (under top-level `locked`).
 */
app.patch("/api/workspaces/:projectName/lock", async (req, res) => {
  try {
    const projectName = req.params.projectName;
    const { locked } = req.body ?? {};

    if (typeof locked !== "boolean") {
      return res
        .status(400)
        .json({ error: "locked is required and must be a boolean" });
    }

    // Load current meta
    const meta = await workspace.readMeta(projectName);
    if (!meta) return res.status(404).json({ error: "workspace not found" });

    // Set the lock flag at top-level for simplicity and backwards compatibility.
    meta.locked = locked;

    // Persist meta.json by writing the file directly in the workspace directory.
    // Use workspace.getWorkspaceDir(projectName) helper to locate workspace path.
    const metaPath = path.join(
      workspace.getWorkspaceDir(projectName),
      "meta.json",
    );
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");

    res.json({ success: true, locked });
  } catch (err) {
    console.error("Failed to update workspace lock:", err);
    res.status(500).json({ error: String(err) });
  }
});

/**
 * PUT /api/workspaces/:projectName/kml
 * Replace or upload the KML for a workspace (multipart/form-data with 'kml' file)
 */
app.put(
  "/api/workspaces/:projectName/kml",
  upload.single("kml"),
  async (req: express.Request, res: express.Response) => {
    try {
      const projectName = req.params.projectName;
      // Safely resolve uploaded temporary path (if multer provided it)
      const uploadedPath =
        req.file && typeof (req.file as any).path === "string"
          ? (req.file as any).path
          : undefined;
      if (!uploadedPath) {
        return res.status(400).json({ error: "kml file required" });
      }
      const buf = await fs.readFile(uploadedPath);
      const summary = await workspace.saveKml(projectName, buf);

      // cleanup tmp upload
      try {
        await fs.unlink(uploadedPath);
      } catch {
        // ignore
      }

      res.json({ projectName, kmlSummary: summary });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  },
);

/**
 * DELETE /api/workspaces/:projectName
 * Delete a workspace and all its contents
 */
app.delete("/api/workspaces/:projectName", async (req, res) => {
  try {
    const projectName = req.params.projectName;
    await workspace.removeWorkspace(projectName);
    res.json({ success: true, message: `Workspace ${projectName} deleted` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * PATCH /api/workspaces/:projectName/videos/:videoName/position
 * Update video timeline position
 * Body: { timelineStart: number }
 */
app.patch(
  "/api/workspaces/:projectName/videos/:videoName/position",
  async (req, res) => {
    try {
      const { projectName, videoName } = req.params;
      const { timelineStart } = req.body;

      if (typeof timelineStart !== "number") {
        return res
          .status(400)
          .json({ error: "timelineStart must be a number (epoch ms)" });
      }

      const updatedVideo = await workspace.updateVideoPosition(
        projectName,
        videoName,
        timelineStart,
      );
      res.json({ success: true, video: updatedVideo });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  },
);

/**
 * PATCH /api/workspaces/:projectName/videos/:videoName/add-to-timeline
 * Add video to timeline at a specific position (or auto-detect from creation time)
 * Body: { timelineStart?: number } (optional, auto-detected if not provided)
 */
app.patch(
  "/api/workspaces/:projectName/videos/:videoName/add-to-timeline",
  async (req, res) => {
    try {
      const { projectName, videoName } = req.params;
      const { timelineStart } = req.body;

      if (timelineStart !== undefined && typeof timelineStart !== "number") {
        return res
          .status(400)
          .json({ error: "timelineStart must be a number (epoch ms)" });
      }

      const updatedVideo = await workspace.addVideoToTimeline(
        projectName,
        videoName,
        timelineStart,
      );
      res.json({ success: true, video: updatedVideo });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  },
);

/**
 * PATCH /api/workspaces/:projectName/videos/:videoName/remove-from-timeline
 * Remove video from timeline (keep file, but unset timelineStart/timelineEnd)
 */
app.patch(
  "/api/workspaces/:projectName/videos/:videoName/remove-from-timeline",
  async (req, res) => {
    try {
      const { projectName, videoName } = req.params;

      const updatedVideo = await workspace.removeVideoFromTimeline(
        projectName,
        videoName,
      );
      res.json({ success: true, video: updatedVideo });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  },
);

/**
 * DELETE /api/workspaces/:projectName/videos/:videoName
 * Delete video completely from workspace (file + SD + meta.json entry)
 */
app.delete(
  "/api/workspaces/:projectName/videos/:videoName",
  async (req, res) => {
    try {
      const { projectName, videoName } = req.params;

      await workspace.removeVideo(projectName, videoName);
      res.json({ success: true, message: `Video ${videoName} deleted` });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  },
);

/**
 * POST /api/workspaces/:projectName/videos
 * Accept one or multiple video files (multipart/form-data).
 * - Stores uploaded files into workspace/videos/
 * - Updates meta.json with video entries
 * - Starts SD generation job for each uploaded file asynchronously
 *
 * Request: multipart/form-data with file fields (any names)
 * Response: 202 { uploaded: [{ name, originalPath }], jobs: [{ videoName, jobId }] }
 */
app.post(
  "/api/workspaces/:projectName/videos",
  upload.any(),
  async (req: express.Request, res: express.Response) => {
    try {
      const projectName = req.params.projectName;
      const files = (req.files as any) ?? [];
      if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "no files uploaded" });
      }

      // Ensure workspace exists
      const meta = await workspace.readMeta(projectName);
      if (!meta) {
        // cleanup uploaded files
        for (const f of files) {
          try {
            if (f && f.path) await fs.unlink(f.path);
          } catch {}
        }
        return res.status(404).json({ error: "workspace not found" });
      }

      const uploaded: Array<{ name: string; originalPath: string }> = [];
      const jobEntries: Array<{ videoName: string; jobId: string }> = [];

      // For each uploaded file, move it into workspace/videos and schedule SD generation
      for (const f of files) {
        const tempPath: string | undefined =
          typeof f.path === "string" ? f.path : undefined;
        const originalName: string = f.originalname ?? `upload-${Date.now()}`;
        if (!tempPath) continue;

        try {
          // Add to workspace (this will move/copy file into videos/ and update meta)
          const videoMeta = await workspace.addVideoFromPath(
            projectName,
            originalName,
            tempPath,
          );
          uploaded.push({
            name: videoMeta.name,
            originalPath: videoMeta.originalPath,
          });

          // Build SD output path relative to workspace dir: sd/<basename>_sd.mp4
          const base = path.parse(videoMeta.name).name;
          const sdRel = path.posix.join("sd", `${base}_sd.mp4`);
          const sdFull = path.join(
            workspace.getWorkspaceDir(projectName),
            sdRel,
          );

          // Start SD generation job asynchronously (no await) and attach job id
          const jobId = uuidv4();
          jobEntries.push({ videoName: videoMeta.name, jobId });

          // Integrate SD job into global job manager so clients can subscribe via SSE.
          // Create a Job entry and attach a dedicated emitter that will forward SD worker events.
          const jobEmitter = new EventEmitter();
          const jobObj: Job = {
            id: jobId,
            emitter: jobEmitter,
            worker: undefined,
            status: "running",
            createdAt: Date.now(),
          };
          // store in global in-memory job map
          jobs.set(jobId, jobObj);

          // Run SD job in background and forward events to job.emitter
          (async () => {
            try {
              // Import SDWorker utilities
              const sdModule = await import("./workers/sdWorker");
              const SDWorkerClass = sdModule.SDWorker;
              // Prepare options for SD worker
              const pythonCmd =
                process.env.PYTHON_CMD ?? process.env.ENCODER_CMD ?? "python";
              const opts: any = {
                inputPath: path.join(
                  workspace.getWorkspaceDir(projectName),
                  videoMeta.originalPath,
                ),
                outputPath: sdFull,
                width: Number(process.env.SD_WIDTH ?? 640),
                crf: Number(process.env.SD_CRF ?? 28),
                preset: String(process.env.SD_PRESET ?? "veryfast"),
                audioBitrate: String(process.env.SD_AUDIO_BITRATE ?? "96k"),
                overwrite: true,
                noProbe: false,
                simulate: false,
                pythonCmd,
                scriptDir: path.join(__dirname, "..", "video_to_sd"),
                env: process.env,
                onLog: (m: string) => {
                  jobObj.emitter.emit("event", {
                    type: "log",
                    data: { message: m, stream: "system" },
                  } as JobEvent);
                },
              };

              // instantiate and attach handlers
              const workerInstance = new SDWorkerClass(opts);
              jobObj.worker = workerInstance;

              workerInstance.on("log", (l: any) => {
                jobObj.emitter.emit("event", {
                  type: "log",
                  data: {
                    message: l.message ?? JSON.stringify(l),
                    stream: l.stream ?? "stdout",
                  },
                } as JobEvent);
              });
              workerInstance.on("progress", (p: any) => {
                jobObj.emitter.emit("event", {
                  type: "progress",
                  data: {
                    percent:
                      (p.percent ?? p.percent === 0) ? p.percent : undefined,
                    message: p.time_seconds
                      ? `time=${p.time_seconds}`
                      : undefined,
                  },
                } as JobEvent);
              });
              workerInstance.on("done", async (d: any) => {
                jobObj.status = "done";
                jobObj.emitter.emit("event", {
                  type: "done",
                  data: {
                    success: !!d.success,
                    exitCode: d.exit_code ?? d.exitCode,
                  },
                } as JobEvent);
                // On success, update meta to mark sd exists
                if (d && d.success) {
                  try {
                    await workspace.setVideoSd(
                      projectName,
                      videoMeta.name,
                      sdRel,
                      undefined,
                    );
                  } catch (e) {
                    // ignore meta update errors but log
                    console.warn("Failed to update meta for SD:", e);
                  }
                } else {
                  console.warn("SD generation finished with non-success:", d);
                }
                // schedule cleanup of job entry
                setTimeout(
                  () => jobs.delete(jobId),
                  Number(process.env.JOB_CLEANUP_MS ?? 30000),
                );
              });
              workerInstance.on("error", (e: any) => {
                jobObj.status = "error";
                jobObj.emitter.emit("event", {
                  type: "error",
                  data: { message: e.message ?? String(e) },
                } as JobEvent);
                setTimeout(
                  () => jobs.delete(jobId),
                  Number(process.env.JOB_CLEANUP_MS ?? 30000),
                );
              });

              // Start the SD worker
              workerInstance.start();
            } catch (err) {
              console.error("SD generation background error:", err);
              // Forward an error event if job exists
              if (jobs.has(jobId)) {
                const j = jobs.get(jobId)!;
                j.status = "error";
                j.emitter.emit("event", {
                  type: "error",
                  data: { message: String(err) },
                } as JobEvent);
                setTimeout(
                  () => jobs.delete(jobId),
                  Number(process.env.JOB_CLEANUP_MS ?? 30000),
                );
              }
            }
          })();
        } catch (err) {
          // If addVideoFromPath threw, ensure temp file is removed
          try {
            await fs.unlink(tempPath);
          } catch {}
        }
      }

      return res.status(202).json({ uploaded, jobs: jobEntries });
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  },
);

/**
 * GET /api/workspaces/:projectName/videos/:filename
 * Stream the original HD video file
 */
app.get(
  "/api/workspaces/:projectName/videos/:filename",
  async (req: express.Request, res: express.Response) => {
    try {
      const projectName = req.params.projectName;
      const filename = req.params.filename;

      // Get workspace metadata
      const meta = await workspace.readMeta(projectName);
      if (!meta) {
        return res.status(404).json({ error: "workspace not found" });
      }

      // Find the video in meta
      const videoEntry = meta.videos.find((v: any) => v.name === filename);
      if (!videoEntry) {
        return res.status(404).json({ error: "video not found" });
      }

      // Build full path to original HD file
      const videoFullPath = path.join(
        workspace.getWorkspaceDir(projectName),
        videoEntry.originalPath,
      );

      // Check if file exists
      try {
        await fs.access(videoFullPath);
      } catch {
        return res.status(404).json({ error: "video file not found on disk" });
      }

      // Get file stats for range support
      const stat = await fs.stat(videoFullPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        // Parse range header
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "video/mp4",
        });

        const stream = require("fs").createReadStream(videoFullPath, {
          start,
          end,
        });
        stream.pipe(res);
      } else {
        // No range, send entire file
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": "video/mp4",
        });
        const stream = require("fs").createReadStream(videoFullPath);
        stream.pipe(res);
      }
    } catch (err) {
      console.error("Error streaming HD video:", err);
      return res.status(500).json({ error: String(err) });
    }
  },
);

/**
 * GET /api/workspaces/:projectName/videos/:filename/sd
 * Stream the SD version of a video file
 */
app.get(
  "/api/workspaces/:projectName/videos/:filename/sd",
  async (req: express.Request, res: express.Response) => {
    try {
      const projectName = req.params.projectName;
      const filename = req.params.filename;

      // Get workspace metadata
      const meta = await workspace.readMeta(projectName);
      if (!meta) {
        return res.status(404).json({ error: "workspace not found" });
      }

      // Find the video in meta
      const videoEntry = meta.videos.find((v: any) => v.name === filename);
      if (!videoEntry) {
        return res.status(404).json({ error: "video not found" });
      }

      // Check if SD exists
      if (!videoEntry.sdExists || !videoEntry.sdPath) {
        return res.status(404).json({ error: "SD version not available yet" });
      }

      // Build full path to SD file
      const sdFullPath = path.join(
        workspace.getWorkspaceDir(projectName),
        videoEntry.sdPath,
      );

      // Check if file exists
      try {
        await fs.access(sdFullPath);
      } catch {
        return res.status(404).json({ error: "SD file not found on disk" });
      }

      // Get file stats for range support
      const stat = await fs.stat(sdFullPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        // Parse range header
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "video/mp4",
        });

        const stream = require("fs").createReadStream(sdFullPath, {
          start,
          end,
        });
        stream.pipe(res);
      } else {
        // No range, send entire file
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": "video/mp4",
        });
        const stream = require("fs").createReadStream(sdFullPath);
        stream.pipe(res);
      }
    } catch (err) {
      console.error("Error streaming SD video:", err);
      return res.status(500).json({ error: String(err) });
    }
  },
);

/**
 * GET /api/workspaces/:projectName/encoded/:filename
 * Download an encoded video file
 */
app.get("/api/workspaces/:projectName/encoded/:filename", async (req, res) => {
  try {
    const { projectName, filename } = req.params;
    const encodedPath = workspace.getEncodedVideoPath(projectName, filename);

    if (!require("fs").existsSync(encodedPath)) {
      return res.status(404).json({ error: "Encoded video not found" });
    }

    const stat = await fs.stat(encodedPath);
    const fileSize = stat.size;

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const stream = require("fs").createReadStream(encodedPath);
    stream.pipe(res);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// Serve static frontend in production
if (process.env.NODE_ENV === "production") {
  const uiDistPath = path.resolve(__dirname, "../../ui/dist");

  if (existsSync(uiDistPath)) {
    // eslint-disable-next-line no-console
    console.log(`Serving static frontend from: ${uiDistPath}`);

    // Serve static files
    app.use(express.static(uiDistPath));

    // SPA fallback - serve index.html for all non-API routes
    app.get("*", (req, res) => {
      res.sendFile(path.join(uiDistPath, "index.html"));
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn(`Warning: UI dist folder not found at ${uiDistPath}`);
  }
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`guiv2 server listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`POST /api/encode  -> start job`);
  // eslint-disable-next-line no-console
  console.log(`GET  /api/encode/events/:jobId -> sse events`);
  if (process.env.NODE_ENV === "production") {
    // eslint-disable-next-line no-console
    console.log(`Frontend available at http://localhost:${PORT}`);
  }
});
