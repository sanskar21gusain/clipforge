# ClipForge Pre-Launch Hardening Log

**Started:** 2026-11-19T20:38:00+05:30  
**Branch:** `fix/pre-launch-hardening`  
**Base Commit:** `209e8b6`  

---

## Running Activity Log

### [2026-11-19T20:38:00+05:30] Session Initialization & Safety Rails
- Created and checked out local branch `fix/pre-launch-hardening` from `main` (commit `209e8b6`).
- Confirmed safety rails: local work only, zero `git push`, zero `vercel deploy`, zero secret/env changes, verified locally on production builds.
- Initialized `HARDENING_LOG.md`.

### [2026-11-19T20:41:00+05:30] Task 1 & Task 2: Git, Deployment & Noindex Investigation
- Inspected git status, branches, and commit histories.
  - `origin/main` is at commit `209e8b6`.
  - Overnight feature commits (`550f56e`..`3382c37`) reached `main` via fast-forward progression from `feature/overnight-v2` (no merge commit was created).
- Investigated `noindex` headers via live HTTP inspection:
  - `curl -I https://clipforge-one-tau.vercel.app` (the project's production domain alias): **NO `X-Robots-Tag: noindex`**. Standard production indexing is allowed.
  - `curl -I https://clipforge-sanskar21gusains-projects.vercel.app` (preview/team subdomain): Returns `X-Robots-Tag: noindex`. Vercel automatically injects this on non-production deployment URLs to prevent search engine fragmentation.
  - Searched all codebase files for `noindex`: 0 matches in code or config. `src/app/layout.js` explicitly defines `robots: { index: true, follow: true }`.

### [2026-11-19T20:45:00+05:30] Task 3: Self-Hosting FFmpeg Core & Stricter CSP
- Installed `@ffmpeg/core@0.12.6` pinned in `package.json`.
- Created build sync script `scripts/copy-ffmpeg.mjs` and hooked into `prebuild` and `predev` in `package.json`.
- Copied `ffmpeg-core.js` (114 KB) and `ffmpeg-core.wasm` (30.64 MB) to `public/ffmpeg/`.
- Updated `src/lib/ffmpegClient.js` to load from local same-origin `/ffmpeg/` without external CDN requests.
- Updated `next.config.mjs`:
  - Added `Cache-Control: public, max-age=31536000, immutable` for `/ffmpeg/(.*)`.
  - Removed `https://cdn.jsdelivr.net` and `https://unpkg.com` from `script-src` and `connect-src`.
- Confirmed `npm run build` succeeds with 0 errors.

### [2026-11-19T20:49:00+05:30] Task 5 (Part A): Universal File Size & Empty File Protection
- Added uniform file size limits across `src/components/Dropzone.jsx` and all 14 tools:
  - 400 MB cap for video tools (`CompressVideo`, `TrimVideo`, `Mp4ToGif`, `VideoConverter`, `VideoFrames`, `MergeVideos`, `VideoSpeed`, `ExtractAudio`).
  - 100 MB cap for audio tools (`AudioCutter`, `AudioToVideo`).
  - 50 MB cap for image tools (`BackgroundRemover`, `PassportPhoto`, `ImageStudio`, `BlurRedact`).
  - Rejection of 0-byte corrupt/empty files across all tools.
- Tested `npm run build`: Exit code 0, all 21 static pages generated.
