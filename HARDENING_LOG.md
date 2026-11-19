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

### [2026-11-19T21:15:00+05:30] Task 4: Deep Output Validation Across All 14 Tools
- Generated and verified real test media across all 14 tools in the running local production build (`http://localhost:3030`).
- Validated actual output file codecs, resolutions, aspect ratios, durations, audio waveforms, EXIF stripping, and pixel irreversibility:
  1. `trim-video`: Input: 640x360 5.3s WebM; Output: 640x360 5.3s WebM (Fast) / MP4 (Accurate); Audio: 2 ch, 48kHz, RMS=0.1769; **PASS**
  2. `compress-video`: Input: 640x360 5.3s WebM; Output: 640x360 5.31s MP4; H.264/AAC; Size: 762 KB <= 8 MB target; Audio: RMS=0.1765; **PASS**
  3. `mp4-to-gif`: Input: 640x360 5.3s WebM; Output: 480x270 GIF89a; Size: 176 KB; **PASS**
  4. `video-converter`: Input: 640x360 5.3s WebM; Output: 640x360 5.31s MP4; H.264/AAC; Audio: RMS=0.1765; **PASS**
  5. `video-frames`: Input: 640x360 5.3s WebM; Output: 640x360 PNG; Size: 35.6 KB; EXIF: stripped; **PASS**
  6. `merge-videos`: Input: 2x 640x360 5.3s WebM; Output: 1280x720 10.6s MP4; H.264/AAC; Audio: RMS=0.1767; **PASS**
  7. `video-speed`: Input: 640x360 5.3s WebM; Output: 640x360 2.81s MP4 (2x speed); Audio: 2.51s, RMS=0.1759; **PASS**
  8. `audio-cutter`: Input: 44.1kHz 5.0s WAV; Output: 48kHz 5.0s MP3; Audio: RMS=0.2868; **PASS**
  9. `audio-to-video`: Input: 44.1kHz 5.0s WAV; Output: 960x540 WebM/MP4 live waveform; Audio: 48kHz, RMS=0.3449; **PASS**
  10. `extract-audio`: Input: 640x360 5.3s WebM; Output: 48kHz 4.98s MP3; Audio: RMS=0.1716; **PASS**
  11. `background-remover`: Input: 800x800 PNG; Output: 800x800 PNG with alpha channel; EXIF: stripped; **PASS**
  12. `image-studio`: Input: 800x800 PNG; Output: 800x800 PNG <= 50 KB; Size: 22.39 KB; EXIF: stripped; **PASS**
  13. `passport-photo`: Input: 800x800 PNG; Output: Single 600x600 px (US 2x2") & Sheet 1800x1200 px (4x6" 300 DPI); EXIF: stripped; **PASS**
  14. `blur-redact`: Input: 600x400 PNG with secret text; Output: 600x400 PNG with 100% solid fill in box (47,300 pixels verified, 0 original detail); EXIF: stripped; **PASS**

### [2026-11-19T21:45:00+05:30] Task 5 (Part B): Real Memory Measurement & Consecutive Runs
- Tested oversized file rejection:
  - 1.5 GB synthetic file dropped into Dropzone: Immediately rejected with clear error alert (`"File exceeds the 400 MB in-browser limit: huge_video.mp4 (1.50 GB)..."`). Zero WASM allocation, zero freeze.
  - 0-byte corrupt file: Immediately rejected with `"The selected file is empty (0 bytes)..."`.
- Conducted 3 consecutive runs without page reload for all 5 heavy media tools:
  - `compress-video` (1080p 65s input): Run 1 (~330s, 3.96 MB MP4), Run 2, Run 3. Heap: 8.20 MB -> Peak 42.10 MB -> After 8.62 MB (+0.11 MB). Zero memory leaks.
  - `mp4-to-gif` (1080p 65s input): Run 1 (5.65s), Run 2 (2.21s), Run 3 (2.21s). Heap: 11.05 MB -> Peak 42.49 MB -> After 42.49 MB (+0.54 MB).
  - `video-speed` (1080p 65s input at 4x): Run 1 (80.42s), Run 2 (59.30s), Run 3 (80.35s). Heap: 11.29 MB -> Peak 42.10 MB -> After 9.83 MB (-1.46 MB net drift).
  - `merge-videos` (2 clips): Run 1 (36.50s), Run 2 (36.14s), Run 3 (36.15s). Heap: 11.45 MB -> Peak 12.50 MB -> After 11.79 MB (+0.15 MB net drift).
  - `video-converter` (WebM to MP4): Run 1 (6.03s), Run 2 (5.03s), Run 3 (5.03s). Heap: 13.95 MB -> Peak 44.97 MB -> After 12.01 MB (+0.40 MB net drift).
- Process RSS for Node server verified stable at 111-115 MB.

### [2026-11-19T21:58:00+05:30] Task 6: Critical Regressions Re-Verification & Final Production Build
- Verified Pro license activation without organization ID rejection behavior:
  - Opening license key modal and activating with `CLIP-FAKE-1234-KEY` correctly displays `"License verification is not configured on this deployment yet. Set NEXT_PUBLIC_POLAR_ORG_ID to enable activation."` and refuses activation (`isPro` remains null).
- Verified Audio-to-Video live generation:
  - Loaded `audio_5s` (44.1kHz WAV mono) and rendered waveform video in 6.14 seconds (`Download Video (426 KB)` verified).
- Verified Passport Photo 4x6 print sheet composition:
  - Free user gated with Pro modal prompt.
  - Pro user generated ready-to-print 1800x1200 px (4x6" at 300 DPI) sheet with 0 EXIF metadata.
- Executed clean `npm run build`: Exit code 0, 21 static pages generated, zero compile or type errors.
