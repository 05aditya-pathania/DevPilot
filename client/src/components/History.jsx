import { useState } from "react";

function History({ projects = [], onOpenProject }) {
  const [historyItems, setHistoryItems] = useState(() => {
    try {
      const data = localStorage.getItem("devpilot_analysis_history");
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (err) {
      console.error("Failed to load analysis history:", err);
    }
    return [];
  });
  const [filterProject, setFilterProject] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);

  function handleClearHistory() {
    if (
      window.confirm(
        "Are you sure you want to clear your analysis scan history? This action cannot be undone."
      )
    ) {
      try {
        localStorage.removeItem("devpilot_analysis_history");
        setHistoryItems([]);
        setSelectedRecord(null);
      } catch (err) {
        console.error("Failed to clear history:", err);
      }
    }
  }

  const filteredItems = historyItems.filter((item) => {
    const matchesProject =
      filterProject === "all" ||
      String(item.projectId) === String(filterProject);
    const matchesSearch =
      !searchTerm ||
      (item.projectName || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesProject && matchesSearch;
  });

  return (
    <main className="dashboard history-page">
      <header className="topbar">
        <div>
          <h2>Analysis History</h2>
          <p>Chronological records of static code scans</p>
        </div>

        {historyItems.length > 0 && (
          <button
            type="button"
            className="secondary-button danger-button"
            onClick={handleClearHistory}
          >
            Clear History
          </button>
        )}
      </header>

      <section className="welcome">
        <div>
          <h1>Scan History</h1>
          <p>
            Review past analysis runs, inspect historical defect counts, and track improvements across your projects.
          </p>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="history-toolbar">
        <div className="history-filters">
          <div className="filter-group">
            <label htmlFor="project-filter">Project:</label>
            <select
              id="project-filter"
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
            >
              <option value="all">All Projects ({historyItems.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="history-search">Search:</label>
            <input
              id="history-search"
              type="text"
              placeholder="Filter by project name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <span className="history-count">
          Showing {filteredItems.length} of {historyItems.length} runs
        </span>
      </div>

      {/* History Items List */}
      {filteredItems.length === 0 ? (
        <section className="history-empty">
          <div className="empty-icon">📜</div>
          <h3>No Analysis History Found</h3>
          <p>
            {historyItems.length === 0
              ? "You haven't run any project analyses yet. Open an uploaded project and run 'Analyze Project' to log scan history."
              : "No records match the current filter criteria."}
          </p>
        </section>
      ) : (
        <section className="history-list">
          {filteredItems.map((record) => (
            <article className="history-card" key={record.id}>
              <div className="history-card-header">
                <div className="history-project-info">
                  <h3>{record.projectName}</h3>
                  <span className="history-timestamp">
                    {new Date(record.timestamp).toLocaleString()}
                  </span>
                </div>
                <span className="status-badge success">Completed</span>
              </div>

              <div className="history-metrics-row">
                <div className="metric">
                  <span className="metric-label">Files Scanned:</span>
                  <span className="metric-value">
                    {record.summary?.filesScanned ?? 0}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Files Skipped:</span>
                  <span className="metric-value">
                    {record.summary?.filesSkipped ?? 0}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Total Findings:</span>
                  <span className="metric-value">
                    {record.findingsCount ?? 0}
                  </span>
                </div>
                <div className="metric-badges">
                  {record.errors > 0 && (
                    <span className="severity-badge severity-error">
                      {record.errors} Errors
                    </span>
                  )}
                  {record.warnings > 0 && (
                    <span className="severity-badge severity-warning">
                      {record.warnings} Warnings
                    </span>
                  )}
                  {record.info > 0 && (
                    <span className="severity-badge severity-info">
                      {record.info} Info
                    </span>
                  )}
                  {record.findingsCount === 0 && (
                    <span className="severity-badge severity-clean">
                      Clean (0 findings)
                    </span>
                  )}
                </div>
              </div>

              <div className="history-card-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setSelectedRecord(
                      selectedRecord?.id === record.id ? null : record
                    )
                  }
                >
                  {selectedRecord?.id === record.id
                    ? "Hide Summary"
                    : "View Summary Details"}
                </button>

                {onOpenProject && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      const matched = projects.find(
                        (p) => String(p.id) === String(record.projectId)
                      );
                      if (matched) {
                        onOpenProject(matched);
                      }
                    }}
                  >
                    Open Project
                  </button>
                )}
              </div>

              {selectedRecord?.id === record.id && (
                <div className="history-expanded-details">
                  <h4>Scan Summary Details</h4>
                  <div className="details-grid">
                    <div>
                      <strong>Total Bytes Scanned:</strong>{" "}
                      {record.summary?.totalBytesScanned
                        ? `${(
                            record.summary.totalBytesScanned / 1024
                          ).toFixed(1)} KB`
                        : "N/A"}
                    </div>
                    <div>
                      <strong>File Limits Reached:</strong>{" "}
                      {record.summary?.fileLimitReached ? "Yes" : "No"}
                    </div>
                    {record.summary?.skipReasons && (
                      <div className="skip-reasons">
                        <strong>Skip Reasons Breakdown:</strong>
                        <ul>
                          <li>
                            Hidden entries:{" "}
                            {record.summary.skipReasons.hiddenEntries ?? 0}
                          </li>
                          <li>
                            Ignored directories:{" "}
                            {record.summary.skipReasons.ignoredDirectories ?? 0}
                          </li>
                          <li>
                            Unsupported extensions:{" "}
                            {record.summary.skipReasons
                              .unsupportedExtensions ?? 0}
                          </li>
                          <li>
                            Oversized files:{" "}
                            {record.summary.skipReasons.oversizedFiles ?? 0}
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default History;
