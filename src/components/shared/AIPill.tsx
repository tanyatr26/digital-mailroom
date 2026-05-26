'use client';
import { Sparkles, AlertTriangle, Scissors } from 'lucide-react';
import { COLORS } from '@/src/lib/constants';

interface Props {
  suggestion: string;
  confidence: number;
  manualRoute?: boolean;
  hideHighConfidence?: boolean;
  folderName: string;
}

export default function AIPill({ suggestion, confidence, manualRoute, hideHighConfidence, folderName }: Props) {
  const c = COLORS[suggestion] || COLORS.junk;

  if (manualRoute) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
        <Scissors className="w-3 h-3" />
        <span>Routes to: <span className="font-semibold">{folderName}</span></span>
        <span className="opacity-60">· split</span>
      </div>
    );
  }

  if (confidence >= 0.99) return null;

  if (confidence < 0.5) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border bg-red-50 text-red-700 border-red-200">
        <AlertTriangle className="w-3 h-3" />
        <span>AI uncertain · <span className="font-semibold">human review</span> · {Math.round(confidence * 100)}%</span>
      </div>
    );
  }

  if (confidence < 0.8) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border bg-amber-50 text-amber-800 border-amber-300">
        <AlertTriangle className="w-3 h-3" />
        <span>Review · {Math.round(confidence * 100)}%</span>
      </div>
    );
  }

  if (hideHighConfidence) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      <Sparkles className="w-3 h-3" />
      <span>{Math.round(confidence * 100)}%</span>
    </div>
  );
}
