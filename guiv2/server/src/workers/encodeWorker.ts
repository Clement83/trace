/**
 * encodeWorker.ts
 *
 * Worker abstraction to start an encoder process (real or simulated) and emit
 * typed events for progress, logs, completion and errors.
 *
 * Usage:
 *   const w = new EncodeWorker({ offset: 1.5, cmd: '/usr/bin/ffmpeg', args: ['-i', 'in.mp4', '-ss', '{offset}', 'out.mp4'] });
 *   w.on('progress', (p) => console.log('progress', p));
 *   w.on('log', (l) => console.log('log', l));
 *   w.on('done', (d) => console.log('done', d));
 *   w.start();
 *
 * If `cmd` is omitted, the worker runs a simulated job useful for UI/dev testing.
 *
 * Note for ESM consumers (Node with "module": "nodenext"):
 *   Import this module using the .js extension after TypeScript compilation, for example:
 *     import { EncodeWorker } from './workers/encodeWorker.js';
 *   The backend index.ts already imports the compiled JS with that extension to satisfy Node's ESM resolver.
 */

import { spawn } from "child_process";
import { EventEmitter } from "events";

export type ProgressEvent = { percent: number; message?: string };
export type LogEvent = {
  message: string;
  stream?: "stdout" | "stderr" | "system";
};
export type DoneEvent = { success: boolean; exitCode?: number };
export type ErrorEvent = { message: string };

export type WorkerEvents = {
  progress: (p: ProgressEvent) => void;
  log: (l: LogEvent) => void;
  done: (d: DoneEvent) => void;
  error: (e: ErrorEvent) => void;
};

export interface EncodeWorkerOptions {
  offset: number;
  /**
   * If provided, this is the executable to spawn (no shell interpolation).
   * If not provided, the worker will simulate progress (useful for testing).
   */
  cmd?: string;
  /**
   * Array of arguments for the command. Use the token "{offset}" which will be
   * replaced by the numeric offset value. Example:
   *   ['-i', '/in.mp4', '-ss', '{offset}', '-c', 'copy', '/out.mp4']
   */
  args?: string[];
  /**
   * If true, forces simulation even if cmd is provided (handy for local testing).
   */
  simulate?: boolean;
  /**
   * Optional environment variables for the spawned process.
   */
  env?: NodeJS.ProcessEnv;
  /**
   * How frequently (ms) to emit simulated progress steps when simulating.
   */
  simulateIntervalMs?: number;
  /**
   * How many simulated steps (higher means slower simulated job).
   */
  simulateSteps?: number;
}

/**
 * EncodeWorker
 *
 * Emits events:
 *  - 'progress' with ProgressEvent
 *  - 'log' with LogEvent
 *  - 'done' with DoneEvent
 *  - 'error' with ErrorEvent
 *
 * The class extends EventEmitter for simple usage.
 */
export class EncodeWorker extends EventEmitter {
  private options: EncodeWorkerOptions;
  // Use a flexible runtime type for the spawned process to avoid strict child-process typing issues.
  // We ensure runtime checks where necessary; this keeps the TypeScript compile step simpler.
  private proc: any | undefined;
  private status: "idle" | "running" | "done" | "error" = "idle";

  // For simulation internals
  private simIntervalHandle?: NodeJS.Timeout;
  private simStep = 0;

  // Last reported percent to avoid regressing
  private lastPercent = 0;

  constructor(options: EncodeWorkerOptions) {
    super();
    this.options = {
      simulateIntervalMs: 400,
      simulateSteps: 20,
      ...options,
    };
  }

  /**
   * Start the worker. If a cmd is provided and simulate is false, it will spawn
   * the provided executable. Otherwise, it will run a simulated job.
   */
  start() {
    if (this.status === "running") {
      this.emitLog("Worker already running", "system");
      return;
    }

    this.status = "running";
    this.lastPercent = 0;
    this.simStep = 0;

    const { cmd, simulate } = this.options;

    if (!cmd || simulate) {
      this.emitLog(
        "Starting simulated encoder (no command configured or simulate=true)",
        "system",
      );
      this.startSimulated();
      return;
    }

    this.startRealProcess();
  }

  /**
   * Stop the worker. If a real process is running, attempts to kill it.
   * If a simulation is running, it will be cleared.
   */
  stop() {
    if (this.proc) {
      try {
        this.emitLog("Killing encoder process...", "system");
        this.proc.kill();
      } catch (err: any) {
        this.emitError(`Failed to kill process: ${String(err)}`);
      } finally {
        this.proc = undefined;
      }
    }

    if (this.simIntervalHandle) {
      clearInterval(this.simIntervalHandle);
      this.simIntervalHandle = undefined;
    }

    if (this.status === "running") {
      this.status = "done";
      this.emitDone({ success: false });
    }
  }

