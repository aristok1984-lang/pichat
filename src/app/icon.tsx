import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#07111F',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="192"
          height="192"
          viewBox="-94 -94 188 188"
        >
          <rect x="-94" y="-94" width="188" height="188" fill="#07111F"/>
          <rect
            x="-90" y="-90" width="180" height="180"
            fill="none" stroke="#FFFFFF" stroke-width="4"
            shape-rendering="geometricPrecision"
          />
          <circle
            cx="0" cy="0" r="82"
            fill="none" stroke="#FFFFFF" stroke-width="3.5"
            shape-rendering="geometricPrecision"
          />
          <path
            d="M -28 -45 L -28 45 M 28 -45 L 28 45 M -48 -45 L 48 -45"
            fill="none"
            stroke="#FFFFFF"
            stroke-width="6"
            stroke-linecap="square"
            stroke-linejoin="miter"
            shape-rendering="geometricPrecision"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
