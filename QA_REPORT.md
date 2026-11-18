# ClipForge — Pre-Release QA Audit & Go/No-Go Report (Final)

**Audit Date:** 2026-11-18  
**Project Path:** `D:\USERS\desktop\clipforge`  
**Stack:** Next.js 15.5.29 (App Router), React 19, Tailwind CSS 3, FFmpeg.wasm (`@ffmpeg/ffmpeg`), `@imgly/background-removal`, Web Audio API, HTML5 Canvas, JSZip, Polar.sh (`@polar-sh/sdk`)  
**Audited Build:** Production build (`npm run build` + `npm run start` on `http://127.0.0.1:3030`)

---

## 1. Executive Summary & Final Release Recommendation

### Final Verdict: **GO** *(with Polar env var configuration on Vercel before accepting paid checkouts)*

All **18 approved issues** (**3 Critical**, **6 High**, **7 Medium**, **2 Low**) have been **fixed, rebuilt in production mode (`0` errors), and re-verified live** in Chromium with **0 browser console errors and 0 warnings**.

- **Lighthouse Scores:** **100** Accessibility · **100** Best Practices · **100** SEO · **100** Agentic Browsing (**0 failed audits** on both Mobile `/` and Desktop `/tools/audio-to-video`).
- **Performance (Cold-Cache Core Web Vitals Trace on `/`):** **TTFB `17 ms`** · **LCP `276 ms`** · **CLS `0.00`** · Render-blocking estimated LCP savings **`0 ms`**.
- **All 3 Critical Regressions Passed** on the final production build (see Section 5).
- **Remaining Launch Action (User-Owned):** Configure the 5 Polar.sh environment variables in Vercel Production (`POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER`, `NEXT_PUBLIC_POLAR_ORG_ID`, `NEXT_PUBLIC_POLAR_ANNUAL_PRODUCT_ID`) and run one live checkout/key activation smoke test.

### Final Issue Tally

| Severity | Found | Fixed & Re-Verified | Deferred / Accepted | Skipped by Design |
| :--- | :---: | :---: | :---: | :---: |
| **Critical** | 3 | **3** | 0 | 0 |
| **High** | 6 | **6** | 0 | 0 |
| **Medium** | 9 | **7** | **1** (`QA-017`) | **1** (`QA-018`) |
| **Low** | 2 | **2** | 0 | 0 |
| **Total** | **20** | **18** | **1** | **1** |

---

## 2. Step 1 Inventory (Test Checklist)

- **Pages & Routes (10 + error/404 + static assets):**
  - `/` (`HomeDirectory`) — hero, search bar, empty search state, 4 category filters, 9 tool cards, trust strip, Annual Pro CTA.
  - `/tools/background-remover` — on-device AI segmentation, 4 backdrops, Compare Original toggle, PNG export.
  - `/tools/compress-video` — FFmpeg.wasm target MB compression (8MB Discord, 16MB WhatsApp, 25MB Email, Custom MB).
  - `/tools/trim-video` — FFmpeg.wasm Fast Lossless Copy (`.mp4`/`.webm`) & Frame-Accurate H.264 trimmer + live video seek.
  - `/tools/mp4-to-gif` — FFmpeg.wasm two-pass `palettegen`/`paletteuse` GIF renderer (range, FPS, width).
  - `/tools/extract-audio` — FFmpeg.wasm MP3/WAV extraction & lossless video mute.
  - `/tools/audio-cutter` — Web Audio waveform canvas + FFmpeg.wasm trim, 50%–300% volume boost, fade-in/out, MP3/WAV export.
  - `/tools/audio-to-video` — Web Audio `AnalyserNode` + Canvas animated audiogram (`16:9`, `1:1`, `9:16`) + `MediaRecorder` export.
  - `/tools/image-studio` — Batch JPG/PNG/WebP conversion, EXIF strip, Exact-KB binary search, max-width resize, ZIP download.
  - `/tools/passport-photo` — India/EU/UK (`35×45mm`), US (`2×2 in`), Canada (`50×70mm`) 300 DPI cropper + 4×6 print sheet.
  - Branded error routes: `src/app/not-found.js` (`/nonexistent-404`, `/tools/does-not-exist`) and `src/app/error.js`.
  - Static SEO/agent files: `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/favicon.svg`.
