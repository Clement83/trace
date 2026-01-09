/**
 * sdWorker.ts
 *
 * SD generation worker using native TypeScript/Node.js implementation.
 * Uses fluent-ffmpeg instead of Python scripts.
 *
 * Events emitted:
 *  - 'progress' : { percent?: number | null, time_seconds?: number | null }
 *  - 'log'      : { stream?: 'stdout' | 'stderr' | 'system', message: string }
 *  - 'done'     : { success: boolean, exit_code?: number }
 *  - 'error'    : { message: string }
 *
 * Usage:
 *   const w = new SDWorker({ inputPath, outputPath });
 *   w.on('progress', (p) => console.log('progress', p));
 *   w.on('log', (l) => console.log('log', l));
 *   w.on('done', (d) => console.log('done', d));
 *   w.start();
 */

import { EventEmitter } from "events";
import { SDConverter } from "../lib/sdConverter";

export type SDProgress = {
  percent?: number | null;
  time_seconds?: number | null;
  [k: string]: any;
};

export type SDLog = {
  stream?: "stdout" | "stderr" | "system";
  message: string;
  [k: string]: any;
};

export type SDDone = {
  success: boolean;
  exit_code?: number | null;
  [k: string]: any;
};

export type SDError = {
  message: string;
  [k: string]: any;
};

export type SDWorkerEvents = {
  progress: (p: SDProgress) => void;
  log: (l: SDLog) => void;
  done: (d: SDDone) => void;
  error: (e: SDError) => void;
};

export interface SDWorkerOptions {
  inputPath: string;
  outputPath: string;
  width?: number;
  crf?: number;
  preset?: string;
  audioBitrate?: string;
  overwrite?: boolean;
  simulate?: boolean;
  onLog?: (msg: string) => void;
}

/**
 * SDWorker
 *
 * Manage an SD generation process using native TypeScript implementation.
 */
export class SDWorker extends EventEmitter {
  private options: SDWorkerOptions;
  private converter?: SDConverter;
  private stopped = false;

  constructor(options: SDWorkerOptions) {
    super();
    this.options = {
      width: 640,
      crf: 28,
      preset: "veryfast",
      audioBitrate: "96k",
      overwrite: true,
      simulate: false,
      ...options,
    };
  }

  /**
   * Start the SD generation process. Emits events based on conversion progress.
   */
  start(): void {
    if (this.converter) {
      this.emit("log", {
        stream: "system",
        message: "SDWorker already running",
      });
      return;
    }
    this.stopped = false;

    // If simulate mode, emit fake events and return
    if (this.options.simulate) {
      this.emit("log", {
        stream: "system",
        message: "[SIMULATE] SD generation",
      });
      setTimeout(() => {
        this.emit("progress", { percent: 50, time_seconds: 5 });
      }, 1000);
      setTimeout(() => {
        this.emit("progress", { percent: 100, time_seconds: 10 });
        this.emit("done", { success: true, exit_code: 0 });
      }, 2000);
      return;
    }

    // Create converter instance
    this.converter = new SDConverter({
      inputPath: this.options.inputPath,
      outputPath: this.options.outputPath,
      width: this.options.width,
      crf: this.options.crf,
      preset: this.options.preset,
      audioBitrate: this.options.audioBitrate,
      overwrite: this.options.overwrite,
    });

    // Forward events
    this.converter.on("progress", (data) => {
      if (this.stopped) return;

      const progress: SDProgress = {
        percent: data.percent,
        time_seconds: data.timeSeconds,
      };
      this.emit("progress", progress);
    });

    this.converter.on("log", (data) => {
      if (this.stopped) return;

      const log: SDLog = {
        stream: data.stream || "system",
        message: data.message,
      };
      this.emit("log", log);
      if (this.options.onLog) {
        this.options.onLog(data.message);
      }
    });

    this.converter.on("done", (data) => {
      const done: SDDone = {
        success: data.success,
        exit_code: data.exit_code || 0,
      };
      this.emit("done", done);
      this.converter = undefined;
    });

    this.converter.on("error", (data) => {
      if (this.stopped) return;

      const error: SDError = {
        message: data.message,
      };
      this.emit("error", error);
    });

    // Start conversion
    this.emit("log", {
      stream: "system",
      message: `Starting SD conversion: ${this.options.inputPath}`,
    });

    this.converter.start().catch((err) => {
      this.emit("error", { message: err.message });
      this.emit("done", { success: false, exit_code: 1 });
    });
  }

  /**
   * Stop the running conversion.
   */
  stop(): void {
    this.stopped = true;
    if (this.converter) {
      this.converter.stop();
      this.emit("log", { stream: "system", message: "SDWorker stopped" });
    }
  }
}

/**
 * Convenience helper to run an SD job and await its completion.
 */
export function runSdJob(options: SDWorkerOptions): Promise<SDDone> {
  return new Promise((resolve, reject) => {
    const worker = new SDWorker(options);
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

export default SDWorker;
