import React from "react";
import type { JobState } from "../../types";

interface JobsCardProps {
  jobs: JobState[];
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function JobsCard({ jobs, collapsed, onToggleCollapse }: JobsCardProps) {
  // Calculer la progression moyenne des jobs en cours
  const runningJobs = jobs.filter((job) => job.status === "running");
  const completedJobs = jobs.filter((job) => job.status === "done");
  const failedJobs = jobs.filter((job) => job.status === "error");

  const averageProgress =
    runningJobs.length > 0
      ? runningJobs.reduce((sum, job) => sum + (job.progress || 0), 0) /
        runningJobs.length
      : 0;

  const hasActiveJobs = runningJobs.length > 0;
  const totalJobs = jobs.length;

  // Ne rien afficher si aucun job
  if (totalJobs === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Widget principal - compact */}
      <div
        className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden cursor-pointer hover:shadow-xl transition-shadow"
        onClick={onToggleCollapse}
      >
        {/* Barre compacte */}
        <div className="px-4 py-3 min-w-[200px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              {hasActiveJobs ? (
                <>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-gray-900">
                    {runningJobs.length} job{runningJobs.length > 1 ? "s" : ""}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-600">
                    {totalJobs} job{totalJobs > 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>

            {/* Indicateur */}
            <button className="text-gray-400 hover:text-gray-600 transition-colors text-xs">
              {collapsed ? "▲" : "▼"}
            </button>
          </div>

          {/* Mini barre de progression (seulement si jobs actifs) */}
          {hasActiveJobs && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${averageProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Panel détaillé - s'ouvre vers le haut */}
        {!collapsed && (
          <div className="border-t border-gray-200 bg-gray-50 max-h-80 overflow-y-auto w-96">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Historique
              </h3>

              <div className="space-y-2">
                {jobs.map((job) => (
                  <div
                    key={job.jobId}
                    className="bg-white rounded border border-gray-200 p-3"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {job.videoName || "Unnamed"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              job.status === "running"
                                ? "bg-blue-100 text-blue-700"
                                : job.status === "done"
                                ? "bg-green-100 text-green-700"
                                : job.status === "error"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {job.status === "running"
                              ? "En cours"
                              : job.status === "done"
                              ? "Terminé"
                              : job.status === "error"
                              ? "Échoué"
                              : job.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {job.jobId.substring(0, 8)}
                          </span>
                        </div>

                        {job.message && (
                          <p className="text-xs text-gray-600 mb-2">
                            {job.message}
                          </p>
                        )}

                        {job.status === "running" && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-600">Progression</span>
                              <span className="font-medium text-gray-900">
                                {job.progress?.toFixed(0) || 0}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${job.progress || 0}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        {job.status === "error" && job.message && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                            {job.message}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
