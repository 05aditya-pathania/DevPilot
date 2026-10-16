import { useState, useEffect } from "react";

import Projects from "./components/projects";
import Sidebar from "./components/sidebar";
import Dashboard from "./components/dashboard";

import "./App.css";

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [projects, setProjects] = useState([]);

  const [backendStatus, setBackendStatus] = useState("checking");

  useEffect(() => {
    let isMounted = true;

    async function checkBackend() {
      try {
        const response = await fetch(
          "http://localhost:5000/api/health"
        );

        if (!response.ok) {
          throw new Error("Backend health check failed");
        }

        const data = await response.json();

        if (isMounted) {
          setBackendStatus(
            data.success ? "connected" : "disconnected"
          );
        }
      } catch (error) {
        if (isMounted) {
          setBackendStatus("disconnected");
        }

        console.error("Backend connection error:", error);
      }
    }

    checkBackend();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="App">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <div className="app-content">
        <div className={`backend-status ${backendStatus}`}>
          <span className="status-indicator"></span>

          {backendStatus === "checking" && "Checking backend..."}

          {backendStatus === "connected" && "Backend Connected"}

          {backendStatus === "disconnected" && "Backend Disconnected"}
        </div>

        {activePage === "dashboard" && (
          <Dashboard projects={projects} />
        )}

        {activePage === "projects" && (
          <Projects
            projects={projects}
            setProjects={setProjects}
          />
        )}
      </div>
    </div>
  );
}

export default App;