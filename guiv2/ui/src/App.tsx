import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WorkspaceListPage } from "./pages/WorkspaceListPage";
import { WorkspaceViewPage } from "./pages/WorkspaceViewPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/workspaces" replace />} />
        <Route path="/workspaces" element={<WorkspaceListPage />} />
        <Route
          path="/workspaces/:projectName"
          element={<WorkspaceViewPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}
