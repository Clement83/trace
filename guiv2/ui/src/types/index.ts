export type WorkspaceSummary = {
  projectName: string;
  path?: string;
  createdAt?: number;
  hasKml?: boolean;
  videoCount?: number;
};

export type KmlCoordinate = {
  lat: number;
  lon: number;
  alt?: number;
  timestamp?: number;
};

export type KmlSummary = {
  start?: number;
  end?: number;
  durationMs?: number;
  coords?: KmlCoordinate[];
};

export type VideoMeta = {
  name: string;
  originalPath: string;
  sdPath?: string;
  sdExists?: boolean;
  addedAt?: number;
  sizeBytes?: number;
  durationMs?: number | null;
  // Video metadata from ffprobe
  creationTimestamp?: number;
  width?: number;
  height?: number;
  frameRate?: number;
  videoCodec?: string;
  audioCodec?: string;
  // Timeline placement
  timelineStart?: number;
  timelineEnd?: number;
  color?: string;
  // Encoded video state
  encodedPath?: string;
  encodedExists?: boolean;
  encodeJobId?: string;
  encodeStatus?: "running" | "done" | "error";
  encodeProgress?: number;
  encodeError?: string;
};

export type WorkspaceMeta = {
  projectName: string;
  createdAt: number;
  kmlSummary?: KmlSummary;
  videos: VideoMeta[];
  [k: string]: any;
};

export type JobProgressData = {
  percent?: number | null;
  time_seconds?: number | null;
  message?: string;
};

export type JobLog = {
  stream?: string;
  message: string;
};

export type JobState = {
  jobId: string;
  videoName?: string;
  progress?: number | null;
  status?: "running" | "done" | "error" | "idle";
  message?: string;
  logs: JobLog[];
  createdAt?: number;
};

export type CurrentPosition = {
  lat: number;
  lon: number;
  coord: KmlCoordinate;
  speed?: number;
};
