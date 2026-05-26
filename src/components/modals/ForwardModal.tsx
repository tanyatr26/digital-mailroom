'use client';
import { useState } from 'react';
import { X, Forward as ForwardIcon } from 'lucide-react';
import type { Document, Folder } from '@/src/types';

interface Props {
  doc: Document;
  parentFolderName: string;          // The folder the doc currently lives in (shown in destination's "Forwarded from" indicator)
  destinationOptions: Folder[];      // Child folders the current admin owns
  onConfirm: (data: { destinationFolderId: string; note: string }) => void;
  onClose: () => void;
}

// V2 Brief §13 — Forward creates a copy. Only allowed to child folders the
// admin owns. Note is required.
export default function ForwardModal({ doc, parentFolderName, destinationOptions, onConfirm, onClose }: Props) {
  const [destinationFolderId, setDestinationFolderId] = useState(destinationOptions[0]?.id ?? '');
  const [note, setNote] = useState('');
  const ok = destinationFolderId && note.trim().length > 0;

  const handleSubmit = () => {
    if (!ok) return;
    onConfirm({ destinationFolderId, note: note.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
              <ForwardIcon className="w-4 h-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900">Forward a copy</h2>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                Doc #{doc.docId || doc.id} · {doc.title}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Destination</label>
            {destinationOptions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No child folders yet. Create one before forwarding.</p>
            ) : (
              <select value={destinationFolderId} onChange={e => setDestinationFolderId(e.target.value)}
                className="w-full appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-blue-400 bg-white">
                {destinationOptions.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-gray-400 mt-1">
              Forward creates a copy. The original stays in {parentFolderName}.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Reason / note <span className="text-red-500">*</span>
            </label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Why is this being forwarded?"
              className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400 resize-none" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={!ok}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors ${ok ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
            <ForwardIcon className="w-3.5 h-3.5" /> Forward
          </button>
        </div>
      </div>
    </div>
  );
}
