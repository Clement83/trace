import type { JobProgressData, JobLog } from "../types";

export function connectToJob(
  jobId: string,
  handlers: {
    onProgress?: (p: JobProgressData) => void;
    onLog?: (l: JobLog) => void;
    onDone?: (d: any) => void;
    onError?: (e: any) => void;
    onOpen?: () => void;
    onClose?: () => void;
  }
) {
  const url = `/api/encode/events/${jobId}`;
  const es = new EventSource(url);

  es.onopen = () => handlers.onOpen?.();
  es.onerror = () => {
    handlers.onError?.({ message: "SSE connection error/closed" });
  };
  es.addEventListener("progress", (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data);
      handlers.onProgress?.(data);
    } catch {
      // ignore
    }
  });
  es.addEventListener("log", (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data);
      handlers.onLog?.(data);
    } catch {
      handlers.onLog?.({ stream: "stdout", message: String(ev.data) });
    }
  });
  es.addEventListener("done", (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data);
      handlers.onDone?.(data);
    } catch {
      handlers.onDone?.({});
    }
  });
  es.addEventListener("error", (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data);
      handlers.onError?.(data);
    } catch {
      handlers.onError?.({ message: String(ev.data) });
    }
  });

  return {
    close: () => {
      try {
        es.close();
      } catch {}
      handlers.onClose?.();
    },
  };
}
