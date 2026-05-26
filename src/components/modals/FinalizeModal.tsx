'use client';
import { Check, Printer } from 'lucide-react';
import MacFolder from '@/src/components/icons/MacFolder';
import MacTrash from '@/src/components/icons/MacTrash';

interface FolderSummary { id: string; name: string; pages: number }

interface Props {
  summary: FolderSummary[];
  total: number;
  labelsPrinted: number;
  onClose: () => void;
}

export default function FinalizeModal({ summary, total, labelsPrinted, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-8 text-center bg-gradient-to-b from-emerald-50 to-white">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Dispatch Complete</h2>
          <p className="text-sm text-gray-500 mt-1">{total} page{total !== 1 ? 's' : ''} routed across {summary.length} folder{summary.length !== 1 ? 's' : ''}</p>
          {labelsPrinted > 0 && (
            <p className="text-xs text-blue-600 mt-1 inline-flex items-center gap-1">
              <Printer className="w-3 h-3" /> {labelsPrinted} physical label{labelsPrinted !== 1 ? 's' : ''} printed
            </p>
          )}
        </div>
        <div className="px-6 pb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Dispatch summary</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {summary.map(folder => (
              <div key={folder.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex-shrink-0" style={{ opacity: folder.id === 'junk' ? 0.7 : 1 }}>
                    {folder.id === 'junk' ? <MacTrash /> : <MacFolder />}
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{folder.name}</p>
                </div>
                <span className="text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-lg px-2.5 py-1 shadow-sm">{folder.pages} pg</span>
              </div>
            ))}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <p className="text-xs text-gray-400">Review complete — ready to finalize</p>
          <button onClick={onClose} className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm">Done</button>
        </div>
      </div>
    </div>
  );
}
