import { useState } from "react";
import CodeEditor from "./codeEditor.jsx";

const API_BASE_URL = "http://localhost:5000";

function DebugSessions({ projects = [] }) {
  const [selectedProjectId, setSelectedProjectId] = useState(
    projects[0]?.id ? String(projects[0].id) : ""
  );
  const [sessionStatus, setSessionStatus] = useState("idle"); // idle | analyzing | active | failed
  const [sessionData, setSessionData] = useState(null);
  const [sessionError, setSessionError] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");

  // Inspecting a specific finding in the editor
  const [inspectingFinding, setInspectingFinding] = useState(null);
  const [inspectingContent, setInspectingContent] = useState("");
  const [inspectingLoading, setInspectingLoading] = useState(false);
  const [inspectingDirty, setInspectingDirty] = useState(false);
  const [inspectingSaving, setInspectingSaving] = useState(false);
  const [inspectingSaveMessage, setInspectingSaveMessage] = useState("");
  const [inspectingSaveError, setInspectingSaveError] = useState("");

  const activeProject = projects.find(
    (p) => String(p.id) === String(selectedProjectId)
  );

  async function handleStartSession() {
    if (!selectedProjectId) {
      setSessionError("Please select a project to start debugging.");
      return;
    }

    if (activeProject && activeProject.upload_status !== "uploaded") {
      setSessionError(
        "This project has not uploaded any files yet. Please upload a ZIP archive first."
      );
      return;
    }

    setSessionStatus("analyzing");
    setSessionError("");
    setInspectingFinding(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/projects/${selectedProjectId}/analyze`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to analyze project.");
      }

      setSessionData(data);
      setSessionStatus("active");
    } catch (err) {
      setSessionError(
        err.message || "Could not connect to backend static analysis service."
      );
      setSessionStatus("failed");
    }
  }

  function handleEndSession() {
    setSessionStatus("idle");
    setSessionData(null);
    setInspectingFinding(null);
    setSessionError("");
  }

  async function handleInspectFinding(finding) {
    setInspectingFinding(finding);
    setInspectingLoading(true);
    setInspectingDirty(false);
    setInspectingSaveMessage("");
    setInspectingSaveError("");

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/projects/${selectedProjectId}/file?path=${encodeURIComponent(
          finding.file
        )}`,
        { cache: "no-store" }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load source file.");
      }

      setInspectingContent(data.content ?? "");
    } catch (err) {
      setInspectingSaveError(err.message || "Failed to read file.");
    } finally {
      setInspectingLoading(false);
    }
  }

  async function handleSaveInspectedFile() {
    if (!inspectingFinding || inspectingSaving) return;

    setInspectingSaving(true);
    setInspectingSaveMessage("");
    setInspectingSaveError("");

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/projects/${selectedProjectId}/file?path=${encodeURIComponent(
          inspectingFinding.file
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: inspectingContent }),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to save file.");
      }

      setInspectingDirty(false);
      setInspectingSaveMessage(
        "File saved! Click 'Re-scan Project' to verify the fix."
      );
    } catch (err) {
      setInspectingSaveError(err.message || "Failed to save changes.");
    } finally {
      setInspectingSaving(false);
    }
  }

  const findings = sessionData?.findings || [];
  const filteredFindings = findings.filter((f) => {
    if (severityFilter === "all") return true;
    return f.severity === severityFilter;
  });

  return (
    <main className="dashboard debug-session-page">
      <header className="topbar">
        <div>
          <h2>Debugging Session</h2>
          <p>Triage and inspect static analysis findings in your code</p>
        </div>

        {sessionStatus === "active" && (
          <div className="header-actions">
            <button
              type="button"
              className="primary-button"
              onClick={handleStartSession}
            >
              ↻ Re-scan Project
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleEndSession}
            >
              End Session
            </button>
          </div>
        )}
      </header>

      <section className="welcome">
        <div>
          <h1>Static Code Debugging & Triage</h1>
          <p>
            Start an inspection session on your uploaded projects to isolate, inspect, and address static analysis defects.
          </p>
        </div>
      </section>

      {/* Project Selector & Session Start */}
      <section className="debug-session-control-panel">
        <div className="control-row">
          <div className="project-select-group">
            <label htmlFor="debug-project-select">Target Project:</label>
            <select
              id="debug-project-select"
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSessionStatus("idle");
                setSessionData(null);
                setInspectingFinding(null);
                setSessionError("");
              }}
              disabled={sessionStatus === "analyzing"}
            >
              {projects.length === 0 && (
                <option value="">No projects available</option>
              )}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{" "}
                  {p.upload_status === "uploaded" ? "(Ready)" : "(No ZIP)"}
                </option>
              ))}
            </select>
          </div>

          <div className="session-status-badge">
            Status:{" "}
            <span className={`badge status-${sessionStatus}`}>
              {sessionStatus === "idle" && "Idle"}
              {sessionStatus === "analyzing" && "Analyzing..."}
              {sessionStatus === "active" && "Session Active"}
              {sessionStatus === "failed" && "Failed"}
            </span>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={handleStartSession}
            disabled={
              sessionStatus === "analyzing" ||
              !selectedProjectId ||
              activeProject?.upload_status !== "uploaded"
            }
          >
            {sessionStatus === "analyzing"
              ? "Running Static Analysis..."
              : sessionStatus === "active"
              ? "Re-analyze Project"
              : "Start Debugging Session"}
          </button>
        </div>

        {activeProject && activeProject.upload_status !== "uploaded" && (
          <p className="notice-text">
            ⚠️ This project has no uploaded files. Go to <strong>Projects</strong> to upload a ZIP archive first.
          </p>
        )}

        {sessionError && (
          <div className="session-error" role="alert">
            <strong>Session Error:</strong> {sessionError}
          </div>
        )}
      </section>

      {/* Active Session Content */}
      {sessionStatus === "analyzing" && (
        <div className="debug-loading" role="status">
          <span className="analysis-spinner"></span>
          <p>Scanning source files with heuristic, AST, and compiler analyzers...</p>
        </div>
      )}

      {sessionStatus === "active" && sessionData && (
        <div className="debug-session-workspace">
          {/* Summary Banner */}
          <div className="session-summary-strip">
            <div className="summary-pill">
              <span>Files Scanned:</span>
              <strong>{sessionData.summary.filesScanned}</strong>
            </div>
            <div className="summary-pill">
              <span>Total Issues:</span>
              <strong>{sessionData.findings.length}</strong>
            </div>
            <div className="summary-pill error">
              <span>Errors:</span>
              <strong>{sessionData.summary.errors}</strong>
            </div>
            <div className="summary-pill warning">
              <span>Warnings:</span>
              <strong>{sessionData.summary.warnings}</strong>
            </div>
            <div className="summary-pill info">
              <span>Info:</span>
              <strong>{sessionData.summary.info}</strong>
            </div>
          </div>

          <div className="debug-workspace-layout">
            {/* Left: Findings Triage List */}
            <section className="findings-triage-panel">
              <div className="panel-header">
                <h3>Detected Issues ({filteredFindings.length})</h3>
                <div className="filter-tabs">
                  <button
                    type="button"
                    className={`tab ${severityFilter === "all" ? "active" : ""}`}
                    onClick={() => setSeverityFilter("all")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`tab ${severityFilter === "error" ? "active" : ""}`}
                    onClick={() => setSeverityFilter("error")}
                  >
                    Errors ({sessionData.summary.errors})
                  </button>
                  <button
                    type="button"
                    className={`tab ${severityFilter === "warning" ? "active" : ""}`}
                    onClick={() => setSeverityFilter("warning")}
                  >
                    Warnings ({sessionData.summary.warnings})
                  </button>
                  <button
                    type="button"
                    className={`tab ${severityFilter === "info" ? "active" : ""}`}
                    onClick={() => setSeverityFilter("info")}
                  >
                    Info ({sessionData.summary.info})
                  </button>
                </div>
              </div>

              {filteredFindings.length === 0 ? (
                <div className="empty-findings">
                  <p>🎉 No issues found for filter: {severityFilter}</p>
                </div>
              ) : (
                <div className="findings-list">
                  {filteredFindings.map((finding, idx) => (
                    <article
                      key={`${finding.file}-${finding.line}-${finding.rule}-${idx}`}
                      className={`finding-card severity-${finding.severity} ${
                        inspectingFinding === finding ? "selected" : ""
                      }`}
                      onClick={() => handleInspectFinding(finding)}
                    >
                      <div className="finding-header">
                        <span className={`badge severity-${finding.severity}`}>
                          {finding.severity}
                        </span>
                        <code>{finding.rule}</code>
                      </div>
                      <p className="finding-msg">{finding.message}</p>
                      <div className="finding-meta">
                        <span>{finding.file}</span>
                        <span>
                          Line {finding.line}, Col {finding.column || 1}
                        </span>
                      </div>
                      {finding.excerpt && (
                        <pre className="finding-preview">
                          <code>{finding.excerpt}</code>
                        </pre>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Right: Code Inspector */}
            <section className="debug-code-inspector">
              <div className="panel-header">
                <h3>Code Inspection</h3>
                {inspectingFinding && (
                  <span className="file-badge">
                    {inspectingFinding.file} (Line {inspectingFinding.line})
                  </span>
                )}
              </div>

              {!inspectingFinding ? (
                <div className="inspector-placeholder">
                  <div className="icon">&lt;/&gt;</div>
                  <h4>Select an issue from the list to inspect source code</h4>
                  <p>
                    DevPilot will open the file in the editor so you can review and address the problem directly.
                  </p>
                </div>
              ) : inspectingLoading ? (
                <div className="inspector-loading">
                  <p>Loading file content...</p>
                </div>
              ) : (
                <div className="inspector-editor-wrapper">
                  <div className="inspector-issue-banner">
                    <span
                      className={`badge severity-${inspectingFinding.severity}`}
                    >
                      {inspectingFinding.severity}
                    </span>
                    <strong>{inspectingFinding.rule}:</strong>{" "}
                    {inspectingFinding.message}
                  </div>

                  <CodeEditor
                    file={{
                      name: inspectingFinding.file.split("/").pop() || "",
                      path: inspectingFinding.file,
                    }}
                    content={inspectingContent}
                    onChange={(val) => {
                      setInspectingContent(val);
                      setInspectingDirty(true);
                      setInspectingSaveMessage("");
                      setInspectingSaveError("");
                    }}
                    onSave={handleSaveInspectedFile}
                    saving={inspectingSaving}
                    dirty={inspectingDirty}
                    saveMessage={inspectingSaveMessage}
                    saveError={inspectingSaveError}
                  />
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

export default DebugSessions;
