/**
 * videoOverlay.ts
 *
 * Add speed overlay to video using fluent-ffmpeg and KML data.
 * Replaces the Python klm_to_video module.
 */

import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffprobePath from "@ffprobe-installer/ffprobe";
import { EventEmitter } from "events";
import { Point, loadAndProcess } from "./kmlParser";
import { KmlSummary, KmlCoordinate } from "../workspace";
import fs from "fs";
import os from "os";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

export interface VideoOverlayOptions {
  kmlPath?: string;
  kmlSummary?: KmlSummary; // Alternative: use pre-parsed KML data from workspace
  videoPath: string;
  outputPath: string;
  kmlOffsetSeconds?: number;
  showSpeed?: boolean;
  showAltitude?: boolean;
  showCoordinates?: boolean;
  showTime?: boolean;
  showMap?: boolean;
  speedUnit?: "kmh" | "ms";
  speedPos?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  speedSize?: "small" | "medium" | "large";
  fontPath?: string;
  fps?: number;
}

export interface OverlayProgress {
  percent?: number;
  timeSeconds?: number;
  message?: string;
}

export class VideoOverlay extends EventEmitter {
  private options: VideoOverlayOptions;
  private command?: ffmpeg.FfmpegCommand;
  private stopped = false;
  private points: Point[] = [];
  private kmlCoords?: KmlCoordinate[]; // Alternative: use workspace KML data
  private videoDuration = 0;

  constructor(options: VideoOverlayOptions) {
    super();

    if (!options.kmlPath && !options.kmlSummary) {
      throw new Error("Either kmlPath or kmlSummary must be provided");
    }

    this.options = {
      kmlOffsetSeconds: 0,
      showSpeed: true,
      speedUnit: "kmh",
      speedPos: "bottom-right",
      speedSize: "medium",
      ...options,
    };
  }

  async start(): Promise<void> {
    if (this.command) {
      this.emit("error", { message: "Encoding already running" });
      return;
    }

    this.stopped = false;

    try {
      // Parse KML or use pre-parsed data
      this.emit("progress", { percent: 5, message: "Loading KML data..." });

      if (this.options.kmlSummary && this.options.kmlSummary.coords) {
        // Use pre-parsed workspace KML data (faster!)
        this.emit("log", {
          stream: "system",
          message: "Using pre-parsed KML data from workspace...",
        });
        this.kmlCoords = this.options.kmlSummary.coords;

        if (this.kmlCoords.length === 0) {
          throw new Error("No coordinates found in KML summary");
        }

        this.emit("log", {
          stream: "system",
          message: `Loaded ${this.kmlCoords.length} GPS coordinates from workspace`,
        });

        // Sort coordinates by timestamp to ensure correct speed calculation
        this.kmlCoords.sort((a, b) => {
          if (!a.timestamp || !b.timestamp) return 0;
          return a.timestamp - b.timestamp;
        });

        this.emit("log", {
          stream: "system",
          message: `Sorted ${this.kmlCoords.length} GPS coordinates by timestamp`,
        });
      } else if (this.options.kmlPath) {
        // Fall back to parsing KML file
        this.emit("log", { stream: "system", message: "Parsing KML file..." });
        this.points = loadAndProcess(this.options.kmlPath);

        if (this.points.length === 0) {
          throw new Error("No points found in KML file");
        }

        this.emit("log", {
          stream: "system",
          message: `Loaded ${this.points.length} GPS points`,
        });
      }

      // Get video duration
      this.emit("progress", { percent: 10, message: "Analyzing video..." });
      this.videoDuration = await this.getVideoDuration();

      this.emit("log", {
        stream: "system",
        message: `Video duration: ${this.videoDuration.toFixed(2)}s`,
      });

      this.emit("log", {
        stream: "system",
        message: `KML offset: ${this.options.kmlOffsetSeconds || 0}s`,
      });

      // Start encoding
      this.emit("progress", {
        percent: 15,
        message: "Starting video encoding...",
      });
      await this.encodeWithOverlay();
    } catch (err: any) {
      this.emit("error", { message: err.message });
      this.emit("done", { success: false, exit_code: 1 });
      throw err;
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.command) {
      try {
        this.command.kill("SIGKILL");
      } catch (err: any) {
        this.emit("log", {
          stream: "system",
          message: `Failed to stop encoding: ${err.message}`,
        });
      }
    }
  }

