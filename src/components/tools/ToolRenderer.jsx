'use client';

import React from 'react';
import { BackgroundRemoverTool } from './BackgroundRemoverTool';
import { CompressVideoTool } from './CompressVideoTool';
import { TrimVideoTool } from './TrimVideoTool';
import { Mp4ToGifTool } from './Mp4ToGifTool';
import { ExtractAudioTool } from './ExtractAudioTool';
import { AudioCutterTool } from './AudioCutterTool';
import { AudioToVideoTool } from './AudioToVideoTool';
import { ImageStudioTool } from './ImageStudioTool';
import { PassportPhotoTool } from './PassportPhotoTool';
import { VideoConverterTool } from './VideoConverterTool';

export function ToolRenderer({ slug }) {
  switch (slug) {
    case 'background-remover':
      return <BackgroundRemoverTool />;
    case 'compress-video':
      return <CompressVideoTool />;
    case 'trim-video':
      return <TrimVideoTool />;
    case 'mp4-to-gif':
      return <Mp4ToGifTool />;
    case 'video-converter':
      return <VideoConverterTool />;
    case 'extract-audio':
      return <ExtractAudioTool />;
    case 'audio-cutter':
      return <AudioCutterTool />;
    case 'audio-to-video':
      return <AudioToVideoTool />;
    case 'image-studio':
      return <ImageStudioTool />;
    case 'passport-photo':
      return <PassportPhotoTool />;
    default:
      return null;
  }
}
