/**
 * sdConverter.ts
 *
 * SD video conversion using fluent-ffmpeg.
 * Replaces the Python video_to_sd module.
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import { EventEmitter } from 'events';

// Set ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

export interface SDConverterOptions {
  inputPath: string;
  outputPath: string;
  width?: number;
  crf?: number;
  preset?: string;
  audioBitrate?: string;
  overwrite?: boolean;
}

export interface SDProgress {
  percent?: number;
  timeSeconds?: number;
  fps?: number;
  frames?: number;
}

export class SDConverter extends EventEmitter {
  private options: SDConverterOptions;
  private command?: ffmpeg.FfmpegCommand;
  private stopped = false;

  constructor(options: SDConverterOptions) {
    super();
    this.options = {
      width: 640,
      crf: 28,
      preset: 'veryfast',
      audioBitrate: '96k',
      overwrite: true,
      ...options,
    };
  }

  async start(): Promise<void> {
    if (this.command) {
      this.emit('error', { message: 'Conversion already running' });
      return;
    }

    this.stopped = false;

    return new Promise((resolve, reject) => {
      try {
        this.command = ffmpeg(this.options.inputPath);

        // Video settings - optimized for browser compatibility
        this.command
          .videoCodec('libx264')
          .addOption('-preset', this.options.preset!)
          .addOption('-crf', String(this.options.crf!))
          .addOption('-profile:v', 'baseline')
          .addOption('-level', '3.1')
          .addOption('-pix_fmt', 'yuv420p')
          .size(`${this.options.width}x?`)
          .autopad();

        // Audio settings
        this.command
          .audioCodec('aac')
          .audioBitrate(this.options.audioBitrate!)
          .audioFrequency(48000);

        // MP4 settings for web streaming
        this.command.format('mp4').addOption('-movflags', '+faststart');

        // Overwrite if needed
        if (this.options.overwrite) {
          this.command.addOption('-y');
        }

        // Output path
        this.command.output(this.options.outputPath);

        // Progress tracking
        this.command.on('progress', (progress: any) => {
          if (this.stopped) return;

          const progressData: SDProgress = {
            percent: progress.percent,
            timeSeconds: progress.timemark
              ? this.parseTimemark(progress.timemark)
              : undefined,
            fps: progress.currentFps,
            frames: progress.frames,
          };

          this.emit('progress', progressData);
          this.emit('log', {
            stream: 'system',
            message: `Progress: ${progress.percent?.toFixed(1)}%`,
          });
        });

        // Error handling
        this.command.on('error', (err: Error) => {
          if (this.stopped) {
            this.emit('log', {
              stream: 'system',
              message: 'Conversion stopped',
            });
            resolve();
            return;
          }

          this.emit('error', { message: err.message });
          this.emit('done', { success: false, exit_code: 1 });
          reject(err);
        });

        // Completion
        this.command.on('end', () => {
          if (this.stopped) {
            this.emit('log', {
              stream: 'system',
              message: 'Conversion stopped',
            });
            resolve();
            return;
          }

          this.emit('progress', { percent: 100 });
          this.emit('done', { success: true, exit_code: 0 });
          this.emit('log', {
            stream: 'system',
            message: 'Conversion complete',
          });
          resolve();
        });

        // Start conversion
        this.emit('log', {
          stream: 'system',
          message: `Starting SD conversion: ${this.options.inputPath} -> ${this.options.outputPath}`,
        });

        this.command.run();
      } catch (err: any) {
        this.emit('error', { message: err.message });
        reject(err);
      }
    });
  }

  stop(): void {
    this.stopped = true;
    if (this.command) {
      try {
        this.command.kill('SIGKILL');
      } catch (err: any) {
        this.emit('log', {
          stream: 'system',
          message: `Failed to stop conversion: ${err.message}`,
        });
      }
    }
  }

  private parseTimemark(timemark: string): number {
    // Parse "HH:MM:SS.ms" to seconds
    const parts = timemark.split(':');
    if (parts.length === 3) {
      const hours = parseFloat(parts[0]);
      const minutes = parseFloat(parts[1]);
      const seconds = parseFloat(parts[2]);
      return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
  }
}

export async function convertToSD(
  options: SDConverterOptions
): Promise<{ success: boolean; exit_code: number }> {
  return new Promise((resolve, reject) => {
    const converter = new SDConverter(options);
    let resolved = false;

    converter.on('done', (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    });

    converter.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(err.message));
      }
    });

    converter.start().catch(reject);
  });
}
