import { useState } from "react";

const DEFAULT_SETTINGS = {
  theme: "vs-dark",
  fontSize: 13,
  wordWrap: "off",
  minimap: false,
};

function Settings({ apiUrl = "http://localhost:5000" }) {
  const [editorSettings, setEditorSettings] = useState(() => {
    try {
      const stored = localStorage.getItem("devpilot_editor_settings");
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Use defaults if storage fails or is malformed
    }
    return DEFAULT_SETTINGS;
  });
  const [savedMessage, setSavedMessage] = useState("");
  const [testStatus, setTestStatus] = useState(null);
  const [testing, setTesting] = useState(false);

  function handleEditorChange(field, value) {
    setEditorSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSavedMessage("");
  }

  function handleSave(e) {
    e.preventDefault();
    try {
      localStorage.setItem(
        "devpilot_editor_settings",
        JSON.stringify(editorSettings)
      );
      window.dispatchEvent(new Event("devpilot-settings-changed"));
      setSavedMessage("Settings saved successfully!");
      setTimeout(() => setSavedMessage(""), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  }

  function handleReset() {
    if (window.confirm("Reset editor preferences to defaults?")) {
      setEditorSettings(DEFAULT_SETTINGS);
      localStorage.setItem(
        "devpilot_editor_settings",
        JSON.stringify(DEFAULT_SETTINGS)
      );
      window.dispatchEvent(new Event("devpilot-settings-changed"));
      setSavedMessage("Settings reset to defaults.");
      setTimeout(() => setSavedMessage(""), 3000);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestStatus(null);
    const start = performance.now();

    try {
      const healthRes = await fetch(`${apiUrl}/api/health`);
      const healthData = await healthRes.json();

      let dbData = null;
      try {
        const dbRes = await fetch(`${apiUrl}/api/db-health`);
        dbData = await dbRes.json();
      } catch {
        // DB call may fail independently
      }

      const elapsed = Math.round(performance.now() - start);

      if (healthRes.ok && healthData.success) {
        setTestStatus({
          ok: true,
          latency: elapsed,
          backendMessage: healthData.message,
          databaseConnected: dbData?.success ?? false,
          databaseName: dbData?.database || "Unknown",
          databaseTime: dbData?.time || null,
        });
      } else {
        setTestStatus({
          ok: false,
          error: healthData.message || "Backend reported an error.",
        });
      }
    } catch (err) {
      setTestStatus({
        ok: false,
        error: err.message || "Failed to reach backend server.",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <main className="dashboard settings-page">
      <header className="topbar">
        <h2>Settings</h2>
        <div className="profile">Developer</div>
      </header>

      <section className="welcome">
        <div>
          <h1>Workspace Settings</h1>
          <p>
            Configure your code editor preferences, check backend health, and view system capabilities.
          </p>
        </div>
      </section>

      {savedMessage && (
        <div className="settings-alert success" role="status">
          {savedMessage}
        </div>
      )}

      <div className="settings-grid">
        {/* Editor Preferences */}
        <section className="settings-card">
          <div className="settings-card-header">
            <h3>Code Editor Preferences</h3>
            <p>Customize the Monaco code editor experience</p>
          </div>

          <form onSubmit={handleSave} className="settings-form">
            <div className="form-group">
              <label htmlFor="editor-theme">Editor Theme</label>
              <select
                id="editor-theme"
                value={editorSettings.theme}
                onChange={(e) => handleEditorChange("theme", e.target.value)}
              >
                <option value="vs-dark">Dark (vs-dark)</option>
                <option value="vs-light">Light (vs-light)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="editor-font-size">
                Font Size ({editorSettings.fontSize}px)
              </label>
              <input
                id="editor-font-size"
                type="number"
                min="10"
                max="24"
                value={editorSettings.fontSize}
                onChange={(e) =>
                  handleEditorChange("fontSize", Number(e.target.value) || 13)
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="editor-word-wrap">Word Wrap</label>
              <select
                id="editor-word-wrap"
                value={editorSettings.wordWrap}
                onChange={(e) =>
                  handleEditorChange("wordWrap", e.target.value)
                }
              >
                <option value="off">Off</option>
                <option value="on">On</option>
                <option value="wordWrapColumn">Wrap at Column</option>
              </select>
            </div>

            <div className="form-group checkbox-group">
              <label htmlFor="editor-minimap">
                <input
                  id="editor-minimap"
                  type="checkbox"
                  checked={editorSettings.minimap}
                  onChange={(e) =>
                    handleEditorChange("minimap", e.target.checked)
                  }
                />
                Show Code Minimap
              </label>
            </div>

            <div className="form-actions">
              <button type="submit" className="primary-button">
                Save Preferences
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleReset}
              >
                Reset Defaults
              </button>
            </div>
          </form>
        </section>

        {/* Backend Connectivity */}
        <section className="settings-card">
          <div className="settings-card-header">
            <h3>Backend Connectivity</h3>
            <p>Verify server health and PostgreSQL database status</p>
          </div>

          <div className="settings-connection-info">
            <div className="info-row">
              <span>API URL:</span>
              <code>{apiUrl}</code>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>

            {testStatus && (
              <div
                className={`connection-result ${
                  testStatus.ok ? "success" : "failure"
                }`}
              >
                {testStatus.ok ? (
                  <>
                    <p>
                      <strong>Server:</strong> Online ({testStatus.latency}ms)
                    </p>
                    <p>
                      <strong>Database:</strong>{" "}
                      {testStatus.databaseConnected
                        ? `Connected (${testStatus.databaseName})`
                        : "Disconnected"}
                    </p>
                    {testStatus.databaseTime && (
                      <p>
                        <strong>DB Time:</strong>{" "}
                        {new Date(testStatus.databaseTime).toLocaleString()}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="error-text">
                    <strong>Error:</strong> {testStatus.error}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* System Capabilities & Limits */}
        <section className="settings-card full-width">
          <div className="settings-card-header">
            <h3>Engine Limits & Security Capabilities</h3>
            <p>Read-only static analysis and upload thresholds</p>
          </div>

          <div className="limits-grid">
            <div className="limit-item">
              <span className="limit-label">ZIP Upload Limit</span>
              <strong className="limit-value">50 MB</strong>
            </div>
            <div className="limit-item">
              <span className="limit-label">Extraction Limit</span>
              <strong className="limit-value">100 MB / 2,000 files</strong>
            </div>
            <div className="limit-item">
              <span className="limit-label">Max File Analysis Size</span>
              <strong className="limit-value">1 MB per file</strong>
            </div>
            <div className="limit-item">
              <span className="limit-label">Total Analysis Cap</span>
              <strong className="limit-value">10 MB / 300 files</strong>
            </div>
            <div className="limit-item">
              <span className="limit-label">Supported Languages</span>
              <strong className="limit-value">
                JavaScript, JSX, Python, JSON, Java
              </strong>
            </div>
            <div className="limit-item">
              <span className="limit-label">Server Credentials (.env)</span>
              <strong className="limit-value protected">
                Protected (Read-only)
              </strong>
            </div>
          </div>
          <p className="settings-disclaimer">
            Server environment variables and database credentials are managed on the host filesystem and cannot be viewed or edited from the browser.
          </p>
        </section>
      </div>
    </main>
  );
}

export default Settings;
