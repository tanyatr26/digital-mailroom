'use client';
import { useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import type { Document, Envelope, Folder } from '@/src/types';
import { deriveDocType } from '@/src/lib/utils';

interface Props {
  doc: Document;
  envelope: Envelope;
  folders: Folder[];
  counts: Record<string, number>;
  folderNameMap: Record<string, string>;
  onConfirm: (data: { selectedFolder: string; docType: string }) => void;
  onClose: () => void;
}

export default function TrustedRouteModal({ doc, envelope, folders, counts, folderNameMap, onConfirm, onClose }: Props) {
  const [selectedFolder, setSelectedFolder] = useState(doc.suggestion || folders[0]?.id || '');
  const docType = deriveDocType(doc.title, doc.suggestion);
  const destName = folderNameMap[selectedFolder] || folders.find(f => f.id === selectedFolder)?.name || (selectedFolder === 'junk' ? 'Junk' : selectedFolder);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-base font-semibold text-gray-900">Mark routing pattern as Trusted</h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">All future documents matching this pattern will route automatically to <span className="font-semibold text-gray-700">{destName}</span>. You can revoke this from the Trusted Routes panel at any time.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-3">
            <p className="text-gray-400 uppercase tracking-widest font-semibold" style={{ fontSize: 10 }}>Pattern</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 uppercase tracking-wide mb-0.5" style={{ fontSize: 10 }}>Sender</p>
                <p className="text-sm font-medium text-gray-900 truncate">{envelope.sender}</p>
              </div>
              <div>
                <p className="text-gray-400 uppercase tracking-wide mb-0.5" style={{ fontSize: 10 }}>Document type</p>
                <p className="text-sm font-medium text-gray-900">{docType}</p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Always route to:</label>
            <div className="relative">
              <select value={selectedFolder} onChange={e => setSelectedFolder(e.target.value)} className="w-full appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-blue-400 bg-white">
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}{(counts[f.id] || 0) > 0 ? ' — ' + counts[f.id] + ' pg queued' : ''}</option>
                ))}
                <option value="junk">Junk</option>
              </select>
              <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 w-3.5 h-3.5 text-gray-400" style={{ transform: 'translateY(-50%) rotate(90deg)' }} />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={() => onConfirm({ selectedFolder, docType })} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">Mark as Trusted</button>
        </div>
      </div>
    </div>
  );
}
