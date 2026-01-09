/**
 * speedometerGenerator.ts
 *
 * Generate speedometer gauge images using node-canvas.
 * Creates a set of pre-rendered speedometer images for each speed value (0-60 km/h).
 */

import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import os from "os";

export interface SpeedometerOptions {
  size?: number; // Widget size in pixels (default: 200)
  maxSpeed?: number; // Maximum speed on gauge (default: 60)
  unit?: "kmh" | "ms"; // Speed unit (default: kmh)
}

/**
 * Generate a single speedometer image for a given speed value.
 */
export function generateSpeedometerImage(
  speed: number,
  options: SpeedometerOptions = {}
): Buffer {
  const size = options.size || 200;
  const maxSpeed = options.maxSpeed || 60;
  const unit = options.unit || "kmh";

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Clear canvas with transparent background
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;

  // Draw background circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(20, 20, 20, 0.85)";
  ctx.fill();
  ctx.strokeStyle = "rgba(200, 200, 200, 1)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw ticks and labels
  const numTicks = 7; // 0, 10, 20, 30, 40, 50, 60
  const startAngle = -120; // degrees
  const endAngle = 120; // degrees

  for (let i = 0; i < numTicks; i++) {
    const angle =
      ((startAngle + ((endAngle - startAngle) * i) / (numTicks - 1)) * Math.PI) /
      180;
    const innerR = r - 8;
    const outerR = r - 2;

    // Draw tick
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

    // Draw label (every 10 km/h)
    const speedLabel = Math.round((maxSpeed * i) / (numTicks - 1));
    const labelR = r - 20;
    const labelX = cx + labelR * Math.cos(angle);
    const labelY = cy + labelR * Math.sin(angle);

    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.font = `${Math.max(10, size * 0.08)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(speedLabel.toString(), labelX, labelY);
  }

  // Calculate needle angle based on speed
  const speedPercent = Math.min(1, Math.max(0, speed / maxSpeed));
  const needleAngle =
    ((startAngle + (endAngle - startAngle) * speedPercent) * Math.PI) / 180;
  const needleLen = r * 0.85;

  // Draw needle
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy + needleLen * Math.sin(needleAngle);

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.strokeStyle = "rgba(255, 50, 50, 1)";
  ctx.lineWidth = Math.max(3, size / 30);
  ctx.lineCap = "round";
  ctx.stroke();

  // Draw center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 1)";
  ctx.fill();

  // Draw speed value text
  const speedText = Math.round(speed).toString();
  ctx.fillStyle = "rgba(255, 255, 255, 1)";
  ctx.font = `bold ${Math.max(14, size * 0.14)}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(speedText, cx, cy + r * 0.5);

  // Draw unit label
  ctx.font = `${Math.max(10, size * 0.08)}px Arial`;
  ctx.fillText(unit, cx, cy + r * 0.7);

  return canvas.toBuffer("image/png");
}

/**
 * Generate all speedometer images (0 to maxSpeed) and save them to a directory.
 * Returns the directory path.
 */
export async function generateSpeedometerSet(
  options: SpeedometerOptions = {}
): Promise<string> {
  const maxSpeed = options.maxSpeed || 60;
  const tempDir = path.join(
    os.tmpdir(),
    `speedometer_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );

  // Create temp directory
  await fs.promises.mkdir(tempDir, { recursive: true });

  // Generate images for each speed value (0 to maxSpeed)
  for (let speed = 0; speed <= maxSpeed; speed++) {
    const imgBuffer = generateSpeedometerImage(speed, options);
    const filename = `speed_${speed.toString().padStart(3, "0")}.png`;
    await fs.promises.writeFile(path.join(tempDir, filename), imgBuffer);
  }

  return tempDir;
}

/**
 * Cleanup speedometer directory.
 */
export async function cleanupSpeedometerSet(dirPath: string): Promise<void> {
  try {
    const files = await fs.promises.readdir(dirPath);
    for (const file of files) {
      await fs.promises.unlink(path.join(dirPath, file));
    }
    await fs.promises.rmdir(dirPath);
  } catch (err) {
    // Ignore cleanup errors
  }
}
