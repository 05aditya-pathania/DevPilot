DevPilot 🚀

An AI-powered code analysis and debugging platform — currently under development.

DevPilot is being built to help developers inspect their projects, understand code issues, and review potential fixes from one workspace. The planned workflow is to upload a project ZIP, inspect its file structure, analyze supported code, and receive clear explanations and suggested fixes.

Project status: Early development / prototype. The current implementation includes a React + Vite frontend with a basic dashboard and projects UI, plus a Node.js + Express backend with a health-check endpoint. ZIP processing, persistent storage, code analysis, AI features, authentication, and deployment are planned—not implemented yet.

✨ Planned Features

Project management — create and view projects from a dashboard.

ZIP upload — upload a project archive with file validation.

Project file explorer — browse folders and files from an uploaded project.

Code analysis — identify supported errors and warnings without automatically running uploaded code.

Analysis reports — review findings by file and keep a history of analyses.

AI-assisted explanations — understand detected issues in plain language.

Suggested fixes — review proposed code changes and diffs before applying them.

Secure workflow — validate uploads, limit archive size, and protect against unsafe archive paths.

Features above are part of the roadmap and may not be available in the current prototype.

🧰 Tech Stack

Currently used

React

Vite

CSS

Node.js

Express

CORS

dotenv

Planned

PostgreSQL for persistent project and analysis data.

JavaScript/TypeScript static-analysis tools.

An AI API for explanations and suggested fixes.

Hosting for the frontend, backend, and database.

The planned stack may change as development progresses.

📁 Project Structure

DevPilot/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/     # Dashboard, sidebar, projects UI
│   │   ├── App.jsx
│   │   └── App.css
│   └── package.json
│
└── backend/                # Node.js + Express API
    ├── server.js
    └── package.json

This is the intended structure based on the current project setup. Your local files may differ as development continues.

⚙️ Getting Started

Prerequisites

Node.js and npm installed

Git (optional, for version control)

1. Clone the repository

git clone <your-repository-url>
cd DevPilot

Replace <your-repository-url> with the URL of your GitHub repository.

2. Start the backend

Open a terminal in the project root:

cd backend
npm install
node server.js

The backend is expected to run at:

http://localhost:5000

Available endpoints in the current prototype:

Method

Endpoint

Purpose

GET

/

Basic API welcome response

GET

/api/health

Backend health check

Example health-check response:

{
  "success": true,
  "message": "DevPilot backend is running",
  "status": "healthy"
}

3. Start the frontend

Open a second terminal:

cd client
npm install
npm run dev

Vite usually serves the development frontend at:

http://localhost:5173

Keep both terminals running while developing locally.

🔌 Frontend–Backend Connection

The current frontend checks the backend health endpoint at:

http://localhost:5000/api/health

The backend's CORS configuration currently allows the local Vite origin:

http://localhost:5173

If your local ports differ, update the configuration accordingly. Production URLs and environment-based configuration still need to be implemented.

🗺️ Roadmap

Set up the React + Vite frontend

Build the initial dashboard, sidebar, and projects UI

Set up the Express backend

Add root and health-check endpoints

Stabilize and verify the responsive frontend layout

Build project CRUD API endpoints

Add PostgreSQL persistence

Implement secure ZIP upload and extraction

Display an uploaded project's file tree

Add JavaScript/TypeScript code analysis

Build analysis reports and history

Add AI explanations and suggested fixes

Add authentication and additional security controls

Test and deploy the application

🔐 Security Notes

DevPilot is intended to inspect uploaded source code, not execute it automatically. Before accepting real user uploads, the backend must implement file-size limits, archive validation, safe extraction, path-traversal protection, appropriate storage controls, and robust error handling.

Never commit API keys, passwords, database credentials, or other secrets. Use environment variables for local configuration, and configure production secrets through the hosting provider.

🤝 Contributing

Contributions, suggestions, and issue reports are welcome. Since this project is in an early stage, please open an issue to discuss larger changes before submitting a pull request.

📄 License

No license has been selected yet. Until a license is added, the repository should not be assumed to grant permission to reuse, modify, or distribute the code.
