# Sub-Report: Settings Feature Audit

**Audited Component:** Settings (`settings`)  
**Project:** DevPilot  
**Status:** **NOT IMPLEMENTED (PLACEHOLDER PRESENT)**  
**Date:** 2026-10-26  

---

## 1. Intended Purpose vs. Actual Reality

### Intended Purpose (per Code, UI, and Documentation)
- **UI Surface**:
  - `client/src/components/sidebar.jsx` (line 7): Nav item `{ label: "Settings", value: "settings" }`.
- **Existing System Preferences & Configurations**:
  Across DevPilot's codebase, several settings and configuration values exist but are currently hardcoded or managed purely through server environment variables:
  1. **Monaco Code Editor Preferences (`client/src/components/codeEditor.jsx`)**:
     - Theme: Hardcoded to `"vs-dark"` (line 148).
     - Font size: Hardcoded to `13` (line 156).
     - Line height: Hardcoded to `22` (line 157).
     - Word wrap: Hardcoded to `"off"` (line 159).
     - Minimap: Hardcoded to `{ enabled: false }` (line 155).
  2. **API & Connection Settings (`client/src/App.jsx` line 10, `FileExplorer.jsx` line 4)**:
     - `API_BASE_URL`: Hardcoded to `"http://localhost:5000"`.
     - Backend Connection Status: Polls `GET /api/projects` on mount, evaluates to `"connected"`, `"disconnected"`, or `"checking"`.
  3. **Backend Server Configuration (`backend/server.js`, `backend/.env`)**:
     - `PORT`: `process.env.PORT || 5000`
     - Database configuration (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`)
     - Maven compilation enabled flag: `process.env.DEVPILOT_ENABLE_MAVEN_ANALYSIS` (defaults to false for untrusted uploads)
     - Security scanning limits: `MAX_FILE_SIZE` (50MB), `MAX_EXTRACTED_SIZE` (100MB), `MAX_ANALYSIS_FILES` (300), `MAX_ANALYSIS_FILE_SIZE` (1MB), `MAX_ANALYSIS_TOTAL_SIZE` (10MB).

---

## 2. Full Flow Trace: Button Handler to Rendering

| Layer | Flow Element | Actual Current Behavior |
|---|---|---|
| **UI Button / Control** | Sidebar item `Settings` | Calls `setActivePage("settings")` |
| **Route / Panel Handler** | `client/src/App.jsx` | Matches condition `activePage !== "dashboard" && activePage !== "projects"` |
| **Rendering** | Fallback Banner | Renders `<div className="coming-soon"><h2>Coming Soon</h2><p>This feature is not yet available.</p></div>` |
| **API Call** | Network Request | **None** (`fetch` is never invoked) |
| **Backend Route** | `backend/server.js` | **None** (requests to `/api/settings` return HTTP 404 HTML) |
| **Backend Logic** | Config Service | **None** |
| **Database / Storage** | PostgreSQL | **None** (no `settings` or `preferences` table) |
| **State Persistence** | Storage / Cache | **None** |

---

## 3. Settings Taxonomy, Placement, and Security Decisions

In compliance with the project's hard rules (*"Never expose, overwrite or invent secrets/.env values. Settings that don't work are labeled as unsupported, not shown as functional"*):

| Setting Item | Intended Purpose | Control Type | Input Validation | Target Storage Location | Security / Handling Rule |
|---|---|---|---|---|---|
| **Editor Theme** | Toggle dark vs light code editor | Dropdown (`vs-dark`, `vs-light`) | Enum whitelist (`vs-dark`, `vs-light`) | Browser `localStorage` (`devpilot_editor_theme`) | Safe. Client-side presentation only. |
| **Editor Font Size** | Adjust code editor readability | Number input / Stepper | Integer between `10` and `24` px | Browser `localStorage` (`devpilot_editor_font_size`) | Safe. Clamped on load/change. |
| **Editor Word Wrap** | Wrap long code lines | Toggle / Select (`off`, `on`, `wordWrapColumn`) | Enum whitelist | Browser `localStorage` (`devpilot_editor_word_wrap`) | Safe. Defaults to `"off"`. |
| **Editor Minimap** | Show/hide code overview map | Checkbox | Boolean | Browser `localStorage` (`devpilot_editor_minimap`) | Safe. Defaults to `false`. |
| **API Base URL** | Allow connecting to custom backend host/port | Text Input | URL format (`http://` or `https://`) | Browser `localStorage` (`devpilot_api_url`) | Requires explicit "Test Connection" button before applying. |
| **Backend Status** | Display active server health and PostgreSQL state | Read-only Status Pills | Read-only query to `/api/health` and `/api/db-health` | None (Live Query) | Read-only. Never permits arbitrary config writes. |
| **Server Environment (.env)** | Database credentials, DB passwords, API keys | **Disabled / Unsupported** | **N/A** | Server filesystem (`.env`) | **STRICT RULE**: Never exposed or editable from client. Labeled explicitly as "Managed via server configuration; cannot be modified in browser." |
| **Maven Analysis Toggle** | Enable/disable compilation diagnostics | Read-only Indicator | Read-only | Server Env (`DEVPILOT_ENABLE_MAVEN_ANALYSIS`) | Shows active server policy; points to documentation regarding security implications. |

---

## 4. Checklist Evaluation

| Criteria | Status | Evidence / Verification |
|---|---|---|
| Opens and loads actual current values | ❌ **NOT IMPLEMENTED** | Opens generic "Coming Soon" placeholder |
| Purpose & correct control for each setting | ❌ **NOT IMPLEMENTED** | Form controls do not exist |
| Storage decision follows architecture | ✅ **DESIGNED** | Frontend preferences in `localStorage`; server security settings read-only |
| Save/Apply persists to the right place | ❌ **NOT IMPLEMENTED** | No save logic implemented |
| Cancel/Reset restores defaults safely | ❌ **NOT IMPLEMENTED** | Controls do not exist |
| Missing values fallback to safe defaults | ❌ **NOT IMPLEMENTED** | Component does not exist |
| No secrets exposed; never write to `.env` | ✅ **VERIFIED** | Backend exposes zero secrets; audit verified no endpoints expose `.env` |
| Unsupported settings labeled accurately | ❌ **NOT IMPLEMENTED** | Placeholder banner shown instead of settings panel |

---

## 5. Smallest Compatible Implementation Proposal

Create a dedicated `client/src/components/Settings.jsx` component:
1. **Editor Preferences Tab / Section**:
   - Theme (`vs-dark` / `vs-light`), Font Size (slider/input: 11-20), Word Wrap (`off` / `on`), Minimap toggle.
   - Saved directly to `localStorage` under `devpilot_user_settings`.
   - Propagated to `codeEditor.jsx` via custom event or context/props so changes apply immediately.
   - "Reset Editor Defaults" button with confirmation.
2. **Connectivity & Backend Tab / Section**:
   - Backend URL display with "Test Ping" button hitting `/api/health` and `/api/db-health`.
   - Displays real response latency, connected database name (`devpilot`), and current server timestamp.
3. **Engine Capabilities & Limits (Read-Only)**:
   - Displays static analysis limits: 50MB ZIP limit, 100MB extract limit, 1MB per-file analysis cap, supported extensions list (`.js`, `.jsx`, `.mjs`, `.cjs`, `.json`, `.py`, `.java`).
   - Clearly labels server environment modification as disabled for security.
