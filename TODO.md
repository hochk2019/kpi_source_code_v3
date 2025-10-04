# TODO



- [ ] Implement frontend updates for Import tab and KPI reports (date formatting, update banners, preferential code management UI, CO discrepancy display).

- [ ] Extend automated tests (backend + frontend) and run validation suite once UI changes land.

- [ ] Investigate and fix preferential tax code handling in UI (wire new APIs, ensure state persists).

- [ ] Verify KPI license exclusion rules: ensure global exclusions (ZN02, HDGC) and per-agency exclusions are honored across ECUS sync and SQL imports.

- [ ] Perform full regression pass (manual & pnpm test --run) after implementing the above.

- [x] S?a l?i cú pháp DataImporter (key cho updatedPreview) d? Vitest không fail.

- [x] C?p nh?t logic/test d? danh sách so_tk trong store kh?p chu?n 11 ch? s? (vd. adjust tests expecting TK0x).



- [ ] Kh?c ph?c c?nh b?o "Cannot update a component (App) while rendering..." trong tests/e2e.login-import.test.jsx (c?n di chuy?n setState ra ngo?i render).

- [ ] Kh?i ph?c warning 'Cannot update a component (App) while rendering ...' (d?i setState ra ngo?i render) trong tests/e2e.login-import.test.jsx.

- [ ] Gi?m th?i h?nho?c t?t b?nh 'Kh?ng th? ??ng b? d? li?u...' trong tests/storageClient.test.js ??? ki?m so?t log khi test ch?y.

- [ ] Ho?n thi?n UI cho c?u h?nh m? ?u ??i / ??i so?t CO (frontend t??ng ?ng v?i API/backend m?i).

- [ ] D?n g?n repo (x?a file dist/, _tmp_get_config.mjs, .vs/ sau khi ho?n th?nh) d? review g?n.
