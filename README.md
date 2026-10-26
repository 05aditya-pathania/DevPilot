# DevPilot 🚀

**A developer-focused project analysis and debugging platform — currently under development.**

DevPilot helps developers upload projects, browse and edit source files, and inspect potential code issues through a browser-based workspace.

> **Project status:** Active development / prototype. Not production-ready.

---

## ✨ Implemented Features

### Project Management
- Create projects through the frontend.
- Retrieve and display projects using the backend API.
- Store project records in PostgreSQL.

### ZIP Upload and Extraction
- Upload ZIP archives to a project.
- Validate uploaded file types and enforce upload limits.
- Extract project files into project-specific directories.
- Apply archive-entry limits and extraction safety checks.

### Project File Explorer
- Browse files and folders inside an uploaded project.
- Navigate between directories.
- View file contents in the browser.
- Display file sizes and selected-file information.

### Code Editor
- Edit project files using Monaco Editor.
- Save changes through the backend API.
- Use `Ctrl + S` / `Cmd + S` to trigger saving.
- Display save status and errors.
- Preserve saved file changes after refreshing the browser.

### Static Code Analysis

The current analysis implementation supports:

- **JavaScript:** heuristic checks and ESLint integration.
- **Python:** syntax validation using Python's AST parser.
- **JSON:** parsing and syntax-error reporting.
- **Java:** standalone Java analysis for files outside detected Maven projects.
- **Maven projects:** optional compilation with Java compiler diagnostics, including source location and error message.

Analysis responses include scanned-file information, findings, severity counts, skipped-file statistics, and analysis errors.

Manual tests have verified selected Java, JavaScript, Python, and JSON error-detection scenarios. These checks do not constitute comprehensive automated test coverage.

**Limitations:**
- Static analysis is heuristic and may produce false positives or miss issues.
- Only configured file extensions are analyzed.
- File-size, file-count, and total-size limits apply.
- Maven compilation is disabled unless explicitly enabled for trusted projects. Maven plugins can execute code, so enabling compilation for untrusted uploads is unsafe.
- Analysis is not a complete security audit.

### Debugging & Workflow Tools
- **Static Code Debugging Sessions:** Interactive triage interface to inspect findings by severity, view source code in Monaco editor, edit files, and re-scan to verify fixes.
- **Analysis Scan History:** Chronological history of completed project analyses with project filtering, search, and summary metric tracking.
- **Workspace Settings:** Configurable Monaco code editor preferences (theme, font size, word wrap, minimap), live backend connectivity testing, and engine limits inspection.

### Backend and Database
- Node.js and Express API.
- PostgreSQL database integration.
- Project CRUD API functionality.
- Project file listing and file-content endpoints.
- File-save endpoint with project-path validation.
- Backend health-check endpoints.
- Project analysis endpoint.

### Frontend
- React + Vite application.
- **Premium Dark Navy & Electric Cyan Theme:** `#07111D` deep navy canvas, `#101F30` / `#14263A` elevated cards, `#233B52` borders, `#22D3EE` electric cyan and `#168BFF` blue accents.
- **Abstract CSS Ambient Lighting & Grid Mesh:** Pure CSS background textures and moving ambient light (zero external image dependencies, zero mountain photos).
- **Self-Hosted Typography:** Local Inter (UI text) and JetBrains Mono (code, file paths, diagnostics).
- **Execution Feedback & Progress Panels:** Visual feedback during static code analysis with stage indicators, spinner, and duplicate submission locks.
- **Responsive Workspace Navigation:** Sidebar with SVG icons, live engine status chip, and responsive collapsible layout for desktop, laptop, tablet, and mobile.
- Analysis loading state, summary cards, findings list, and analysis-error display.
- Frontend-to-backend API integration.
- Production build verified locally using `npm run build`.

---

## 🗺️ Planned Features

The following are not yet implemented as complete product functionality:

- AI-assisted explanations of code issues.
- AI-generated fix suggestions and code diffs.
- Review and approval workflow for suggested changes.
- Interactive runtime debugging (GDB/V8 process attachments).
- User authentication and authorization.
- Comprehensive automated tests and expanded security testing.
- Production deployment.
- React Native / Expo mobile applications for Android and iOS.

---

## 🧰 Tech Stack

### Currently Used
- React
- Vite
- JavaScript
- CSS
- Monaco Editor
- Node.js
- Express
- PostgreSQL
- `pg`
- CORS
- dotenv
- Multer
- yauzl
- ESLint
- Python AST parsing
- Maven wrapper for optional Java project compilation

### Planned
- AI API or model for explanations and suggested fixes.
- Automated testing infrastructure.
- Production hosting and deployment services.
- React Native and Expo for mobile applications.

---

## 📁 Project Structure

```text
DevPilot/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FileExplorer.jsx
│   │   │   └── codeEditor.jsx
│   │   ├── App.jsx
│   │   └── App.css
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── server.js
│   ├── db.js
│   ├── package.json
│   ├── uploads/
│   └── project-files/
│
├── .gitignore
└── README.md
