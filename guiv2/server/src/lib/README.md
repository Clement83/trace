# Video Processing Library

Native TypeScript/Node.js implementations for video processing and KML parsing.

## Modules

### `kmlParser.ts`

Parse KML files and calculate GPS-based speeds.

#### Features

- Parse KML files (Google Earth format, standard LineString)
- Extract GPS coordinates with timestamps
- Calculate distances using Haversine formula
- Compute speeds (km/h and m/s)
- Support for various KML structures

#### Usage

```typescript
import { loadAndProcess, getSpeedAtTime, getKmlStartTime } from './lib/kmlParser';

// Parse KML and compute speeds
const points = loadAndProcess('path/to/track.kml');

console.log(`Loaded ${points.length} GPS points`);

// Access point data
points.forEach(point => {
  console.log(`Lat: ${point.lat}, Lon: ${point.lon}`);
  console.log(`Speed: ${point.speedKmh} km/h`);
  console.log(`Time: ${point.time?.toISOString()}`);
});

// Get speed at specific video time
const speed = getSpeedAtTime(points, 120.5, 0); // 120.5 seconds, 0 offset
console.log(`Speed at 2:00: ${speed} km/h`);

// Get KML start time
const startTime = getKmlStartTime(points);
console.log(`Track started at: ${startTime}`);
```

#### Point Interface

```typescript
interface Point {
  lat: number;
  lon: number;
  ele?: number;
  time?: Date;
  distanceFromPrev?: number;
  timeDiffFromPrev?: number;
  speedMs?: number;
  speedKmh?: number;
}
```

### `sdConverter.ts`

Convert videos to SD (low-resolution) for smooth preview playback.

#### Features

- H.264 baseline profile (browser compatible)
- YUV420p pixel format
- Optimized for web streaming (faststart)
- Real-time progress events
- Configurable quality settings

#### Usage

```typescript
import { SDConverter, convertToSD } from './lib/sdConverter';

// Using the class (with events)
const converter = new SDConverter({
  inputPath: 'video.mp4',
  outputPath: 'video_sd.mp4',
  width: 640,
  crf: 28,
  preset: 'veryfast',
  audioBitrate: '96k',
  overwrite: true,
});

converter.on('progress', (data) => {
  console.log(`Progress: ${data.percent}%`);
});

converter.on('log', (data) => {
  console.log(`[${data.stream}] ${data.message}`);
});

converter.on('done', (data) => {
  if (data.success) {
    console.log('Conversion complete!');
  }
});

converter.on('error', (data) => {
  console.error('Error:', data.message);
});

await converter.start();

// Or use the simple async function
const result = await convertToSD({
  inputPath: 'video.mp4',
  outputPath: 'video_sd.mp4',
});

console.log('Success:', result.success);
```

#### Options

```typescript
interface SDConverterOptions {
  inputPath: string;
  outputPath: string;
  width?: number;           // Default: 640
  crf?: number;             // Default: 28 (lower = better quality)
  preset?: string;          // Default: 'veryfast'
  audioBitrate?: string;    // Default: '96k'
  overwrite?: boolean;      // Default: true
}
```

### `videoOverlay.ts`

Add speed overlay to videos from KML data.

#### Features

- Parse KML and extract GPS track
- Calculate average speed
- Add text overlay using ffmpeg
- Configurable position and size
- Support for km/h or m/s units
- Real-time progress tracking

#### Usage

