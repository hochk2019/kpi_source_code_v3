# Desktop Control App Blueprint

## Purpose

- Document a non-invasive plan to wrap the existing KPI system in a desktop application with start/stop/build controls.
- Act only as reference; no changes to current runtime or features are implied by this document.

## Prerequisites

- Node.js and npm/yarn already required by the project.
- Ensure the existing scripts in `package.json` cover: build, lint, start (dev), start:prod (if any), tests.
- Source control clean prior to beginning (commit or stash active work).

## Recommended Stack

- **Primary**: Electron (Node.js main process + React renderer) for minimal friction and reuse of current React knowledge.
- **Alternatives**: Tauri (Rust-backed, lighter binaries) or NW.js. Choose Electron unless bundle size is a hard requirement.

## High-Level Steps

1. Scaffold `desktop-shell/` with Electron (Electron Forge or manual setup).
2. Wire a minimal React/HTML UI for the renderer (reuse existing build tooling if convenient).
3. In the Electron main process:
   - Expose IPC channels for `start-server`, `stop-server`, `build`, `lint`, `test`.
   - Use `child_process.spawn`/`exec` to run the existing npm scripts; pipe stdout/stderr back to renderer.
   - Track spawned processes so they can be terminated cleanly.
4. Renderer UI:
   - Buttons for each action, status indicator, log panel showing real-time output (IPC listener).
   - Disable conflicting buttons while a command is running (e.g., prevent double-start).
   - Support background mode: minimize to tray, optional auto-start with Windows, and tray menu entries for quick actions.
5. Packaging:
   - Use electron-builder/electron-forge to create Windows binaries (portable `.exe` or installer `.msi`).
   - Optional: prepare code-signing certificate to avoid SmartScreen warnings.

## Operational Considerations

- Keep the desktop app as a thin wrapper; no business logic should diverge from CLI workflow.
- Ensure file paths are relative to the project root; prompt user to select repo path if needed.
- Log retention: write command output to rotating files under `desktop-shell/logs/` if long sessions are expected.
- Optional service mode: for production, consider running the server under PM2/NSSM and let the UI call REST endpoints.
- For background operation on Windows, register a tray icon plus context menu, make minimize-to-tray the default, and gate auto-start via user setting (use `electron-settings` + Windows `Registry` or `electron-builder` auto-launch helpers).

## Next Steps After Pending Fixes

- Finalize lint/style fixes and confirm tests pass.
- Iterate on a proof-of-concept Electron shell, starting with build/start buttons.
- Add integration tests (e.g., Playwright) to confirm the desktop UI triggers the correct scripts.
- Once stable, document the workflow for teammates in the main README.
