import { useState, useEffect } from "react";

import Projects from "./components/projects";
import Sidebar from "./components/sidebar";
import Dashboard from "./components/dashboard";
import FileExplorer from "./components/fileExplorer";
import Settings from "./components/Settings";
import History from "./components/History";
import DebugSessions from "./components/DebugSessions";

import "./App.css";

const API_BASE_URL = "http://localhost:5000";

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [projects, setProjects] = useState([]);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);

  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadProjects() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/projects`);

        if (!response.ok) {
          throw new Error("Failed to load projects");
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error("Could not retrieve projects");
        }

        if (isMounted) {
          setProjects(data.projects);
          setBackendStatus("connected");
          setProjectsError("");
        }
      } catch (error) {
        if (isMounted) {
          setBackendStatus("disconnected");
          setProjectsError(
            "Could not load projects. Please check the backend."
          );
        }

        console.error("Project loading error:", error);
      } finally {
        if (isMounted) {
          setProjectsLoading(false);
        }
      }
    }

    loadProjects();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCreateProject(name) {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to create project");
    }

    setProjects((previousProjects) => [
      data.project,
      ...previousProjects,
    ]);

    return data.project;
  }

  async function handleAnalyzeProject() {
    if (!selectedProject?.id) {
      setAnalysisError("Please select a project first.");
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError("");
    setAnalysis(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${selectedProject.id}/analyze`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to analyze project."
        );
      }

      setAnalysis(data);

      try {
        const historyRun = {
          id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          projectId: selectedProject.id,
          projectName: selectedProject.name,
          timestamp: new Date().toISOString(),
          findingsCount: data.findings?.length || 0,
          errors: data.summary?.errors || 0,
          warnings: data.summary?.warnings || 0,
          info: data.summary?.info || 0,
          summary: data.summary || {},
        };
        const existing = JSON.parse(
          localStorage.getItem("devpilot_analysis_history") || "[]"
        );
        const updated = [historyRun, ...existing].slice(0, 100);
        localStorage.setItem(
          "devpilot_analysis_history",
          JSON.stringify(updated)
        );
      } catch (err) {
        console.warn("Could not log analysis run to history:", err);
      }
    } catch (error) {
      setAnalysisError(
        error.message ||
          "Unable to analyze project. Check your backend connection."
      );
    } finally {
      setAnalysisLoading(false);
    }
  }

  function handleOpenProject(project) {
    setSelectedProject(project);
    setAnalysis(null);
    setAnalysisError("");
    setActivePage("projects");
  }

  function handleCloseProject() {
    setSelectedProject(null);
    setAnalysis(null);
    setAnalysisError("");
  }

  return (
    <div className="App">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <div className="app-content">
        <div className={`backend-status ${backendStatus}`}>
          <span className="status-indicator"></span>

          {backendStatus === "checking" &&
            "Connecting to backend..."}

          {backendStatus === "connected" &&
            "Backend Connected"}

          {backendStatus === "disconnected" &&
            "Backend Disconnected"}
        </div>

        {projectsError && (
          <p role="alert" className="error-message">
            {projectsError}
          </p>
        )}

        {activePage === "dashboard" && (
          <Dashboard
            projects={projects}
            onNavigate={setActivePage}
            onOpenProject={handleOpenProject}
          />
        )}

        {activePage === "projects" && !selectedProject && (
          <Projects
            projects={projects}
            onCreateProject={handleCreateProject}
            loading={projectsLoading}
            onOpenProject={handleOpenProject}
          />
        )}

        {activePage === "projects" && selectedProject && (
          <div className="selected-project-view">
            <div className="analysis-toolbar">
              <div className="analysis-project-info">
                <h2>{selectedProject.name}</h2>
                <p>
                  Analyze your uploaded JavaScript project for
                  potential issues.
                </p>
              </div>

              <div className="analysis-actions">
                <button
                  type="button"
                  className="analysis-back-button"
                  onClick={handleCloseProject}
                  disabled={analysisLoading}
                >
                  Back to Projects
                </button>

                <button
                  type="button"
                  className="analyze-project-button"
                  onClick={handleAnalyzeProject}
                  disabled={
                    analysisLoading ||
                    selectedProject.upload_status !== "uploaded"
                  }
                >
                  {analysisLoading
                    ? "Analyzing..."
                    : "Analyze Project"}
                </button>
              </div>
            </div>

            {selectedProject.upload_status !== "uploaded" && (
              <p className="analysis-notice">
                Upload a ZIP file before analyzing this project.
              </p>
            )}

            {analysisError && (
              <div className="analysis-error" role="alert">
                <strong>Analysis failed</strong>
                <p>{analysisError}</p>
              </div>
            )}

            {analysisLoading && (
              <div
                className="analysis-loading"
                role="status"
                aria-live="polite"
              >
                <span className="analysis-spinner"></span>
                <div>
                  <strong>Analyzing your project...</strong>
                  <p>
                    Scanning supported files for
                    potential issues.
                  </p>
                </div>
              </div>
            )}

            {analysis && (
              <section
                className="analysis-results"
                aria-label="Project analysis results"
              >
                <div className="analysis-results-heading">
                  <div>
                    <h2>Analysis Results</h2>
                    <p>
                      {analysis.projectName ||
                        selectedProject.name}
                    </p>
                  </div>

                  <span className="analysis-success-badge">
                    Analysis Complete
                  </span>
                </div>

                <div className="analysis-summary-grid">
                  <div className="analysis-stat-card">
                    <span>Files Scanned</span>
                    <strong>
                      {analysis.summary.filesScanned}
                    </strong>
                  </div>

                  <div className="analysis-stat-card">
                    <span>Total Findings</span>
                    <strong>
                      {analysis.summary.findings}
                    </strong>
                  </div>

                  <div className="analysis-stat-card warning-stat">
                    <span>Warnings</span>
                    <strong>
                      {analysis.summary.warnings}
                    </strong>
                  </div>

                  <div className="analysis-stat-card error-stat">
                    <span>Errors</span>
                    <strong>
                      {analysis.summary.errors}
                    </strong>
                  </div>

                  <div className="analysis-stat-card info-stat">
                    <span>Info</span>
                    <strong>
                      {analysis.summary.info}
                    </strong>
                  </div>

                  <div className="analysis-stat-card">
                    <span>Files Skipped</span>
                    <strong>
                      {analysis.summary.filesSkipped}
                    </strong>
                  </div>
                </div>

                {analysis.summary.fileLimitReached && (
                  <div className="analysis-notice">
                    Scan limits were reached. Not every supported
                    file may have been analyzed.
                  </div>
                )}

                {analysis.analysisErrors?.length > 0 && (
                  <div className="analysis-error-details">
                    <h3>Files that could not be analyzed</h3>

                    {analysis.analysisErrors.map(
                      (item, index) => (
                        <div
                          className="analysis-finding"
                          key={`${item.path}-${index}`}
                        >
                          <strong>{item.path}</strong>
                          <p>{item.message}</p>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className="analysis-findings-section">
                  <div className="analysis-findings-heading">
                    <h3>Findings</h3>
                    <span>
                      {analysis.findings.length} detected
                    </span>
                  </div>

                  {analysis.findings.length === 0 ? (
                    <div className="analysis-empty-state">
                      <h3>No findings detected</h3>
                      <p>
                        The analyzer did not detect any of its
                        configured patterns in the scanned files.
                        This does not guarantee that the project
                        is free of bugs or security issues.
                      </p>
                    </div>
                  ) : (
                    <div className="analysis-findings-list">
                      {analysis.findings.map(
                        (finding, index) => (
                          <article
                            className="analysis-finding"
                            key={`${finding.file}-${finding.line}-${finding.rule}-${index}`}
                          >
                            <div className="finding-top-row">
                              <span
                                className={`severity-badge severity-${finding.severity}`}
                              >
                                {finding.severity}
                              </span>

                              <code>{finding.rule}</code>
                            </div>

                            <h4>{finding.message}</h4>

                            <div className="finding-location">
                              <span>{finding.file}</span>
                              <span>
                                Line {finding.line}, Column{" "}
                                {finding.column}
                              </span>
                            </div>

                            {finding.excerpt && (
                              <pre className="finding-code">
                                <code>{finding.excerpt}</code>
                              </pre>
                            )}
                          </article>
                        )
                      )}
                    </div>
                  )}
                </div>

                {analysis.note && (
                  <p className="analysis-disclaimer">
                    {analysis.note}
                  </p>
                )}
              </section>
            )}

            <div className="project-file-explorer">
              <FileExplorer
                key={selectedProject.id}
                project={selectedProject}
                onBack={handleCloseProject}
              />
            </div>
          </div>
        )}

        {activePage === "debug-sessions" && (
          <DebugSessions
            projects={projects}
            onOpenProject={handleOpenProject}
          />
        )}

        {activePage === "history" && (
          <History
            projects={projects}
            onOpenProject={handleOpenProject}
          />
        )}

        {activePage === "settings" && (
          <Settings apiUrl={API_BASE_URL} />
        )}
      </div>
    </div>
  );
}

export default App;