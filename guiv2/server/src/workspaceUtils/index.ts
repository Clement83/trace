/**
 * guiv2 - workspace utilities
 *
 * Responsibilities:
 * - Manage workspace root and per-project directories
 * - Create workspace, store KML as `kml.kml`
 * - Read / write `meta.json`
 * - List workspaces and videos
 * - Provide light-weight KML parsing to extract timeline and coordinates
 *
 * Notes:
 * - Workspace root is configurable via env var `GUIV2_WORKSPACE_ROOT`.
 *   Defaults to `<projectRoot>/workspace` where projectRoot is two levels up from this file.
 * - All on-disk paths are created under the workspace root. `projectName` is sanitized
 *   and must match the allowed pattern (alphanumeric, dash, underscore).
 *
 * This module aims to be synchronous-friendly (async API) and minimal-dependency.
 */

import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { spawn } from "child_process";
const { XMLParser } = require("fast-xml-parser");

export type KmlTimestamp = number; // epoch millis

export type KmlCoordinate = {
  lat: number;
  lon: number;
  alt?: number;
  timestamp?: number; // epoch millis - when this coordinate was recorded
};

export type KmlSummary = {
  start?: KmlTimestamp;
  end?: KmlTimestamp;
  durationMs?: number;
  coords?: Array<KmlCoordinate>;
  // Legacy: coords without timestamps (for backward compatibility)
  // New: coords with timestamps for accurate interpolation
};

export type VideoMeta = {
  name: string; // original filename
  originalPath: string; // relative to workspace root (videos/<name>)
  sizeBytes?: number;
  sdPath?: string; // relative path to SD file if generated
  sdExists?: boolean;
  addedAt: number;
  durationMs?: number | null; // may be null if unknown
  // Video metadata from ffprobe
  creationTimestamp?: number; // epoch millis - when video was recorded
  width?: number;
  height?: number;
  frameRate?: number;
  videoCodec?: string;
  audioCodec?: string;
  // Timeline placement
  timelineStart?: number; // epoch millis - where on timeline this video starts
  timelineEnd?: number; // epoch millis - where on timeline this video ends
  color?: string; // hex color for UI representation (e.g. "#FF5733")
  // Encoded video state
  encodedPath?: string; // relative path to encoded file if exists (e.g. "encoded/filename.mp4")
  encodedExists?: boolean;
  encodeJobId?: string; // current or last encode job ID
  encodeStatus?: "running" | "done" | "error"; // encode job status
  encodeProgress?: number; // 0-100
  encodeError?: string; // error message if failed
};

export type WorkspaceMeta = {
  projectName: string;
  createdAt: number;
  kmlSummary?: KmlSummary;
  videos: VideoMeta[];
  // optional jobs array/other meta fields can be added
  [k: string]: any;
};

const DEFAULT_WORKSPACE_DIR_NAME = "workspace";

/**
 * Return workspace template path.
 * This is the versioned template directory used as a base for new workspaces.
 */
function getWorkspaceTemplatePath(): string {
  // Template is at server/workspace-template (one level up from dist/workspace)
  return path.resolve(__dirname, "..", "..", "workspace-template");
}

/**
 * Return workspace root path.
 * Priority:
 *  - env GUIV2_WORKSPACE_ROOT
 *  - default: <repo-root>/workspace  (two levels up from this file)
 */
export function getWorkspaceRoot(): string {
  const env = process.env.GUIV2_WORKSPACE_ROOT;
  if (env && env.trim().length > 0) {
    return path.resolve(env);
  }
  // assume this file is at server/src/workspace/index.ts -> repo root is three levels up
  // but to be resilient, go up two levels to guiv2/
  const repoDir = path.resolve(__dirname, "..", "..", ".."); // may point to project root
  // Fallback: use cwd if computed path doesn't exist
  const candidate = path.join(repoDir, DEFAULT_WORKSPACE_DIR_NAME);
  return candidate;
}

/**
 * Sanitize / validate a project name (folder name).
 * Allowed chars: a-zA-Z0-9_- (no spaces, no dots at start).
 */
