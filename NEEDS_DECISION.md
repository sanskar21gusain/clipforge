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

### D-003: Client-Side `localStorage` Pro Flag Tradeoff (Stateless Architecture)
- **Context:** Phase 2 security audit tested Pro gating bypasses (`/?checkout=success`, `/?pro=true`, arbitrary license key `123456`, and `localStorage` inspection). All URL params and unverified keys are strictly blocked. Because ClipForge is intentionally stateless and account-less (`QA-018` skipped by your decision), a technical user who opens DevTools can still manually set `localStorage.setItem('clipforge_pro_annual', 'true')`.
- **Choice Made:** Kept stateless Polar Customer Portal license validation (no accounts/backend DB), as requested.
- **Why:** Matches ClipForge's zero-account, zero-server-upload positioning. If you ever want server-enforced entitlements later, it would require user sessions or a lightweight API check on startup.

### D-004: Free vs Pro Tier Boundaries on New Video Tools
- **Context:** Item 6 (`MOV/WebM → MP4 Converter`) and Item 9 (`Merge / Join Videos`) required Free/Pro limits consistent with existing tools.
- **Choice Made:**
  - `MOV/WebM → MP4 Converter`: **720p HD** and all 4 aspect presets (`Original`, `16:9`, `9:16`, `1:1`) are **Free**; **1080p Full HD** high-bitrate export requires **Pro Annual (`$29/year`)**.
  - `Video Frame Extractor`: Unlimited single full-res PNG captures are **Free**; **Batch Extract every N seconds as ZIP** (capped at 60 frames for tab RAM safety) requires **Pro Annual**.
  - `Merge / Join Videos`: Merging up to **2 clips** in 720p/9:16 is **Free**; **3+ clips** and **1080p Full HD** require **Pro Annual**.
  - `Blur & Redact Photo` and `Video Speed & Reverse`: 100% Free to maximize organic SEO/viral sharing.
- **Why:** Keeps everyday single-file tasks generous and watermark-free while gating batch/multi-clip/Full-HD power workflows consistently with `Image Studio` and `Passport Photo`.

### D-005: Browser WASM Memory Safety Caps
- **Context:** FFmpeg.wasm runs single-threaded inside browser tab RAM (~1–2 GB practical ceiling) and FFmpeg's `reverse` filter buffers all decoded frames uncompressed in memory.
- **Choice Made:** Added friendly upfront file-size guards: `250 MB` for instant in-memory tool handoff, `400 MB` for Video Converter, `450 MB` combined for Merge Videos, `350 MB` for Video Speed (`80 MB` when Reverse is enabled), and `50 MB` for Canvas Blur & Redact.
- **Why:** Prevents silent browser tab OOM crashes and gives users an actionable error message before processing begins.

### D-006: Merge Videos Silent-Audio Fallback
- **Context:** Screen recordings (Chrome `.webm`) and muted clips frequently lack an audio stream, which causes FFmpeg `concat=n=N:v=1:a=1` to exit with code 1.
- **Choice Made:** `MergeVideosTool` first attempts normalized video+audio concat (`v=1:a=1`, 44.1kHz stereo AAC); if that fails (e.g., any input lacks audio), it automatically retries cleanly with video-only concat (`v=1:a=0`, `-an`).
- **Why:** Guarantees mixed silent/audio or screen-recording merges succeed instead of failing mysteriously.
