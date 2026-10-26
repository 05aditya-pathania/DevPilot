# Sub-Report: Analysis History Feature Audit

**Audited Component:** Analysis History (`history`)  
**Project:** DevPilot  
**Status:** **NOT IMPLEMENTED (PLACEHOLDER PRESENT)**  
**Date:** 2026-10-26  

---

## 1. Intended Purpose vs. Actual Reality

### Intended Purpose (per Code, UI, and Documentation)
- **Documented Roadmap**:
  - `README.md` (line 83) under Planned Features:
    > `- Analysis history and report persistence.`
  - `client/README.md` (line 74):
    > `- Persistent analysis history and reports are not yet implemented.`
- **UI Surface**:
  - `client/src/components/sidebar.jsx` (line 6): Nav item `{ label: "History", value: "history" }`.
  - `client/src/components/dashboard.jsx` (lines 9-12): Stat card "Analyses" displaying `"—"` (formerly hardcoded `0`) with description `"Analysis history coming soon"`.
- **Actual Engine Behavior**:
  - When a user triggers project analysis (`POST /api/projects/:id/analyze`), `server.js` invokes `analyzeProjectFiles(project.root)`.
  - It generates summary stats (`filesScanned`, `filesSkipped`, `findings`, `errors`, `warnings`, `info`), scanned files, and findings list.
  - The results are returned directly in the HTTP JSON response and stored in React state (`analysis` in `App.jsx`).
  - **Crucial Finding**: The backend **does not write analysis records to PostgreSQL or disk**. Once the page is refreshed or another project is opened, previous analysis data is lost.

---

## 2. Full Flow Trace: Button Handler to Rendering

| Layer | Flow Element | Actual Current Behavior |
|---|---|---|
| **UI Button / Control** | Sidebar item `History` | Calls `setActivePage("history")` |
| **Route / Panel Handler** | `client/src/App.jsx` | Matches condition `activePage !== "dashboard" && activePage !== "projects"` |
| **Rendering** | Fallback Banner | Renders `<div className="coming-soon"><h2>Coming Soon</h2><p>This feature is not yet available.</p></div>` |
| **API Call** | Network Request | **None** (`fetch` is never invoked) |
| **Backend Route** | `backend/server.js` | **None** (requests to `/api/history` or `/api/projects/:id/history` return HTTP 404 HTML) |
| **Backend Logic** | History Query | **None** |
| **Database / Storage** | PostgreSQL | **None** (PostgreSQL only has `projects` table; no `analyses` or `scan_history` table exists) |
| **State Persistence** | Storage / Cache | **None** |

---

## 3. Checklist Evaluation

| Criteria | Status | Evidence / Verification |
|---|---|---|
| Opens correctly and lists real records | ❌ **NOT IMPLEMENTED** | Opens generic "Coming Soon" placeholder |
| Never displays hardcoded or mock entries | ✅ **VERIFIED** | No fake or mock data exists; correctly shows placeholder |
| Shows accurate project, timestamp, status, summary | ❌ **NOT IMPLEMENTED** | No list or detail view implemented |
| No cross-project data leakage | ❌ **NOT IMPLEMENTED** | No data storage exists to isolate |
| Survives page reload where intended | ❌ **NOT IMPLEMENTED** | Current analysis state in `App.jsx` is lost on browser refresh |
| Sorting / filter / search / pagination | ❌ **NOT IMPLEMENTED** | Controls do not exist |
| Loading, empty, and error states | ⚠️ **PARTIAL** | Shows static placeholder banner; no dynamic state handling |
| Delete / clear actions with confirmation | ❌ **NOT IMPLEMENTED** | Controls do not exist |

---

## 4. Root Cause

Historical tracking was part of the original project vision (`README.md`), but was designated as a future feature. The backend endpoint `POST /api/projects/:id/analyze` was written as a pure stateless query that scans files on demand and returns the JSON payload without persisting audit history to the database.

---

## 5. Smallest Compatible Implementation Proposal

To provide a fully functional, verifiable History module while respecting the minimal-change and zero-unapproved-schema rules:

### Architecture Options:

#### Option 1: Browser Storage Persistence (Recommended — Zero DB Schema Changes)
1. **Recording Trigger (`client/src/App.jsx`)**:
   - In `handleAnalyzeProject()`, on successful analysis response:
     - Record `{ id: crypto.randomUUID(), projectId: selectedProject.id, projectName: selectedProject.name, timestamp: new Date().toISOString(), summary: data.summary, findingsCount: data.findings.length, errors: data.summary.errors, warnings: data.summary.warnings, info: data.summary.info, status: "completed" }`.
     - Append to `localStorage` under `devpilot_analysis_history` (capped at last 50 runs to prevent unbounded growth).
2. **Component (`client/src/components/History.jsx`)**:
   - Lists historical scan runs sorted chronologically (newest first).
   - Filter dropdown by project name; search bar by project or status.
   - Shows project name, timestamp, duration/status badge, file scan count, and breakdown of findings (Errors, Warnings, Info).
   - "Inspect Details" button opens modal/view showing specific summary statistics and file scan limits.
   - "Clear History" button with explicit confirmation modal (clears only history, leaves projects intact).
   - Proper empty state ("No analysis runs recorded yet. Analyze a project to view history.").

#### Option 2: Database Table Persistence (Requires Explicit User Schema Approval)
1. Execute migration:
   ```sql
   CREATE TABLE analysis_runs (
     id SERIAL PRIMARY KEY,
     project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
     files_scanned INTEGER NOT NULL,
     files_skipped INTEGER NOT NULL,
     findings_count INTEGER NOT NULL,
     errors_count INTEGER NOT NULL,
     warnings_count INTEGER NOT NULL,
     info_count INTEGER NOT NULL,
     summary JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```
2. Update `server.js` `POST /api/projects/:id/analyze` to insert a row on completion.
3. Add `GET /api/history` and `DELETE /api/history/:id` endpoints in `server.js`.
