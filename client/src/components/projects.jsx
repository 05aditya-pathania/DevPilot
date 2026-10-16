import { useState } from "react";

function Projects({ projects, setProjects }) {
  const [projectName, setProjectName] = useState("");
  const [showForm, setShowForm] = useState(false);

  function handleCreateProject(event) {
    event.preventDefault();

    const name = projectName.trim();

    if (!name) {
      return;
    }

    const newProject = {
      id: crypto.randomUUID(),
      name: name,
      createdAt: new Date().toLocaleDateString(),
    };

    setProjects((previousProjects) => [
      ...previousProjects,
      newProject,
    ]);

    setProjectName("");
    setShowForm(false);
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <h2>Projects</h2>

        <button
          className="primary-button"
          onClick={() => setShowForm(true)}
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
            onChange={(event) =>
              setProjectName(event.target.value)
            }
            maxLength={80}
            required
          />

          <div className="form-actions">
            <button type="submit" className="primary-button">
              Create Project
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setShowForm(false);
                setProjectName("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="recent-projects">
        <h2>All Projects ({projects.length})</h2>

        {projects.length === 0 ? (
          <p>No projects yet. Create your first project!</p>
        ) : (
          <div className="project-list">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <h3>{project.name}</h3>
                <p>Created: {project.createdAt}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Projects;