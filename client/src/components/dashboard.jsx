import { useState } from "react";

function Dashboard({ projects = [], onNavigate, onOpenProject }) {
  const [analysisCount] = useState(() => {
    try {
      const data = localStorage.getItem("devpilot_analysis_history");
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.length;
        }
      }
    } catch {
      // Default to 0 if storage is empty or unavailable
    }
    return 0;
  });

  const stats = [
    {
      title: "Total Projects",
      value: projects.length,
      description: "Projects active in workspace",
      variant: "cyan",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      title: "Analyses Recorded",
      value: analysisCount,
      description: "Static scans & heuristic runs",
      variant: "blue",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      title: "Resolved Issues",
      value: "—",
      description: "Issue tracking coming soon",
      variant: "teal",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
  ];

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <h2>Dashboard Overview</h2>
          <span className="topbar-subtitle">System Telemetry & Project Status</span>
        </div>

        <div className="topbar-right">
          <div className="engine-chip">
            <span className="pulse-dot"></span>
            <span>Analyzers Ready</span>
          </div>
          <div className="profile">Developer</div>
        </div>
      </header>

      <section className="welcome">
        <div className="welcome-glow-backdrop" aria-hidden="true"></div>
        <div className="welcome-mesh" aria-hidden="true">
          <div className="mesh-line mesh-line-1"></div>
          <div className="mesh-line mesh-line-2"></div>
          <div className="mesh-node node-a"></div>
          <div className="mesh-node node-b"></div>
          <div className="mesh-node node-c"></div>
        </div>

        <div className="welcome-content">
          <div className="welcome-badge">
            <span className="badge-text">DevPilot Intelligence Platform</span>
          </div>
          <h1>Next-Gen Code Triage & Analysis</h1>
          <p>
            Monitor defect patterns, trace AST heuristics, and inspect compiler diagnostics across your repositories.
          </p>
        </div>
      </section>

      <section className="stats">
        {stats.map((stat) => (
          <div className={`stat-card stat-${stat.variant}`} key={stat.title}>
            <div className="stat-card-header">
              <h3>{stat.title}</h3>
              <div className="stat-icon-wrapper">{stat.icon}</div>
            </div>

            <p className="stat-value">{stat.value}</p>

            <span className="stat-description">
              {stat.description}
            </span>

            <div className="stat-spark-bar" aria-hidden="true">
              <div className="stat-spark-fill"></div>
            </div>
          </div>
        ))}
      </section>

      <section className="dashboard-actions">
        <div className="section-heading">
          <div>
            <h2>Quick Actions</h2>
            <p>Direct entrypoints for common developer workflows.</p>
          </div>
        </div>

        <div className="action-grid">
          <div
            className="action-card interactive"
            onClick={() => onNavigate?.("projects")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onNavigate?.("projects")}
          >
            <div className="action-icon action-icon-cyan">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>

            <h3>Manage Projects</h3>
            <p>
              Upload archive files, browse extracted directory trees, and initiate code scans.
            </p>
            <span className="action-label">Open Projects &rarr;</span>
          </div>

          <div
            className="action-card interactive"
            onClick={() => onNavigate?.("debug-sessions")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onNavigate?.("debug-sessions")}
          >
            <div className="action-icon action-icon-blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
                <line x1="14" y1="4" x2="10" y2="20" />
              </svg>
            </div>

            <h3>Debug Code</h3>
            <p>
              Inspect findings in Monaco editor, triage static analyzer diagnostics, and patch in-place.
            </p>
            <span className="action-label">Start Session &rarr;</span>
          </div>
        </div>
      </section>

      <section className="recent-projects">
        <div className="section-heading">
          <div>
            <h2>Recent Projects</h2>
            <p>Most recently managed repository workspaces.</p>
          </div>

          <span className="project-count">
            {projects.length} Total
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="empty-projects">
            <h3>No projects registered yet</h3>
            <p>
              Create your first project in the Projects panel to upload and analyze code.
            </p>
          </div>
        ) : (
          <div className="project-list">
            {projects.slice(-4).reverse().map((project) => (
              <article
                className="project-card interactive"
                key={project.id}
                onClick={() => onOpenProject?.(project)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onOpenProject?.(project)}
              >
                <div className="project-card-top">
                  <div className="project-card-icon">
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                  <span className={`project-status-tag ${project.upload_status === "uploaded" ? "tag-ready" : "tag-pending"}`}>
                    {project.upload_status === "uploaded" ? "ZIP Ready" : "Awaiting Upload"}
                  </span>
                </div>

                <div className="project-card-info">
                  <h3>{project.name}</h3>
                  <p>Created: {new Date(project.created_at).toLocaleDateString()}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Dashboard;
