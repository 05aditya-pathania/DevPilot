import { useMemo } from "react";
import Editor from "@monaco-editor/react";

function CodeEditor({ file, content, onChange, saving = false }) {
  const language = useMemo(() => {
    const extension = file?.name?.split(".").pop()?.toLowerCase();

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
      scss: "scss",
      json: "json",
      java: "java",
      c: "c",
      h: "c",
      cpp: "cpp",
      hpp: "cpp",
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
      txt: "plaintext",
    };

    return languages[extension] || "plaintext";
  }, [file?.name]);

  if (!file) {
    return (
      <div className="editor-empty">
        <div className="editor-empty-icon">&lt;/&gt;</div>
        <h3>No file selected</h3>
        <p>Select a project file to start editing.</p>
      </div>
    );
  }

  return (
    <section className="code-editor">
      <header className="code-editor-toolbar">
        <div className="code-editor-file">
          <span className="code-editor-file-icon">&lt;/&gt;</span>

          <div>
            <h3>{file.name}</h3>
            <p>{file.path}</p>
          </div>
        </div>

        <div className="code-editor-actions">
          <span className="editor-language">{language}</span>

          {saving && (
            <span className="editor-saving">Saving...</span>
          )}
        </div>
      </header>

      <div className="code-editor-body">
        <Editor
          height="480px"
          language={language}
          theme="vs-dark"
          value={content ?? ""}
          onChange={(value) => onChange?.(value ?? "")}
          loading="Loading Monaco Editor..."
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: 22,
            fontFamily: "Consolas, 'Courier New', monospace",
            wordWrap: "on",
            scrollBeyondLastLine: false,
            renderLineHighlight: "all",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            lineNumbers: "on",
            folding: true,
            readOnly: false,
            tabSize: 2,
            padding: {
              top: 16,
              bottom: 16,
            },
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </div>
    </section>
  );
}

export default CodeEditor;