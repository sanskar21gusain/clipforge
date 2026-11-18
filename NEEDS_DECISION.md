# Decisions Made Autonomously (`NEEDS_DECISION.md`)

Every conservative assumption or product decision made during the autonomous overnight run is logged below so you can review or adjust it in the morning.

---

### D-001: Placement of `pre-overnight` Git Tag
- **Context:** Before starting Phase 1, the working tree contained the already-approved QA audit fixes (`QA-001`–`QA-016`, `QA-019`, `QA-020`) uncommitted on top of `main` (`7536db6`). The safety rails prohibit touching `main`.
- **Choice Made:** Switched to `feature/overnight-v2` first, committed those approved QA fixes as `f8c97fc`, and placed the `pre-overnight` tag on `f8c97fc`.
- **Why:** Keeps `main` 100% untouched while ensuring rolling back to `pre-overnight` returns to the exact verified QA-passing state right before tonight's features began.

### D-002: Vercel Analytics Localhost Guard & Explicit CSP Allowlist
- **Context:** In local `next start`, Vercel's edge script `/_vercel/insights/script.js` does not exist and returns `404 text/html`, generating browser console errors. Additionally, Item 3 requires CSP and security headers to pass without breaking FFmpeg.wasm or `@imgly/background-removal`.
- **Choice Made:** `AnalyticsClient.jsx` skips mounting `<Analytics />` on `localhost`/`127.0.0.1`/`::1` (while auto-enabling on all deployed Vercel/custom hosts) and strips query strings/hashes via `beforeSend`. Added a strict `Content-Security-Policy` header in `next.config.mjs` explicitly allowlisting only `'self'`, `blob:`, `data:`, `'wasm-unsafe-eval'`, `cdn.jsdelivr.net`, `unpkg.com`, `staticimgly.com`, `api.polar.sh`, `va.vercel-scripts.com`, and `vitals.vercel-insights.com`.
- **Why:** Guarantees 0 console errors locally, zero cookies, zero filename/query leakage, and explicit allowlisting for every third-party CDN/API ClipForge uses.
