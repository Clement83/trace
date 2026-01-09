import { useState, useEffect, useCallback } from "react";
import { fetchJSON } from "../utils/api";
import type { WorkspaceMeta } from "../types";

export function useWorkspaceData(projectName: string) {
  const [meta, setMeta] = useState<WorkspaceMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMeta = useCallback(
    async (preserveCurrentTime = false) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchJSON<WorkspaceMeta>(
          `/api/workspaces/${encodeURIComponent(projectName)}`
        );
        setMeta(data);
        return data;
      } catch (e: any) {
        setError(e?.message ?? String(e));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [projectName]
  );

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  return {
    meta,
    loading,
    error,
    setError,
    loadMeta,
  };
}