export function sanitizeProjectName(raw: string): string {
  if (typeof raw !== "string") {
    throw new Error("projectName must be a string");
  }
  const name = raw.trim();
  if (!name) throw new Error("projectName cannot be empty");
  // disallow path separators
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    throw new Error("projectName contains invalid path characters");
  }
  const valid = /^[a-zA-Z0-9_-]+$/.test(name);
  if (!valid) {
    throw new Error(
      "projectName contains invalid characters. Allowed: letters, numbers, '-' and '_'",
    );
  }
  return name;
}

/* ---------------------- path helpers ----------------------- */

export function getWorkspaceDir(projectName: string): string {
  const root = getWorkspaceRoot();
  const name = sanitizeProjectName(projectName);
  return path.join(root, name);
}

export function getKmlPath(projectName: string): string {
  return path.join(getWorkspaceDir(projectName), "kml.kml");
}

export function getVideosDir(projectName: string): string {
  return path.join(getWorkspaceDir(projectName), "videos");
}

export function getSdDir(projectName: string): string {
  return path.join(getWorkspaceDir(projectName), "sd");
}

export function getEncodedDir(projectName: string): string {
  return path.join(getWorkspaceDir(projectName), "encoded");
}

export function getEncodedVideoPath(
  projectName: string,
  videoName: string,
): string {
  return path.join(getEncodedDir(projectName), videoName);
}

export function getVideoPath(projectName: string, videoName: string): string {
  return path.join(getVideosDir(projectName), videoName);
}

export function getMetaPath(projectName: string): string {
  return path.join(getWorkspaceDir(projectName), "meta.json");
}

export function getBackupDir(projectName: string): string {
  return path.join(getWorkspaceDir(projectName), ".backups");
}

/* ---------------------- low level FS helpers ----------------------- */

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively copy a directory
 */
