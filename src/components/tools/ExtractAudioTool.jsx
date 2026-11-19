'use client';

import React, { useState } from 'react';
import { Download, Loader2, RefreshCw, Music, VolumeX } from 'lucide-react';
import { Dropzone } from '../Dropzone';
import { getFFmpeg, clearFFmpegProgress, fileToUint8Array, uint8ToBlob } from '../../lib/ffmpegClient';
import { formatBytes, downloadBlob, baseName } from '../../lib/format';

const MAX_VIDEO_BYTES = 400 * 1024 * 1024; // 400 MB in-browser safety limit

export function ExtractAudioTool() {
  const [file, setFile] = useState(null);
  const [action, setAction] = useState('mp3'); // 'mp3' | 'wav' | 'mute'
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputBlob, setOutputBlob] = useState(null);
  const [outputExt, setOutputExt] = useState('mp3');
  const [error, setError] = useState('');

  const handleRun = async () => {
    if (!file) return;
    setProcessing(true);
    setError('');
    setOutputBlob(null);
    setProgress(10);

    try {
      const ffmpeg = await getFFmpeg((pct) => setProgress(Math.max(15, pct)));
      const inExt = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      const inName = `source.${inExt}`;
      await ffmpeg.writeFile(inName, await fileToUint8Array(file));

      let outName = 'extracted.mp3';
      let mime = 'audio/mpeg';
      let args = [];

      if (action === 'mp3') {
        outName = 'extracted.mp3';
        mime = 'audio/mpeg';
        args = ['-i', inName, '-vn', '-acodec', 'libmp3lame', '-b:a', '192k', outName];
      } else if (action === 'wav') {
        outName = 'extracted.wav';
        mime = 'audio/wav';
        args = ['-i', inName, '-vn', '-acodec', 'pcm_s16le', outName];
      } else {
        const isWebm = inExt === 'webm';
        outName = isWebm ? 'muted.webm' : 'muted.mp4';
        mime = isWebm ? 'video/webm' : 'video/mp4';
        args = ['-i', inName, '-c:v', 'copy', '-an', outName];
      }

      const exitCode = await ffmpeg.exec(args);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg exited with code ${exitCode}`);
      }
      const data = await ffmpeg.readFile(outName);
      setOutputBlob(uint8ToBlob(data, mime));
      setOutputExt(action === 'mute' ? (inExt === 'webm' ? 'webm' : 'mp4') : action);
      setProgress(100);

      await ffmpeg.deleteFile(inName).catch(() => {});
      await ffmpeg.deleteFile(outName).catch(() => {});
    } catch (err) {
      console.error(err);
      setError('Could not process this media file. Ensure the video contains a valid track.');
    } finally {
      clearFFmpegProgress();
      setProcessing(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="video/*"
        maxBytes={MAX_VIDEO_BYTES}
        onFiles={(files) => {
          const f = files[0];
          if (!f) return;
          if (f.size === 0) {
            setError('This video file is empty (0 bytes). Please choose a valid video file.');
            return;
          }
          if (f.size > MAX_VIDEO_BYTES) {
            setError('This file exceeds 400 MB. Trim or shorten it first so your browser tab stays responsive.');
            return;
          }
          setFile(f);
          setOutputBlob(null);
          setError('');
        }}
        title="Drop a video to extract audio or mute it"
        subtitle="Extract MP3 (192kbps), lossless WAV, or remove audio without touching video quality."
        allowPaste={false}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-canvas-300 bg-canvas-100 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="truncate text-sm font-bold text-ink-900">{file.name}</span>
          <span className="rounded-md border border-canvas-300 bg-white px-2 py-0.5 text-xs font-mono text-ink-500">
            {formatBytes(file.size)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setFile(null);
            setOutputBlob(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-200 px-3 py-1.5 text-xs font-semibold text-ink-700 cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>Change File</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { id: 'mp3', title: 'Extract MP3 Audio', desc: '192 kbps universal MP3 track', icon: Music },
          { id: 'wav', title: 'Extract Lossless WAV', desc: 'Uncompressed studio PCM audio', icon: Music },
          { id: 'mute', title: 'Remove Audio (Mute)', desc: 'Lossless silent MP4 (-c:v copy)', icon: VolumeX },
        ].map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setAction(opt.id);
                setOutputBlob(null);
              }}
              className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                action === opt.id
                  ? 'border-blue-600 bg-blue-50/70'
                  : 'border-canvas-300 bg-white hover:bg-canvas-100'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-bold text-ink-900">
                <Icon size={16} className="text-blue-600" />
                <span>{opt.title}</span>
              </div>
              <p className="mt-1 text-xs text-ink-500">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={processing}
          onClick={handleRun}
          className="inline-flex items-center gap-2 rounded-xl bg-ink-900 hover:bg-ink-700 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white cursor-pointer"
        >
          {processing && <Loader2 size={15} className="animate-spin" />}
          <span>
            {processing
              ? `Processing (${progress}%)...`
              : action === 'mute'
                ? 'Strip Audio from Video'
                : `Extract ${action.toUpperCase()} Audio`}
          </span>
        </button>

        {outputBlob && (
          <button
            type="button"
            onClick={() =>
              downloadBlob(
                outputBlob,
                `${baseName(file.name)}-${action === 'mute' ? 'muted' : 'audio'}.${outputExt}`
              )
            }
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm cursor-pointer"
          >
            <Download size={15} />
            <span>Download .{outputExt.toUpperCase()} ({formatBytes(outputBlob.size)})</span>
          </button>
        )}
      </div>
    </div>
  );
}
