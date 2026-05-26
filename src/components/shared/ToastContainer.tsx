'use client';
import { X, Star } from 'lucide-react';
import type { Toast } from '@/src/types';

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export default function ToastContainer({ toasts, onDismiss }: Props) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2" style={{ maxWidth: 380 }}>
      {toasts.map(t => (
        <div key={t.id} className="flex items-start gap-3 px-4 py-3 bg-gray-900 text-white rounded-xl shadow-2xl text-sm">
          {t.star && <Star className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ fill: '#facc15', color: '#facc15' }} />}
          <span className="flex-1 leading-snug">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="flex-shrink-0 text-gray-400 hover:text-white transition-colors ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
