# ClipForge — Overnight v2 Full QA Audit & Release Report

**Audit Date:** 2026-11-18  
**Branch:** `feature/overnight-v2` (Rollback tag: `pre-overnight` at `f8c97fc`; `main` untouched at `7536db6`)  
**Audited Build:** Production build (`npm run build` + `npm run start` on `http://127.0.0.1:3030`)  
**Total Tools:** **14** on-device tools (9 original + 5 new: `video-converter`, `blur-redact`, `video-frames`, `merge-videos`, `video-speed`)

---

## 1. Executive Summary & Release Verdict

### Final Verdict: **GO** *(ready for Vercel Preview & Production once you add Polar env vars)*

- **Production Build:** `npm run build` passed with **0 errors and 0 warnings** (`21/21` static pages + `2` API routes + `/opengraph-image`).
- **Browser Console:** **0 errors and 0 warnings** across all tested routes.
- **Lighthouse (6 Full Runs — Mobile & Desktop):** **100** Accessibility · **100** Best Practices · **100** SEO · **100** Agentic Browsing (**0 failed audits** across `/`, `/tools/video-converter`, `/tools/blur-redact`, `/tools/video-frames`, and `/tools/merge-videos`).
- **Core Web Vitals (Cold-Cache Trace on `/`):** **TTFB `16 ms`** · **LCP `288 ms`** · **CLS `0.00`** · Render-blocking LCP savings **`0 ms`**.
- **Privacy Verified (Network Tab):** **0 user files, 0 filenames, 0 file bytes, and 0 cookies** transmitted to any server during tool usage.
- **All 3 Earlier Critical Regressions Passed** on the final 14-tool production build.

---

## 2. Issues Found During Overnight Build & Phase 2 Audit

### Caught & Fixed During Overnight Run (All Verified Live)

| ID | Severity | Status | Area | Steps to Reproduce | Expected vs Actual | Applied Fix |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **QA-V2-001** | **High** | **Fixed & Verified** | Functional (`TrimVideoTool`, `CompressVideoTool`, `Mp4ToGifTool`) | Upload a Chrome `MediaRecorder` `.webm` video (whose `<video>.duration === Infinity`) and click **Trim Video**. | **Expected:** Trims cleanly.<br>**Actual:** Passed `-t Infinity` to FFmpeg → `FFmpeg exited with code 1`. | Guarded all `onLoadedMetadata` duration handlers with `Number.isFinite(raw) && raw > 0` and safe fallbacks. Re-verified live: WebM trimmed & handed off to Compress Video with `0` errors. |
| **QA-V2-002** | **High** | **Fixed & Verified** | Functional (`BlurRedactTool.jsx`) | Rapidly drag mouse/pointer across `#redact-canvas` to draw a redaction box. | **Expected:** Draws redaction immediately.<br>**Actual:** Async React `draft` state lagged behind rapid `pointerdown → pointermove → pointerup`, dropping drags. | Backed active drag coordinates with synchronous `draftRef` alongside state. Re-verified live at pixel level (`centerPx: [15,23,42,255]`, red destroyed). |
| **QA-V2-003** | **High** | **Fixed & Verified** | Runtime / Console (`AnalyticsClient.jsx`) | Run local production server (`next start`) with `<Analytics />` mounted unconditionally. | **Expected:** 0 console errors locally.<br>**Actual:** Requested `/_vercel/insights/script.js` → `404 text/html` MIME error in browser console. | Guarded `<Analytics />` to auto-mount on deployed non-localhost hosts while skipping `localhost`/`127.0.0.1`/`::1`, and added `beforeSend` query/hash stripping + explicit `Content-Security-Policy` in `next.config.mjs`. Re-verified: `0` console errors, `0` CSP violations. |
| **QA-V2-004** | **Medium** | **Fixed & Verified** | Build / OG Image (`opengraph-image.js`) | Run `npm run build` with unicode symbols `✦` and `●` inside Satori `ImageResponse`. | **Expected:** Zero build warnings.<br>**Actual:** Logged `Failed to load dynamic font for ✦● (Status 400)`. | Replaced non-ASCII glyphs with pure ASCII mark + CSS circle dot. Re-verified: `0` build warnings, valid `61,253 B` PNG (`HTTP 200`). |
| **QA-V2-005** | **Medium** | **Fixed & Verified** | UX (`StudioProvider.jsx`, `ProModal.jsx`) | Visit `/?checkout=success` (opens native `<dialog>` in browser top layer). | **Expected:** Welcome confirmation clearly visible immediately.<br>**Actual:** Fixed toast sat behind modal backdrop and auto-dismissed after 9s. | Added prominent emerald welcome banner inside `ProModal` (`data-testid="checkout-welcome-banner"`) and extended toast to 20s so confirmation is visible both inside and after closing the modal. |
| **QA-V2-006** | **Low** | **Fixed & Verified** | UI Accuracy (`HomeDirectory.jsx`, `llms.txt`) | Add new tools to `TOOLS`. | **Expected:** Category pill & `llms.txt` reflect true tool count.<br>**Actual:** Hardcoded `All (9)` in `HomeDirectory.jsx`. | Switched pill dynamically to `All (${TOOLS.length})` (`All (14)`) and updated `llms.txt` to 14 tools. |

