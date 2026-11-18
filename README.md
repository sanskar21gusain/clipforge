# ClipForge — Browser Video, Audio & Photo Studio

ClipForge is a bright, privacy-first browser media studio built with **Next.js 15 (App Router)**, **React 19**, **Tailwind CSS**, **FFmpeg.wasm**, **`@imgly/background-removal`**, **Web Audio API**, **HTML5 Canvas**, **JSZip**, and **Polar.sh** annual subscriptions (`$29/year`).

All media processing runs locally inside the user's browser tab with zero server-side file uploads.

## Included Tools
- **AI Background Remover** (`/tools/background-remover`) — On-device neural segmentation with transparent PNG & solid backdrop export.
- **Compress Video to Size** (`/tools/compress-video`) — Target 8MB Discord, 16MB WhatsApp, 25MB Email, or custom MB via FFmpeg.wasm.
- **Video Trimmer & Cutter** (`/tools/trim-video`) — Instant lossless stream-copy (`-c copy`) or frame-accurate H.264 re-encoding.
- **MP4 to Animated GIF** (`/tools/mp4-to-gif`) — Two-pass custom palette (`palettegen`/`paletteuse`) GIF converter.
- **MOV & WebM to MP4 Converter** (`/tools/video-converter`) — Convert MOV/WebM/MKV to universal H.264 MP4 with 9:16, 1:1, and 16:9 social presets.
- **Video Frame & Thumbnail Extractor** (`/tools/video-frames`) — Scrub to exact frame timestamps for instant full-res PNG export, plus Pro batch ZIP extraction.
- **Extract or Mute Audio** (`/tools/extract-audio`) — Extract 192 kbps MP3 / lossless WAV or mute videos without re-encoding.
- **Audio Cutter & Volume Booster** (`/tools/audio-cutter`) — Live waveform scrubber, fade-in/out, volume boost up to 300%, MP3/WAV export.
- **Audio to Waveform Video** (`/tools/audio-to-video`) — Real-time animated audiogram video (`16:9`, `1:1`, `9:16`).
- **Image Studio & Compress to KB** (`/tools/image-studio`) — Batch JPG/PNG/WebP conversion, EXIF stripping, exact-KB binary search, ZIP download.
- **Passport & ID Photo Maker** (`/tools/passport-photo`) — Official India/UK/EU, US, and Canada 300 DPI sizing + 4×6 printable sheet.
- **Blur & Redact Photo** (`/tools/blur-redact`) — Irreversible Canvas blur, pixelate, and solid black-box redaction with EXIF/GPS stripped on export.

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3030](http://localhost:3030).

### Production Build

```bash
npm run build
npm run start
```

## Environment Variables (Polar.sh Annual Pro)

Copy `.env.example` and configure these variables in `.env.local` (for local testing) and in **Vercel Project Settings → Environment Variables** (for production):

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `POLAR_ACCESS_TOKEN` | Server | Polar Organization Access Token (`polar_oat_...`) |
| `POLAR_WEBHOOK_SECRET` | Server | Polar webhook signing secret for `/api/webhook/polar` |
| `POLAR_SERVER` | Server | `production` (default) or `sandbox` |
| `NEXT_PUBLIC_POLAR_ORG_ID` | Client | Polar Organization ID used for Customer Portal license key validation |
| `NEXT_PUBLIC_POLAR_ANNUAL_PRODUCT_ID` | Client + Server | Polar Annual Pro (`$29/year`) Product ID allowlisted by `/api/checkout` |

## Deployment (Vercel)

1. Push the repository to GitHub or run `vercel` from the project directory.
2. Add the 5 Polar environment variables above for the **Production** environment in Vercel.
3. Point your Polar webhook endpoint to `https://<your-domain>/api/webhook/polar` (listening for `order.paid` and `customer.state_changed`).
4. Trigger a production build and verify one checkout + license key activation flow.
