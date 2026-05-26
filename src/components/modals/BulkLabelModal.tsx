'use client';
import { useState } from 'react';
import { X, Printer, Check } from 'lucide-react';
import type { Folder, BulkLabelUpdate, EnvelopeDoc } from '@/src/types';
import { formatLabelDate } from '@/src/lib/utils';
import { DEPT_DOTS } from '@/src/lib/constants';
import RecipientCombobox from '@/src/components/shared/RecipientCombobox';

interface Props {
  items: EnvelopeDoc[];
  folders: Folder[];
  allRecipients: string[];
  title?: string;
  folderNameMap: Record<string, string>;
  onConfirm: (updates: BulkLabelUpdate[]) => void;
  onClose: () => void;
}

export default function BulkLabelModal({ items, allRecipients, title, folderNameMap, onConfirm, onClose }: Props) {
  const today = formatLabelDate();
  const [includeMap, setIncludeMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    items.forEach(it => { m[it.doc.id] = true; });
    return m;
  });
  const [recipientMap, setRecipientMap] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    items.forEach(it => { m[it.doc.id] = it.doc.labelRecipient || ''; });
    return m;
  });

  const includedCount = items.filter(it => includeMap[it.doc.id]).length;

  const handleConfirm = () => {
    const updates: BulkLabelUpdate[] = items.filter(it => includeMap[it.doc.id]).map(it => {
      const folderId = it.doc.dispatchedTo || it.doc.suggestion || '';
      return { envelopeId: it.envelope.id, docId: it.doc.id, labelStatus: 'printed', labelDate: today, labelRecipient: (recipientMap[it.doc.id] || '').trim(), labelRoute: folderId };
    });
    onConfirm(updates);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 600, maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0"><Printer className="w-4 h-4 text-blue-600" /></div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{title || 'Bulk print physical labels'}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{includedCount} of {items.length} selected</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
          {items.map(it => {
            const folderId = it.doc.dispatchedTo || it.doc.suggestion || '';
            const folderName = folderNameMap[folderId] || folderId || 'Unrouted';
            const dotColor = DEPT_DOTS[folderId] || '#64748b';
            const included = includeMap[it.doc.id];
            return (
              <div key={it.doc.id} className={`p-3 rounded-xl border transition-all ${included ? 'border-blue-200 bg-white shadow-sm' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                <div className="flex items-start gap-3">
                  <div onClick={() => setIncludeMap(prev => ({ ...prev, [it.doc.id]: !prev[it.doc.id] }))}
                    className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${included ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300 hover:border-blue-400'}`}>
                    {included && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 truncate">{it.doc.title}</p>
                      {it.doc.labelStatus === 'ai_suggested' && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">AI flag</span>}
                      {it.doc.labelStatus === 'printed' && <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Reprint</span>}
                    </div>
                    <div className="text-xs text-gray-700 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-medium">#{it.doc.docId}</span>
                      <span className="text-gray-300">·</span>
                      <span>from {it.envelope.sender}</span>
                      <span className="text-gray-300">·</span>
                      <span className="inline-flex items-center gap-1">
                        <div className="rounded-full" style={{ width: 6, height: 6, backgroundColor: dotColor }} />
                        to {folderName}
                      </span>
                    </div>
                    {included && (
                      <div className="mt-2">
                        <RecipientCombobox
                          value={recipientMap[it.doc.id] || ''}
                          onChange={v => setRecipientMap(prev => ({ ...prev, [it.doc.id]: v }))}
                          suggestions={allRecipients}
                          placeholder="Recipient (optional)"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-2 bg-white flex-shrink-0">
          <div className="text-xs text-gray-500">
            {includedCount === 0 ? 'No labels selected.' : includedCount + ' label' + (includedCount !== 1 ? 's' : '') + ' will be printed.'}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
            <button onClick={handleConfirm} disabled={includedCount === 0}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors ${includedCount === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              <Printer className="w-3.5 h-3.5" /> Print {includedCount} label{includedCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
