# guiv2 — Modern Web UI for KML Video Workspace Management

A modern web application for managing video projects synchronized with GPS tracks from KML files. Built with React, TypeScript, Node.js, and featuring real-time progress tracking via Server-Sent Events (SSE).

![Status](https://img.shields.io/badge/status-MVP%20Complete-brightgreen)
![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![React](https://img.shields.io/badge/React-19-blue)

---

## 🎯 Overview

**guiv2** provides a complete workspace management system for:
- Creating project workspaces with KML GPS track uploads
- Managing video files with automatic SD (web-optimized) conversion
- Visualizing GPS tracks on interactive maps (OpenStreetMap via Leaflet)
- Synchronizing video playback with GPS timeline position
- **Customizable video overlays** with real-time GPS data (speed, altitude, coordinates, time)
- Real-time job progress monitoring via SSE
- Modern, responsive UI with Tailwind CSS

---

## ✨ Features

### Workspace Management
- ✅ Create workspaces with KML file upload
- ✅ List and browse existing workspaces
- ✅ Automatic KML parsing (timestamps, coordinates, duration)
- ✅ Project metadata management (`meta.json`)

### Video Handling
- ✅ Multi-file video upload
- ✅ Automatic SD (Standard Definition) video generation for web playback
- ✅ Background job processing with progress tracking
- ✅ Video streaming with HTTP Range support for efficient playback

### Interactive Visualization
- ✅ **Interactive Map** with GPS track polyline (react-leaflet + OpenStreetMap)
- ✅ **Animated marker** synchronized with timeline position
- ✅ **Timeline scrubber** with play/pause controls
- ✅ Real-time position interpolation on map

### Modern UI Components
- ✅ Card-based layout system
- ✅ Modal dialogs for workspace creation and video upload
- ✅ Progress bars with job status indicators
- ✅ Expandable logs viewer
- ✅ Responsive design with Tailwind CSS
- ✅ Smooth animations and transitions
- ✅ Icons via Lucide React

### Real-Time Updates
- ✅ Server-Sent Events (SSE) for job progress
- ✅ Live log streaming
- ✅ Automatic metadata refresh on job completion

### 🎬 Video Overlay System (NEW!)
- ✅ **Customizable information display** via checkboxes
- ✅ **Real-time GPS data overlay** on encoded videos
- ✅ Choose what to display:
  - Speed (km/h)
  - Altitude (meters)
  - GPS Coordinates (latitude/longitude)
  - Timestamp
- ✅ **Semi-transparent info box** positioned at bottom-left
- ✅ **Smooth animations** with 5 FPS updates
- ✅ **Adaptive sizing** based on selected information

---

## 🏗️ Architecture

```
guiv2/
├── server/              # Node.js + Express + TypeScript backend
│   ├── src/
│   │   ├── index.ts     # Main server, routes, SSE handling
│   │   ├── workers/     # Job workers (encode, SD generation)
│   │   │   ├── encodeWorker.ts
│   │   │   └── sdWorker.ts
│   │   ├── workspace/   # Workspace utilities
│   │   │   └── index.ts
│   │   └── types/       # TypeScript type definitions
│   └── video_to_sd/     # Python SD conversion script
│       └── convert.py
│
├── ui/                  # React + Vite + TypeScript frontend
│   ├── src/
│   │   ├── main.tsx     # Main app with routing and views
│   │   ├── components/  # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── MapView.tsx
│   │   │   ├── Timeline.tsx
│   │   │   └── ProgressBar.tsx
│   │   └── index.css    # Tailwind + custom styles
│   └── index.html
│
├── workspace/           # User workspaces (gitignored)
│   └── {projectName}/
│       ├── kml.kml
│       ├── videos/
│       ├── sd/
│       └── meta.json
│
├── .env.example         # Environment variables template
├── WORKPLAN.md          # Detailed development plan
└── README.md            # This file
```

---

## 📋 Prerequisites

- **Node.js** >= 22
- **npm** or **yarn**
- **Python 3** (for SD video generation)
- **ffmpeg** (required for video processing)

---

## 🚀 Quick Start

### 1. Environment Setup

Copy the environment template and configure:

```bash
cp .env.example .env
```

Edit `.env` and configure paths:

```env
# Server configuration
PORT=3001

# Python environment
PYTHON_CMD=python
# or: PYTHON_CMD=/path/to/venv/bin/python

# Workspace location (relative or absolute)
WORKSPACE_ROOT=./workspace

# SD video settings
SD_WIDTH=640
SD_CRF=28
SD_PRESET=veryfast
SD_AUDIO_BITRATE=96k

# Job settings
MAX_CONCURRENT_JOBS=3
JOB_CLEANUP_MS=30000
```

### 2. Install Dependencies

**Backend:**
```bash
cd server
npm install
```

**Frontend:**
```bash
cd ui
npm install
```

### 3. Run Development Servers

**Option A: Run both simultaneously (from guiv2/ root):**
```bash
npm run dev
```

**Option B: Run separately:**

Terminal 1 (Backend):
```bash
cd server
npm run dev
```

Terminal 2 (Frontend):
```bash
cd ui
npm run dev
```

### 4. Access the Application

Open your browser to: **http://localhost:5173**

The frontend automatically proxies API requests to `http://localhost:3001`

---

## 🎮 Usage

### Creating a Workspace

1. Click **"New Workspace"**
2. Enter a project name (alphanumeric, dashes, underscores)
3. Upload a KML file with GPS track data
4. Click **"Create Workspace"**

### Uploading Videos

1. Open a workspace
2. Click **"Upload Video"**
3. Select one or more video files
4. Videos are automatically processed to create SD versions
5. Monitor progress in the **Active Jobs** panel

### Using the Timeline & Map

- **Timeline Scrubber**: Drag to move through the GPS track
- **Play/Pause**: Auto-animate through the timeline
- **Map Marker**: Automatically syncs with timeline position (animated cyclist 🚴)
- **Map Controls**: Zoom and pan the interactive map

### Configuring Video Overlay

In the **"Current KML Node"** card:
1. Check/uncheck desired information to display on the final video:
   - ✅ **Speed** (default: enabled)
   - ☐ **Altitude**
   - ☐ **GPS Coordinates** 
   - ☐ **Time**
2. Selected options are used when encoding the video
3. Preview real-time data in the card while playing the timeline

### Encoding Videos

1. Place video on timeline to synchronize with GPS track
2. Select overlay options in "Current KML Node" card
3. Click **"Encode"** button for the video
4. Monitor progress in the **Active Jobs** panel
5. Final video will include a semi-transparent info box at bottom-left

### Playing Videos

- Wait for SD version to be ready (green checkmark)
- Click **"Play SD Version"** to stream optimized video

---

## 📡 API Endpoints

### Workspaces

- `GET /api/workspaces` — List all workspaces
- `POST /api/workspaces` — Create workspace (multipart: projectName, kml)
- `GET /api/workspaces/:projectName` — Get workspace metadata
- `PUT /api/workspaces/:projectName/kml` — Update KML file
- `DELETE /api/workspaces/:projectName` — Delete workspace

### Videos

- `POST /api/workspaces/:projectName/videos` — Upload videos (multipart)
- `GET /api/workspaces/:projectName/videos` — List videos
- `GET /api/workspaces/:projectName/videos/:filename/sd` — Stream SD video (with Range support)
- `DELETE /api/workspaces/:projectName/videos/:filename` — Delete video

### Jobs & Progress

- `POST /api/encode` — Start encoding job
- `GET /api/encode/events/:jobId` — SSE stream for job progress
- `DELETE /api/encode/:jobId` — Cancel running job
- `GET /api/health` — Health check

### SSE Event Types

```typescript
// Progress update
{ type: "progress", data: { percent: number, message?: string } }

// Log message
{ type: "log", data: { message: string, stream: "stdout" | "stderr" } }

// Job completion
{ type: "done", data: { success: boolean, exitCode?: number } }

// Error
{ type: "error", data: { message: string } }
```

---

## 🛠️ Development

### Build for Production

**Backend:**
```bash
cd server
npm run build
# Output: server/dist/
```

**Frontend:**
```bash
cd ui
npm run build
# Output: ui/dist/
```

### Linting & Formatting

```bash
# Backend
cd server
npm run lint

# Frontend
cd ui
npm run lint
npm run format
```

### Project Structure Conventions

- **Components**: Reusable UI elements in `ui/src/components/`
- **Utilities**: Helper functions in `server/src/workspace/`
- **Workers**: Background job processors in `server/src/workers/`
- **Types**: TypeScript definitions in `server/src/types/`

---

## 🔒 Security Notes

- ✅ Input sanitization for `projectName` (prevents path traversal)
- ✅ File type validation (MIME checking)
- ✅ No shell command injection (uses `spawn` with args array)
- ✅ Workspace files isolated outside Git repository
- ⚠️ **TODO**: Add authentication/authorization for production
- ⚠️ **TODO**: Add rate limiting for uploads

---

## 📊 Workspace File Structure

Each workspace creates the following structure:

```
workspace/{projectName}/
├── kml.kml              # GPS track (renamed from upload)
├── videos/              # Original uploaded videos
│   ├── video1.mp4
│   └── video2.mov
├── sd/                  # SD versions for web playback
│   ├── video1_sd.mp4
│   └── video2_sd.mp4
├── meta.json            # Project metadata
└── logs/                # Job logs (optional)
```

### meta.json Structure

```json
{
  "projectName": "my-ride-2024",
  "createdAt": 1704067200000,
  "kmlSummary": {
    "start": 1704067200000,
    "end": 1704070800000,
    "durationMs": 3600000,
    "coords": [
      { "lat": 48.8566, "lon": 2.3522, "alt": 35 }
    ]
  },
  "videos": [
    {
      "name": "ride.mp4",
      "originalPath": "videos/ride.mp4",
      "sdPath": "sd/ride_sd.mp4",
      "sdExists": true,
      "sizeBytes": 1048576,
      "addedAt": 1704067200000
    }
  ]
}
```

---

## 🎨 UI Components

### Available Components

- **Button** — Primary, secondary, danger, ghost variants
- **Card** — Container with header, title, content sections
- **Modal** — Overlay dialogs with backdrop and animations
- **MapView** — Interactive Leaflet map with GPS track
- **Timeline** — Scrubber with play/pause and time display
- **ProgressBar** — Job progress with status indicators
- **JobProgress** — Multi-job display with expandable logs

### Component Usage Example

```tsx
import { Button } from './components/Button';
import { Card, CardHeader, CardTitle, CardContent } from './components/Card';

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Title</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="primary" onClick={handleClick}>
          Click Me
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## 🧪 Testing

### Manual Testing Workflow

1. **Create Workspace**
   ```bash
   curl -F "projectName=test-project" \
        -F "kml=@sample.kml" \
        http://localhost:3001/api/workspaces
   ```

2. **Upload Video**
   ```bash
   curl -F "file=@video.mp4" \
        http://localhost:3001/api/workspaces/test-project/videos
   ```

3. **Monitor Job Progress** (SSE)
   ```bash
   curl -N http://localhost:3001/api/encode/events/{jobId}
   ```

4. **Stream SD Video**
   ```bash
   curl http://localhost:3001/api/workspaces/test-project/videos/video.mp4/sd \
        --output test_sd.mp4
   ```

---

## 📝 Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `PYTHON_CMD` | `python` | Python executable path |
| `WORKSPACE_ROOT` | `./workspace` | Workspace storage directory |
| `SD_WIDTH` | `640` | SD video width (height auto) |
| `SD_CRF` | `28` | Video quality (lower = better) |
| `SD_PRESET` | `veryfast` | ffmpeg encoding preset |
| `SD_AUDIO_BITRATE` | `96k` | Audio bitrate for SD |
| `MAX_CONCURRENT_JOBS` | `3` | Max simultaneous jobs |
| `JOB_CLEANUP_MS` | `30000` | Job cleanup delay (ms) |

---

## 🗺️ Roadmap

### ✅ Milestone 1 — MVP (Complete)
- Workspace creation and management
- Video upload with SD generation
- Interactive map with GPS visualization
- Timeline synchronization
- Modern UI with Tailwind

### ✅ Milestone 2 — Video Overlay System (Complete)
- ✅ Customizable overlay checkboxes in UI
- ✅ Real-time GPS data overlay generation
- ✅ Info box rendering with canvas
- ✅ FFmpeg integration for video encoding
- ✅ Animated cyclist marker on map
- ✅ Job queue management

### 📅 Milestone 3 — Production Ready
- User authentication & authorization
- Database persistence (SQLite/PostgreSQL)
- Multi-user workspace isolation
- Advanced job queue (Bull/BullMQ)
- Thumbnail generation
- Video trimming/editing UI
- Backup & restore functionality

---

## 🤝 Contributing

See `WORKPLAN.md` for detailed development plans and task breakdown.

---

## 📄 License

MIT

---

## 🙏 Credits

- **React** — UI framework
- **Leaflet** — Interactive maps
- **Tailwind CSS** — Utility-first styling
- **Vite** — Fast build tool
- **Express** — Web framework
- **Lucide** — Icon library
- **OpenStreetMap** — Map tiles

---

## 📞 Support

For questions and issues, refer to:
- `QUICKSTART.md` — Quick start guide for new users
- `GUIDE_OVERLAY.md` — Complete guide for video overlay features
- `IMPLEMENTATION_SUMMARY.md` — Technical details of the implementation
- `CHANGELOG.md` — History of changes and new features
- `WORKPLAN.md` — Development plan and progress
- `TODO.md` — Task tracking
- GitHub Issues (if applicable)

---

**Built with ❤️ for seamless KML + Video synchronization**