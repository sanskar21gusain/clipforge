import { ImageResponse } from 'next/og';

export const alt = 'ClipForge — Free On-Device Video, Audio & Photo Studio';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc',
          padding: '56px 64px',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: '#0f172a',
          position: 'relative',
        }}
      >
        {/* Top Row: Brand + Privacy Pill */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                fontWeight: 800,
              }}
            >
              CF
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.03em' }}>
                <span>Clip</span>
                <span style={{ color: '#2563eb' }}>Forge</span>
              </div>
              <div style={{ fontSize: '16px', color: '#475569', fontWeight: 600 }}>
                Video, Audio &amp; Photo Studio
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#ecfdf5',
              border: '2px solid #a7f3d0',
              color: '#065f46',
              borderRadius: '999px',
              padding: '10px 22px',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '999px',
                backgroundColor: '#059669',
              }}
            />
            <span>100% On-Device - Zero Uploads</span>
          </div>
        </div>

        {/* Center Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '980px' }}>
          <div
            style={{
              fontSize: '60px',
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: '-0.035em',
              color: '#0f172a',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span>Fast, Private Media Tools</span>
            <span style={{ color: '#2563eb' }}>Right in Your Browser.</span>
          </div>
          <div style={{ fontSize: '23px', color: '#475569', lineHeight: 1.4, fontWeight: 500 }}>
            AI Background Remover | Video Compress &amp; Trim | MP4 to GIF | Audio Waveform Videos | Exact-KB Images | 300 DPI Passport Sheets
          </div>
        </div>

        {/* Bottom Tool Category Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '2px solid #e2e8f0',
            paddingTop: '24px',
          }}
        >
          <div style={{ display: 'flex', gap: '14px' }}>
            {[
              { label: 'Video Tools', bg: '#eff6ff', border: '#bfdbfe', fg: '#1d4ed8' },
              { label: 'Audio Tools', bg: '#eef2ff', border: '#c7d2fe', fg: '#4338ca' },
              { label: 'Photo Tools', bg: '#ecfdf5', border: '#a7f3d0', fg: '#065f46' },
            ].map((pill) => (
              <div
                key={pill.label}
                style={{
                  backgroundColor: pill.bg,
                  border: `2px solid ${pill.border}`,
                  color: pill.fg,
                  borderRadius: '12px',
                  padding: '8px 18px',
                  fontSize: '18px',
                  fontWeight: 700,
                }}
              >
                {pill.label}
              </div>
            ))}
          </div>

          <div style={{ fontSize: '20px', fontWeight: 700, color: '#334155' }}>
            clipforge.cv
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
