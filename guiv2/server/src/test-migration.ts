/**
 * test-migration.ts
 *
 * Quick test script to verify the new TypeScript implementations work correctly.
 * Run with: npx ts-node src/test-migration.ts
 */

import { SDConverter } from "./lib/sdConverter";
import { VideoOverlay } from "./lib/videoOverlay";
import { loadAndProcess } from "./lib/kmlParser";
import path from "path";
import fs from "fs";

async function testKmlParser() {
  console.log("\n=== Testing KML Parser ===");

  // Look for a sample KML file
  const possiblePaths = [
    path.join(__dirname, "..", "uploads", "test.kml"),
    path.join(__dirname, "..", "uploads", "sample.kml"),
    path.join(__dirname, "..", "klm", "test.kml"),
  ];

  let kmlPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      kmlPath = p;
      break;
    }
  }

  if (!kmlPath) {
    console.log("❌ No KML file found. Skipping KML parser test.");
    console.log("   Place a KML file at: uploads/test.kml");
    return;
  }

  try {
    console.log(`✓ Found KML file: ${kmlPath}`);

    const points = loadAndProcess(kmlPath);
    console.log(`✓ Parsed ${points.length} GPS points`);

    if (points.length > 0) {
      const firstPoint = points[0];
      console.log(
        `✓ First point: lat=${firstPoint.lat}, lon=${firstPoint.lon}`,
      );

      if (firstPoint.time) {
        console.log(`✓ Timestamp: ${firstPoint.time.toISOString()}`);
      }

      const pointsWithSpeed = points.filter((p) => p.speedKmh !== undefined);
      if (pointsWithSpeed.length > 0) {
        const avgSpeed =
          pointsWithSpeed.reduce((sum, p) => sum + (p.speedKmh || 0), 0) /
          pointsWithSpeed.length;
        const maxSpeed = Math.max(
          ...pointsWithSpeed.map((p) => p.speedKmh || 0),
        );
        console.log(`✓ Average speed: ${avgSpeed.toFixed(2)} km/h`);
        console.log(`✓ Max speed: ${maxSpeed.toFixed(2)} km/h`);
      }
    }

    console.log("✅ KML Parser: PASSED");
  } catch (err: any) {
    console.error("❌ KML Parser: FAILED");
    console.error(err.message);
  }
}

async function testSDConverter() {
  console.log("\n=== Testing SD Converter ===");

  // Look for a sample video file
  const possiblePaths = [
    path.join(__dirname, "..", "uploads", "test.mp4"),
    path.join(__dirname, "..", "uploads", "sample.mp4"),
    path.join(__dirname, "..", "video", "test.mp4"),
  ];

  let videoPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      videoPath = p;
      break;
    }
  }

  if (!videoPath) {
    console.log("❌ No video file found. Skipping SD converter test.");
    console.log("   Place a video file at: uploads/test.mp4");
    return;
  }

  const outputPath = path.join(__dirname, "..", "uploads", "test_sd.mp4");

  try {
    console.log(`✓ Found video: ${videoPath}`);
    console.log(`✓ Output will be: ${outputPath}`);

    const converter = new SDConverter({
      inputPath: videoPath,
      outputPath: outputPath,
      width: 640,
      crf: 28,
      preset: "veryfast",
      overwrite: true,
    });

    let lastProgress = 0;
    converter.on("progress", (data) => {
      if (data.percent && data.percent - lastProgress >= 10) {
        console.log(`  Progress: ${data.percent.toFixed(1)}%`);
        lastProgress = data.percent;
      }
    });

    converter.on("log", (data) => {
      if (data.stream === "system") {
        console.log(`  ${data.message}`);
      }
    });

    await converter.start();

    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log(
        `✓ Output file created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log("✅ SD Converter: PASSED");
    } else {
      console.log("❌ SD Converter: FAILED - Output file not created");
    }
  } catch (err: any) {
    console.error("❌ SD Converter: FAILED");
    console.error(err.message);
  }
}

async function testVideoOverlay() {
  console.log("\n=== Testing Video Overlay ===");

  // Look for video and KML files
  const videoPath = path.join(__dirname, "..", "uploads", "test.mp4");
  const kmlPath = path.join(__dirname, "..", "uploads", "test.kml");

  if (!fs.existsSync(videoPath)) {
    console.log("❌ No video file found. Skipping video overlay test.");
    console.log("   Place a video file at: uploads/test.mp4");
    return;
  }

  if (!fs.existsSync(kmlPath)) {
    console.log("❌ No KML file found. Skipping video overlay test.");
    console.log("   Place a KML file at: uploads/test.kml");
    return;
  }

  const outputPath = path.join(__dirname, "..", "uploads", "test_overlay.mp4");

  try {
    console.log(`✓ Found video: ${videoPath}`);
    console.log(`✓ Found KML: ${kmlPath}`);
    console.log(`✓ Output will be: ${outputPath}`);

    const encoder = new VideoOverlay({
      kmlPath: kmlPath,
      videoPath: videoPath,
      outputPath: outputPath,
      showSpeed: true,
      speedUnit: "kmh",
      speedPos: "bottom-right",
      speedSize: "medium",
    });

    let lastProgress = 0;
    encoder.on("progress", (data) => {
      if (data.percent && data.percent - lastProgress >= 10) {
        console.log(
          `  Progress: ${data.percent.toFixed(1)}% - ${data.message}`,
        );
        lastProgress = data.percent;
      }
    });

    encoder.on("log", (data) => {
      if (data.stream === "system") {
        console.log(`  ${data.message}`);
      }
    });

    await encoder.start();

    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log(
        `✓ Output file created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log("✅ Video Overlay: PASSED");
    } else {
      console.log("❌ Video Overlay: FAILED - Output file not created");
    }
  } catch (err: any) {
    console.error("❌ Video Overlay: FAILED");
    console.error(err.message);
  }
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║  Migration Test Suite - Python to TypeScript/Node.js ║");
  console.log("╚═══════════════════════════════════════════════════════╝");

  await testKmlParser();
  await testSDConverter();
  await testVideoOverlay();

  console.log("\n=== Test Summary ===");
  console.log("Check the results above for details.");
  console.log("Place test files in uploads/ directory to run all tests.");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
