import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt =
  'VectorEnglish — ELPAC exam prep for Air Traffic Controllers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#090b10',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Amber glow */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '800px',
          height: '400px',
          borderRadius: '50%',
          background: 'rgba(244, 196, 107, 0.18)',
          filter: 'blur(80px)',
        }}
      />

      {/* Badge */}
      <div
        style={{
          display: 'flex',
          border: '1px solid rgba(244, 196, 107, 0.25)',
          borderRadius: '9999px',
          padding: '8px 20px',
          marginBottom: '36px',
          fontSize: '14px',
          letterSpacing: '0.18em',
          color: 'rgba(244, 196, 107, 0.75)',
          textTransform: 'uppercase',
        }}
      >
        ELPAC Exam Prep · ATC Only
      </div>

      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          marginBottom: '28px',
        }}
      >
        <span
          style={{
            fontSize: '72px',
            fontWeight: 700,
            color: '#f4c46b',
            letterSpacing: '-1px',
          }}
        >
          Vector
        </span>
        <span
          style={{
            fontSize: '72px',
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-1px',
          }}
        >
          English
        </span>
        <span
          style={{
            fontSize: '72px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: '-1px',
          }}
        >
          .io
        </span>
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: '24px',
          color: 'rgba(255,255,255,0.50)',
          textAlign: 'center',
          maxWidth: '680px',
          lineHeight: 1.5,
        }}
      >
        Ace your ELPAC. Train with realistic ATC scenarios, scored like the real
        exam.
      </div>
    </div>,
    { ...size },
  );
}