### Open / Informational Items (No Action Needed Without Your Approval)

| ID | Severity | Status | Area | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **QA-017** | **Medium** | Deferred (Reported Only) | Dependencies (`npm audit`) | Unchanged at **14 advisories** (13 high, 1 moderate): 12 build/dev-only (`tailwindcss@3.4.19` → `picomatch`, `next@15.5.29` → internal `postcss@8.4.31`), 2 client-only lazy chunk (`@imgly/background-removal` → `zod`). Adding `@vercel/analytics` introduced **0** new advisories. `npm audit fix --dry-run` confirms 0 safe non-breaking upgrades. |
| **QA-018** | **Medium** | Skipped by Design | Backend (`api/webhook/polar/route.js`) | Stateless Polar license key validation chosen; webhook handlers intentionally remain stubs. |
| **QA-V2-007** | **Low** | Accepted Tradeoff (`D-003`) | Client-Side Pro State | As a stateless zero-account browser app, a user with DevTools could manually edit `localStorage`. All URL params (`?checkout=success`, `?pro=true`, `?license=...`) and unverified keys (`123456`) remain strictly blocked. |

---

## 3. What Was Tested & Passed (Complete Matrix)

### A. Lighthouse & Core Web Vitals (Final 14-Tool Production Build)

| Route | Device | Accessibility | Best Practices | SEO | Agentic Browsing | Failed Audits |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `/` | Mobile | **100** | **100** | **100** | **100** | **0** |
| `/` | Desktop | **100** | **100** | **100** | **100** | **0** |
| `/tools/video-converter` | Desktop | **100** | **100** | **100** | **100** | **0** |
| `/tools/blur-redact` | Mobile | **100** | **100** | **100** | **100** | **0** |
| `/tools/video-frames` | Desktop | **100** | **100** | **100** | **100** | **0** |
| `/tools/merge-videos` | Mobile | **100** | **100** | **100** | **100** | **0** |

- **Cold-Cache Performance Trace (`/`):** TTFB **`16 ms`** · LCP **`288 ms`** · CLS **`0.00`** · Render-blocking LCP savings **`0 ms`**.

