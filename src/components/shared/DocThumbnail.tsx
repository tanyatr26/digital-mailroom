'use client';
import { Eye } from 'lucide-react';

interface Props {
  pages: number;
  // When provided, the thumbnail becomes the preview trigger — clicking it
  // fires onPreview and on hover it overlays a translucent "Preview" affordance.
  onPreview?: () => void;
}

export default function DocThumbnail({ pages, onPreview }: Props) {
  const interactive = !!onPreview;
  return (
    <div className={`relative flex-shrink-0 group/thumb ${interactive ? 'cursor-pointer' : ''}`}
      style={{ width: 56, height: 72 }}
      onMouseDown={e => { if (interactive) e.stopPropagation(); }}
      onClick={e => { if (interactive) { e.stopPropagation(); onPreview!(); } }}>
      {pages > 2 && <div className="absolute bg-white border border-gray-200 rounded shadow-sm" style={{ width: 56, height: 72, top: 4, left: 4 }} />}
      {pages > 1 && <div className="absolute bg-white border border-gray-200 rounded shadow-sm" style={{ width: 56, height: 72, top: 2, left: 2 }} />}
      <div className="relative bg-white border border-gray-300 rounded shadow-sm p-2 overflow-hidden" style={{ width: 56, height: 72 }}>
        <div className="space-y-1">
          {[75, 100, 65, 100, 80, 50, 100].map((w, i) => (
            <div key={i} className="bg-gray-200 rounded-full" style={{ height: 2, width: w + '%' }} />
          ))}
        </div>
        {interactive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover/thumb:opacity-100 transition-opacity"
            style={{ backgroundColor: 'rgba(31,41,55,0.65)' }}>
            <Eye className="w-3.5 h-3.5 text-white" />
            <span className="text-[10px] font-semibold text-white uppercase tracking-wide">Preview</span>
          </div>
        )}
      </div>
    </div>
  );
}
