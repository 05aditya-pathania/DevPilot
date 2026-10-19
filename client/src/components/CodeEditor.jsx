
import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";

function CodeEditor({
  file,
  content,
  onChange,
  onSave,
  saving = false,
  saveMessage = "",
  saveError = "",
  dirty = false,
}) {
  const [editorReady, setEditorReady] = useState(false);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  const getLanguage = useCallback((filename = "") => {
    const extension = filename.split(".").pop()?.toLowerCase();

    const languages = {
      js: "javascript",
      jsx: "javascript",
      mjs: "javascript",
      cjs: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      html: "html",
      css: "css",
      json: "json",
      java: "java",
      c: "c",
      cpp: "cpp",
      cs: "csharp",
      php: "php",
      go: "go",
      rs: "rust",
      sql: "sql",
      xml: "xml",
      md: "markdown",
      sh: "shell",
      yml: "yaml",
      yaml: "yaml",
    };

    return languages[extension] || "plaintext";
  }, []);

  function handleEditorMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorReady(true);

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        handleSaveClick();
      }
    );
  }

  useEffect(() => {
    return () => {
      editorRef.current = null;
      monacoRef.current = null;
    };
  }, []);

  function handleSaveClick() {
    if (typeof onSave !== "function"){
      console.error("[DevPilot] onSave callback is unavailable");
      return;
    }

    if (saving || !dirty){
      return;
    }

    onSave();
  }


  if (!file) {
    return (
      <div className="editor-empty">
        <div className="editor-empty-icon">{"</>"}</div>
        <h3>No file selected</h3>
        <p>Select a project file to start editing.</p>
      </div>
    );
  }

  return (
    <section className="code-editor">
      <header className="code-editor-toolbar">
        <div className="code-editor-file">
          <span className="code-editor-file-icon">{"</>"}</span>

          <div>
            <h3>{file.name}</h3>
            <p>{file.path}</p>
          </div>
        </div>

        <div className="code-editor-actions">
          <span className="editor-language">
            {getLanguage(file.name).toUpperCase()}
          </span>

          {dirty && !saving && (
            <span className="editor-saving">Unsaved changes</span>
          )}

          {saving && (
            <span className="editor-saving">Saving...</span>
          )}

          <button
            type="button"
            className="primary-button"
            onClick={handleSaveClick}
            disabled={saving}
            title="Save file (Ctrl+S)"
          >
            {saving ? "Saving..." : "Save File"}
          </button>
        </div>
      </header>

      {saveMessage && (
        <p className="save-success" role="status">
          {saveMessage}
        </p>
      )}

      {saveError && (
        <p className="error-message" role="alert">
          {saveError}
        </p>
      )}

      <div className="code-editor-body">
        <Editor
          height="480px"
          language={getLanguage(file.name)}
          theme="vs-dark"
          value={content}
          onChange={(value) => onChange?.(value ?? "")}
          onMount={handleEditorMount}
          loading="Loading editor..."
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineHeight: 22,
            fontFamily: "Consolas, 'Courier New', monospace",
            wordWrap: "off",
            scrollBeyondLastLine: false,
            renderLineHighlight: "all",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            padding: { top: 16, bottom: 16 },
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </div>

      <div className="editor-debug-status">
        {!editorReady
          ? "Initializing editor..."
          : dirty
            ? "Unsaved changes"
            : "All changes saved"}
      </div>
    </section>
  );
}

export default CodeEditor;