- **Global Shell & Modals:**
  - `AppShell` (top bar, desktop persistent sidebar, accessible mobile slide-over drawer with `Escape` close, footer).
  - `StudioProvider` + `ProModal` (native `<dialog>`, Annual Pro `$29/year` Polar checkout + license key activation/deactivation).
- **API Endpoints:**
  - `GET /api/checkout` — validates product allowlist + email, creates Polar checkout session with `success_url`, redirects `302`.
  - `POST /api/webhook/polar` — verifies Polar webhook signatures (`webhook-id`, `webhook-timestamp`, `webhook-signature`).

---

## 3. Master Issues Table (Final Status)

| ID | Severity | Status | Area | Steps to Reproduce | Expected vs Actual (Before Fix) | Applied Fix / Resolution |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **QA-001** | **Critical** | **Fixed & Verified** | Security / Revenue (`ProModal.jsx`) | Open Pro modal without `NEXT_PUBLIC_POLAR_ORG_ID`, enter `123456`, click **Activate**. | **Expected:** Reject unverified keys.<br>**Actual:** Unlocked Pro Annual for free. | Removed offline length fallback; now requires `NEXT_PUBLIC_POLAR_ORG_ID` and live Polar validation. Clears stale errors on reopen & cleans up `setTimeout`. |
| **QA-002** | **Critical** | **Fixed & Verified** | Functional (`AudioToVideoTool.jsx`) | Upload WAV on `/tools/audio-to-video`, click **Render Live Waveform Video** (or double-click). | **Expected:** Playable multi-KB WebM video.<br>**Actual:** `vp9,opus` produced empty **110 B** file on Windows Chrome; double-click spawned duplicate recordings. | Prioritized `video/webm;codecs=vp8,opus` (+ `vp9`, `webm`, Safari `video/mp4`), added `audioCtx.resume()`, `recorder.start(200)`, `startingRef` double-click guard, and `audioCtx.close()` on error. Re-verified live: **146–148 KB** playable WebM. |
| **QA-003** | **Critical** | **Fixed & Verified** | Functional (`PassportPhotoTool.jsx`) | Select **US (2×2 in)** or **Canada (50×70mm)** and export 4×6 print sheet (`1800×1200`), or upload corrupt `.jpg`. | **Expected:** Zero clipping inside `1800×1200`; corrupt file shows error.<br>**Actual:** US (`1848×1224`) & Canada (`1678px` tall) clipped off canvas; corrupt upload failed silently. | US set to `gap: 0` (`1800×1200`, 6 photos); Canada set to `2×1, gap: 24` (`1204×827`, 2 photos); India `4×2, gap: 24` (`1724×1086`, 8 photos). Added `img.onerror` alert + URL revoke. |
| **QA-004** | **High** | **Fixed & Verified** | Security / API (`api/checkout/route.js`) | Call `/api/checkout?products=evil-id` or invalid `customer_email`, or call without `POLAR_ACCESS_TOKEN`. | **Expected:** Allowlist check, email check, `success_url`, clean `503`.<br>**Actual:** Arbitrary product IDs allowed, no `success_url`, raw `500`. | Enforced `NEXT_PUBLIC_POLAR_ANNUAL_PRODUCT_ID` allowlist, email regex validation (`400`), `success_url`, and `503` when unconfigured. |
| **QA-005** | **High** | **Fixed & Verified** | Input Validation (`Dropzone.jsx`) | Drag-and-drop or paste a `.txt` file onto Image/Video/Audio tools. | **Expected:** Reject wrong file types.<br>**Actual:** Passed `.txt` straight into tools. | Added MIME + extension `matchesAccept()` check across file input, drag-and-drop, and paste with `role="alert"` banner; switched `id` to `useId()`. |
| **QA-006** | **High** | **Fixed & Verified** | Data Integrity (`AudioCutterTool.jsx`, `ExtractAudioTool.jsx`) | Export MP3, then switch button to WAV (or Mute) without re-exporting. | **Expected:** Clear stale export or keep original extension.<br>**Actual:** Saved MP3 binary as `.wav` / `-muted.mp3`; leaked `AudioContext` on decode error. | Cleared `outputBlob` on format/action switches, tracked `outputFormat`, closed `AudioContext` in `finally`, added `end <= start` error. |
| **QA-007** | **High** | **Fixed & Verified** | Functional (`ImageStudioTool.jsx`) | Enter `-500` in Max Width, upload corrupt PNG, or ZIP duplicate file stems. | **Expected:** Bounds-clamped width, error badge on corrupt image, deduplicated ZIP entries.<br>**Actual:** 1×1 px output, silent error, overwritten ZIP file. | Clamped `maxWidth` (`16–16384`) & `targetKb` (`10–5000`), attached `onload`/`onerror` before `src`, revoked URL in `finally`, added corrupt badge, deduplicated ZIP names, disabled `Clear List` during processing. |
| **QA-008** | **High** | **Fixed & Verified** | Functional (`CompressVideoTool`, `TrimVideoTool`, `Mp4ToGifTool`, `BackgroundRemoverTool`) | Invalid/huge numeric inputs, `.webm` fast-trim, *Use Current Time* past bounds, *Compare Original* click, discard photo mid-AI run. | **Expected:** Clamped inputs, valid container, clean toggle, no stale overwrite.<br>**Actual:** `NaN`/unbounded values, VP8-in-MP4 crash, mouse/click conflict, stale async result. | Clamped all numeric inputs & *Use Current Time*, preserved `.webm` on fast-copy trim, replaced mouse handlers with `aria-pressed` toggle, added `runIdRef` guard. |
| **QA-009** | **High** | **Fixed & Verified** | Security (`next.config.mjs`) | Inspect HTTP response headers on HTML and API routes. | **Expected:** Standard security headers.<br>**Actual:** All missing (`null`). | Added `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. |
| **QA-010** | **Medium** | **Fixed & Verified** | UX / Error Pages (`not-found.js`, `error.js`) | Visit `/nonexistent-404` or `/tools/does-not-exist`. | **Expected:** Branded ClipForge 404 & error boundary.<br>**Actual:** Generic Next.js default 404. | Created bright-themed `src/app/not-found.js` and `src/app/error.js`. Verified HTTP `404` with branded UI and *Back to All Tools* link. |
| **QA-011** | **Medium** | **Fixed & Verified** | Accessibility (`AppShell.jsx`, `tools.js`, `ProModal.jsx`, `ToolPageLayout.jsx`, `ImageStudioTool.jsx`) | Run Lighthouse Accessibility audit on `/` and `/tools/*`. | **Expected:** All text ≥4.5:1 WCAG AA.<br>**Actual:** `text-ink-400` (`2.56:1`), sidebar badges (`4.34:1`/`3.62:1`), photo badges (`3.57:1`). | Updated low-contrast labels to `text-ink-500`/`text-ink-700`, active pill to `bg-blue-800/80`, and category accents to `text-blue-700` / `text-indigo-700` / `text-emerald-800`. Lighthouse Accessibility reached **100**. |
| **QA-012** | **Medium** | **Fixed & Verified** | Accessibility (`Dropzone.jsx`) | Run Lighthouse on any `/tools/[slug]` page. | **Expected:** Sequential headings (`h1` → `h2`).<br>**Actual:** Dropzone used `<h3>` directly under `<h1>`. | Changed Dropzone title element from `<h3>` to `<h2>`. Lighthouse `heading-order` now passes. |
| **QA-013** | **Medium** | **Fixed & Verified** | SEO (`public/robots.txt`) | Run Lighthouse SEO audit. | **Expected:** Valid `robots.txt`.<br>**Actual:** 2 errors (relative `Sitemap:` path + non-standard `LLMs-Txt:` directive). | Updated to absolute `Sitemap: https://clipforge.vercel.app/sitemap.xml` and removed unknown directive. Lighthouse SEO reached **100**. |
| **QA-014** | **Medium** | **Fixed & Verified** | SEO / Social (`src/app/layout.js`) | Inspect `<head>` meta tags on `/`. | **Expected:** `metadataBase`, `openGraph`, and `twitter` tags.<br>**Actual:** Missing on `/`. | Added `metadataBase`, `openGraph`, and `twitter` (`summary_large_image`) to root `metadata`. Verified live in `<head>`. |
| **QA-015** | **Medium** | **Fixed & Verified** | UX / Empty State (`HomeDirectory.jsx`) | Search `zzzzzz` on homepage. | **Expected:** Helpful empty state + reset button.<br>**Actual:** Blank grid with `0 tools`. | Added empty-state card with **Reset Search & Filters** button. Verified live restoring all 9 tools. |
| **QA-016** | **Medium** | **Fixed & Verified** | Mobile A11y (`AppShell.jsx`) | Open mobile drawer at 375px and press `Escape`; inspect DOM. | **Expected:** `Escape` closes drawer; no duplicate hidden Close button.<br>**Actual:** `Escape` ignored; hidden desktop Close button existed in DOM. | Added `Escape` handler, `role="dialog"` / `aria-modal="true"`, unique `<nav aria-label>`, and conditional Close button rendering. Verified live at 375px. |
| **QA-017** | **Medium** | **Audited — Deferred (0 non-breaking fixes)** | Security / Dependencies (`npm audit`) | Run `npm audit` and `npm audit fix --dry-run`. | **Expected:** Classify all 14 advisories; apply only non-semver-major fixes.<br>**Actual:** `npm audit fix --dry-run` returned `changed: 0` — all 14 require semver-major changes. | No `--force` or semver-major upgrades applied. Full 14-item breakdown documented in Section 4 below. |
| **QA-018** | **Medium** | **Skipped by Design** | Backend (`api/webhook/polar/route.js`) | Inspect `order.paid` / `customer.state_changed` stubs. | Stateless Polar license key validation chosen; DB persistence not required. | Skipped per release owner decision. |
| **QA-019** | **Low** | **Fixed & Verified** | Documentation (`README.md`) | Check root directory for setup/deploy docs. | **Expected:** Setup, env vars, deploy instructions.<br>**Actual:** Missing. | Created comprehensive `README.md` with local run, build, Polar env var table, and Vercel deployment instructions. |
| **QA-020** | **Low** | **Fixed & Verified** | Agentic Browsing (`public/llms.txt`) | Run Lighthouse Agentic Browsing audit. | **Expected:** Markdown links per `llmstxt.org`.<br>**Actual:** Failed (`File does not appear to contain any links`). | Formatted all studio & tool entries as `[Tool Name](https://clipforge.vercel.app/tools/...)` markdown links. Lighthouse Agentic Browsing reached **100**. |

---

## 4. `QA-017` — Complete Breakdown of All 14 `npm audit` Vulnerabilities

Ran `npm audit fix --dry-run --json` (**without** `--force`): **`added: 0, changed: 0, removed: 0`**. No safe non-breaking upgrade exists for any of the 14 entries, so **zero breaking changes were applied**.

| # | Package | Severity | Ships at Runtime or Build/Dev-Only? | Safe Non-Breaking Upgrade? | Root Cause & Required Semver-Major Path |
| :-: | :--- | :--- | :--- | :---: | :--- |
| 1 | `zod` (`3.25.76`) | High | **Client Runtime** *(lazy chunk on `/tools/background-remover` only; validates internal library options, not untrusted user input)* | **No** | `GHSA-mrhx-c7xc-m3w5` (`<4.6.6`). `@imgly/background-removal@1.7.0` pins `zod@^3.x`. |
| 2 | `@imgly/background-removal` (`1.7.0`) | High | **Client Runtime** *(lazy chunk on `/tools/background-remover` only)* | **No** | Transitive parent of #1 (`zod`). `npm audit` only offers breaking downgrade to `1.1.5`. |
| 3 | `postcss` (`next/node_modules/postcss@8.4.31`) | High | **Build / Dev-Only** *(runs during `next build` on static project CSS; never runs on user requests or in browser; top-level `postcss` is already `8.5.33`)* | **No** | `GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q`, `GHSA-fxqj-rqcc-2cmp`, `GHSA-r28c-9q8g-f849` (`<=8.5.22`). Bundled inside `next@15.5.29`; requires `next@16.4.6` (major). |
| 4 | `next` (`15.5.29`) | Moderate | **Build / Dev-Only** *(flagged solely via internal build-time `postcss` #3)* | **No** | Transitive parent of #3 (`postcss`). Requires semver-major `next@16.4.6`. |
| 5 | `picomatch` (`2.3.2` & `4.0.7`) | High | **Build / Dev-Only** *(`devDependencies` via `tailwindcss@3.4.19`; 0 bytes ship to browser or server)* | **No** | `GHSA-fc5q-39xc-vjpf` (`<=4.0.7` ReDoS in extglobs). Requires `tailwindcss@4.3.5` (major). |
| 6 | `anymatch` (`3.1.3`) | High | **Build / Dev-Only** *(via `tailwindcss` → `chokidar`)* | **No** | Transitive parent of #5 (`picomatch@2.3.2`). Requires `tailwindcss@4.3.5` (major). |
| 7 | `chokidar` (`3.6.0`) | High | **Build / Dev-Only** *(via `tailwindcss` file watcher)* | **No** | Transitive parent of #5 (`picomatch@2.3.2`). Requires `tailwindcss@4.3.5` (major). |
| 8 | `fast-glob` (`3.x`) | High | **Build / Dev-Only** *(via `tailwindcss` content scanner)* | **No** | Transitive parent of #5 (`picomatch@2.3.2`). Requires `tailwindcss@4.3.5` (major). |
| 9 | `fdir` (`6.5.0`) | High | **Build / Dev-Only** *(via `tailwindcss` → `sucrase` → `tinyglobby`)* | **No** | Transitive parent of #5 (`picomatch@4.0.7`). Requires `tailwindcss@4.3.5` (major). |
| 10 | `micromatch` (`4.0.8`) | High | **Build / Dev-Only** *(via `tailwindcss` → `fast-glob`)* | **No** | Transitive parent of #5 (`picomatch@2.3.2`). Requires `tailwindcss@4.3.5` (major). |
| 11 | `readdirp` (`3.6.0`) | High | **Build / Dev-Only** *(via `tailwindcss` → `chokidar`)* | **No** | Transitive parent of #5 (`picomatch@2.3.2`). Requires `tailwindcss@4.3.5` (major). |
| 12 | `sucrase` (`3.35.1`) | High | **Build / Dev-Only** *(via `tailwindcss` TS config loader)* | **No** | Transitive parent of #5 (`picomatch@4.0.7`). Requires `tailwindcss@4.3.5` (major). |
| 13 | `tinyglobby` (`0.2.17`) | High | **Build / Dev-Only** *(via `tailwindcss` → `sucrase`)* | **No** | Transitive parent of #5 (`picomatch@4.0.7`). Requires `tailwindcss@4.3.5` (major). |
| 14 | `tailwindcss` (`3.4.19`) | High | **Build / Dev-Only** *(`devDependencies`; compiles static CSS at build time)* | **No** | Direct devDep pulling #5–#13. Final v3 release; requires semver-major migration to `tailwindcss@4.3.5`. |

**Risk Assessment:** 12 of 14 advisories are strictly **build/dev-only** (never ship to users or execute on requests). The remaining 2 (`@imgly/background-removal` → `zod`) are client-only on `/tools/background-remover` and do not validate attacker-controlled collections. Safe for launch; schedule Tailwind v4 / Next 16 migration in a planned post-launch upgrade branch.

---

## 5. Post-Fix Verification & Regression Test Results

### Lighthouse & Core Web Vitals (After All Fixes)

| Audit | Before Fixes | After Fixes | Target |
| :--- | :---: | :---: | :---: |
| **Mobile (`/`) — Accessibility** | 96 | **100** | Pass |
| **Mobile (`/`) — Best Practices** | 100 | **100** | Pass |
| **Mobile (`/`) — SEO** | 91 | **100** | Pass |
| **Mobile (`/`) — Agentic Browsing** | 67 | **100** | Pass |
| **Desktop (`/tools/audio-to-video`) — Accessibility** | 94 | **100** | Pass |
| **Desktop (`/tools/audio-to-video`) — Best Practices** | 100 | **100** | Pass |
| **Desktop (`/tools/audio-to-video`) — SEO** | 91 | **100** | Pass |
| **Desktop (`/tools/audio-to-video`) — Agentic Browsing** | 67 | **100** | Pass |
| **Performance Trace (`/` cold cache) — TTFB** | — | **17 ms** | Good (`< 800 ms`) |
| **Performance Trace (`/` cold cache) — LCP** | — | **276 ms** | Good (`< 2500 ms`) |
| **Performance Trace (`/` cold cache) — CLS** | — | **0.00** | Good (`< 0.10`) |

### All 3 Critical Regressions — Re-Verified Live on Final Build

1. **Critical #1 (`QA-001` — Pro Activation without `NEXT_PUBLIC_POLAR_ORG_ID`):**
   - Submitted `123456` in `#clipforge-license-input` → **PASS (`bypassBlocked: true`)**. Displayed `"License verification is not configured on this deployment yet. Set NEXT_PUBLIC_POLAR_ORG_ID to enable activation."` and `localStorage.clipforge_pro_annual` remained unset.
2. **Critical #2 (`QA-002` — Audio-to-Video Export + Double-Click Guard):**
   - Synthesized 1.2s 440Hz WAV on `/tools/audio-to-video`, rapidly double-clicked **Render Live Waveform Video** → **PASS (`Download Video (146 KB)`, `0` errors)**.
3. **Critical #3 (`QA-003` — Passport 4×6 Print Sheets, Zero Clipping):**
   - Exercised `exportPrintSheet()` on `/tools/passport-photo` for all 3 countries and measured actual canvas bounding boxes on `1800×1200`:
     - **India/EU/UK:** 8 photos, `77,982 B` JPEG, bounds `[38..1762] × [57..1143]` → **PASS (`fitsZeroClip: true`)**.
     - **United States:** 6 photos, `64,468 B` JPEG, bounds `[0..1800] × [0..1200]` → **PASS (`fitsZeroClip: true`)**.
     - **Canada:** 2 photos, `37,989 B` JPEG, bounds `[298..1502] × [186..1013]` → **PASS (`fitsZeroClip: true`)**.

### Additional Live Checks Passed
- **Production Build:** `npm run build` compiled in 50s with **0 errors** (`15/15` static pages + `2` API routes).
- **Console Errors/Warnings:** **0** across `/`, `/tools/audio-to-video`, `/tools/passport-photo`, `/tools/image-studio`, and `/tools/audio-cutter`.
- **Branded 404 (`QA-010`):** `/nonexistent-404` and `/tools/does-not-exist` return HTTP `404` with `404 · PAGE NOT FOUND` and `Back to All Tools` link.
- **Open Graph & Twitter Tags (`QA-014`):** `og:title`, `og:site_name`, and `twitter:card` (`summary_large_image`) verified in `<head>`.
- **Empty Search State (`QA-015`):** Typing `zzzzzz-not-a-tool` displays `"No tools match"` and clicking **Reset Search & Filters** restores all 9 tools.
- **Mobile Drawer (`QA-016`):** At `375px`, opens `role="dialog" aria-modal="true"` with `1` Close button (and `0` hidden Close buttons on desktop), and closes cleanly on `Escape`.
- **Responsive Breakpoints:** Zero horizontal overflow verified at `320px`, `375px`, `768px`, `1024px`, and `1440px`.

---

## 6. What Could Not Be Tested & Why

1. **Live Polar.sh Checkout Redirect & Webhook Signature Verification:** Polar credentials are intentionally not populated in local `.env`; verify once configured in Vercel Production.
2. **Native Safari / iOS WebKit & Firefox Testing:** Local browser automation runs Chromium on Windows; spot-check Safari's `video/mp4` MediaRecorder fallback and iOS WASM memory ceiling on a real Apple device.
3. **First-Run `@imgly/background-removal` Model Download & Large (>200MB) Video WASM Stress Tests:** Full ~40MB ONNX download timing on low-RAM mobile hardware and 300MB+ 4K MP4 browser tab RAM ceilings were outside local automated fixtures.
