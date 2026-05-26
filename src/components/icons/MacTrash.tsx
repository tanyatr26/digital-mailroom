'use client';
import { useId } from 'react';

export default function MacTrash() {
  const uid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 128 104" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id={`tb${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#E5E7EB" />
          <stop offset="100%" stopColor="#9CA3AF" />
        </linearGradient>
      </defs>
      <rect x="56" y="14" width="16" height="6" rx="2" fill="#9CA3AF" />
      <rect x="28" y="20" width="72" height="10" rx="4" fill="#D1D5DB" stroke="#6B7280" strokeWidth=".5" />
      <path d="M34 32L94 32L88 98Q88 100 86 100L42 100Q40 100 40 98Z" fill={`url(#tb${uid})`} stroke="#6B7280" strokeWidth=".8" />
      {[50, 60, 68, 78].map(x => (
        <line key={x} x1={x} y1="38" x2={x + (x > 65 ? 1 : 0)} y2="95" stroke="#6B7280" strokeWidth=".8" opacity=".5" />
      ))}
    </svg>
  );
}
