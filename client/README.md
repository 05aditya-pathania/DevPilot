# DevPilot 🚀

**A developer platform for project management, code analysis, and debugging — currently under development.**

DevPilot aims to provide developers with a unified workspace to upload projects, explore source code, edit files, and identify potential code issues.

The current prototype supports project management, ZIP uploads, safe file extraction, project file browsing, source-code editing, persistent file saving, and heuristic static code analysis through a dedicated dashboard.

> **Project Status:** Active Development / Prototype
> DevPilot is not production-ready. Advanced AI debugging, automated fixes, authentication, and mobile applications remain planned features.

---

## ✨ Implemented Features

### 1. Project Management

- Create projects through the web interface.
- Retrieve and display projects using the backend API.
- Store project records in PostgreSQL.
- Open individual projects to access their files and analysis tools.

### 2. ZIP Upload and Extraction

- Upload ZIP archives to a project.
- Validate uploaded file types.
- Enforce upload-size limits.
- Extract project files into project-specific directories.
- Apply archive-entry and extracted-data limits.
- Validate file paths to help prevent unsafe archive extraction.
- Handle invalid uploads and extraction errors.

### 3. Project File Explorer

- Browse files and folders inside an uploaded project.
- Navigate through project directories.
- Select and open source files.
- View file contents in the browser-based workspace.
- Display file information and selected-file details.
- Navigate back to the project list.

### 4. Code Editor

- Edit project files using Monaco Editor.
- Save changes through the backend API.
- Use `Ctrl + S` / `Cmd + S` to trigger saving where supported by the editor.
- Display save status and errors.
- Preserve saved changes after refreshing the browser.

### 5. Static Code Analysis Engine

DevPilot includes an initial heuristic static-analysis engine for supported JavaScript-family files.

**Current capabilities:**

- Trigger project analysis through the frontend.
- Analyze supported source files without executing the uploaded code.
- Identify selected patterns that may indicate code-quality issues.
- Display analysis results in the frontend dashboard.
- Show the total number of files scanned.
- Display total findings, warnings, errors, informational findings, and skipped files.
- Identify findings by rule name and severity.
- Display the affected file, line, column, message, and source-code excerpt.
- Show analysis errors and applicable scanning-limit information.
- Display a disclaimer explaining the limitations of heuristic analysis.

**Current limitations:**

- Analysis is based on heuristic checks rather than a complete language parser.
- Only selected patterns are checked; many possible issues will not be detected.
- Findings may include false positives.
- The analyzer is not a complete security audit.
- AI-powered explanations and automated code fixes are not implemented.
- Persistent analysis history and reports are not yet implemented.

### 6. Code Analysis Dashboard

The frontend provides a dedicated interface for displaying analysis results.

- Analyze the currently selected project.
- View analysis status and summary statistics.
- Review detected findings.
- Inspect finding severity, rule name, location, message, and code excerpt.
- Access the existing File Explorer below the analysis results.
- Navigate back to the project list.

### 7. Backend and Database

- Node.js and Express backend.
- PostgreSQL database integration.
- Project creation and retrieval endpoints.
- Project-specific ZIP upload endpoint.
- Project file-listing endpoint.
- File-content retrieval endpoint.
- File-save endpoint with project-path validation.
- Backend health-check endpoints.
- Project analysis endpoint.

### 8. Frontend

- React-based user interface.
- Vite development and production build tooling.
- Project dashboard.
- Project management interface.
- File Explorer and Monaco code editor.
- Code Analysis Dashboard.
- Frontend-to-backend API integration.
- Backend connection-status indicator.
- Production build verified locally.

---

## 🛠️ Tech Stack

### Frontend

- React
- Vite
- JavaScript
- CSS
- Monaco Editor

### Backend

- Node.js
- Express
- JavaScript
- Multer
- Yauzl

### Database

- PostgreSQL

### Development Tools

- Git
- GitHub
- npm
- PowerShell

---

## 🏗️ Project Structure

```text
DevPilot/
├── backend/
│   ├── project-files/
│   ├── server.js
│   ├── db.js
│   └── package.json
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard.jsx
│   │   │   ├── projects.jsx
│   │   │   ├── sidebar.jsx
│   │   │   ├── FileExplorer.jsx
│   │   │   └── codeEditor.jsx
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── package.json
│   └── README.md
│
├── .gitignore
└── README.md
