import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { KmlSummary, CurrentPosition, KmlCoordinate } from "../types";

export function useTimelinePlayer(kmlSummary?: KmlSummary) {
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playing, setPlaying] = useState(false);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepIntervalRef = useRef<number | null>(null);
  const stepTimeoutRef = useRef<number | null>(null);

  // Initialize current time when KML data loads
  useEffect(() => {
    if (kmlSummary?.start && currentTime === 0) {
      setCurrentTime(kmlSummary.start);
    }
  }, [kmlSummary?.start]);

  // Auto-play timeline
  useEffect(() => {
    if (playing && kmlSummary) {
      const end = kmlSummary.end ?? kmlSummary.start ?? 0;
      const stepMs = 100; // Update every 100ms
      const increment = stepMs; // Increment by actual elapsed time (100ms)

      playIntervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + increment;
          if (next >= end) {
            setPlaying(false);
            return end;
          }
          return next;
        });
      }, stepMs);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [playing, kmlSummary]);

  // Calculate current position on map
  const currentPosition = useMemo((): CurrentPosition | undefined => {
    if (!kmlSummary?.coords || !kmlSummary.start) return undefined;
    const coords = kmlSummary.coords;
    const start = kmlSummary.start;
    const end = kmlSummary.end ?? start;
    const duration = end - start;

    if (duration <= 0 || coords.length === 0)
      return {
        lat: coords[0]?.lat ?? 0,
        lon: coords[0]?.lon ?? 0,
        coord: coords[0],
        speed: undefined,
      };

    // Helper function to calculate distance between two GPS coordinates (Haversine formula)
    const calculateDistance = (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number
    ): number => {
      const R = 6371; // Radius of Earth in kilometers
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // Distance in km
    };

    // Check if coordinates have individual timestamps
    const hasTimestamps = coords.some((c) => c.timestamp !== undefined);

    if (hasTimestamps) {
      // Use the previous node (no interpolation)
      let prevIdx = 0;
      for (let i = coords.length - 1; i >= 0; i--) {
        if (coords[i].timestamp && coords[i].timestamp! <= currentTime) {
          prevIdx = i;
          break;
        }
      }

      const prevNode = coords[prevIdx];

      // Calculate speed if we have a next node
      let speed: number | undefined = undefined;
      if (prevIdx < coords.length - 1) {
        const nextNode = coords[prevIdx + 1];
        if (nextNode.timestamp && prevNode.timestamp) {
          const distance = calculateDistance(
            prevNode.lat,
            prevNode.lon,
            nextNode.lat,
            nextNode.lon
          );
          const timeDiffSeconds =
            (nextNode.timestamp - prevNode.timestamp) / 1000;
          if (timeDiffSeconds > 0) {
            speed = (distance / timeDiffSeconds) * 3600; // Convert to km/h
          }
        }
      }

      return {
        lat: prevNode.lat,
        lon: prevNode.lon,
        coord: prevNode,
        speed,
      };
    } else {
      // Fallback: use index-based approach
      const elapsed = currentTime - start;
      const fraction = Math.max(0, Math.min(1, elapsed / duration));
      const idx = Math.floor(fraction * (coords.length - 1));
      const coord = coords[idx] ?? coords[0];
      return { lat: coord.lat, lon: coord.lon, coord, speed: undefined };
    }
  }, [currentTime, kmlSummary]);

  // Step time forward/backward by 1 second
  const stepTime = useCallback((direction: 1 | -1) => {
    if (!kmlSummary?.start || !kmlSummary?.end) return;
    const newTime = currentTime + direction * 1000; // 1000ms = 1 second
    const clampedTime = Math.max(
      kmlSummary.start,
      Math.min(kmlSummary.end, newTime)
    );
    setCurrentTime(clampedTime);
  }, [currentTime, kmlSummary]);

  // Handle step button press with continuous stepping on hold
  const handleStepMouseDown = useCallback((direction: 1 | -1) => {
    stepTime(direction);
    stepTimeoutRef.current = window.setTimeout(() => {
      stepIntervalRef.current = window.setInterval(() => {
        stepTime(direction);
      }, 100);
    }, 500);
  }, [stepTime]);

  const handleStepMouseUp = useCallback(() => {
    if (stepTimeoutRef.current) {
      clearTimeout(stepTimeoutRef.current);
      stepTimeoutRef.current = null;
    }
    if (stepIntervalRef.current) {
      clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }
  }, []);

  // Cleanup step intervals on unmount
  useEffect(() => {
    return () => {
      if (stepTimeoutRef.current) clearTimeout(stepTimeoutRef.current);
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
    };
  }, []);

  return {
    currentTime,
    setCurrentTime,
    playing,
    setPlaying,
    currentPosition,
    stepTime,
    handleStepMouseDown,
    handleStepMouseUp,
  };
}
