'use client';
import { Search, Check } from 'lucide-react';
import type { Document, TrustedRoute, EnvelopeDoc } from '@/src/types';
import DocumentRow from '@/src/components/DocumentRow';

interface Props {
  items: EnvelopeDoc[];
  searchTerm: string;
  selectedDocIds: Set<string>;
  folderNameMap: Record<string, string>;
  onToggleSelect: (docId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onDragStart: (envId: string, doc: Document, fromSelection: boolean) => void;
  onDragEnd: () => void;
  draggedDocId: string | null;
  onPreview: (envId: string, docId: string) => void;
  onReleaseNow: (envId: string, doc: Document) => void;
  onDeleteDoc?: (envId: string, doc: Document) => void;
  onPrintLabel?: (envId: string, doc: Document) => void;
  onMarkAsProcessed?: (envId: string, doc: Document) => void;
  onForward?: (envId: string, doc: Document) => void;
  onReturnUpstream?: (envId: string, doc: Document) => void;
  onDuplicate?: (envId: string, doc: Document) => void;
  canForward?: boolean;
  trustedRoutes: TrustedRoute[];
  onTrustStar?: (envId: string, doc: Document) => void;
  onRevokeTrustStar?: (envId: string, doc: Document) => void;
  onRename: (envId: string, docId: string, title: string) => void;
  hideLabelActions?: boolean;
  hideTier1Actions?: boolean;
}

export default function FlatSearchList({
  items, searchTerm, selectedDocIds, folderNameMap, onToggleSelect, onSelectAll, onClear,
  onDragStart, onDragEnd, draggedDocId, onPreview, onReleaseNow, onDeleteDoc, onPrintLabel,
  onMarkAsProcessed, onForward, onReturnUpstream, onDuplicate, canForward,
  trustedRoutes, onTrustStar, onRevokeTrustStar, onRename,
  hideLabelActions, hideTier1Actions,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-12 text-center">
        <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700">No matching documents</p>
        <p className="text-xs text-gray-400 mt-1">No results for <span className="font-medium">&quot;{searchTerm}&quot;</span></p>
      </div>
    );
  }
  const allSelected = items.every(({ doc }) => selectedDocIds.has(doc.id));
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-b from-gray-50 to-gray-100 border-b border-gray-200 flex items-center gap-3">
        <div onClick={allSelected ? onClear : onSelectAll}
          className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${allSelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-400 hover:border-blue-400'}`}>
          {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{items.length} matching document{items.length !== 1 ? 's' : ''}</p>
          <p className="text-xs text-gray-500 mt-0.5">Select rows and drag any one into a folder to dispatch the whole batch</p>
        </div>
        {selectedDocIds.size > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex-shrink-0">{selectedDocIds.size} selected</span>}
      </div>
      <div className="divide-y divide-gray-100">
        {items.map(({ doc, envelope }) => (
          <DocumentRow key={doc.id} doc={doc} envelopeId={envelope.id} senderName={envelope.sender}
            folderNameMap={folderNameMap} onDragStart={onDragStart} onDragEnd={onDragEnd}
            isDragging={draggedDocId === doc.id} onPreview={onPreview} onReleaseNow={onReleaseNow}
            onDeleteDoc={onDeleteDoc} onPrintLabel={onPrintLabel}
            onMarkAsProcessed={onMarkAsProcessed} onForward={onForward}
            onReturnUpstream={onReturnUpstream} onDuplicate={onDuplicate} canForward={canForward}
            trustedRoutes={trustedRoutes}
            onTrustStar={onTrustStar} onRevokeTrustStar={onRevokeTrustStar} onUndoAutoRoute={undefined}
            onRename={onRename} isSearching={true} isSelected={selectedDocIds.has(doc.id)} onToggleSelect={onToggleSelect}
            hideLabelActions={hideLabelActions} hideTier1Actions={hideTier1Actions} />
        ))}
      </div>
    </div>
  );
}
