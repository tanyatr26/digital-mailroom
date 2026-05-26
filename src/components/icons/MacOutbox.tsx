'use client';
import { useId } from 'react';

// "Return upstream" target. Same 3D macOS folder silhouette as MacFolder
// so it slots into the right panel without a stylistic mismatch, retinted
// amber and overlaid with a curved-back arrow on the front face to read
// as "return" instead of "route to".
export default function MacOutbox() {
  const uid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 128 104" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        {/* Back panel + tab gradient (deeper amber, sits behind the front face) */}
        <linearGradient id={`rb${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#E08A1F" />
          <stop offset="100%" stopColor="#B36316" />
        </linearGradient>
        {/* Front face gradient (lighter amber, matches the folder front-face brightness) */}
        <linearGradient id={`rf${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#E08A1F" />
        </linearGradient>
        {/* Top sheen — matches MacFolder's highlight band */}
        <linearGradient id={`rs${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="white" stopOpacity=".45" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Back panel + tab (identical geometry to MacFolder for shape parity) */}
      <path d="M8 24Q8 14 18 14L44 14Q48 14 51 17L57 24L110 24Q120 24 120 34L120 90Q120 100 110 100L18 100Q8 100 8 90Z" fill={`url(#rb${uid})`} />
      {/* Front face */}
      <path d="M8 36L120 36L120 90Q120 100 110 100L18 100Q8 100 8 90Z" fill={`url(#rf${uid})`} />
      {/* Top sheen band */}
      <path d="M8 36L120 36L120 46L8 46Z" fill={`url(#rs${uid})`} />
      {/* Fishhook return arrow (mirrors the Unicode ↩ glyph). Vertical stem
          on the right, a 90° rounded turn at the bottom, a short horizontal
          stretch heading left, and a sharp angular arrowhead pointing left.
          Solid white, single consistent stroke weight, sized ~34% × 50% of
          the front face and centered. */}
      <g>
        <path
          d="M 82 52 L 82 66 Q 82 76 72 76 L 58 76"
          fill="none"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polygon points="40,76 60,65 60,87" fill="white" />
      </g>
    </svg>
  );
}
