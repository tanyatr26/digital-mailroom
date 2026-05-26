'use client';
import { useState } from 'react';
import { X, Printer } from 'lucide-react';
import type { Document, Envelope, Folder, LabelData } from '@/src/types';
import { formatLabelDate } from '@/src/lib/utils';
import RecipientCombobox from '@/src/components/shared/RecipientCombobox';
import LabelPreview from '@/src/components/shared/LabelPreview';

interface Props {
  doc: Document;
  envelope: Envelope;
  folder: Folder | null;
  allRecipients: string[];
  folderName: string;
  onPrint: (envelopeId: string, doc: Document, data: LabelData) => void;
  onSkip: (envelopeId: string, doc: Document) => void;
  onClose: () => void;
  onPreviewDoc?: () => void;
}

export default function LabelPrintModal({ doc, envelope, folder, allRecipients, folderName, onPrint, onSkip, onClose, onPreviewDoc }: Props) {
  const [recipient, setRecipient] = useState(doc.labelRecipient || '');
  const today = formatLabelDate();
  const isReprint = doc.labelStatus === 'printed';
  const isAi = doc.labelStatus === 'ai_suggested';

  const handlePrint = () => onPrint(envelope.id, doc, {
    labelStatus: 'printed',
    labelDate: today,
    labelRecipient: recipient.trim(),
    labelRoute: folder?.id || doc.suggestion || '',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
              <Printer className="w-4 h-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900">
                {isReprint ? 'Reprint physical label' : isAi ? 'AI suggests a physical label' : 'Print physical label'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {isAi ? 'Similar documents have required hard copies. Confirm to print.' : 'A 6-digit ID will be printed and applied to the physical document.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Preview</p>
            <div className="flex justify-center bg-slate-100 rounded-xl p-5">
              <LabelPreview docId={doc.docId} date={today} folderName={folderName} recipient={recipient.trim()} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Recipient (optional)</label>
            <RecipientCombobox value={recipient} onChange={setRecipient} suggestions={allRecipients} placeholder="Type a name or pick from list…" autoFocus={!recipient} />
            <p className="text-xs text-gray-400 mt-1">Defaults to the destination folder admin. Override with the specific recipient if known.</p>
          </div>
          {onPreviewDoc ? (
            <button onClick={onPreviewDoc} className="w-full text-left text-xs text-gray-500 bg-gray-50 border border-gray-200 hover:border-blue-300 hover:bg-blue-50 rounded-lg px-3 py-2 flex items-start gap-2 transition-colors group">
              <div className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0 group-hover:bg-blue-400" />
              <span>Doc <span className="font-mono">#{doc.docId}</span> · from <span className="font-medium">{envelope.sender}</span> · {doc.pages} page{doc.pages !== 1 ? 's' : ''}{doc.dispatchedTo ? ' · already dispatched' : ''} <span className="text-blue-500 group-hover:underline ml-1">Preview →</span></span>
            </button>
          ) : (
            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
              <span>Doc <span className="font-mono">#{doc.docId}</span> · from <span className="font-medium">{envelope.sender}</span> · {doc.pages} page{doc.pages !== 1 ? 's' : ''}{doc.dispatchedTo ? ' · already dispatched' : ''}</span>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          {isAi
            ? <button onClick={() => onSkip(envelope.id, doc)} className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">No label needed</button>
            : <span />
          }
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              <Printer className="w-3.5 h-3.5" /> {isReprint ? 'Reprint label' : 'Print label'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
