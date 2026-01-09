import React from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface ProgressBarProps {
  progress?: number | null;
  status?: "running" | "done" | "error" | "idle";
  message?: string;
  showPercentage?: boolean;
  className?: string;
}

export function ProgressBar({
  progress = 0,
  status = "idle",
  message,
  showPercentage = true,
  className = "",
}: ProgressBarProps) {
  const percent =
    progress !== null && progress !== undefined
      ? Math.min(100, Math.max(0, progress))
      : 0;

  const getStatusColor = () => {
    switch (status) {
      case "done":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "running":
        return "bg-indigo-600";
      default:
        return "bg-gray-300";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "done":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Header with status icon and message */}
      {(message || status !== "idle") && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            {getStatusIcon()}
            {message && <span>{message}</span>}
          </div>
          {showPercentage && status === "running" && (
            <span className="text-sm font-medium text-gray-900">
              {progress === null || progress === undefined || percent === 0
                ? "Processing..."
                : `${percent.toFixed(0)}%`}
            </span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        {status === "running" &&
        (progress === null || progress === undefined || percent === 0) ? (
          /* Indeterminate progress animation when percent is unknown */
          <div
            className="h-full bg-gradient-to-r from-indigo-400 via-indigo-600 to-indigo-400 animate-[shimmer_2s_ease-in-out_infinite] bg-[length:200%_100%]"
            style={{ width: "100%" }}
          />
        ) : (
          <div
            className={`h-full transition-all duration-300 ease-out ${getStatusColor()} ${
              status === "running" && percent < 100 ? "animate-pulse" : ""
            }`}
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
    </div>
  );
}

interface JobProgressProps {
  jobs: Array<{
    jobId: string;
    videoName?: string;
    progress?: number | null;
    status?: "running" | "done" | "error" | "idle";
    message?: string;
    logs?: Array<{ stream?: string; message: string }>;
  }>;
  className?: string;
}

export function JobProgress({ jobs, className = "" }: JobProgressProps) {
  if (!jobs || jobs.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {jobs.map((job, idx) => (
        <div
          key={job.jobId || idx}
          className="bg-gray-50 rounded-lg p-4 border border-gray-200"
        >
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium text-gray-900">
                {job.videoName
                  ? `Processing: ${job.videoName}`
                  : `Job ${job.jobId.slice(0, 8)}`}
              </h4>
              <span className="text-xs text-gray-500">
                ID: {job.jobId.slice(0, 8)}
              </span>
            </div>
            <ProgressBar
              progress={job.progress ?? 0}
              status={job.status}
              message={job.message}
              showPercentage={true}
            />
          </div>

          {/* Logs */}
          {job.logs && job.logs.length > 0 && (
            <div className="mt-3">
              <details className="group">
                <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900 flex items-center gap-1">
                  <span className="transition-transform group-open:rotate-90">
                    ▶
                  </span>
                  View logs ({job.logs.length})
                </summary>
                <div className="mt-2 max-h-40 overflow-y-auto bg-gray-900 text-gray-100 text-xs font-mono p-2 rounded border border-gray-700">
                  {job.logs.map((log, i) => (
                    <div key={i} className="py-0.5">
                      <span
                        className={
                          log.stream === "stderr"
                            ? "text-red-400"
                            : "text-gray-300"
                        }
                      >
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
