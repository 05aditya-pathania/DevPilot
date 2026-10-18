
import { useCallback, useEffect, useState } from "react";
import CodeEditor from "./codeEditor.jsx";

const API_URL = "http://localhost:5000/api";

function FileExplorer({ project, onBack }) {
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [fileLoading, setFileLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const loadFiles = useCallback(async (folderPath = "") => {
    setLoading(true);
    setError("");

    try {
      const query = folderPath
        ? `?path=${encodeURIComponent(folderPath)}`
        : "";

      const response = await fetch(
        `${API_URL}/projects/${project.id}/files${query}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load project files");
      }

      setFiles(data.files || []);
      setCurrentPath(folderPath);
    } catch (err) {
      console.error("[DevPilot] Load files failed:", err);
      setError(err.message || "Could not load project files");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    setSelectedFile(null);
    setFileContent("");
    setDirty(false);
    setFileError("");
    setSaveMessage("");
    setSaveError("");
    loadFiles("");
  }, [project.id, loadFiles]);

  async function handleFileClick(file) {
    if (saving || fileLoading) return;

    if (dirty && !window.confirm("Discard unsaved changes?")) {
      return;
    }

    if (file.type === "directory") {
      setSelectedFile(null);
      setFileContent("");
      setDirty(false);
      setFileError("");
      setSaveMessage("");
      setSaveError("");
      await loadFiles(file.path);
      return;
    }

    setSelectedFile(file);
    setFileContent("");
    setFileLoading(true);
    setDirty(false);
    setFileError("");
    setSaveMessage("");
    setSaveError("");

    try {
      const url =
        `${API_URL}/projects/${project.id}/file?path=` +
        encodeURIComponent(file.path);

      console.log("[DevPilot] Opening file:", url);

      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to open file");
      }

      setFileContent(data.content ?? "");
      console.log("[DevPilot] File opened:", file.path);
    } catch (err) {
      console.error("[DevPilot] Open file failed:", err);
      setFileError(err.message || "Could not open this file");
    } finally {
      setFileLoading(false);
    }
  }

  async function handleSave() {
    console.log("[DevPilot] Save handler entered", {
      projectId: project.id,
      filePath: selectedFile?.path,
      saving,
      dirty,
    });

    if (!selectedFile) {
      setSaveError("Select a file before saving.");
      return;
    }

    if (saving) return;

    if (!dirty) {
      setSaveMessage("No unsaved changes.");
      return;
    }

    setSaving(true);
    setSaveMessage("");
    setSaveError("");

    const url =
      `${API_URL}/projects/${project.id}/file?path=` +
      encodeURIComponent(selectedFile.path);

    try {
      console.log("[DevPilot] Sending POST:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: fileContent,
        }),
      });

      const responseText = await response.text();
      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Invalid server response (HTTP ${response.status})`
        );
      }

      console.log("[DevPilot] Save response:", {
        status: response.status,
        data,
      });

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || `Save failed (HTTP ${response.status})`
        );
      }

      setDirty(false);
      setSaveMessage("File saved successfully!");
      console.log("[DevPilot] Save successful:", selectedFile.path);

      // Refresh file list to update file sizes.
      await loadFiles(currentPath);
    } catch (err) {
      console.error("[DevPilot] Save failed:", err);
      setSaveError(err.message || "Could not save file");
    } finally {
      setSaving(false);
    }
  }

  function handleEditorChange(value) {
    setFileContent(value);
    setDirty(true);
    setSaveMessage("");
    setSaveError("");
  }

  function handleSaveClick() {
    console.log("[DevPilot] Save File button clicked");
    void handleSave();
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

    if (saving || uploading) {
      input.value = "";
      return;
    }

    if (dirty && !window.confirm("Discard unsaved changes before uploading?")) {
      input.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setError("");
    setSaveMessage("");
    setSaveError("");

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
        throw new Error(data.message || "ZIP upload failed");
      }

      setSelectedFile(null);
      setFileContent("");
      setDirty(false);
      setFileError("");

      await loadFiles("");
    } catch (err) {
      console.error("[DevPilot] ZIP upload failed:", err);
      setError(err.message || "Could not upload ZIP");
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  function navigateToFolder(folderPath) {
    if (saving || fileLoading) return;

    if (dirty && !window.confirm("Discard unsaved changes?")) {
      return;
    }

    setSelectedFile(null);
    setFileContent("");
    setDirty(false);
    setFileError("");
    setSaveMessage("");
    setSaveError("");

    void loadFiles(folderPath);
  }

  function goToParent() {
    if (!currentPath) return;

    const parts = currentPath.split("/");
    parts.pop();
    navigateToFolder(parts.join("/"));
  }

  function handleBack() {
    if (saving) return;

    if (dirty && !window.confirm("Discard unsaved changes?")) {
      return;
    }

    onBack();
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
          onClick={handleBack}
          disabled={saving}
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
              onClick={() => navigateToFolder("")}
              disabled={loading || saving}
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
                disabled={loading || saving}
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
                disabled={uploading || saving}
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
              <p className="file-empty-state">Loading files...</p>
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
                      selectedFile?.path === file.path ? "selected" : ""
                    }`}
                    onClick={() => handleFileClick(file)}
                    disabled={loading || fileLoading || saving}
                  >
                    <span className="file-item-icon">
                      {file.type === "directory" ? "📁" : "📄"}
                    </span>

                    <span className="file-item-name">{file.name}</span>

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
              <p className="file-empty-state">Loading file content...</p>
            ) : selectedFile ? (
              <CodeEditor
                file={selectedFile}
                content={fileContent}
                onChange={handleEditorChange}
                onSave={handleSaveClick}
                saving={saving}
                dirty={dirty}
                saveMessage={saveMessage}
                saveError={saveError}
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
