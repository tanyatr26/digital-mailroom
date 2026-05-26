'use client';
import { Check, Zap, Layers } from 'lucide-react';
import type { Document, TrustedRoute, EnvelopeDoc } from '@/src/types';
import DocumentRow from '@/src/components/DocumentRow';

interface Props {
  folderId: string;
  items: EnvelopeDoc[];
  folderNameMap: Record<string, string>;
  onDragStart: (envId: string, doc: Document, fromSelection: boolean) => void;
  onRightDragStart?: (envId: string, doc: Document, e: React.MouseEvent) => void;
  // Picks up every undispatched doc in this batch as a bulk drag.
  onBatchDragStart?: (folderId: string, items: EnvelopeDoc[]) => void;
  onDragEnd: () => void;
  draggedDocId: string | null;
  onPreview: (envId: string, docId: string) => void;
  onAutoDispatch: (folderId: string) => void;
  onReleaseNow: (envId: string, doc: Document) => void;
  onRemoveInstance: (envId: string, doc: Document) => void;
  onDeleteDoc: (envId: string, doc: Document) => void;
  onPrintLabel: (envId: string, doc: Document) => void;
  onMarkAsProcessed?: (envId: string, doc: Document) => void;
  onForward?: (envId: string, doc: Document) => void;
  onReturnUpstream?: (envId: string, doc: Document) => void;
  onDuplicate?: (envId: string, doc: Document) => void;
  canForward?: boolean;
  trustedRoutes: TrustedRoute[];
  onTrustStar: (envId: string, doc: Document) => void;
  onRevokeTrustStar?: (envId: string, doc: Document) => void;
  onUndoAutoRoute: (envId: string, doc: Document) => void;
  onRename: (envId: string, docId: string, title: string) => void;
  selectedDocIds?: Set<string>;
  selectionMode?: boolean;
  onToggleSelect?: (docId: string) => void;
  hideLabelActions?: boolean;
  hideTier1Actions?: boolean;
  // Brief V2 §11 — render as the Ungrouped bucket: header subtitle calls
  // out AI uncertainty, no "Dispatch all to" button (each doc must be
  // individually routed), no batch-header drag (no shared destination).
  isUngrouped?: boolean;
}

export default function DepartmentBucketCard({
  folderId, items, folderNameMap, onDragStart, onRightDragStart, onBatchDragStart, onDragEnd, draggedDocId, onPreview,
  onAutoDispatch, onReleaseNow, onRemoveInstance, onDeleteDoc, onPrintLabel, onMarkAsProcessed, onForward, onReturnUpstream, onDuplicate, canForward,
  trustedRoutes, onTrustStar, onRevokeTrustStar, onUndoAutoRoute, onRename,
  selectedDocIds, selectionMode, onToggleSelect,
  hideLabelActions, hideTier1Actions, isUngrouped,
}: Props) {
  const folderName = folderNameMap[folderId] || folderId;
  const undispatched = items.filter(({ doc }) => !doc.dispatchedTo);
  const undispatchedPages = undispatched.reduce((s, { doc }) => s + doc.pages, 0);
  const dispatchedCount = items.length - undispatched.length;
  const allDispatched = undispatched.length === 0;

  // Batch-header drag handle. Picks up every undispatched doc in this batch
  // as a bulk drag — equivalent to clicking "Dispatch all to" except the
  // worker chooses the drop target by dragging onto a folder.
  const handleBatchHeaderDragStart = (e: React.DragEvent) => {
    if (allDispatched || !onBatchDragStart) return;
    e.dataTransfer.effectAllowed = 'copyMove';
    // Custom drag ghost — same "stacked-card" pattern used for multi-select drags.
    const n = undispatched.length;
    const ghost = document.createElement('div');
    ghost.style.cssText = [
      'position:absolute', 'top:-1000px', 'left:-1000px',
      'padding:10px 14px', 'background:#ffffff', 'border:1px solid #cbd5e1',
      'border-radius:8px', 'font-family:-apple-system,system-ui,sans-serif',
      'font-size:13px', 'font-weight:600', 'color:#1e293b', 'white-space:nowrap',
      'box-shadow:4px 4px 0 -1px #ffffff,4px 4px 0 0 #cbd5e1,8px 8px 0 -1px #ffffff,8px 8px 0 0 #e2e8f0,0 6px 12px -2px rgba(0,0,0,0.15)',
    ].join(';');
    ghost.textContent = `Moving ${n} document${n !== 1 ? 's' : ''} from ${folderName}`;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 0);
    onBatchDragStart(folderId, undispatched);
  };

  // Ungrouped has no shared destination, so batch-header drag is disabled.
  const batchHeaderInteractive = !!onBatchDragStart && !allDispatched && !isUngrouped;

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm transition-all ${allDispatched ? 'opacity-60' : ''}`}>
      <div
        draggable={batchHeaderInteractive}
        onDragStart={batchHeaderInteractive ? handleBatchHeaderDragStart : undefined}
        onDragEnd={batchHeaderInteractive ? onDragEnd : undefined}
        className={`px-4 py-2.5 bg-gradient-to-b from-gray-50 to-gray-100 border-b border-gray-200 rounded-t-2xl flex items-center gap-3 ${batchHeaderInteractive ? 'cursor-grab active:cursor-grabbing' : ''}`}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{folderName}</p>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
            <Layers className="w-3 h-3" />
            <span>{undispatched.length} scan{undispatched.length !== 1 ? 's' : ''}</span>
            <span className="text-gray-300">·</span>
            <span>{undispatchedPages} page{undispatchedPages !== 1 ? 's' : ''}</span>
            {dispatchedCount > 0 && <><span className="text-gray-300">·</span><span className="text-emerald-600 font-medium">{dispatchedCount} queued</span></>}
          </div>
          {isUngrouped && (
            <p className="text-[11px] text-gray-500 mt-1 italic">
              AI couldn&apos;t confidently route these. Drag each to a folder.
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {allDispatched
            ? <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><Check className="w-3.5 h-3.5" /> Cleared</span>
            : !hideTier1Actions && !isUngrouped
              ? <button
                  draggable={false}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onAutoDispatch(folderId); }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors">
                  <Zap className="w-3 h-3" /> Dispatch all to {folderName}
                </button>
              : null
          }
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {items.map(({ doc, envelope }) => (
          <DocumentRow key={doc.id} doc={doc} envelopeId={envelope.id} senderName={envelope.sender}
            folderNameMap={folderNameMap} onDragStart={onDragStart} onRightDragStart={onRightDragStart} onDragEnd={onDragEnd}
            isDragging={draggedDocId === doc.id} onPreview={onPreview} onReleaseNow={onReleaseNow}
            onRemoveInstance={onRemoveInstance} onDeleteDoc={onDeleteDoc} onPrintLabel={onPrintLabel}
            onMarkAsProcessed={onMarkAsProcessed}
            onForward={onForward} onReturnUpstream={onReturnUpstream} onDuplicate={onDuplicate} canForward={canForward}
            trustedRoutes={trustedRoutes} onTrustStar={onTrustStar} onRevokeTrustStar={onRevokeTrustStar}
            onUndoAutoRoute={onUndoAutoRoute} onRename={onRename}
            isSearching={false}
            isSelected={!!selectedDocIds?.has(doc.id)}
            onToggleSelect={onToggleSelect}
            selectionMode={selectionMode}
            selectionCount={selectedDocIds?.size}
            hideLabelActions={hideLabelActions} hideTier1Actions={hideTier1Actions} />
        ))}
      </div>
    </div>
  );
}
