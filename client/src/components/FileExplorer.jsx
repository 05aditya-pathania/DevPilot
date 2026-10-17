import { useEffect, useState } from "react";
import CodeEditor from "./CodeEditor.jsx";

const API_URL = "http://localhost:5000/api";

function FileExplorer({ project, onBack }) {
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");

  const [loading, setLoading] = useState(true);
  const [fileLoading, setFileLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");

  async function loadFiles(folderPath = "") {
    setLoading(true);
    setError("");
    setSelectedFile(null);
    setFileContent("");
    setFileError("");
    setFileLoading(false);

    try {
      const query = folderPath
        ? `?path=${encodeURIComponent(folderPath)}`
        : "";

      const response = await fetch(
        `${API_URL}/projects/${project.id}/files${query}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to load project files"
        );
      }

      setFiles(data.files);
      setCurrentPath(folderPath);
    } catch (err) {
      setFiles([]);
      setError(err.message || "Could not load project files");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiles();
  }, [project.id]);

  async function handleFileClick(file) {
    if (file.type === "directory") {
      await loadFiles(file.path);
      return;
    }

    setSelectedFile(file);
    setFileContent("");
    setFileError("");
    setFileLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/projects/${project.id}/file?path=${encodeURIComponent(
          file.path
        )}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to open file"
        );
      }

      setFileContent(data.content ?? "");
    } catch (err) {
      setFileError(
        err.message || "Could not open this file"
      );
    } finally {
      setFileLoading(false);
    }
  }

  async function handleUpload(event) {
    const input = event.target;
    const file = input.files?.[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Please select a ZIP file.");
      input.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/projects/${project.id}/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "ZIP upload failed"
        );
      }

      await loadFiles("");
    } catch (err) {
      setError(
        err.message || "Could not upload ZIP"
      );
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  function goToParent() {
    if (!currentPath) return;

    const parts = currentPath.split("/");
    parts.pop();

    loadFiles(parts.join("/"));
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <h2>File Explorer</h2>
          <p>{project.name}</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={onBack}
        >
          ← Back to Projects
        </button>
      </header>

      <section className="file-explorer">
        <div className="file-explorer-toolbar">
          <div className="file-breadcrumb">
            <button
              type="button"
              className="file-breadcrumb-button"
              onClick={() => loadFiles("")}
              disabled={loading}
            >
              📁 Root
            </button>

            {currentPath && <span>/ {currentPath}</span>}
          </div>

          <div className="file-explorer-actions">
            {currentPath && (
              <button
                type="button"
                className="secondary-button"
                onClick={goToParent}
                disabled={loading}
              >
                ↑ Parent Folder
              </button>
            )}

            <label
              className={`primary-button upload-label ${
                uploading ? "disabled" : ""
              }`}
            >
              {uploading ? "Uploading..." : "↑ Upload ZIP"}

              <input
                type="file"
                accept=".zip,application/zip"
                onChange={handleUpload}
                disabled={uploading}
                hidden
              />
            </label>
          </div>
        </div>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        <div className="file-explorer-layout">
          <section className="file-list-panel">
            <h3>Project Files</h3>

            {loading ? (
              <p className="file-empty-state">
                Loading files...
              </p>
            ) : files.length === 0 ? (
              <p className="file-empty-state">
                No files found. Upload a ZIP to get started.
              </p>
            ) : (
              <div className="file-list">
                {files.map((file) => (
                  <button
                    type="button"
                    key={file.path}
                    className={`file-item ${
                      selectedFile?.path === file.path
                        ? "selected"
                        : ""
                    }`}
                    onClick={() => handleFileClick(file)}
                    disabled={loading}
                  >
                    <span className="file-item-icon">
                      {file.type === "directory" ? "📁" : "📄"}
                    </span>

                    <span className="file-item-name">
                      {file.name}
                    </span>

                    {file.type === "file" && (
                      <span className="file-item-size">
                        {file.size < 1024
                          ? `${file.size} B`
                          : `${(file.size / 1024).toFixed(1)} KB`}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="code-panel">
            {fileError ? (
              <>
                <header className="code-panel-header">
                  <h3>{selectedFile?.name || "Code Editor"}</h3>
                </header>

                <p className="file-empty-state" role="alert">
                  {fileError}
                </p>
              </>
            ) : fileLoading ? (
              <>
                <header className="code-panel-header">
                  <h3>{selectedFile?.name || "Code Editor"}</h3>
                </header>

                <p className="file-empty-state">
                  Loading file content...
                </p>
              </>
            ) : selectedFile ? (
              <CodeEditor
                key={selectedFile.path}
                file={selectedFile}
                content={fileContent}
                onChange={setFileContent}
              />
            ) : (
              <>
                <header className="code-panel-header">
                  <h3>Code Editor</h3>
                </header>

                <div className="file-empty-state">
                  Select a file to open it in the code editor.
                </div>
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

export default FileExplorer;