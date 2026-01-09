import * as os from "os";
import * as path from "path";

function buildASSFilter(assFilePath: string): string {
  // On Windows, ffmpeg needs special handling for paths with drive letters
  // Use double backslashes for proper escaping in filter arguments
  let normalizedPath = assFilePath;

  if (process.platform === "win32") {
    // Replace single backslashes with double backslashes for ffmpeg filter syntax
    normalizedPath = assFilePath.replace(/\\/g, "\\\\");
    // Also escape the colon after drive letter
    normalizedPath = normalizedPath.replace(/^([a-zA-Z]):/, "$1\\\\:");
  }

  // Use ass filter instead of subtitles for better compatibility
  return `ass=${normalizedPath}`;
}

// Test with typical Windows temp path
const testPath = path.join(os.tmpdir(), `speed_${Date.now()}_test.ass`);

console.log("Original path:", testPath);
console.log("Platform:", process.platform);
console.log("Filter string:", buildASSFilter(testPath));
console.log("");

// Test with various path formats
const testPaths = [
  "C:\\Users\\qclem\\AppData\\Local\\Temp\\speed_123.ass",
  "D:\\Videos\\subtitle.ass",
  "/tmp/speed.ass", // Unix path
  "C:/Users/test/file.ass", // Already forward slashes
];

testPaths.forEach((p) => {
  console.log(`Input:  ${p}`);
  console.log(`Output: ${buildASSFilter(p)}`);
  console.log("");
});
