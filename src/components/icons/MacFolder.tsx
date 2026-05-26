'use client';
import { useId } from 'react';

export default function MacFolder() {
  const uid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 128 104" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id={`fb${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#4A8FE3" />
          <stop offset="100%" stopColor="#2B6FBF" />
        </linearGradient>
        <linearGradient id={`ff${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#7DB7F0" />
          <stop offset="100%" stopColor="#4D8EDF" />
        </linearGradient>
        <linearGradient id={`fs${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="white" stopOpacity=".45" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M8 24Q8 14 18 14L44 14Q48 14 51 17L57 24L110 24Q120 24 120 34L120 90Q120 100 110 100L18 100Q8 100 8 90Z" fill={`url(#fb${uid})`} />
      <path d="M8 36L120 36L120 90Q120 100 110 100L18 100Q8 100 8 90Z" fill={`url(#ff${uid})`} />
      <path d="M8 36L120 36L120 46L8 46Z" fill={`url(#fs${uid})`} />
    </svg>
  );
}
