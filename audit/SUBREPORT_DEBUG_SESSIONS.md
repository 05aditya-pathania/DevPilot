# Sub-Report: Debugging Session Feature Audit

**Audited Component:** Debugging Session (`debug-sessions`)  
**Project:** DevPilot  
**Status:** **NOT IMPLEMENTED (PLACEHOLDER PRESENT)**  
**Date:** 2026-10-26  

---

## 1. Intended Purpose vs. Actual Reality

### Intended Purpose (per Code, UI, and Documentation)
- **Codebase Reality**: DevPilot is a **static source code analysis and code editing platform** built on Express, PostgreSQL, and React. It utilizes heuristic regex checks, ESLint, Python AST parsing, and standalone `javac`/Maven compilation diagnostics.
- **What it is NOT**: DevPilot **does not possess an interactive runtime debugger** (no Node.js V8 inspector, no Python `pdb`, no GDB/JDB session attachment). Subprocesses are strictly short-lived validator runs (e.g., `python -c "import ast; ..."` with a 5-second timeout, `javac` with an 8-second timeout).
- **UI Surface**:
  1. `client/src/components/sidebar.jsx` (line 5): Nav item `{ label: "Debug Sessions", value: "debug-sessions" }`.
  2. `client/src/components/dashboard.jsx` (lines 74-85): Quick Action card with title "Debug Code", description "Prepare to investigate errors and understand code issues", and badge "Coming next".
  3. `client/src/components/codeEditor.jsx` (line 173): Footer indicator `<div className="editor-debug-status">` displaying `"All changes saved"` or `"Unsaved changes"`.
- **Documentation**:
  - `README.md` (lines 3, 79-84): Describes DevPilot as "A developer-focused project analysis and debugging platform - currently under development." Under **Planned Features**, it lists:
    - *AI-assisted explanations of code issues.*
    - *AI-generated fix suggestions and code diffs.*
    - *Review and approval workflow for suggested changes.*
  - `client/README.md` (lines 72-74): Notes that AI-powered explanations, automated fixes, and interactive workflows are not implemented.

---

## 2. Full Flow Trace: Button Handler to Rendering

| Layer | Flow Element | Actual Current Behavior |
|---|---|---|
| **UI Button / Control** | Sidebar item `Debug Sessions` | Calls `setActivePage("debug-sessions")` |
| **Dashboard Quick Action** | "Debug Code" Action Card | Static `<div>`, **no click handler** attached (`onClick` is undefined) |
| **Route / Panel Handler** | `client/src/App.jsx` | Matches condition `activePage !== "dashboard" && activePage !== "projects"` |
| **Rendering** | Fallback Banner | Renders `<div className="coming-soon"><h2>Coming Soon</h2><p>This feature is not yet available.</p></div>` |
| **API Call** | Network Request | **None** (`fetch` is never invoked) |
| **Backend Route** | `backend/server.js` | **None** (requests to `/api/debug-sessions` or `/api/projects/:id/debug` return HTTP 404 HTML) |
| **Backend Logic** | Subprocess / Analysis | **None** |
| **Database / Storage** | PostgreSQL | **None** (only the `projects` table exists in PostgreSQL; no `debug_sessions` table) |
| **State Persistence** | Session Storage / DB | **None** |

---

## 3. Checklist Evaluation

| Criteria | Status | Evidence / Verification |
|---|---|---|
| Button opens correct interface | ❌ **NOT IMPLEMENTED** | Clicking sidebar navigates to generic "Coming Soon" placeholder |
| Starting a session triggers intended action | ❌ **NOT IMPLEMENTED** | No action button exists; Dashboard "Debug Code" card is inert |
| Shows correct project findings/logs/results | ❌ **NOT IMPLEMENTED** | No session interface exists to display project findings |
| Status transitions (loading, active, completed, failed) | ❌ **NOT IMPLEMENTED** | No state machine exists for debugging sessions |
| Cancel / end session controls | ❌ **N/A** | Controls do not exist |
| Errors are visible, not swallowed | ⚠️ **PARTIAL** | Analysis errors in Project view are visible; in Debug Sessions view there are none |
| Empty & backend-down states handled | ⚠️ **PARTIAL** | Backend-down indicator works globally in header; view has no data |
| Data tied to project & survives reload | ❌ **NOT IMPLEMENTED** | No persistence layer or project association |

---

## 4. Root Cause

The "Debug Sessions" navigation item was introduced in the initial repository scaffold (`commit 7010a46`) as part of a planned roadmap item. The backend static analysis engine (`server.js`) was developed to analyze files on-the-fly (`POST /api/projects/:id/analyze`), but no dedicated session management, findings inspection, or interactive debugging panel was ever created.

---

## 5. Smallest Compatible Implementation Proposal

To align with the project's real static-analysis capabilities without inventing false runtime debugging:

### Proposed Architecture (Minimal & Compatible):
1. **Frontend Component (`client/src/components/DebugSessions.jsx`)**:
   - Allows selecting an existing project from `projects` list.
   - **Start Inspection Session**: Runs or loads the static code analysis results (`POST /api/projects/:id/analyze`).
   - **Session Status Lifecycle**: `idle` → `analyzing` (with spinner) → `active` (findings ready for triage) → `completed` (all items reviewed/saved).
   - **Findings Triage List**: Displays issues grouped by severity (Error, Warning, Info) with rule tags, line/column numbers, and code excerpts.
   - **Interactive Code Inspection**: Clicking an issue opens the file in Monaco Editor focused directly on the offending line.
   - **Session Actions**: "Re-scan / Verify Fixes" (re-analyzes project to confirm fixes), "End Session".
2. **Persistence Decision**:
   - **Recommended (Option A - No Schema Change)**: Persist session progress (reviewed finding IDs, active notes) in browser `localStorage` keyed by project ID (`devpilot_debug_session_${projectId}`).
   - **Alternative (Option B - Requires DB Schema Migration)**: Create a `debug_sessions` table in PostgreSQL. *Not recommended for initial fix to keep changes minimal.*
3. **Dashboard Quick Action Fix**:
   - Bind the "Debug Code" action card in `dashboard.jsx` to switch navigation to `debug-sessions`.