```typescript
import { VideoOverlay, encodeWithOverlay } from './lib/videoOverlay';

// Using the class (with events)
const encoder = new VideoOverlay({
  kmlPath: 'track.kml',
  videoPath: 'video.mp4',
  outputPath: 'video_with_speed.mp4',
  showSpeed: true,
  speedUnit: 'kmh',
  speedPos: 'bottom-right',
  speedSize: 'medium',
  kmlOffsetSeconds: 0,
});

encoder.on('progress', (data) => {
  console.log(`${data.percent}% - ${data.message}`);
});

encoder.on('log', (data) => {
  console.log(`[${data.stream}] ${data.message}`);
});

encoder.on('done', (data) => {
  if (data.success) {
    console.log('Encoding complete!');
  }
});

encoder.on('error', (data) => {
  console.error('Error:', data.message);
});

await encoder.start();

// Or use the simple async function
const result = await encodeWithOverlay({
  kmlPath: 'track.kml',
  videoPath: 'video.mp4',
  outputPath: 'video_with_speed.mp4',
  showSpeed: true,
  speedUnit: 'kmh',
});

console.log('Success:', result.success);
```

#### Options

```typescript
interface VideoOverlayOptions {
  kmlPath: string;
  videoPath: string;
  outputPath: string;
  kmlOffsetSeconds?: number;                                    // Default: 0
  showSpeed?: boolean;                                          // Default: true
  speedUnit?: 'kmh' | 'ms';                                    // Default: 'kmh'
  speedPos?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';  // Default: 'bottom-right'
  speedSize?: 'small' | 'medium' | 'large';                    // Default: 'medium'
  fontPath?: string;                                            // Optional custom font
  fps?: number;                                                 // Optional FPS override
}
```

## Events

All classes extend `EventEmitter` and emit the following events:

### `progress`

Emitted during processing with current progress.

```typescript
{
  percent?: number;      // 0-100
  timeSeconds?: number;  // Current processing time
  message?: string;      // Status message
}
```

### `log`

Emitted for log messages.

```typescript
{
  stream: 'stdout' | 'stderr' | 'system';
  message: string;
}
```

### `done`

Emitted when processing completes.

```typescript
{
  success: boolean;
  exit_code: number;
}
```

### `error`

Emitted when an error occurs.

```typescript
{
  message: string;
}
```

## Notes

### Speed Overlay Limitations

The current implementation shows **average speed** across the entire video. Dynamic speed at each frame would require:

1. Generating subtitle files (SRT) with speed at each timestamp
2. Using ffmpeg's subtitle filter
3. Or frame-by-frame processing with custom overlays

### ffmpeg Path

The modules automatically detect ffmpeg using `@ffmpeg-installer/ffmpeg` and `@ffprobe-installer/ffprobe`. No manual installation required.

### Browser Compatibility

SD videos are encoded with:
- H.264 baseline profile
- Level 3.1
- yuv420p pixel format
- AAC audio at 48kHz
- MP4 container with faststart

This ensures maximum browser compatibility.

## Testing

Run the test suite:

```bash
# Place test files in uploads/
# - uploads/test.mp4
# - uploads/test.kml

npx ts-node src/test-migration.ts
```

## Examples

### Complete Workflow

```typescript
import { loadAndProcess } from './lib/kmlParser';
import { SDConverter } from './lib/sdConverter';
import { VideoOverlay } from './lib/videoOverlay';

async function processVideo() {
  // 1. Parse KML
  const points = loadAndProcess('track.kml');
  console.log(`Loaded ${points.length} GPS points`);

  // 2. Create SD version
  const sdConverter = new SDConverter({
    inputPath: 'video.mp4',
    outputPath: 'video_sd.mp4',
  });

  sdConverter.on('progress', (p) => console.log(`SD: ${p.percent}%`));
  await sdConverter.start();

  // 3. Add speed overlay
  const overlay = new VideoOverlay({
    kmlPath: 'track.kml',
    videoPath: 'video.mp4',
    outputPath: 'video_final.mp4',
    showSpeed: true,
  });

  overlay.on('progress', (p) => console.log(`Encode: ${p.percent}%`));
  await overlay.start();

  console.log('All done!');
}

processVideo().catch(console.error);
```

## Migration from Python

These modules replace:
- `video_to_sd/` Python package → `sdConverter.ts`
- `klm_to_video/` Python package → `kmlParser.ts` + `videoOverlay.ts`

The API is designed to be similar, with the same event types and progress reporting.