  private async getVideoDuration(): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(this.options.videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(metadata.format.duration || 0);
      });
    });
  }

  /**
   * Generate a complete animated speedometer video file using canvas.
   * Returns the path to the generated video file.
   */
  private async generateSpeedometerVideo(): Promise<string> {
    const { speedSize } = this.options;
    const { createCanvas } = await import("canvas");

    // Determine speedometer size
    const size =
      speedSize === "large" ? 200 : speedSize === "medium" ? 150 : 120;

    this.emit("log", {
      stream: "system",
      message: `Generating animated speedometer video (${size}x${size}px)...`,
    });

    const duration = Math.ceil(this.videoDuration);
    const fps = 5; // 5 frames per second for smooth interpolation

    // Create temporary directory for frames
    const framesDir = path.join(
      os.tmpdir(),
      `speedometer_frames_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    );
    await fs.promises.mkdir(framesDir, { recursive: true });

    // Generate frames with interpolation
    let frameIndex = 0;
    for (let sec = 0; sec < duration; sec++) {
      // Generate multiple frames per second for smooth interpolation
      for (let subFrame = 0; subFrame < fps; subFrame++) {
        const timeSeconds = sec + subFrame / fps;
        const speed = this.getInterpolatedSpeed(timeSeconds);
        const speedKmh = speed || 0;

        // Generate speedometer image for this speed
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext("2d");

        // Clear with transparent background
        ctx.clearRect(0, 0, size, size);

        const cx = size / 2;
        const cy = size / 2;
        const r = size * 0.42;

        // Background circle (semi-transparent)
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(20, 20, 20, 0.5)";
        ctx.fill();
        ctx.strokeStyle = "rgba(200, 200, 200, 1)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw ticks and labels
        const numTicks = 7;
        const startAngle = -120;
        const endAngle = 120;
        for (let i = 0; i < numTicks; i++) {
          const angle =
            ((startAngle + ((endAngle - startAngle) * i) / (numTicks - 1)) *
              Math.PI) /
            180;
          const innerR = r - 8;
          const outerR = r - 2;
          const x1 = cx + innerR * Math.cos(angle);
          const y1 = cy + innerR * Math.sin(angle);
          const x2 = cx + outerR * Math.cos(angle);
          const y2 = cy + outerR * Math.sin(angle);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = "rgba(220, 220, 220, 1)";
          ctx.lineWidth = Math.max(1, size / 70);
          ctx.stroke();

          // Draw label
          const speedLabel = Math.round((60 * i) / (numTicks - 1));
          const labelR = r - 20;
          const labelX = cx + labelR * Math.cos(angle);
          const labelY = cy + labelR * Math.sin(angle);
          ctx.fillStyle = "rgba(255, 255, 255, 1)";
          ctx.font = `${Math.max(10, size * 0.08)}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(speedLabel.toString(), labelX, labelY);
        }

        // Calculate needle angle
        const speedPercent = Math.min(1, Math.max(0, speedKmh / 60));
        const needleAngle =
          ((startAngle + (endAngle - startAngle) * speedPercent) * Math.PI) /
          180;
        const needleLen = r * 0.85;
        const nx = cx + needleLen * Math.cos(needleAngle);
        const ny = cy + needleLen * Math.sin(needleAngle);

        // Draw needle
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = "rgba(255, 50, 50, 1)";
        ctx.lineWidth = Math.max(3, size / 30);
        ctx.lineCap = "round";
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.fill();

        // Speed value text (positioned to the left of center)
        const speedText = Math.round(speedKmh).toString();
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.font = `bold ${Math.max(14, size * 0.14)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(speedText, cx - r * 0.5, cy);

        // Unit label (below the speed value)
        ctx.font = `${Math.max(10, size * 0.08)}px Arial`;
        ctx.fillText("km/h", cx - r * 0.5, cy + r * 0.25);

        // Save frame
        const frameBuffer = canvas.toBuffer("image/png");
        const framePath = path.join(
          framesDir,
          `frame_${frameIndex.toString().padStart(6, "0")}.png`,
        );
        await fs.promises.writeFile(framePath, frameBuffer);
        frameIndex++;
      }
    }

    this.emit("log", {
      stream: "system",
      message: `Generated ${frameIndex} speedometer frames`,
    });

    // Create video from frames using ffmpeg
    const speedometerVideoPath = path.join(
      os.tmpdir(),
      `speedometer_video_${Date.now()}.mov`,
    );

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(path.join(framesDir, "frame_%06d.png"))
        .inputOptions(["-framerate", fps.toString()])
        .videoCodec("qtrle") // QuickTime Animation codec - supports alpha
        .addOption("-t", duration.toString())
        .outputFormat("mov") // MOV format supports alpha better
        .output(speedometerVideoPath.replace(".mp4", ".mov"))
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    // Cleanup frames
    const files = await fs.promises.readdir(framesDir);
    for (const file of files) {
      await fs.promises.unlink(path.join(framesDir, file));
    }
    await fs.promises.rmdir(framesDir);

    this.emit("log", {
      stream: "system",
      message: `Speedometer video created: ${speedometerVideoPath.replace(".mp4", ".mov")}`,
    });

    return speedometerVideoPath.replace(".mp4", ".mov");
  }

  /**
   * Generate a complete animated info overlay video file using canvas.
   * Returns the path to the generated video file.
   */
  private async generateInfoOverlayVideo(): Promise<string> {
    const { createCanvas } = await import("canvas");
    const { showAltitude, showCoordinates, showTime } = this.options;

    // Only generate if at least one option is enabled (excluding speed which has its own tachometer)
    if (!showAltitude && !showCoordinates && !showTime) {
      throw new Error("No overlay options enabled");
    }

    // Determine overlay size based on content
    const width = 280;
    const padding = 12;
    const lineHeight = 22;
    const fontSize = 14;

    // Count enabled options (speed is handled by tachometer)
    let lineCount = 0;
    if (showAltitude) lineCount++;
    if (showCoordinates) lineCount += 2; // lat + lon on separate lines
    if (showTime) lineCount++;

    const height = padding * 2 + lineCount * lineHeight;

    this.emit("log", {
      stream: "system",
      message: `Generating animated info overlay video (${width}x${height}px)...`,
    });

    const duration = Math.ceil(this.videoDuration);
    const fps = 5; // 5 frames per second for smooth updates

    // Create temporary directory for frames
    const framesDir = path.join(
      os.tmpdir(),
      `info_overlay_frames_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    );
    await fs.promises.mkdir(framesDir, { recursive: true });

    // Generate frames
    let frameIndex = 0;
    for (let sec = 0; sec < duration; sec++) {
      for (let subFrame = 0; subFrame < fps; subFrame++) {
        const timeSeconds = sec + subFrame / fps;

        // Get data at this time
        const coord = this.getCoordAtTime(timeSeconds);

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");

        // Draw text only (no background box or border)
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        let yPos = padding;

        if (showAltitude && coord?.alt !== undefined) {
          const altMeters = Math.round(coord.alt);
          ctx.fillText(`Altitude: ${altMeters} m`, padding, yPos);
          yPos += lineHeight;
        }

        if (showCoordinates && coord) {
          const lat = coord.lat.toFixed(6);
          const lon = coord.lon.toFixed(6);
          ctx.fillText(`Lat: ${lat}°`, padding, yPos);
          yPos += lineHeight;
          ctx.fillText(`Lon: ${lon}°`, padding, yPos);
          yPos += lineHeight;
        }

        if (showTime && coord?.timestamp !== undefined) {
          const date = new Date(coord.timestamp);
          const timeStr = date.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          ctx.fillText(`Heure: ${timeStr}`, padding, yPos);
          yPos += lineHeight;
        }

        // Save frame
        const frameBuffer = canvas.toBuffer("image/png");
        const framePath = path.join(
          framesDir,
          `frame_${frameIndex.toString().padStart(6, "0")}.png`,
        );
        await fs.promises.writeFile(framePath, frameBuffer);
        frameIndex++;
      }
    }

    this.emit("log", {
      stream: "system",
      message: `Generated ${frameIndex} info overlay frames`,
    });

    // Create video from frames using ffmpeg
    const infoOverlayVideoPath = path.join(
      os.tmpdir(),
      `info_overlay_video_${Date.now()}.mov`,
    );

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(path.join(framesDir, "frame_%06d.png"))
        .inputOptions(["-framerate", fps.toString()])
        .videoCodec("qtrle") // QuickTime Animation codec - supports alpha
        .addOption("-t", duration.toString())
        .outputFormat("mov") // MOV format supports alpha better
        .output(infoOverlayVideoPath.replace(".mp4", ".mov"))
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    // Cleanup frames
    const files = await fs.promises.readdir(framesDir);
    for (const file of files) {
      await fs.promises.unlink(path.join(framesDir, file));
    }
    await fs.promises.rmdir(framesDir);

    this.emit("log", {
      stream: "system",
      message: `Info overlay video created: ${infoOverlayVideoPath.replace(".mp4", ".mov")}`,
    });

    return infoOverlayVideoPath.replace(".mp4", ".mov");
  }

  /**
   * Generate a complete animated map overlay video file using canvas.
   * Returns the path to the generated video file.
   */
  private async generateMapOverlayVideo(): Promise<string> {
    const { createCanvas, loadImage } = await import("canvas");

    if (!this.kmlCoords || this.kmlCoords.length === 0) {
      throw new Error("No KML coordinates available for map generation");
    }

    // Map size (small, top-right corner)
    const width = 300;
    const height = 200;
    const padding = 10;

    this.emit("log", {
      stream: "system",
      message: `Generating animated map overlay video (${width}x${height}px)...`,
    });

    const duration = Math.ceil(this.videoDuration);
    const fps = 5;

    // Calculate bounds of the entire track
    let minLat = Infinity,
      maxLat = -Infinity;
    let minLon = Infinity,
      maxLon = -Infinity;
    for (const coord of this.kmlCoords) {
      if (coord.lat < minLat) minLat = coord.lat;
      if (coord.lat > maxLat) maxLat = coord.lat;
      if (coord.lon < minLon) minLon = coord.lon;
      if (coord.lon > maxLon) maxLon = coord.lon;
    }

    const latRange = maxLat - minLat;
    const lonRange = maxLon - minLon;

    // Calculate center and zoom for static map
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;

    // Estimate zoom level based on bounds
    const zoom = Math.min(
      Math.floor(Math.log2((360 * (width - 2 * padding)) / (lonRange * 256))),
      Math.floor(Math.log2((180 * (height - 2 * padding)) / (latRange * 256))),
      18,
    );

    // Download static map tile once
    this.emit("log", {
      stream: "system",
      message: `Downloading base map tile (zoom ${zoom})...`,
    });

    let baseMapImage;
    try {
      // Use OpenStreetMap static map API
      const mapUrl = `https://tile.openstreetmap.org/${zoom}/${Math.floor(((centerLon + 180) / 360) * Math.pow(2, zoom))}/${Math.floor(((1 - Math.log(Math.tan((centerLat * Math.PI) / 180) + 1 / Math.cos((centerLat * Math.PI) / 180)) / Math.PI) / 2) * Math.pow(2, zoom))}.png`;

      const https = await import("https");
      baseMapImage = await new Promise<any>((resolve, reject) => {
        https
          .get(
            mapUrl,
            {
              headers: {
                "User-Agent": "KMLToVideo/1.0",
              },
            },
            (res) => {
              const chunks: any[] = [];
              res.on("data", (chunk) => chunks.push(chunk));
              res.on("end", () => {
                const buffer = Buffer.concat(chunks);
                loadImage(buffer).then(resolve).catch(reject);
              });
            },
          )
          .on("error", reject);
      });
    } catch (err) {
      this.emit("log", {
        stream: "system",
        message: `Could not download map tile, using simple background`,
      });
      baseMapImage = null;
    }

    // Helper function to convert lat/lon to canvas coordinates
    const toCanvasCoords = (lat: number, lon: number) => {
      const x = padding + ((lon - minLon) / lonRange) * (width - 2 * padding);
      const y =
        height - padding - ((lat - minLat) / latRange) * (height - 2 * padding);
      return { x, y };
    };

    // Create temporary directory for frames
    const framesDir = path.join(
      os.tmpdir(),
      `map_overlay_frames_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    );
    await fs.promises.mkdir(framesDir, { recursive: true });

    // Generate frames
    let frameIndex = 0;
    for (let sec = 0; sec < duration; sec++) {
      for (let subFrame = 0; subFrame < fps; subFrame++) {
        const timeSeconds = sec + subFrame / fps;
        const currentCoord = this.getCoordAtTime(timeSeconds);

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");

        // Draw base map if available with transparency
        if (baseMapImage) {
          // Draw the map tile with transparency
          ctx.globalAlpha = 0.7;
          ctx.drawImage(baseMapImage, 0, 0, width, height);
          ctx.globalAlpha = 1.0;
          // Add semi-transparent overlay for better contrast
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.fillRect(0, 0, width, height);
        } else {
          // Fallback: white map background
          ctx.fillStyle = "rgba(230, 235, 240, 1)";
          ctx.fillRect(0, 0, width, height);

          // Draw grid to simulate map tiles
          ctx.strokeStyle = "rgba(200, 205, 210, 0.4)";
          ctx.lineWidth = 1;
          const gridSize = 20;
          for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
        }

        // Border
        ctx.strokeStyle = "rgba(80, 80, 80, 0.8)";
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, width - 2, height - 2);

        // Draw entire track (dark gray line)
        ctx.strokeStyle = "rgba(100, 100, 100, 0.9)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < this.kmlCoords.length; i++) {
          const coord = this.kmlCoords[i];
          const { x, y } = toCanvasCoords(coord.lat, coord.lon);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Draw current section in color (blue)
        if (currentCoord) {
          const firstCoordWithTime = this.kmlCoords.find(
            (c) => c.timestamp != null,
          );
          if (firstCoordWithTime && firstCoordWithTime.timestamp != null) {
            const kmlStartTime = firstCoordWithTime.timestamp;
            const adjustedTime =
              timeSeconds + (this.options.kmlOffsetSeconds || 0);
            const targetTimestamp = kmlStartTime + adjustedTime * 1000;

            ctx.strokeStyle = "rgba(66, 135, 245, 1)";
            ctx.lineWidth = 4;
            ctx.beginPath();
            let started = false;
            for (let i = 0; i < this.kmlCoords.length; i++) {
              const coord = this.kmlCoords[i];
              if (coord.timestamp && coord.timestamp <= targetTimestamp) {
                const { x, y } = toCanvasCoords(coord.lat, coord.lon);
                if (!started) {
                  ctx.moveTo(x, y);
                  started = true;
                } else {
                  ctx.lineTo(x, y);
                }
              }
            }
            ctx.stroke();
          }

          // Draw current position marker (red dot)
          const { x, y } = toCanvasCoords(currentCoord.lat, currentCoord.lon);
          ctx.fillStyle = "rgba(255, 50, 50, 1)";
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();

          // White outline for visibility
          ctx.strokeStyle = "rgba(255, 255, 255, 1)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Save frame
        const frameBuffer = canvas.toBuffer("image/png");
        const framePath = path.join(
          framesDir,
          `frame_${frameIndex.toString().padStart(6, "0")}.png`,
        );
        await fs.promises.writeFile(framePath, frameBuffer);
        frameIndex++;
      }
    }

    this.emit("log", {
      stream: "system",
      message: `Generated ${frameIndex} map overlay frames`,
    });

    // Create video from frames using ffmpeg
    const mapOverlayVideoPath = path.join(
      os.tmpdir(),
      `map_overlay_video_${Date.now()}.mov`,
    );

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(path.join(framesDir, "frame_%06d.png"))
        .inputOptions(["-framerate", fps.toString()])
        .videoCodec("qtrle") // QuickTime Animation codec - supports alpha
        .addOption("-t", duration.toString())
        .outputFormat("mov") // MOV format supports alpha better
        .output(mapOverlayVideoPath.replace(".mp4", ".mov"))
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    // Cleanup frames
    const files = await fs.promises.readdir(framesDir);
    for (const file of files) {
      await fs.promises.unlink(path.join(framesDir, file));
    }
    await fs.promises.rmdir(framesDir);

    this.emit("log", {
      stream: "system",
      message: `Map overlay video created: ${mapOverlayVideoPath.replace(".mp4", ".mov")}`,
    });

    return mapOverlayVideoPath.replace(".mp4", ".mov");
  }

  /**
   * Get coordinate data at a specific video timestamp (in seconds).
   */
  private getCoordAtTime(videoTimeSeconds: number): KmlCoordinate | undefined {
    if (!this.kmlCoords || this.kmlCoords.length === 0) {
      return undefined;
    }

    const firstCoordWithTime = this.kmlCoords.find((c) => c.timestamp != null);
    if (!firstCoordWithTime || firstCoordWithTime.timestamp == null) {
      return undefined;
    }

    const kmlStartTime = firstCoordWithTime.timestamp;
    const adjustedTime =
      videoTimeSeconds + (this.options.kmlOffsetSeconds || 0);
    const targetTimestamp = kmlStartTime + adjustedTime * 1000;

    // Find closest coordinate
    let closestCoord: KmlCoordinate | undefined;
    let minDiff = Infinity;

    for (const coord of this.kmlCoords) {
      if (coord.timestamp == null) continue;
      const diff = Math.abs(coord.timestamp - targetTimestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closestCoord = coord;
      }
    }

    return closestCoord;
  }

  /**
   * Get interpolated speed at a specific video timestamp (in seconds).
   * Uses linear interpolation between two GPS points.
   */
  private getInterpolatedSpeed(videoTimeSeconds: number): number | undefined {
    // Use workspace KML data if available
    if (this.kmlCoords && this.kmlCoords.length > 0) {
      return this.getInterpolatedSpeedFromWorkspaceKml(videoTimeSeconds);
    }

    // Fall back to non-interpolated speed for Point-based data
    return this.getSpeedAtTime(videoTimeSeconds);
  }

  /**
   * Get speed at a specific video timestamp (in seconds).
   */
  private getSpeedAtTime(videoTimeSeconds: number): number | undefined {
    // Use workspace KML data if available
    if (this.kmlCoords && this.kmlCoords.length > 0) {
      return this.getSpeedFromWorkspaceKml(videoTimeSeconds);
    }

    // Fall back to Point-based data
    if (this.points.length === 0) return undefined;

    // Find first point with timestamp
    const firstPointWithTime = this.points.find((p) => p.time);
    if (!firstPointWithTime || !firstPointWithTime.time) return undefined;

    // Calculate target timestamp
    const kmlStartTime = firstPointWithTime.time;
    const adjustedTime =
      videoTimeSeconds + (this.options.kmlOffsetSeconds || 0);
    const targetTimestamp = new Date(
      kmlStartTime.getTime() + adjustedTime * 1000,
    );

    // Find closest point to target timestamp
    let closestPoint: Point | undefined;
    let minDiff = Infinity;

    for (const point of this.points) {
      if (!point.time) continue;

      const diff = Math.abs(point.time.getTime() - targetTimestamp.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closestPoint = point;
      }
    }

    if (this.options.speedUnit === "ms") {
      return closestPoint?.speedMs;
    }
    return closestPoint?.speedKmh;
  }

  /**
   * Calculate interpolated speed from workspace KML coordinates.
   * Uses linear interpolation between two GPS points for smooth transitions.
   */
  private getInterpolatedSpeedFromWorkspaceKml(
    videoTimeSeconds: number,
  ): number | undefined {
    if (!this.kmlCoords || this.kmlCoords.length === 0) return undefined;

    // Find first coordinate with timestamp
    const firstCoordWithTime = this.kmlCoords.find((c) => c.timestamp);
    if (!firstCoordWithTime || !firstCoordWithTime.timestamp) return undefined;

    // Calculate target timestamp (in milliseconds)
    const kmlStartTime = firstCoordWithTime.timestamp;
    const adjustedTime =
      videoTimeSeconds + (this.options.kmlOffsetSeconds || 0);
    const targetTimestamp = kmlStartTime + adjustedTime * 1000;

    // Find the last node with timestamp <= targetTimestamp
    let prevIdx = 0;
    for (let i = this.kmlCoords.length - 1; i >= 0; i--) {
      if (
        this.kmlCoords[i].timestamp &&
        this.kmlCoords[i].timestamp! <= targetTimestamp
      ) {
        prevIdx = i;
        break;
      }
    }

    const prevNode = this.kmlCoords[prevIdx];
    if (!prevNode.timestamp) return undefined;

    // Calculate speed if we have a next node
    if (prevIdx < this.kmlCoords.length - 1) {
      const nextNode = this.kmlCoords[prevIdx + 1];
      if (nextNode.timestamp && prevNode.timestamp) {
        // Calculate distance using Haversine formula (in kilometers)
        const distanceKm = this.haversineKm(
          prevNode.lat,
          prevNode.lon,
          nextNode.lat,
          nextNode.lon,
        );

        // Calculate time difference in seconds
        const timeDiffSeconds =
          (nextNode.timestamp - prevNode.timestamp) / 1000;

        if (timeDiffSeconds > 0) {
          // Speed in km/h
          const speedKmh = (distanceKm / timeDiffSeconds) * 3600;

          // For now, return constant speed between points (could interpolate based on acceleration)
          // In the future, could add acceleration-based interpolation using:
          // const timeSincePrev = (targetTimestamp - prevNode.timestamp) / 1000;
          // const interpolationFactor = timeSincePrev / timeDiffSeconds;

          if (this.options.speedUnit === "ms") {
            return speedKmh / 3.6; // Convert to m/s
          }
          return speedKmh;
        }
      }
    }

    return undefined;
  }

  /**
   * Calculate speed from workspace KML coordinates.
   * Uses the same algorithm as the UI: find previous node and calculate speed to next node.
   */
  private getSpeedFromWorkspaceKml(
    videoTimeSeconds: number,
  ): number | undefined {
    if (!this.kmlCoords || this.kmlCoords.length === 0) return undefined;

    // Find first coordinate with timestamp
    const firstCoordWithTime = this.kmlCoords.find((c) => c.timestamp);
    if (!firstCoordWithTime || !firstCoordWithTime.timestamp) return undefined;

    // Calculate target timestamp (in milliseconds)
    const kmlStartTime = firstCoordWithTime.timestamp;
    const adjustedTime =
      videoTimeSeconds + (this.options.kmlOffsetSeconds || 0);
    const targetTimestamp = kmlStartTime + adjustedTime * 1000;

    // Debug: log first calculation
    if (videoTimeSeconds === 0) {
      this.emit("log", {
        stream: "system",
        message: `[DEBUG] KML start time: ${new Date(kmlStartTime).toISOString()}, offset: ${this.options.kmlOffsetSeconds || 0}s, target: ${new Date(targetTimestamp).toISOString()}`,
      });
    }

    // Find the last node with timestamp <= targetTimestamp (same as UI)
    let prevIdx = 0;
    for (let i = this.kmlCoords.length - 1; i >= 0; i--) {
      if (
        this.kmlCoords[i].timestamp &&
        this.kmlCoords[i].timestamp! <= targetTimestamp
      ) {
        prevIdx = i;
        break;
      }
    }

    const prevNode = this.kmlCoords[prevIdx];
    if (!prevNode.timestamp) return undefined;

    // Calculate speed if we have a next node (same as UI)
    if (prevIdx < this.kmlCoords.length - 1) {
      const nextNode = this.kmlCoords[prevIdx + 1];
      if (nextNode.timestamp && prevNode.timestamp) {
        // Calculate distance using Haversine formula (in kilometers)
        const distanceKm = this.haversineKm(
          prevNode.lat,
          prevNode.lon,
          nextNode.lat,
          nextNode.lon,
        );

        // Calculate time difference in seconds
        const timeDiffSeconds =
          (nextNode.timestamp - prevNode.timestamp) / 1000;

        if (timeDiffSeconds > 0) {
          // Speed in km/h (same as UI: distance in km * 3600 / time in seconds)
          const speedKmh = (distanceKm / timeDiffSeconds) * 3600;

          // Debug: log first calculation
          if (videoTimeSeconds === 0) {
            this.emit("log", {
              stream: "system",
              message: `[DEBUG] Using nodes ${prevIdx} -> ${prevIdx + 1}`,
            });
            this.emit("log", {
              stream: "system",
              message: `[DEBUG] Distance: ${(distanceKm * 1000).toFixed(2)}m, TimeDiff: ${timeDiffSeconds.toFixed(2)}s, Speed: ${speedKmh.toFixed(2)}km/h`,
            });
          }

          if (this.options.speedUnit === "ms") {
            return speedKmh / 3.6; // Convert to m/s
          }
          return speedKmh;
        }
      }
    }

    return undefined;
  }

  /**
   * Haversine formula to calculate distance between two GPS coordinates.
   * Returns distance in kilometers (used for speed calculation like in UI).
   */
  private haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in km
  }

  private async encodeWithOverlay(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      let speedometerVideoPath: string | undefined;
      let infoOverlayVideoPath: string | undefined;
      let mapOverlayVideoPath: string | undefined;

      try {
        // Generate speedometer video if speed overlay is enabled
        if (this.options.showSpeed) {
          this.emit("log", {
            stream: "system",
            message: "Generating speedometer overlay...",
          });

          speedometerVideoPath = await this.generateSpeedometerVideo();

          this.emit("log", {
            stream: "system",
            message: `Speedometer overlay ready`,
          });
        }

        // Generate info overlay video if any info option is enabled (excluding speed which has tachometer)
        const hasInfoOverlay =
          this.options.showAltitude ||
          this.options.showCoordinates ||
          this.options.showTime;

        if (hasInfoOverlay) {
          this.emit("log", {
            stream: "system",
            message: "Generating info overlay...",
          });

          infoOverlayVideoPath = await this.generateInfoOverlayVideo();

          this.emit("log", {
            stream: "system",
            message: `Info overlay ready`,
          });
        }

        // Generate map overlay video if map option is enabled
        if (this.options.showMap) {
          this.emit("log", {
            stream: "system",
            message: "Generating map overlay...",
          });

          mapOverlayVideoPath = await this.generateMapOverlayVideo();

          this.emit("log", {
            stream: "system",
            message: `Map overlay ready`,
          });
        }

        this.command = ffmpeg(this.options.videoPath);

        // Add overlays as inputs
        let inputIndex = 1;
        if (speedometerVideoPath) {
          this.command.input(speedometerVideoPath);
          inputIndex++;
        }
        if (infoOverlayVideoPath) {
          this.command.input(infoOverlayVideoPath);
          inputIndex++;
        }
        if (mapOverlayVideoPath) {
          this.command.input(mapOverlayVideoPath);
        }

        // Video settings - maintain quality
        this.command
          .videoCodec("libx264")
          .addOption("-preset", "medium")
          .addOption("-crf", "23")
          .addOption("-pix_fmt", "yuv420p");

        // Build complex filter for overlays
        if (
          speedometerVideoPath ||
          infoOverlayVideoPath ||
          mapOverlayVideoPath
        ) {
          const filters: string[] = [];
          let currentInput = "[0:v]";
          let filterIndex = 1;

          // Add speedometer overlay at bottom-right
          if (speedometerVideoPath) {
            this.emit("log", {
              stream: "system",
              message: `[DEBUG] Adding speedometer overlay at bottom-right`,
            });
            const overlayPos = "main_w-overlay_w-10:main_h-overlay_h-10";
            const outputLabel =
              infoOverlayVideoPath || mapOverlayVideoPath
                ? `[tmp${filterIndex}]`
                : "";
            filters.push(
              `${currentInput}[${filterIndex}:v]overlay=${overlayPos}${outputLabel}`,
            );
            currentInput = `[tmp${filterIndex}]`;
            filterIndex++;
          }

          // Add info overlay at bottom-left
          if (infoOverlayVideoPath) {
            this.emit("log", {
              stream: "system",
              message: `[DEBUG] Adding info overlay at bottom-left`,
            });
            const overlayPos = "10:main_h-overlay_h-10";
            const outputLabel = mapOverlayVideoPath
              ? `[tmp${filterIndex}]`
              : "";
            filters.push(
              `${currentInput}[${filterIndex}:v]overlay=${overlayPos}${outputLabel}`,
            );
            currentInput = `[tmp${filterIndex}]`;
            filterIndex++;
          }

          // Add map overlay at top-right
          if (mapOverlayVideoPath) {
            this.emit("log", {
              stream: "system",
              message: `[DEBUG] Adding map overlay at top-right`,
            });
            const overlayPos = "main_w-overlay_w-10:10";
            filters.push(
              `${currentInput}[${filterIndex}:v]overlay=${overlayPos}`,
            );
          }

          this.command.complexFilter(filters);

          // Map audio from main video (input 0)
          this.command.outputOptions(["-map", "0:a"]);
        }

        // Audio codec
        this.command.audioCodec("aac").audioBitrate("128k");

        // Output format
        this.command.format("mp4").addOption("-movflags", "+faststart");

        // FPS if specified
        if (this.options.fps) {
          this.command.fps(this.options.fps);
        }

        // Output path
        this.command.output(this.options.outputPath);

        // Progress tracking (map 0-100% to 20-95% for external reporting)
        this.command.on("progress", (progress: any) => {
          if (this.stopped) return;

          const rawPercent = progress.percent || 0;
          const mappedPercent = 20 + (rawPercent / 100) * 75;

          const progressData: OverlayProgress = {
            percent: Math.min(95, mappedPercent),
            timeSeconds: progress.timemark
              ? this.parseTimemark(progress.timemark)
              : undefined,
            message: `Encoding video... ${rawPercent.toFixed(1)}%`,
          };

          this.emit("progress", progressData);
        });

        // Error handling
        this.command.on("error", (err: Error) => {
          // Cleanup overlay videos
          if (speedometerVideoPath) {
            fs.promises.unlink(speedometerVideoPath).catch(() => {});
          }
          if (infoOverlayVideoPath) {
            fs.promises.unlink(infoOverlayVideoPath).catch(() => {});
          }
          if (mapOverlayVideoPath) {
            fs.promises.unlink(mapOverlayVideoPath).catch(() => {});
          }

          if (this.stopped) {
            this.emit("log", { stream: "system", message: "Encoding stopped" });
            resolve();
            return;
          }

          this.emit("error", { message: err.message });
          this.emit("done", { success: false, exit_code: 1 });
          reject(err);
        });

        // Completion
        // Success handling
        this.command.on("end", () => {
          // Cleanup overlay videos
          if (speedometerVideoPath) {
            fs.promises.unlink(speedometerVideoPath).catch(() => {});
          }
          if (infoOverlayVideoPath) {
            fs.promises.unlink(infoOverlayVideoPath).catch(() => {});
          }
          if (mapOverlayVideoPath) {
            fs.promises.unlink(mapOverlayVideoPath).catch(() => {});
          }

          if (this.stopped) {
            this.emit("log", { stream: "system", message: "Encoding stopped" });
            resolve();
            return;
          }

          this.emit("progress", {
            percent: 100,
            message: "Encoding complete!",
          });
          this.emit("done", { success: true, exit_code: 0 });
          this.emit("log", {
            stream: "system",
            message: `Video saved to: ${this.options.outputPath}`,
          });
          resolve();
        });

        // Log stderr for debugging
        this.command.on("stderr", (stderrLine: string) => {
          this.emit("log", { stream: "stderr", message: stderrLine });
        });

        // Start encoding
        this.emit("log", {
          stream: "system",
          message: "Starting ffmpeg encoding...",
        });

        this.command.run();
      } catch (err: any) {
        // Cleanup overlay videos on error
        if (speedometerVideoPath) {
          fs.promises.unlink(speedometerVideoPath).catch(() => {});
        }
        if (infoOverlayVideoPath) {
          fs.promises.unlink(infoOverlayVideoPath).catch(() => {});
        }
        if (mapOverlayVideoPath) {
          fs.promises.unlink(mapOverlayVideoPath).catch(() => {});
        }
        this.emit("error", { message: err.message });
        reject(err);
      }
    });
  }

  private parseTimemark(timemark: string): number {
    const parts = timemark.split(":");
    if (parts.length === 3) {
      const hours = parseFloat(parts[0]);
      const minutes = parseFloat(parts[1]);
      const seconds = parseFloat(parts[2]);
      return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
  }
}

export async function encodeWithOverlay(
  options: VideoOverlayOptions,
): Promise<{ success: boolean; exit_code: number }> {
  return new Promise((resolve, reject) => {
    const encoder = new VideoOverlay(options);
    let resolved = false;

    encoder.on("done", (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    });

    encoder.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(err.message));
      }
    });

    encoder.start().catch(reject);
  });
}
