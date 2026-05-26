'use client';
import type { Document, Envelope } from '@/src/types';

interface Props {
  doc: Document;
  envelope: Envelope;
  onJustThis: (envelopeId: string, doc: Document) => void;
  onUndoAndRevoke: (envelopeId: string, doc: Document) => void;
  onClose: () => void;
}

export default function UndoAutoRouteModal({ doc, envelope, onJustThis, onUndoAndRevoke, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5">
          <h3 className="text-base font-semibold text-gray-900 mb-1.5">Undo trusted auto-route?</h3>
          <p className="text-sm text-gray-500 leading-relaxed"><span className="font-medium text-gray-700">"{doc.title}"</span> was automatically routed via a trusted rule. Choose how to undo:</p>
        </div>
        <div className="px-6 pb-4 flex flex-col gap-2">
          <button onClick={() => onJustThis(envelope.id, doc)} className="w-full flex items-start px-4 py-3 border border-gray-200 rounded-xl text-left hover:bg-gray-50 transition-colors">
            <div>
              <p className="text-sm font-semibold text-gray-900">Just this one</p>
              <p className="text-xs text-gray-500 mt-0.5">Return this document to the workspace. The trusted rule stays active.</p>
            </div>
          </button>
          <button onClick={() => onUndoAndRevoke(envelope.id, doc)} className="w-full flex items-start px-4 py-3 border border-red-200 bg-red-50 rounded-xl text-left hover:bg-red-100 transition-colors">
            <div>
              <p className="text-sm font-semibold text-red-800">Undo and revoke rule</p>
              <p className="text-xs text-red-600 mt-0.5">Return this document and revoke the trusted rule so future matches surface for review.</p>
            </div>
          </button>
        </div>
        <div className="px-6 pb-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}