async function copyDir(src: string, dest: string): Promise<void> {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/* ---------------------- Video metadata extraction ----------------------- */

/**
 * Probe video metadata using Python script (probe_video.py)
 * Returns metadata including duration, creation time, resolution, etc.
 */
async function probeVideoMetadata(
  videoPath: string,
): Promise<Partial<VideoMeta>> {
  return new Promise((resolve, reject) => {
    const pythonCmd = process.env.PYTHON_CMD ?? "python";
    const scriptPath = path.resolve(
      __dirname,
      "..",
      "..",
      "video_to_sd",
      "probe_video.py",
    );

    if (!existsSync(scriptPath)) {
      console.warn(
        "[Video Probe] probe_video.py not found, skipping metadata extraction",
      );
      resolve({});
      return;
    }

    const proc = spawn(pythonCmd, [scriptPath, "--json", videoPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    if (proc.stdout) {
      proc.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (proc.stderr) {
      proc.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    proc.on("close", (code) => {
      if (code !== 0) {
        console.warn(
          `[Video Probe] Failed to probe ${videoPath}: exit code ${code}`,
        );
        if (stderr) console.warn(`[Video Probe] stderr: ${stderr}`);
        resolve({});
        return;
      }

      try {
        const data = JSON.parse(stdout);

        const metadata: Partial<VideoMeta> = {};

        // Duration
        if (data.duration_seconds) {
          metadata.durationMs = Math.round(data.duration_seconds * 1000);
        }

        // Creation time (prefer creation_timestamp, fallback to file_modified_timestamp)
        if (data.creation_timestamp) {
          metadata.creationTimestamp = data.creation_timestamp;
        } else if (data.file_modified_timestamp) {
          metadata.creationTimestamp = data.file_modified_timestamp;
        }

        // Resolution
        if (data.width) metadata.width = data.width;
        if (data.height) metadata.height = data.height;

        // Frame rate
        if (data.frame_rate) metadata.frameRate = data.frame_rate;

        // Codecs
        if (data.video_codec) metadata.videoCodec = data.video_codec;
        if (data.audio_codec) metadata.audioCodec = data.audio_codec;

        resolve(metadata);
      } catch (err) {
        console.warn(`[Video Probe] Failed to parse JSON: ${err}`);
        resolve({});
      }
    });

    proc.on("error", (err) => {
      console.warn(`[Video Probe] Failed to spawn python: ${err}`);
      resolve({});
    });
  });
}

/**
 * Generate a random color for video timeline representation
 */
function generateVideoColor(index: number): string {
  const colors = [
    "#E63946", // Red
    "#2A9D8F", // Teal
    "#264653", // Dark Blue
    "#E76F51", // Orange
    "#F4A261", // Sandy Brown
    "#8338EC", // Purple
    "#06FFA5", // Bright Mint
    "#FB5607", // Bright Orange
    "#FFBE0B", // Yellow
    "#3A86FF", // Blue
    "#FF006E", // Hot Pink
    "#06D6A0", // Green
    "#118AB2", // Ocean Blue
    "#EF476F", // Pink
    "#FFD60A", // Golden Yellow
    "#06A77D", // Emerald
    "#9D4EDD", // Lavender
    "#FF5400", // Safety Orange
    "#00B4D8", // Bright Cyan
    "#C9184A", // Crimson
  ];
  return colors[index % colors.length];
}

/* ---------------------- KML parsing (best-effort) ----------------------- */

/**
 * Best-effort KML parser:
 * - Extract <when> timestamps (ISO strings) -> start / end
 * - Extract coordinate lists from <coordinates> and <gx:coord> (lon,lat[,alt])
 *
 * Returns KmlSummary with times in epoch ms and coords array.
 */
export function parseKml(bufferOrString: Buffer | string): KmlSummary {
  const xml = Buffer.isBuffer(bufferOrString)
    ? bufferOrString.toString("utf8")
    : bufferOrString;

  console.log("[KML Parser] Starting parse, XML length:", xml.length);

  const options = {
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    trimValues: true,
    ignoreNameSpace: true, // Important: ignore namespaces like gx:, kml:, etc.
  };

  let j: any;
  try {
    const parser = new XMLParser(options);
    j = parser.parse(xml);
  } catch (err) {
    console.error("[KML Parser] XML parse failed:", err);
    return {};
  }

  // Recursive helper to collect <when> entries and <coordinates> text nodes
  const whens: string[] = [];
  const coordsTexts: string[] = [];

  function walk(node: any, depth = 0) {
    if (!node || typeof node !== "object") return;
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (!val) continue;

      // Handle <when> tags (timestamps)
      if (key === "when") {
        if (Array.isArray(val)) {
          for (const v of val) if (typeof v === "string") whens.push(v);
        } else if (typeof val === "string") {
          whens.push(val);
        }
      }
      // Handle <coordinates> tags
      else if (key === "coordinates") {
        if (Array.isArray(val)) {
          for (const v of val) if (typeof v === "string") coordsTexts.push(v);
        } else if (typeof val === "string") {
          coordsTexts.push(val);
        }
      }
      // Handle <coord> tags (gx:coord becomes just coord with ignoreNameSpace)
      else if (key === "coord") {
        if (Array.isArray(val)) {
          for (const v of val) if (typeof v === "string") coordsTexts.push(v);
        } else if (typeof val === "string") {
          coordsTexts.push(val);
        }
      }
      // Dive deeper into nested objects
      else {
        if (Array.isArray(val)) {
          for (const v of val) walk(v, depth + 1);
        } else if (typeof val === "object") {
          walk(val, depth + 1);
        }
      }
    }
  }

  walk(j);

  console.log("[KML Parser] Found whens:", whens.length);
  console.log("[KML Parser] Found coordinate texts:", coordsTexts.length);

  const timestamps: number[] = [];
  for (const w of whens) {
    const t = Date.parse(w);
    if (!isNaN(t)) timestamps.push(t);
  }

  const coords: Array<KmlCoordinate> = [];

  for (const txt of coordsTexts) {
    // coordinates text can be "lon,lat,alt lon,lat,alt ..." or with newlines
    const parts = txt.trim().split(/[\s\n]+/);
    for (const p of parts) {
      if (!p) continue;
      const comps = p
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (comps.length >= 2) {
        const lon = Number(comps[0]);
        const lat = Number(comps[1]);
        const alt = comps.length >= 3 ? Number(comps[2]) : undefined;
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
          coords.push(
            alt !== undefined && !Number.isNaN(alt)
              ? { lat, lon, alt }
              : { lat, lon },
          );
        }
      }
    }
  }

  // Try to match timestamps to coordinates (if counts match)
  if (timestamps.length > 0 && coords.length > 0) {
    if (timestamps.length === coords.length) {
      // Perfect match: pair each timestamp with its coordinate
      console.log(
        "[KML Parser] Pairing timestamps with coordinates (1:1 match)",
      );
      for (let i = 0; i < coords.length; i++) {
        coords[i].timestamp = timestamps[i];
      }
    } else {
      // WARNING: Timestamps and coordinates count mismatch - using interpolation as fallback
      console.warn(
        `[KML Parser] Mismatch: ${timestamps.length} timestamps vs ${coords.length} coordinates. Using interpolation as fallback.`,
      );
      const start = Math.min(...timestamps);
      const end = Math.max(...timestamps);
      const duration = end - start;
      for (let i = 0; i < coords.length; i++) {
        const fraction = coords.length > 1 ? i / (coords.length - 1) : 0;
        coords[i].timestamp = start + fraction * duration;
      }
    }
  }

  // Fallback: regex search for gx:coord patterns
  if (coords.length === 0) {
    console.log("[KML Parser] Trying regex fallback for gx:coord");
    const gxMatches = xml.match(/<gx:coord>([^<]+)<\/gx:coord>/gi);
    if (gxMatches) {
      for (const m of gxMatches) {
        const inner = m.replace(/<\/?gx:coord>/gi, "").trim();
        const comps = inner.split(/\s+/);
        if (comps.length >= 2) {
          const lon = Number(comps[0]);
          const lat = Number(comps[1]);
          const alt = comps.length >= 3 ? Number(comps[2]) : undefined;
          if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
            coords.push(
              alt !== undefined && !Number.isNaN(alt)
                ? { lat, lon, alt }
                : { lat, lon },
            );
          }
        }
      }
    }
  }

  console.log("[KML Parser] Parsed timestamps:", timestamps.length);
  console.log("[KML Parser] Parsed coords:", coords.length);

  const summary: KmlSummary = {};
  if (timestamps.length > 0) {
    const s = Math.min(...timestamps);
    const e = Math.max(...timestamps);
    summary.start = s;
    summary.end = e;
    summary.durationMs = e - s;
    console.log(
      "[KML Parser] Time range:",
      new Date(s).toISOString(),
      "to",
      new Date(e).toISOString(),
    );
  }
  if (coords.length > 0) {
    summary.coords = coords;
    console.log(
      "[KML Parser] First coord:",
      coords[0],
      "Last coord:",
      coords[coords.length - 1],
    );
  }

  if (coords.length === 0 && timestamps.length === 0) {
    console.warn(
      "[KML Parser] WARNING: No coords or timestamps found! Check KML format.",
    );
  }

  return summary;
}

/* ---------------------- meta helpers ----------------------- */

export async function readMeta(
  projectName: string,
): Promise<WorkspaceMeta | null> {
  const metaPath = getMetaPath(projectName);
  if (!(await fileExists(metaPath))) return null;
  const raw = await fs.readFile(metaPath, "utf8");
  try {
    const parsed = JSON.parse(raw) as WorkspaceMeta;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Create a backup of meta.json before writing.
 * Keeps only a single backup file (overwrites previous backup).
 */
async function backupMeta(projectName: string): Promise<void> {
  const metaPath = getMetaPath(projectName);

  // Check if meta.json exists
  if (!(await fileExists(metaPath))) {
    return; // Nothing to backup
  }

  const backupDir = getBackupDir(projectName);
  await ensureDir(backupDir);

  // Single backup file - always the same name
  const backupPath = path.join(backupDir, `meta.backup.json`);

  // Copy current meta.json to backup (overwrites previous backup)
  await fs.copyFile(metaPath, backupPath);
}

export async function writeMeta(
  projectName: string,
  meta: WorkspaceMeta,
): Promise<void> {
  // Create backup before writing
  await backupMeta(projectName);

  // JSON-encode with 2-space indent
  const metaPath = getMetaPath(projectName);
  const dir = path.dirname(metaPath);
  await ensureDir(dir);
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
}

/* ---------------------- workspace operations ----------------------- */

/**
 * List workspaces (names). Returns array of { projectName, path, createdAt, meta? }
 */
export async function listWorkspaces(): Promise<
  Array<{
    projectName: string;
    path: string;
    createdAt: number;
    meta?: WorkspaceMeta;
  }>
> {
  const root = getWorkspaceRoot();
  const result: Array<{
    projectName: string;
    path: string;
    createdAt: number;
    meta?: WorkspaceMeta;
  }> = [];
  try {
    await ensureDir(root);
    const entries = await fs.readdir(root, { withFileTypes: true });
    // Reserved directories that should not appear in workspace list
    const RESERVED_DIRS = [".git", "node_modules"];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const projectName = e.name;
      // Skip reserved directories
      if (RESERVED_DIRS.includes(projectName)) continue;
      try {
        const dirPath = path.join(root, projectName);
        const st = await fs.stat(dirPath);
        const createdAt = st.ctimeMs || Date.now();
        const meta = await readMeta(projectName);
        result.push({
          projectName,
          path: dirPath,
          createdAt,
          meta: meta ?? undefined,
        });
      } catch {
        // skip invalid entries
      }
    }
  } catch {
    // if root doesn't exist or other errors, return empty list
  }
  return result;
}

/**
 * Create a workspace. If kmlBuffer provided, write it as kml.kml and parse summary.
 * Returns the created meta.
 */
export async function createWorkspace(
  projectNameRaw: string,
  kmlBuffer?: Buffer | string,
): Promise<WorkspaceMeta> {
  const projectName = sanitizeProjectName(projectNameRaw);
  const dir = getWorkspaceDir(projectName);
  const videosDir = getVideosDir(projectName);
  const sdDir = getSdDir(projectName);

  // Copy template structure
  const templatePath = getWorkspaceTemplatePath();
  if (existsSync(templatePath)) {
    // Copy template directory recursively
    await copyDir(templatePath, dir);
  } else {
    // Fallback: create directories manually if template doesn't exist
    await ensureDir(dir);
    await ensureDir(videosDir);
    await ensureDir(sdDir);
  }

  // write kml if provided
  let summary: KmlSummary | undefined = undefined;
  if (kmlBuffer) {
    await fs.writeFile(
      getKmlPath(projectName),
      Buffer.isBuffer(kmlBuffer) ? kmlBuffer : Buffer.from(kmlBuffer, "utf8"),
    );
    try {
      summary = parseKml(kmlBuffer);
    } catch {
      summary = undefined;
    }
  }

  const now = Date.now();
  const meta: WorkspaceMeta = {
    projectName,
    createdAt: now,
    kmlSummary: summary,
    videos: [],
  };

  await writeMeta(projectName, meta);
  return meta;
}

/**
 * Save / replace the KML for a workspace and update meta (kmlSummary).
 */
export async function saveKml(
  projectNameRaw: string,
  kmlBuffer: Buffer | string,
): Promise<KmlSummary> {
  const projectName = sanitizeProjectName(projectNameRaw);
  const kmlPath = getKmlPath(projectName);
  await ensureDir(path.dirname(kmlPath));
  await fs.writeFile(
    kmlPath,
    Buffer.isBuffer(kmlBuffer) ? kmlBuffer : Buffer.from(kmlBuffer, "utf8"),
  );
  const summary = parseKml(kmlBuffer);
  const meta = (await readMeta(projectName)) ?? {
    projectName,
    createdAt: Date.now(),
    videos: [],
  };
  meta.kmlSummary = summary;
  await writeMeta(projectName, meta);
  return summary;
}

/**
 * Add a video to workspace by moving/copying an existing file into videos/ and update meta.
 * - sourcePath: absolute path to uploaded file (temporary path) OR Buffer not supported here.
 * - name: target filename to keep (original name).
 *
 * Returns VideoMeta stored.
 */
export async function addVideoFromPath(
  projectNameRaw: string,
  name: string,
  sourcePath: string,
): Promise<VideoMeta> {
  const projectName = sanitizeProjectName(projectNameRaw);
  const videosDir = getVideosDir(projectName);
  await ensureDir(videosDir);

  const targetPath = path.join(videosDir, name);

  // Move or copy: try rename first (faster), fallback to copy
  try {
    await fs.rename(sourcePath, targetPath);
  } catch {
    // try copy
    await fs.copyFile(sourcePath, targetPath);
  }

  // gather metadata
  let sizeBytes: number | undefined = undefined;
  try {
    const st = await fs.stat(targetPath);
    sizeBytes = st.size;
  } catch {
    // ignore
  }

  const addedAt = Date.now();
  const relOriginal = path
    .relative(getWorkspaceDir(projectName), targetPath)
    .replace(/\\/g, "/");

  // Probe video metadata
  const probedMeta = await probeVideoMetadata(targetPath);

  // Read current meta to get existing videos and timeline info
  const meta = (await readMeta(projectName)) ?? {
    projectName,
    createdAt: Date.now(),
    videos: [],
  };
  meta.videos = meta.videos || [];

  // Assign a color for this video
  const color = generateVideoColor(meta.videos.length);

  // Build video metadata
  const videoMeta: VideoMeta = {
    name,
    originalPath: relOriginal,
    sizeBytes,
    addedAt,
    sdExists: false,
    color,
    ...probedMeta,
  };

  // Position video on timeline
  // If video has creation timestamp, try to position it there
  // Otherwise position at the beginning of KML timeline or at 0
  const kmlStart = meta.kmlSummary?.start;
  const kmlEnd = meta.kmlSummary?.end;

  console.log(
    `[Video Positioning] ${name}: creationTimestamp=${videoMeta.creationTimestamp}, durationMs=${videoMeta.durationMs}, kmlStart=${kmlStart}, kmlEnd=${kmlEnd}`,
  );

  // Check if creation timestamp is within KML timeline bounds
  const creationInBounds =
    videoMeta.creationTimestamp &&
    kmlStart &&
    kmlEnd &&
    videoMeta.creationTimestamp >= kmlStart &&
    videoMeta.creationTimestamp <= kmlEnd;

  if (creationInBounds) {
    // Video creation time is within KML timeline - use it
    videoMeta.timelineStart = videoMeta.creationTimestamp!;
    if (videoMeta.durationMs && videoMeta.durationMs > 0) {
      videoMeta.timelineEnd = videoMeta.timelineStart + videoMeta.durationMs;
    } else {
      videoMeta.timelineEnd = videoMeta.timelineStart;
    }
    console.log(
      `[Video Positioning] Using creation timestamp (in bounds): ${new Date(videoMeta.timelineStart).toISOString()}`,
    );
  } else if (kmlStart) {
    // No valid creation timestamp - position at start of KML timeline
    videoMeta.timelineStart = kmlStart;
    if (videoMeta.durationMs && videoMeta.durationMs > 0) {
      videoMeta.timelineEnd = kmlStart + videoMeta.durationMs;
    } else {
      videoMeta.timelineEnd = kmlStart;
    }
    console.log(
      `[Video Positioning] Using KML start (no valid timestamp): ${new Date(videoMeta.timelineStart).toISOString()}`,
    );
  } else {
    // No KML timeline - position at upload time
    videoMeta.timelineStart = addedAt;
    if (videoMeta.durationMs && videoMeta.durationMs > 0) {
      videoMeta.timelineEnd = addedAt + videoMeta.durationMs;
    } else {
      videoMeta.timelineEnd = addedAt;
    }
    console.log(
      `[Video Positioning] Using addedAt time (no KML): ${new Date(videoMeta.timelineStart).toISOString()}`,
    );
  }

  console.log(
    `[Video Added] ${name}: duration=${videoMeta.durationMs}ms, timeline=${new Date(videoMeta.timelineStart).toISOString()} → ${new Date(videoMeta.timelineEnd).toISOString()}, color=${color}`,
  );

  meta.videos.push(videoMeta);
  await writeMeta(projectName, meta);

  return videoMeta;
}

/**
 * List videos for a workspace by reading meta.json and verifying sd existence.
 */
export async function listVideos(projectNameRaw: string): Promise<VideoMeta[]> {
  const projectName = sanitizeProjectName(projectNameRaw);
  const meta = (await readMeta(projectName)) ?? {
    projectName,
    createdAt: Date.now(),
    videos: [],
  };
  const videos = meta.videos || [];
  // ensure sdExists flag is accurate
  for (const v of videos) {
    if (v.sdPath) {
      const full = path.join(getWorkspaceDir(projectName), v.sdPath);
      v.sdExists = existsSync(full);
    } else {
      v.sdExists = false;
    }
  }
  return videos;
}

/**
 * Update encode status for a video in workspace meta.
 * Called during and after encoding to persist state across refreshes.
 */
export async function setVideoEncodeStatus(
  projectNameRaw: string,
  videoName: string,
  update: {
    encodeJobId?: string;
    encodeStatus?: "running" | "done" | "error";
    encodeProgress?: number;
    encodeError?: string;
    encodedPath?: string;
    encodedExists?: boolean;
  },
): Promise<VideoMeta | null> {
  const projectName = sanitizeProjectName(projectNameRaw);
  const meta = (await readMeta(projectName)) ?? null;
  if (!meta) throw new Error("workspace meta not found");
  meta.videos = meta.videos || [];
  const item = meta.videos.find((v) => v.name === videoName);
  if (!item) return null;

  // Update encode fields
  if (update.encodeJobId !== undefined) item.encodeJobId = update.encodeJobId;
  if (update.encodeStatus !== undefined)
    item.encodeStatus = update.encodeStatus;
  if (update.encodeProgress !== undefined)
    item.encodeProgress = update.encodeProgress;
  if (update.encodeError !== undefined) item.encodeError = update.encodeError;
  if (update.encodedPath !== undefined) item.encodedPath = update.encodedPath;
  if (update.encodedExists !== undefined)
    item.encodedExists = update.encodedExists;

  await writeMeta(projectName, meta);
  return item;
}

/**
 * Write SD info into meta for a video (called after SD generation).
 * sdRelativePath is path relative to workspace dir, e.g. "sd/myride_sd.mp4".
 */
export async function setVideoSd(
  projectNameRaw: string,
  videoName: string,
  sdRelativePath: string,
  sdSizeBytes?: number,
): Promise<void> {
  const projectName = sanitizeProjectName(projectNameRaw);
  const meta = (await readMeta(projectName)) ?? null;
  if (!meta) throw new Error("workspace meta not found");
  meta.videos = meta.videos || [];
  const item = meta.videos.find((v) => v.name === videoName);
  if (!item) throw new Error("video entry not found in meta");
  item.sdPath = sdRelativePath.replace(/\\/g, "/");
  item.sdExists = true;
  if (typeof sdSizeBytes === "number") item.sizeBytes = sdSizeBytes;
  await writeMeta(projectName, meta);
}

/**
 * Remove workspace directory completely (use with caution). Synchronous deletion not provided.
 */
async function removeWorkspace(projectNameRaw: string): Promise<void> {
  const projectName = sanitizeProjectName(projectNameRaw);
  const dir = getWorkspaceDir(projectName);
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * Update video timeline position in the workspace meta.json
 * @param projectName - workspace name
 * @param videoName - name of the video to update
 * @param newTimelineStart - new start position on timeline (epoch ms)
 * @returns updated VideoMeta
 */
export async function updateVideoPosition(
  projectNameRaw: string,
  videoName: string,
  newTimelineStart: number,
): Promise<VideoMeta> {
  const projectName = sanitizeProjectName(projectNameRaw);
  const meta = await readMeta(projectName);

  if (!meta) {
    throw new Error(`Workspace ${projectName} not found`);
  }

  const video = meta.videos?.find((v) => v.name === videoName);
  if (!video) {
    throw new Error(`Video ${videoName} not found in workspace ${projectName}`);
  }

  // Update timeline start
  video.timelineStart = newTimelineStart;

  // Update timeline end based on duration
  if (video.durationMs) {
    video.timelineEnd = newTimelineStart + video.durationMs;
  } else {
    video.timelineEnd = newTimelineStart;
  }

  console.log(
    `[Video Position Updated] ${videoName}: timelineStart=${video.timelineStart}, timelineEnd=${video.timelineEnd}`,
  );

  await writeMeta(projectName, meta);
  return video;
}

/**
 * Add or update a video on the timeline at a specific position
 * @param projectName - workspace name
 * @param videoName - name of the video to add to timeline
 * @param timelineStart - start position on timeline (epoch ms). If not provided, uses video creation time or KML start
 * @returns updated VideoMeta
 */
export async function addVideoToTimeline(
  projectNameRaw: string,
  videoName: string,
  timelineStart?: number,
): Promise<VideoMeta> {
  const projectName = sanitizeProjectName(projectNameRaw);
  const meta = await readMeta(projectName);

  if (!meta) {
    throw new Error(`Workspace ${projectName} not found`);
  }

  const video = meta.videos?.find((v) => v.name === videoName);
  if (!video) {
    throw new Error(`Video ${videoName} not found in workspace ${projectName}`);
  }

  // Determine start position
  let start = timelineStart;
  if (start === undefined) {
    // Try to use video creation timestamp
    if (video.creationTimestamp) {
      start = video.creationTimestamp;
    } else if (meta.kmlSummary?.start) {
      // Fallback to KML start
      start = meta.kmlSummary.start;
    } else {
      throw new Error(
        `Cannot determine timeline position for ${videoName}. Please provide timelineStart.`,
      );
    }
  }

  // Set timeline positions
  video.timelineStart = start;
  if (video.durationMs) {
    video.timelineEnd = start + video.durationMs;
  } else {
    video.timelineEnd = start;
  }

  console.log(
    `[Video Added to Timeline] ${videoName}: timelineStart=${video.timelineStart}, timelineEnd=${video.timelineEnd}`,
  );

  await writeMeta(projectName, meta);
  return video;
}

/**
 * Remove a video from timeline (set timelineStart/timelineEnd to undefined)
 * The video file remains in the workspace
 * @param projectName - workspace name
 * @param videoName - name of the video to remove from timeline
 * @returns updated VideoMeta
 */
export async function removeVideoFromTimeline(
  projectNameRaw: string,
  videoName: string,
): Promise<VideoMeta> {
  const projectName = sanitizeProjectName(projectNameRaw);
  const meta = await readMeta(projectName);

  if (!meta) {
    throw new Error(`Workspace ${projectName} not found`);
  }

  const video = meta.videos?.find((v) => v.name === videoName);
  if (!video) {
    throw new Error(`Video ${videoName} not found in workspace ${projectName}`);
  }

  // Remove from timeline by unsetting the timeline positions
  video.timelineStart = undefined;
  video.timelineEnd = undefined;

  console.log(`[Video Removed from Timeline] ${videoName}`);

  await writeMeta(projectName, meta);
  return video;
}

/**
 * Remove a video completely from the workspace
 * Deletes the video file, SD version, and removes from meta.json
 * @param projectName - workspace name
 * @param videoName - name of the video to remove
 */
export async function removeVideo(
  projectNameRaw: string,
  videoName: string,
): Promise<void> {
  const projectName = sanitizeProjectName(projectNameRaw);
  const meta = await readMeta(projectName);

  if (!meta) {
    throw new Error(`Workspace ${projectName} not found`);
  }

  const videoIndex = meta.videos?.findIndex((v) => v.name === videoName);
  if (videoIndex === undefined || videoIndex === -1) {
    throw new Error(`Video ${videoName} not found in workspace ${projectName}`);
  }

  const video = meta.videos[videoIndex];

  // Delete original video file
  const videosDir = getVideosDir(projectName);
  const videoPath = path.join(videosDir, videoName);
  if (await fileExists(videoPath)) {
    await fs.unlink(videoPath);
    console.log(`[Video File Deleted] ${videoPath}`);
  }

  // Delete SD version if exists
  if (video.sdPath) {
    const sdDir = getSdDir(projectName);
    const sdPath = path.join(sdDir, path.basename(video.sdPath));
    if (await fileExists(sdPath)) {
      await fs.unlink(sdPath);
      console.log(`[SD File Deleted] ${sdPath}`);
    }
  }

  // Remove from meta.json
  meta.videos.splice(videoIndex, 1);
  await writeMeta(projectName, meta);

  console.log(`[Video Removed] ${videoName} from workspace ${projectName}`);
}

/* ---------------------- Utilities exposed for other modules ----------------------- */

export default {
  getWorkspaceRoot,
  getWorkspaceDir,
  getKmlPath,
  getVideosDir,
  getSdDir,
  getEncodedDir,
  getEncodedVideoPath,
  getVideoPath,
  getMetaPath,
  ensureDir,
  parseKml,
  readMeta,
  writeMeta,
  listWorkspaces,
  createWorkspace,
  saveKml,
  addVideoFromPath,
  listVideos,
  setVideoSd,
  updateVideoPosition,
  addVideoToTimeline,
  removeVideoFromTimeline,
  removeVideo,
  removeWorkspace,
  setVideoEncodeStatus,
};
