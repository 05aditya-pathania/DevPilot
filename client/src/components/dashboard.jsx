function Dashboard({ projects = [] }) {
  const stats = [
    {
      title: "Total Projects",
      value: projects.length,
      description: "Projects created",
    },
    {
      title: "Analyses",
      value: 0,
      description: "Code analyses completed",
    },
    {
      title: "Resolved Issues",
      value: 0,
      description: "Issues successfully resolved",
    },
  ];

  return (
    <main className="dashboard">
      <header className="topbar">
        <h2>Dashboard</h2>

        <div className="profile">Developer</div>
      </header>

      <section className="welcome">
        <div>
          <h1>Welcome back, Developer!</h1>

          <p>
            Manage your projects and build better software with DevPilot.
          </p>
        </div>
      </section>

      <section className="stats">
        {stats.map((stat) => (
          <div className="stat-card" key={stat.title}>
            <h3>{stat.title}</h3>

            <p>{stat.value}</p>

            <span className="stat-description">
              {stat.description}
            </span>
          </div>
        ))}
      </section>

      <section className="dashboard-actions">
        <div className="section-heading">
          <div>
            <h2>Quick Actions</h2>

            <p>Get started with your development workflow.</p>
          </div>
        </div>

        <div className="action-grid">
          <div className="action-card">
            <div className="action-icon">+</div>

            <h3>Manage Projects</h3>

            <p>
              Organize your projects and prepare them for code analysis.
            </p>

            <span className="action-label">Available in Projects</span>
          </div>

          <div className="action-card">
            <div className="action-icon">&lt;/&gt;</div>

            <h3>Debug Code</h3>

            <p>
              Prepare to investigate errors and understand code issues.
            </p>

            <span className="action-label">Coming next</span>
          </div>
        </div>
      </section>

      <section className="recent-projects">
        <div className="section-heading">
          <div>
            <h2>Recent Projects</h2>

            <p>Your recently created projects.</p>
          </div>

          <span className="project-count">
            {projects.length} total
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="empty-projects">
            <h3>No projects yet</h3>

            <p>
              Create your first project to get started with DevPilot.
            </p>
          </div>
        ) : (
          <div className="project-list">
            {projects.slice(-4).reverse().map((project) => (
              <article className="project-card" key={project.id}>
                <div className="project-card-icon">
                  {project.name.charAt(0).toUpperCase()}
                </div>

                <div className="project-card-info">
                  <h3>{project.name}</h3>

                  <p>Created: {project.createdAt}</p>
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