  /**
   * Start a simulated worker that emits periodic progress/log events.
   */
  private startSimulated() {
    const steps = Math.max(1, Number(this.options.simulateSteps ?? 20));
    const intervalMs = Math.max(
      50,
      Number(this.options.simulateIntervalMs ?? 400),
    );
    this.simStep = 0;

    this.simIntervalHandle = setInterval(() => {
      this.simStep += 1;
      const percent = Math.min(100, Math.round((this.simStep / steps) * 100));
      this.emitProgress({ percent, message: `Step ${this.simStep}/${steps}` });
      this.emitLog(
        `Simulated encoder: offset=${this.options.offset} step=${this.simStep}`,
        "stdout",
      );

      // small safeguard to ensure percent doesn't go backwards
      if (percent >= 100 || this.simStep >= steps) {
        if (this.simIntervalHandle) {
          clearInterval(this.simIntervalHandle);
          this.simIntervalHandle = undefined;
        }
        this.status = "done";
        this.emitDone({ success: true, exitCode: 0 });
      }
    }, intervalMs);
  }

  /**
   * Start a real encoder process using spawn.
   * Replaces token "{offset}" in args with the provided offset.
   */
  private startRealProcess() {
    const cmd = this.options.cmd!;
    const rawArgs = Array.isArray(this.options.args) ? this.options.args : [];
    const offsetStr = String(this.options.offset);

    const args = rawArgs.map((a) => a.replace("{offset}", offsetStr));

    this.emitLog(`Spawning encoder: ${cmd} ${args.join(" ")}`, "system");

    try {
      this.proc = spawn(cmd, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ...(this.options.env ?? {}) },
      }) as any;

      this.proc.stdout.setEncoding("utf8");
      this.proc.stderr.setEncoding("utf8");

      this.proc.stdout.on("data", (chunk: string) => {
        const text = String(chunk);
        this.emitLog(text, "stdout");
        this.tryParseProgressFromChunk(text);
      });

      this.proc.stderr.on("data", (chunk: string) => {
        const text = String(chunk);
        this.emitLog(text, "stderr");
        this.tryParseProgressFromChunk(text);
      });

      this.proc.on("close", (code: number | null) => {
        this.proc = undefined;
        this.status = "done";
        const success = code === 0;
        this.emitDone({ success, exitCode: code ?? undefined });
      });

      this.proc.on("error", (err: any) => {
        this.proc = undefined;
        this.status = "error";
        this.emitError(String(err));
      });
    } catch (err: any) {
      this.status = "error";
      this.emitError(String(err));
    }
  }

  /**
   * Try to parse percent progress out of a stdout/stderr chunk.
   * This is best-effort. Common patterns:
   *   - "50%" present in the text
   *   - ffmpeg outputs "frame=..." "time=..." etc (hard to map to percent without duration)
   *
   * If a numeric percent is found, emit a progress event. Otherwise, as a
   * fallback, increment the lastPercent slowly (best-effort heuristic).
   */
  private tryParseProgressFromChunk(chunk: string) {
    const pctMatch = chunk.match(/(\d{1,3})\s?%/);
    if (pctMatch) {
      const parsed = Math.max(0, Math.min(100, Number(pctMatch[1])));
      this.emitProgress({ percent: parsed });
      return;
    }

    // Try to match ffmpeg-ish "time=" patterns; without a total duration we can't compute percent.
    // So we fallback to heuristic increment: small bump when we see activity, capped at 98.
    const activityMatch =
      /time=\s*([\d:.]+)/.test(chunk) ||
      /frame=\s*\d+/.test(chunk) ||
      /progress=/.test(chunk);
    if (activityMatch) {
      let next = this.lastPercent + 2;
      if (next > 98) next = 98;
      this.emitProgress({ percent: next });
    }
  }

  /* ---------------------- event emitters (typed helpers) ---------------------- */

  private emitProgress(p: ProgressEvent) {
    // ensure monotonic increase except when 100
    const pct = Math.max(0, Math.min(100, Math.round(p.percent)));
    if (pct > this.lastPercent || pct === 100) {
      this.lastPercent = pct;
      this.emit("progress", { percent: pct, message: p.message });
    }
  }

  private emitLog(message: string, stream?: LogEvent["stream"]) {
    this.emit("log", { message, stream });
  }

  private emitDone(d: DoneEvent) {
    // once done, ensure we report 100%
    if (this.lastPercent < 100) {
      this.lastPercent = 100;
      this.emit("progress", { percent: 100 });
    }
    this.emit("done", d);
  }

  private emitError(e: string) {
    this.status = "error";
    this.emit("error", { message: e });
  }
}

export default EncodeWorker;