### B. Functional, Edge-Case, Privacy & Security Checks Passed
- **All 15 Page Routes + Assets:** `/` + all 14 `/tools/*` returned `HTTP 200`, all 5 security headers (`CSP`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`), absolute `og:image`, zero `"lifetime"`, zero removed banners; all 14 slugs verified in `sitemap.xml` and `llms.txt`.
- **Checkout Return Flow (`/?checkout=success` & URL bypass test `/?pro=true&plan=annual&checkout=success&license=FREE`):** Welcome toast + modal banner shown, license input auto-opened, `checkout` param cleaned via `replaceState`, **Pro NOT unlocked**.
- **Dynamic OG Image (`/opengraph-image`):** `HTTP 200`, `image/png`, `61,253 B`, valid PNG magic bytes.
- **Copy-to-Clipboard (`BackgroundRemover`, `ImageStudio`, `PassportPhoto`):** Verified automatic WebP→PNG conversion + `ClipboardItem(['image/png'])` write AND graceful amber fallback alert on `NotAllowedError`.
- **In-Memory Tool Handoff:** Real WebM trimmed in `/tools/trim-video` via FFmpeg.wasm → clicked **Compress →** → auto-loaded `"Loaded directly from Video Trimmer (in-memory)"` in `/tools/compress-video` with `0` errors.
- **All 5 New Tools Live-Verified End-to-End:**
  - `/tools/video-converter`: 0-byte file rejected; `1080p Full HD` opened Pro modal; WebM → `9:16 Vertical` H.264 MP4 (`9.06 KB`).
  - `/tools/blur-redact`: Solid Black Box irreversibly destroyed red center pixels (`[15, 23, 42, 255]`); Undo restored red; Pixelate mode worked; exported PNG had zero EXIF/eXIf metadata.
  - `/tools/video-frames`: Captured native `480×270` PNG (`3.52 KB`) from WebM; Pro Batch Extract ZIP opened Pro modal.
  - `/tools/merge-videos`: Merged 2 mixed-resolution (`320×240` + `400×300`) silent WebM clips → `11.1 KB` MP4; 3rd clip opened Pro modal.
  - `/tools/video-speed`: Rendered 2× Reversed WebM → `2.68 KB` MP4 with `0` errors.
- **XSS Filename & Repeated-Run Check:** Uploaded `<img src=x onerror=window.__xssFile=1>.png` on `/tools/image-studio`, ran 3 consecutive optimizations without refresh → `xssExecuted: false`, `0` errors, `0` file network requests.
- **Offline Failure Handling:** Emulated `Offline` on `/tools/compress-video` → friendly error displayed in `1.8s`, button cleanly re-enabled (no crash/hang).
- **Responsive Mobile (`320px`, `375px`, `768px`):** `0` horizontal overflow (`scrollWidth <= innerWidth`) across `/` and all 5 new tools + mobile drawer SPA navigation & `Escape` close verified.
- **API & Bundle Security:** `/api/checkout` (missing params `400`, bad email `400`, unconfigured `503`, POST `405`); `/api/webhook/polar` (GET `405`, unconfigured POST `500`); **0 secrets** in `.next/static` client bundles or `src/`.
- **All 3 Earlier Critical Regressions Re-Verified on Final Build:**
  - `QA-001` (Pro activation without org ID): `123456` blocked (`c1_blocked: true`).
  - `QA-002` (Audio-to-Video WebM export): Real `139 KB` WebM generated (`c2_ready: true`).
  - `QA-003` (Passport 4×6 print sheets on `1800×1200`): India (8 photos), US (6 photos), Canada (2 photos) — all `fits: true` (zero clipping).

---

## 4. What Could Not Be Tested & Why

1. **Live Polar.sh Checkout Redirect, Email License Delivery & Webhook Signature Verification:** Polar production/sandbox env vars are intentionally not set locally (per safety rails).
2. **Real Vercel Edge `/_vercel/insights/script.js` Ingestion:** Local `next start` does not serve Vercel's edge analytics script; verify `200 OK` on a Vercel Preview deployment and confirm zero cookies / stripped query params in DevTools Network tab.
3. **Native Safari (macOS/iOS) & Firefox:** Automated checks ran in Chromium on Windows; spot-check Safari's `video/mp4` MediaRecorder fallback and iOS WASM memory ceiling on a real Apple device.
4. **Very Large (>200 MB) Videos & First-Run `@imgly/background-removal` ~40 MB ONNX Model on Low-RAM Phones:** Outside local automated fixtures; upfront size guards (`80–450 MB`) protect users cleanly.
