# Pending follow-ups

- [ ] Restore failing tests impacted by CRLF normalization:
  - `tests/reportViewer.test.jsx`: adjust expectation for "Top 5 nhan vien..." heading.
  - `tests/dataImporter.preview.test.jsx`: review snapshot output to match current UI.
- [ ] Resolve `EADDRINUSE` in `tests/server.monitor.test.js` (choose free port instead of 5000 or stop conflicting process).
- [ ] Address remaining lint warnings (unused vars, hook dependency arrays, etc.) once CRLF changes are merged.
