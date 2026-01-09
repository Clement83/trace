import React, { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in Leaflet with React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface Coordinate {
  lat: number;
  lon: number;
  alt?: number;
  timestamp?: number; // epoch millis - when this coordinate was recorded
}

interface Video {
  name: string;
  timelineStart?: number;
  timelineEnd?: number;
  color?: string;
}

interface MapViewProps {
  coords: Coordinate[];
  currentPosition?: { lat: number; lon: number };
  videos?: Video[];
  className?: string;
}

// Component to update map view when coords change (only on first load)
function MapUpdater({ coords }: { coords: Coordinate[] }) {
  const map = useMap();
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Only fit bounds on first load, not on every coords change
    if (coords && coords.length > 0 && !hasInitialized.current) {
      const bounds = L.latLngBounds(
        coords.map((c) => [c.lat, c.lon] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
      hasInitialized.current = true;
    }
  }, [coords, map]);

  return null;
}

// Component to animate marker position
function AnimatedMarker({
  position,
}: {
  position: { lat: number; lon: number };
}) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (markerRef.current) {
      const marker = markerRef.current;
      const newLatLng = L.latLng(position.lat, position.lon);
      marker.setLatLng(newLatLng);
    }
  }, [position]);

  const icon = L.divIcon({
    className: "custom-marker",
    html: `
      <div class="relative flex items-center justify-center">
        <div class="text-2xl" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🚴</div>
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-400 rounded-full opacity-20 animate-ping pointer-events-none"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  return (
    <Marker
      ref={markerRef}
      position={[position.lat, position.lon]}
      icon={icon}
    />
  );
}

export function MapView({
  coords,
  currentPosition,
  videos = [],
  className = "",
}: MapViewProps) {
  if (!coords || coords.length === 0) {
    return (
      <div
        className={`w-full h-full bg-gray-100 rounded-lg flex items-center justify-center ${className}`}
      >
        <p className="text-gray-500 text-sm">No coordinates available</p>
      </div>
    );
  }

  // Calculate center from coords
  const centerLat = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length;
  const centerLon = coords.reduce((sum, c) => sum + c.lon, 0) / coords.length;

  // Use currentPosition if provided, otherwise use first coord
  const markerPosition = currentPosition || {
    lat: coords[0].lat,
    lon: coords[0].lon,
  };

  // Create colored segments based on video timeline positions
  const coloredSegments: Array<{
    positions: [number, number][];
    color: string;
  }> = [];

  if (videos.length > 0 && coords.some((c) => c.timestamp !== undefined)) {
    // Build segments with video colors
    let currentSegment: [number, number][] = [];
    let currentColor = "#9CA3AF"; // Default gray for no video

    for (let i = 0; i < coords.length; i++) {
      const coord = coords[i];
      const position: [number, number] = [coord.lat, coord.lon];

      // Find which video is active at this timestamp
      let activeVideo: Video | undefined;
      if (coord.timestamp !== undefined) {
        activeVideo = videos.find(
          (v) =>
            v.timelineStart !== undefined &&
            v.timelineEnd !== undefined &&
            coord.timestamp! >= v.timelineStart &&
            coord.timestamp! < v.timelineEnd
        );
      }

      const segmentColor = activeVideo?.color || "#9CA3AF";

      // If color changes, save current segment and start new one
      if (segmentColor !== currentColor && currentSegment.length > 0) {
        // Add last point to new segment for continuity
        coloredSegments.push({
          positions: [...currentSegment],
          color: currentColor,
        });
        currentSegment = [currentSegment[currentSegment.length - 1]];
        currentColor = segmentColor;
      }

      currentSegment.push(position);
    }

    // Add final segment
    if (currentSegment.length > 0) {
      coloredSegments.push({
        positions: currentSegment,
        color: currentColor,
      });
    }
  } else {
    // Fallback: single segment with default color
    coloredSegments.push({
      positions: coords.map((c) => [c.lat, c.lon] as [number, number]),
      color: "#4F46E5", // Indigo
    });
  }

  return (
    <div
      className={`w-full h-full rounded-lg overflow-hidden shadow-md ${className}`}
    >
      <MapContainer
        center={[centerLat, centerLon]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {coloredSegments.map((segment, idx) => (
          <Polyline
            key={idx}
            positions={segment.positions}
            pathOptions={{
              color: segment.color,
              weight: 3,
              opacity: 0.8,
            }}
          />
        ))}

        <AnimatedMarker position={markerPosition} />

        <MapUpdater coords={coords} />
      </MapContainer>
    </div>
  );
}
