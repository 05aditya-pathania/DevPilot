# DevPilot 🚀

**An AI-powered code analysis and debugging platform — currently under development.**

DevPilot aims to help developers inspect projects, understand code issues, and review potential fixes from one workspace.

The current prototype supports project management, ZIP uploads, project file browsing, and editing and saving source files through a browser-based code editor. AI-powered analysis, explanations, and suggested fixes remain part of the roadmap.

> **Project status:** Active development / prototype. This project is not production-ready.

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

### Backend and Database
- Node.js and Express API.
- PostgreSQL database integration.
- Project CRUD API functionality.
- Project file listing and file-content endpoints.
- File-save endpoint with project-path validation.
- Backend health-check endpoints.

### Frontend
- React + Vite application.
- Project dashboard and file explorer.
- Frontend-to-backend API integration.
- Production build verified locally.

---

## 🗺️ Planned Features

The following features are not yet implemented as complete product functionality:

- Static code analysis for supported languages.
- Detection of code issues, errors, and warnings.
- Analysis reports and history.
- AI-assisted explanations.
- AI-generated fix suggestions and code diffs.
- Review and approval workflow for suggested changes.
- User authentication and authorization.
- Automated tests and expanded security testing.
- Production deployment.
- React Native / Expo mobile applications for Android and iOS.

These features will be implemented and documented as development progresses.

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

### Planned
- Static-analysis tools for supported programming languages.
- An AI API or model for explanations and suggested fixes.
- Automated testing infrastructure.
- Production hosting and deployment services.
- React Native and Expo for mobile applications.

The technology stack may evolve as development progresses.

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