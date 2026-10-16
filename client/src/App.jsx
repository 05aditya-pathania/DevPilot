import { useState, useEffect } from "react";
import Projects from "./components/projects";
import Sidebar from "./components/sidebar";
import Dashboard from "./components/dashboard";
import "./App.css";

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [projects, setProjects] = useState([]);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadProjects() {
      try {
        const response = await fetch("http://localhost:5000/api/projects");

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
          setProjectsError("Could not load projects. Please check the backend.");
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
    const response = await fetch("http://localhost:5000/api/projects", {
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

  return (
    <div className="App">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <div className="app-content">
        <div className={`backend-status ${backendStatus}`}>
          <span className="status-indicator"></span>
          {backendStatus === "checking" && "Connecting to backend..."}
          {backendStatus === "connected" && "Backend Connected"}
          {backendStatus === "disconnected" && "Backend Disconnected"}
        </div>

        {projectsError && (
          <p role="alert" className="error-message">
            {projectsError}
          </p>
        )}

        {activePage === "dashboard" && (
          <Dashboard projects={projects} />
        )}

        {activePage === "projects" && (
          <Projects
            projects={projects}
            onCreateProject={handleCreateProject}
            loading={projectsLoading}
          />
        )}
      </div>
    </div>
  );
}

export default App;