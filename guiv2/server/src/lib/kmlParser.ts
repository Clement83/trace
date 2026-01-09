/**
 * kmlParser.ts
 *
 * Parse KML files and extract GPS tracks with speed calculations.
 * Replaces the Python klm_to_video parser module.
 */

import fs from "fs";

const fxp = require("fast-xml-parser");

export interface Point {
  lat: number;
  lon: number;
  ele?: number;
  time?: Date;
  distanceFromPrev?: number;
  timeDiffFromPrev?: number;
  speedMs?: number;
  speedKmh?: number;
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula.
 * Returns distance in meters.
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Compute speeds for all points based on distance and time differences.
 * Modifies the points array in place.
 */
export function computeSpeeds(points: Point[]): Point[] {
  if (points.length === 0) return points;

  // First point has no previous point
  points[0].distanceFromPrev = undefined;
  points[0].timeDiffFromPrev = undefined;
  points[0].speedMs = undefined;
  points[0].speedKmh = undefined;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // Calculate distance
    try {
      const distance = haversineMeters(prev.lat, prev.lon, curr.lat, curr.lon);
      curr.distanceFromPrev = distance;
    } catch {
      curr.distanceFromPrev = undefined;
    }

    // Calculate time difference
    if (prev.time && curr.time) {
      const timeDiff = (curr.time.getTime() - prev.time.getTime()) / 1000; // seconds
      curr.timeDiffFromPrev = timeDiff >= 0 ? timeDiff : 0;
    } else {
      curr.timeDiffFromPrev = undefined;
    }

    // Calculate speed
    if (
      curr.distanceFromPrev !== undefined &&
      curr.timeDiffFromPrev !== undefined &&
      curr.timeDiffFromPrev > 0
    ) {
      curr.speedMs = curr.distanceFromPrev / curr.timeDiffFromPrev;
      curr.speedKmh = curr.speedMs * 3.6;
    } else {
      curr.speedMs = undefined;
      curr.speedKmh = undefined;
    }
  }

  return points;
}

/**
 * Parse a KML file and extract GPS track points.
 */
export function parseKml(kmlPath: string): Point[] {
  const xmlContent = fs.readFileSync(kmlPath, "utf-8");

  const parser = new fxp.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    parseTagValue: true,
    parseAttributeValue: true,
    trimValues: true,
  });

  const parsed = parser.parse(xmlContent);

  const points: Point[] = [];

  // Navigate KML structure to find track points
  // Common structures: kml -> Document -> Placemark -> gx:Track or LineString
  const kml = parsed.kml || parsed;
  const doc = kml.Document || kml;

  // Helper to extract points from different KML structures
  const extractFromPlacemark = (placemark: any) => {
    // Try gx:Track (Google Earth extended format)
    const gxTrack = placemark["gx:Track"];
    if (gxTrack) {
      const coords = gxTrack["gx:coord"];
      const whens = gxTrack.when;

      const coordArray = Array.isArray(coords) ? coords : [coords];
      const whenArray = Array.isArray(whens) ? whens : [whens];

      coordArray.forEach((coordStr: string, idx: number) => {
        if (!coordStr) return;
        const parts = coordStr.trim().split(/\s+/);
        if (parts.length >= 2) {
          const lon = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          const ele = parts.length >= 3 ? parseFloat(parts[2]) : undefined;

          const point: Point = { lat, lon, ele };

          if (whenArray[idx]) {
            try {
              point.time = new Date(whenArray[idx]);
            } catch {
              // ignore invalid dates
            }
          }

          points.push(point);
        }
      });
    }

    // Try MultiGeometry -> gx:Track
    const multiGeometry = placemark.MultiGeometry;
    if (multiGeometry) {
      const tracks = multiGeometry["gx:Track"];
      if (tracks) {
        const trackArray = Array.isArray(tracks) ? tracks : [tracks];
        trackArray.forEach((track: any) => {
          extractFromPlacemark({ "gx:Track": track });
        });
      }
    }

    // Try LineString (basic KML format without timestamps)
    const lineString = placemark.LineString;
    if (lineString) {
      const coordsStr = lineString.coordinates;
      if (coordsStr) {
        const lines = coordsStr.trim().split(/\s+/);
        lines.forEach((line: string) => {
          const parts = line.trim().split(",");
          if (parts.length >= 2) {
            const lon = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            const ele = parts.length >= 3 ? parseFloat(parts[2]) : undefined;
            points.push({ lat, lon, ele });
          }
        });
      }
    }

    // Try Track -> Segment -> Point (GPX-style in KML)
    const track = placemark.Track;
    if (track) {
      const segments = track.Segment || track;
      const segmentArray = Array.isArray(segments) ? segments : [segments];

      segmentArray.forEach((segment: any) => {
        const trackPoints = segment.Point || segment;
        const pointArray = Array.isArray(trackPoints)
          ? trackPoints
          : [trackPoints];

        pointArray.forEach((pt: any) => {
          if (pt.coord) {
            const parts = pt.coord.trim().split(/\s+/);
            if (parts.length >= 2) {
              const lon = parseFloat(parts[0]);
              const lat = parseFloat(parts[1]);
              const ele = parts.length >= 3 ? parseFloat(parts[2]) : undefined;

              const point: Point = { lat, lon, ele };

              if (pt.time) {
                try {
                  point.time = new Date(pt.time);
                } catch {
                  // ignore
                }
              }

              points.push(point);
            }
          }
        });
      });
    }
  };

  // Process all placemarks
  if (doc.Placemark) {
    const placemarks = Array.isArray(doc.Placemark)
      ? doc.Placemark
      : [doc.Placemark];
    placemarks.forEach(extractFromPlacemark);
  }

  // Also check direct Folder -> Placemark structure
  if (doc.Folder) {
    const folders = Array.isArray(doc.Folder) ? doc.Folder : [doc.Folder];
    folders.forEach((folder: any) => {
      if (folder.Placemark) {
        const placemarks = Array.isArray(folder.Placemark)
          ? folder.Placemark
          : [folder.Placemark];
        placemarks.forEach(extractFromPlacemark);
      }
    });
  }

  return points;
}

/**
 * Load and process a KML file: parse + compute speeds.
 */
export function loadAndProcess(kmlPath: string): Point[] {
  const points = parseKml(kmlPath);
  return computeSpeeds(points);
}

/**
 * Get speed at a specific video timestamp (in seconds).
 * Returns speed in km/h or undefined if not found.
 */
export function getSpeedAtTime(
  points: Point[],
  videoTimeSeconds: number,
  kmlOffsetSeconds: number = 0,
): number | undefined {
  if (points.length === 0) return undefined;

  // Adjust video time to KML time
  const adjustedSeconds = videoTimeSeconds + kmlOffsetSeconds;

  // Find the point closest to this time
  let closestPoint: Point | undefined;
  let minDiff = Infinity;

  for (const point of points) {
    if (!point.time) continue;

    const pointSeconds =
      (point.time.getTime() - (points[0].time?.getTime() || 0)) / 1000;
    const diff = Math.abs(pointSeconds - adjustedSeconds);

    if (diff < minDiff) {
      minDiff = diff;
      closestPoint = point;
    }
  }

  return closestPoint?.speedKmh;
}

/**
 * Get video start time from KML (first timestamp).
 */
export function getKmlStartTime(points: Point[]): Date | undefined {
  for (const point of points) {
    if (point.time) return point.time;
  }
  return undefined;
}
