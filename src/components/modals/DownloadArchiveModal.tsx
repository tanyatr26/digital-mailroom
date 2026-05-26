'use client';
import { X, Download, FileText, AlertTriangle } from 'lucide-react';
import type { EnvelopeDoc } from '@/src/types';

interface Props {
  items: EnvelopeDoc[];
  onConfirm: () => void;
  onClose: () => void;
}

// V2 changelog — simple Download & Archive confirmation. No form fields, no
// structured fields, no audit-note requirement logic. Batch ZIP all queued
// docs, archive them, drop them from the inbox.
export default function DownloadArchiveModal({ items, onConfirm, onClose }: Props) {
  const n = items.length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: 560, maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900">Download &amp; Archive</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {n} document{n !== 1 ? 's' : ''} ready to bundle and archive.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {n === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-6">No documents queued.</p>
          ) : (
            <ul className="space-y-1.5">
              {items.map(({ doc, envelope }) => (
                <li key={doc.id} className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg">
                  <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{doc.title}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      <span className="font-mono">#{doc.docId || doc.id.slice(0, 6)}</span>
                      <span className="text-gray-300 mx-1.5">·</span>
                      {doc.pages} page{doc.pages !== 1 ? 's' : ''}
                      <span className="text-gray-300 mx-1.5">·</span>
                      from {envelope.sender}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-amber-50 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            Downloaded as a ZIP and archived. Cannot be undone.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={n === 0}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors ${n === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
            Download &amp; Archive ({n}) <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
