import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../Card";
import { MapPin } from "lucide-react";
import type { CurrentPosition } from "../../types";

export interface VideoOverlayOptions {
  showSpeed: boolean;
  showAltitude: boolean;
  showCoordinates: boolean;
  showTime: boolean;
  showMap: boolean;
}

interface KMLNodeInfoCardProps {
  currentPosition?: CurrentPosition;
  overlayOptions?: VideoOverlayOptions;
  onOverlayOptionsChange?: (options: VideoOverlayOptions) => void;
}

export function KMLNodeInfoCard({
  currentPosition,
  overlayOptions = {
    showSpeed: true,
    showAltitude: false,
    showCoordinates: false,
    showTime: false,
    showMap: false,
  },
  onOverlayOptionsChange,
}: KMLNodeInfoCardProps) {
  const handleCheckboxChange = (key: keyof VideoOverlayOptions) => {
    if (onOverlayOptionsChange) {
      onOverlayOptionsChange({
        ...overlayOptions,
        [key]: !overlayOptions[key],
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Current KML Node
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentPosition?.coord ? (
          <div className="space-y-2 text-sm">
            {/* Latitude */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={overlayOptions.showCoordinates}
                  onChange={() => handleCheckboxChange("showCoordinates")}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-gray-500">Latitude:</span>
              </div>
              <span className="font-mono">
                {currentPosition.coord.lat.toFixed(6)}°
              </span>
            </div>

            {/* Longitude */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={overlayOptions.showCoordinates}
                  onChange={() => handleCheckboxChange("showCoordinates")}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-gray-500">Longitude:</span>
              </div>
              <span className="font-mono">
                {currentPosition.coord.lon.toFixed(6)}°
              </span>
            </div>

            {/* Altitude */}
            {currentPosition.coord.alt !== undefined && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={overlayOptions.showAltitude}
                    onChange={() => handleCheckboxChange("showAltitude")}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-gray-500">Altitude:</span>
                </div>
                <span className="font-mono">
                  {currentPosition.coord.alt.toFixed(2)} m
                </span>
              </div>
            )}

            {/* Temps */}
            {currentPosition.coord.timestamp !== undefined && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={overlayOptions.showTime}
                    onChange={() => handleCheckboxChange("showTime")}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-gray-500">Temps:</span>
                </div>
                <span className="font-mono text-xs">
                  {new Date(
                    currentPosition.coord.timestamp
                  ).toLocaleTimeString()}
                </span>
              </div>
            )}

            {/* Vitesse */}
            {currentPosition.speed !== undefined && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={overlayOptions.showSpeed}
                    onChange={() => handleCheckboxChange("showSpeed")}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-gray-500">Vitesse:</span>
                </div>
                <span className="font-mono">
                  {currentPosition.speed.toFixed(1)} km/h
                </span>
              </div>
            )}

            {/* Carte */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={overlayOptions.showMap}
                  onChange={() => handleCheckboxChange("showMap")}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-gray-500">Carte (en haut à droite)</span>
              </div>
            </div>

            {/* Raw data section */}
            <details className="mt-3">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700 text-xs">
                Afficher les données brutes
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                {JSON.stringify(currentPosition.coord, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">
            Aucune donnée de position KML disponible
          </p>
        )}
      </CardContent>
    </Card>
  );
}
