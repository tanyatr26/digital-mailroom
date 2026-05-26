'use client';
import { useState } from 'react';
import { X, Check, Printer, RotateCcw, CheckCircle2 } from 'lucide-react';
import type { EnvelopeDoc } from '@/src/types';

// Confirmation step shown immediately after the worker prints labels.
// Lists what just printed and offers a Reprint affordance for any items
// that came out wrong (paper jam, smudge, misalignment, etc.). Default
// "Looks good" continues the flow.
interface Props {
  items: EnvelopeDoc[];
  folderNameMap: Record<string, string>;
  onReprint: (items: EnvelopeDoc[]) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export default function PrintConfirmationModal({ items, folderNameMap, onReprint, onConfirm, onClose }: Props) {
  // Track which items the worker has flagged for reprint. Default empty so
  // "Looks good" is the expected primary action.
  const [reprintIds, setReprintIds] = useState<Set<string>>(() => new Set());
  const toggle = (docId: string) => setReprintIds(prev => {
    const next = new Set(prev);
    if (next.has(docId)) next.delete(docId); else next.add(docId);
    return next;
  });
  const reprintCount = reprintIds.size;

  const fireReprint = () => {
    if (reprintCount === 0) return;
    const picks = items.filter(it => reprintIds.has(it.doc.id));
    onReprint(picks);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 560, maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Labels sent to printer</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {items.length} label{items.length !== 1 ? 's' : ''} printed. Check the output and flag anything that came out wrong.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 bg-slate-50">
          {items.map(it => {
            const folderId = it.doc.dispatchedTo || it.doc.suggestion || '';
            const folderName = folderNameMap[folderId] || folderId || 'Unrouted';
            const selected = reprintIds.has(it.doc.id);
            return (
              <button key={it.doc.id} type="button" onClick={() => toggle(it.doc.id)}
                className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg border transition-all ${selected ? 'bg-amber-50 border-amber-300 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                <div className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${selected ? 'bg-amber-500 border-amber-500' : 'bg-white border-gray-300'}`}>
                  {selected && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{it.doc.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    <span className="font-mono">#{it.doc.docId}</span>
                    <span className="text-gray-300 mx-1.5">·</span>
                    to {folderName}
                    {it.doc.labelRecipient && <>
                      <span className="text-gray-300 mx-1.5">·</span>
                      Attn: {it.doc.labelRecipient}
                    </>}
                  </p>
                </div>
                <span className={`flex-shrink-0 text-[10px] uppercase tracking-wide font-semibold ${selected ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {selected ? 'Reprint' : 'OK'}
                </span>
              </button>
            );
          })}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-2 bg-white flex-shrink-0">
          <div className="text-xs text-gray-500">
            {reprintCount === 0
              ? 'Nothing flagged for reprint.'
              : reprintCount + ' label' + (reprintCount !== 1 ? 's' : '') + ' will be reprinted.'}
          </div>
          <div className="flex gap-2">
            <button onClick={fireReprint} disabled={reprintCount === 0}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${reprintCount === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'}`}>
              <RotateCcw className="w-3.5 h-3.5" /> Reprint{reprintCount > 0 ? ` ${reprintCount}` : ''}
            </button>
            <button onClick={onConfirm}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
              <Printer className="w-3.5 h-3.5" /> Looks good
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
