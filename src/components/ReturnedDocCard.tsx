'use client';
import { Trash2, Undo2, AlertTriangle } from 'lucide-react';
import type { Document } from '@/src/types';
import DocThumbnail from '@/src/components/shared/DocThumbnail';

// V2 §8 — Card for a returned document. Used by:
//   - MailDispatch (SA/Worker) Returns section, with [Discard] as the
//     destructive secondary action.
//   - FolderWorkspace Returns batch, with [Return upstream] as the secondary
//     action (opens the existing ReturnModal).
// Drag-to-route is wired by the parent's drag system — the card is draggable
// just like a normal DocumentRow.
export type ReturnedSecondaryKind = 'discard' | 'return-upstream';

interface Props {
  doc: Document;
  envelopeId: string;
  senderName: string;
  isDragging: boolean;
  onDragStart: (envId: string, doc: Document, fromSelection: boolean) => void;
  onDragEnd: () => void;
  onPreview: (envId: string, docId: string) => void;
  onSecondaryAction: (envId: string, doc: Document) => void;
  secondaryKind: ReturnedSecondaryKind;
}

export default function ReturnedDocCard({
  doc, envelopeId, senderName, isDragging,
  onDragStart, onDragEnd, onPreview, onSecondaryAction, secondaryKind,
}: Props) {
  const secondaryLabel = secondaryKind === 'discard' ? 'Discard' : 'Return upstream';
  const SecondaryIcon  = secondaryKind === 'discard' ? Trash2 : Undo2;
  const secondaryClass = secondaryKind === 'discard'
    ? 'text-red-700 hover:bg-red-100 border border-red-200'
    : 'text-amber-800 hover:bg-amber-100 border border-amber-300';

  return (
    <div draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(envelopeId, doc, false); }}
      onDragEnd={onDragEnd}
      className={`bg-amber-50 border border-amber-300 rounded-xl p-3 transition-all cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : 'hover:border-amber-400 hover:shadow-sm'}`}>
      <div className="flex items-start gap-3 mb-1.5">
        <DocThumbnail pages={doc.pages} onPreview={() => onPreview(envelopeId, doc.id)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Undo2 className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
            <p className="text-sm font-semibold text-gray-900 truncate">{doc.title}</p>
            <span
              title={`Returned by: ${doc.returnedBy ?? 'unknown'}\nReason: "${doc.returnReason ?? doc.inactiveReturnLabel ?? '—'}"`}
              className="text-[10px] uppercase tracking-wide font-bold text-white bg-amber-500 rounded-full px-2 py-0.5 shadow-sm">Returned</span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            from <span className="font-medium text-gray-700">{senderName}</span>
            {doc.docId && <> · <span className="font-mono">#{doc.docId}</span></>}
            <> · {doc.pages} page{doc.pages !== 1 ? 's' : ''}</>
          </p>
          {(doc.returnReason || doc.inactiveReturnLabel) && (
            <div className="mt-1.5 flex items-start gap-1.5 text-xs">
              <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-900 leading-relaxed">
                <span className="font-semibold">Return reason:</span> &ldquo;{doc.returnReason ?? doc.inactiveReturnLabel}&rdquo;
              </p>
            </div>
          )}
          {(doc.returnedBy || doc.returnedAt) && (
            <p className="mt-1 text-[11px] text-gray-500">
              Returned by <span className="font-medium text-gray-700">{doc.returnedBy ?? 'unknown'}</span>
              {doc.returnedAt && <> · {doc.returnedAt}</>}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <button onClick={e => { e.stopPropagation(); onSecondaryAction(envelopeId, doc); }}
              onMouseDown={e => e.stopPropagation()} draggable={false}
              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${secondaryClass}`}>
              <SecondaryIcon className="w-3 h-3" /> {secondaryLabel}
            </button>
            <span className="text-[11px] text-gray-500 italic">Drag to route</span>
          </div>
        </div>
      </div>
    </div>
  );
}
