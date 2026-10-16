import { useState } from "react";

function Projects({ projects, onCreateProject, loading }) {
  const [projectName, setProjectName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateProject(event) {
    event.preventDefault();

    const name = projectName.trim();

    if (!name || saving) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onCreateProject(name);

      setProjectName("");
      setShowForm(false);
    } catch (error) {
      setError(error.message || "Could not create project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <h2>Projects</h2>

        <button
          className="primary-button"
          onClick={() => setShowForm(true)}
          disabled={saving}
        >
          + New Project
        </button>
      </header>

      <section className="welcome">
        <h1>Your Projects</h1>
        <p>Manage your projects and debug issues in one place.</p>
      </section>

      {showForm && (
        <form
          className="project-form"
          onSubmit={handleCreateProject}
        >
          <label htmlFor="projectName">Project Name</label>

          <input
            id="projectName"
            type="text"
            placeholder="Enter project name"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            maxLength={100}
            required
            disabled={saving}
          />

          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving ? "Creating..." : "Create Project"}
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={saving}
              onClick={() => {
                setShowForm(false);
                setProjectName("");
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="recent-projects">
        <h2>All Projects ({projects.length})</h2>

        {loading ? (
          <p>Loading projects...</p>
        ) : projects.length === 0 ? (
          <p>No projects yet. Create your first project!</p>
        ) : (
          <div className="project-list">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <h3>{project.name}</h3>

                <p>
                  Created:{" "}
                  {new Date(project.created_at).toLocaleDateString()}
                </p>

                {project.description && <p>{project.description}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Projects;