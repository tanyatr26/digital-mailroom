'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import type { Document } from '@/src/types';

interface Props {
  doc: Document;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

const MIN_LEN = 10;

export default function ReturnModal({ doc, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const valid = trimmed.length >= MIN_LEN;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: 440 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Return to Mailroom</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[340px]">&quot;{doc.title}&quot;</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Return reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Explain why this document is being returned…"
            className="w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400 resize-none transition-colors"
          />
          <p className={`text-xs mt-1 ${valid ? 'text-emerald-600' : 'text-gray-400'}`}>
            {trimmed.length} / {MIN_LEN} minimum characters
          </p>
        </div>
        <div className="px-6 pb-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={() => valid && onConfirm(trimmed)}
            disabled={!valid}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm ${valid ? 'bg-gray-800 text-white hover:bg-gray-900' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            Return ↩
          </button>
        </div>
      </div>
    </div>
  );
}
