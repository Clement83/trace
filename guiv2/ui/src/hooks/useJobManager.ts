import { useState, useRef, useEffect, useCallback } from "react";
import { connectToJob } from "../utils/sse";
import type { JobState } from "../types";

export function useJobManager(onJobComplete?: () => void) {
  const [jobStates, setJobStates] = useState<Map<string, JobState>>(new Map());
  const [lastJobActivity, setLastJobActivity] = useState<number>(Date.now());
  const sseConnectionsRef = useRef<Map<string, { close: () => void }>>(
    new Map()
  );

  const attachJobSSE = useCallback(
    (jobId: string, videoName?: string) => {
      if (sseConnectionsRef.current.has(jobId)) return;

      const state: JobState = {
        jobId,
        videoName,
        progress: 0,
        status: "running",
        logs: [],
        createdAt: Date.now(),
      };
      setJobStates((prev) => new Map(prev).set(jobId, state));
      setLastJobActivity(Date.now());

      const conn = connectToJob(jobId, {
        onOpen: () => {
          setJobStates((prev) => {
            const updated = new Map(prev);
            const s = updated.get(jobId);
            if (s) s.status = "running";
            return updated;
          });
        },
        onProgress: (p) => {
          setLastJobActivity(Date.now());
          setJobStates((prev) => {
            const updated = new Map(prev);
            const s = updated.get(jobId);
            if (s) {
              s.progress = p.percent ?? s.progress;
              s.message = p.message;
            }
            return updated;
          });
        },
        onLog: (l) => {
          setLastJobActivity(Date.now());
          setJobStates((prev) => {
            const updated = new Map(prev);
            const s = updated.get(jobId);
            if (s) s.logs.push(l);
            return updated;
          });
        },
        onDone: (d) => {
          setLastJobActivity(Date.now());
          setJobStates((prev) => {
            const updated = new Map(prev);
            const s = updated.get(jobId);
            if (s) {
              s.status = "done";
              s.progress = 100;
              s.message = "Completed";
            }
            return updated;
          });
          onJobComplete?.();
          setTimeout(() => {
            const conn = sseConnectionsRef.current.get(jobId);
            if (conn) {
              conn.close();
              sseConnectionsRef.current.delete(jobId);
            }
          }, 2000);
        },
        onError: (e) => {
          setJobStates((prev) => {
            const updated = new Map(prev);
            const s = updated.get(jobId);
            if (s) {
              s.status = "error";
              s.message = e.message ?? "Error occurred";
              s.logs.push({
                stream: "stderr",
                message: e.message ?? "Unknown error",
              });
            }
            return updated;
          });
        },
        onClose: () => {
          sseConnectionsRef.current.delete(jobId);
        },
      });

      sseConnectionsRef.current.set(jobId, conn);
    },
    [onJobComplete]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sseConnectionsRef.current.forEach((conn) => conn.close());
      sseConnectionsRef.current.clear();
    };
  }, []);

  return {
    jobStates,
    lastJobActivity,
    attachJobSSE,
  };
}
