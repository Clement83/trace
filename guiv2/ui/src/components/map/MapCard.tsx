import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../Card";
import { MapView } from "../MapView";
import { MapPin } from "lucide-react";
import { formatDuration } from "../../utils/formatters";
import type { KmlSummary, CurrentPosition, VideoMeta } from "../../types";

interface MapCardProps {
  kmlSummary?: KmlSummary;
  currentPosition?: CurrentPosition;
  videos: VideoMeta[];
}

export function MapCard({ kmlSummary, currentPosition, videos }: MapCardProps) {
  const kml = kmlSummary;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            GPS Track
          </CardTitle>
          {/* KML Summary Info */}
          {kml && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {kml.start && (
                <span>
                  Start: {new Date(kml.start).toLocaleTimeString()}
                </span>
              )}
              {kml.durationMs && (
                <span>Duration: {formatDuration(kml.durationMs)}</span>
              )}
              {kml.coords && <span>{kml.coords.length} points</span>}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          {kml && kml.coords && kml.coords.length > 0 ? (
            <MapView
              coords={kml.coords}
              currentPosition={currentPosition}
              videos={videos}
            />
          ) : (
            <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
              <p className="text-gray-500">No GPS data available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
