import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Card, CardContent } from "../components/Card";
import { Modal, ModalFooter } from "../components/Modal";
import { WorkspaceCard } from "../components/workspace/WorkspaceCard";
import { CreateWorkspaceModal } from "../components/workspace/CreateWorkspaceModal";
import { Plus, FolderOpen } from "lucide-react";
import { fetchJSON } from "../utils/api";
import type { WorkspaceSummary } from "../types";

export function WorkspaceListPage() {
  const navigate = useNavigate();
  const [list, setList] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJSON<WorkspaceSummary[]>("/api/workspaces");
      setList(data);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(projectName: string) {
    setDeleting(true);
    try {
      await fetchJSON(`/api/workspaces/${encodeURIComponent(projectName)}`, {
        method: "DELETE",
      });
      setDeleteConfirm(null);
      load();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            KML Video Workspaces
          </h1>
          <p className="text-gray-600">
            Manage your video projects with GPS tracking
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowCreate(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              New Workspace
            </Button>
            <Button variant="secondary" onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Workspace Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Loading workspaces...</p>
          </div>
        ) : list.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FolderOpen className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No workspaces yet
              </h3>
              <p className="text-gray-600 mb-4">
                Create your first workspace to get started
              </p>
              <Button
                onClick={() => setShowCreate(true)}
                icon={<Plus className="w-4 h-4" />}
              >
                Create Workspace
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {list.map((ws) => (
              <WorkspaceCard
                key={ws.projectName}
                workspace={ws}
                onOpen={(name) =>
                  navigate(`/workspaces/${encodeURIComponent(name)}`)
                }
                onDelete={setDeleteConfirm}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateWorkspaceModal
          onClose={() => setShowCreate(false)}
          onCreated={(name) => {
            setShowCreate(false);
            load();
            navigate(`/workspaces/${encodeURIComponent(name)}`);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Workspace"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">
                Are you sure you want to delete "{deleteConfirm}"?
              </p>
              <p className="text-red-700 text-sm mt-2">
                This will permanently delete all videos, SD versions, KML file
                and metadata.
              </p>
              <p className="text-red-800 font-medium text-sm mt-3">
                This action cannot be undone!
              </p>
            </div>

            <ModalFooter>
              <Button
                variant="secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Permanently"}
              </Button>
            </ModalFooter>
          </div>
        </Modal>
      )}
    </div>
  );
}
