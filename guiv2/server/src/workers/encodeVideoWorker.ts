/**
 * encodeVideoWorker.ts
 *
 * Video encoding worker using native TypeScript/Node.js implementation.
 * Uses fluent-ffmpeg and KML parser instead of Python scripts.
 *
 * Events emitted:
 *  - 'progress' : { percent?: number | null, message?: string }
 *  - 'log'      : { stream?: 'stdout' | 'stderr' | 'system', message: string }
 *  - 'done'     : { success: boolean, exit_code?: number }
 *  - 'error'    : { message: string }
 *
 * Usage:
 *   const w = new EncodeVideoWorker({
 *     kmlPath: 'path/to/track.kml',
 *     videoPath: 'path/to/video.mp4',
 *     outputPath: 'path/to/output.mp4',
 *     kmlOffsetSeconds: 123.45,
 *     showSpeed: true,
 *     speedUnit: 'kmh',
 *     speedPos: 'bottom-right',
 *   });
 *   w.on('progress', (p) => console.log('progress', p));
 *   w.on('log', (l) => console.log('log', l));
 *   w.on('done', (d) => console.log('done', d));
 *   w.start();
 */

import { EventEmitter } from "events";
import { VideoOverlay } from "../lib/videoOverlay";
import { KmlSummary } from "../workspace";

export type EncodeVideoProgress = {
  percent?: number | null;
  message?: string;
  [k: string]: any;
};

export type EncodeVideoLog = {
  stream?: "stdout" | "stderr" | "system";
  message: string;
  [k: string]: any;
};

export type EncodeVideoDone = {
  success: boolean;
  exit_code?: number | null;
  [k: string]: any;
};

export type EncodeVideoError = {
  message: string;
  [k: string]: any;
};

export type EncodeVideoWorkerEvents = {
  progress: (p: EncodeVideoProgress) => void;
  log: (l: EncodeVideoLog) => void;
  done: (d: EncodeVideoDone) => void;
  error: (e: EncodeVideoError) => void;
};

export interface EncodeVideoWorkerOptions {
  // Required paths
  kmlPath?: string;
  kmlSummary?: KmlSummary; // Alternative: use pre-parsed KML data from workspace
  videoPath: string;
  outputPath: string;

  // Encoding options
  kmlOffsetSeconds?: number;
  showSpeed?: boolean;
  showAltitude?: boolean;
  showCoordinates?: boolean;
  showTime?: boolean;
  showMap?: boolean;
  speedUnit?: "kmh" | "ms";
  speedPos?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  speedSize?: "small" | "medium" | "large";
  speedStyle?: "text" | "tachometer";
  map?: boolean;
  mapSize?: string;
  mapPos?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  font?: string;
  fps?: number;
  verbose?: number;
  videoStartAuto?: boolean;
  videoStartTime?: string;

  // Runtime options
  simulate?: boolean;
  onLog?: (msg: string) => void;
}

/**
 * EncodeVideoWorker
 *
 * Manage a video encoding process with KML overlay using native TypeScript implementation.
 */
export class EncodeVideoWorker extends EventEmitter {
  private options: EncodeVideoWorkerOptions;
  private encoder?: VideoOverlay;
  private stopped = false;

  constructor(options: EncodeVideoWorkerOptions) {
    super();
    this.options = {
      showSpeed: true,
      speedUnit: "kmh",
      speedPos: "bottom-right",
      speedSize: "medium",
      speedStyle: "text",
      simulate: false,
      ...options,
    };
  }

  /**
   * Start the encoding process. Emits events based on encoding progress.
   */
  start(): void {
    if (this.encoder) {
      this.emit("log", {
        stream: "system",
        message: "EncodeVideoWorker already running",
      });
      return;
    }
    this.stopped = false;

    // If simulate mode, emit fake events and return
    if (this.options.simulate) {
      this.emit("log", {
        stream: "system",
        message: "[SIMULATE] Video encoding with overlay",
      });
      setTimeout(() => {
        this.emit("progress", {
          percent: 50,
          message: "Simulating encoding...",
        });
      }, 1000);
      setTimeout(() => {
        this.emit("progress", { percent: 100, message: "Simulation complete" });
        this.emit("done", { success: true, exit_code: 0 });
      }, 2000);
      return;
    }

    // Create encoder instance
    this.encoder = new VideoOverlay({
      kmlPath: this.options.kmlPath,
      kmlSummary: this.options.kmlSummary,
      videoPath: this.options.videoPath,
      outputPath: this.options.outputPath,
      kmlOffsetSeconds: this.options.kmlOffsetSeconds,
      showSpeed: this.options.showSpeed,
      showAltitude: this.options.showAltitude,
      showCoordinates: this.options.showCoordinates,
      showTime: this.options.showTime,
      showMap: this.options.showMap,
      speedUnit: this.options.speedUnit,
      speedPos: this.options.speedPos,
      speedSize: this.options.speedSize,
      fontPath: this.options.font,
      fps: this.options.fps,
    });

    // Forward events
    this.encoder.on("progress", (data) => {
      if (this.stopped) return;

      const progress: EncodeVideoProgress = {
        percent: data.percent,
        message: data.message,
      };
      this.emit("progress", progress);
    });

    this.encoder.on("log", (data) => {
      if (this.stopped) return;

      const log: EncodeVideoLog = {
        stream: data.stream || "system",
        message: data.message,
      };
      this.emit("log", log);
      if (this.options.onLog) {
        this.options.onLog(data.message);
      }
    });

    this.encoder.on("done", (data) => {
      const done: EncodeVideoDone = {
        success: data.success,
        exit_code: data.exit_code || 0,
      };
      this.emit("done", done);
      this.encoder = undefined;
    });

    this.encoder.on("error", (data) => {
      if (this.stopped) return;

      const error: EncodeVideoError = {
        message: data.message,
      };
      this.emit("error", error);
    });

    // Start encoding
    this.emit("log", {
      stream: "system",
      message: `Starting video encoding with KML overlay`,
    });

    this.encoder.start().catch((err) => {
      this.emit("error", { message: err.message });
      this.emit("done", { success: false, exit_code: 1 });
    });
  }

  /**
   * Stop the running encoding.
   */
  stop(): void {
    this.stopped = true;
    if (this.encoder) {
      this.encoder.stop();
      this.emit("log", {
        stream: "system",
        message: "EncodeVideoWorker stopped",
      });
    }
  }
}

/**
 * Convenience helper to run an encode job and await its completion.
 */
export function runEncodeVideoJob(
  options: EncodeVideoWorkerOptions,
): Promise<EncodeVideoDone> {
  return new Promise((resolve, reject) => {
    const worker = new EncodeVideoWorker(options);
    let resolved = false;

    worker.on("done", (d) => {
      if (!resolved) {
        resolved = true;
        resolve(d);
      }
    });

    worker.on("error", (e) => {
      if (!resolved) {
        resolved = true;
        reject(e);
      }
    });

    worker.start();
  });
}

export default EncodeVideoWorker;
