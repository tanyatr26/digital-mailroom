'use client';
import { useState, useRef, useEffect } from 'react';
import { Zap, Copy, Check, Printer, X, Trash2, Star, AlertTriangle, CheckSquare, Forward as ForwardIcon, MoreVertical, CornerUpLeft } from 'lucide-react';
import type { Document, InboxSource, TrustedRoute } from '@/src/types';
import { deriveDocType } from '@/src/lib/utils';
import DocThumbnail from '@/src/components/shared/DocThumbnail';
import AIPill from '@/src/components/shared/AIPill';

interface Props {
  doc: Document;
  envelopeId: string;
  senderName: string;
  folderNameMap: Record<string, string>;
  onDragStart: (envId: string, doc: Document, fromSelection: boolean) => void;
  // Right-click-and-drag entry (copy gesture). When set, the card listens
  // for mousedown with button=2 and fires this — bypassing the native HTML5
  // drag system which only handles left-click. Suppresses contextmenu.
  onRightDragStart?: (envId: string, doc: Document, e: React.MouseEvent) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  onPreview: (envId: string, docId: string) => void;
  onReleaseNow?: (envId: string, doc: Document) => void;
  onRemoveInstance?: (envId: string, doc: Document) => void;
  onDeleteDoc?: (envId: string, doc: Document) => void;
  onPrintLabel?: (envId: string, doc: Document) => void;
  onMarkAsProcessed?: (envId: string, doc: Document) => void;
  onForward?: (envId: string, doc: Document) => void;
  onReturnUpstream?: (envId: string, doc: Document) => void;
  // Duplicate the doc as a new unrouted card directly below the original.
  // Surfaces as the ⧉ Duplicate item in the ⋮ menu when supplied.
  onDuplicate?: (envId: string, doc: Document) => void;
  canForward?: boolean;
  isSearching: boolean;
  isSelected: boolean;
  onToggleSelect?: (docId: string) => void;
  selectionMode?: boolean;        // True when one or more cards in the panel are selected. Forces checkboxes visible.
  selectionCount?: number;        // Drives the "Moving N documents" drag ghost.
  trustedRoutes: TrustedRoute[];
  onTrustStar?: (envId: string, doc: Document) => void;
  // Click on a filled (active) star — opens the revoke-confirmation flow.
  // Only fires when the doc currently matches an active trusted route.
  onRevokeTrustStar?: (envId: string, doc: Document) => void;
  onRevokeStar?: (envId: string, doc: Document) => void;
  onUndoAutoRoute?: (envId: string, doc: Document) => void;
  onRename?: (envId: string, docId: string, title: string) => void;
  showFromMainInbox?: boolean;
  hideLabelActions?: boolean;
  hideTier1Actions?: boolean;
  // V2 §3.0 — Folder Admin inbox source tag (top-right of card).
  inboxSource?: InboxSource;
}

export default function DocumentRow({
  doc, envelopeId, senderName, folderNameMap, onDragStart, onRightDragStart, onDragEnd, isDragging,
  onPreview, onReleaseNow, onRemoveInstance, onDeleteDoc, onPrintLabel, onMarkAsProcessed, onForward, onReturnUpstream, onDuplicate, canForward,
  isSearching, isSelected, onToggleSelect, selectionMode, selectionCount, trustedRoutes,
  onTrustStar, onRevokeTrustStar, onUndoAutoRoute, onRename,
  showFromMainInbox, hideLabelActions, hideTier1Actions, inboxSource,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const labelPrinted = doc.labelStatus === 'printed';
  const labelAi = doc.labelStatus === 'ai_suggested';
  const hasSuggestion = !!doc.suggestion;

  const isTrusted = !!(trustedRoutes && senderName && trustedRoutes.find(r =>
    r.isActive &&
    senderName.toLowerCase().includes(r.pattern.sender.toLowerCase()) &&
    deriveDocType(doc.title, doc.suggestion).toLowerCase().includes(r.pattern.document_type.toLowerCase())
  ));
  // Destination-aware variant for the dispatched-state star (Folder Admin
  // inline trust marking). Matches the doc's chosen destination too.
  const isDestTrusted = !!(doc.dispatchedTo && trustedRoutes && senderName && trustedRoutes.find(r =>
    r.isActive &&
    r.destination === doc.dispatchedTo &&
    senderName.toLowerCase().includes(r.pattern.sender.toLowerCase()) &&
    deriveDocType(doc.title, doc.suggestion).toLowerCase().includes(r.pattern.document_type.toLowerCase())
  ));

  // ── Dispatched state ──────────────────────────────────────────
  if (doc.dispatchedTo) {
    const isReleased = doc.released, isCopy = doc.isCopy, isAutoRouted = doc.autoRouted;
    const isAutoRoutedByAi = !!doc.autoRoutedByAi;
    const aiConfidencePct = Math.round((doc.confidence ?? 0) * 100);
    let bg: string, tc: string, icon: React.ReactNode, lbl: React.ReactNode;
    if (isReleased) {
      bg = 'bg-red-50'; tc = 'text-red-800';
      icon = <Zap className="w-3 h-3 text-red-600" />;
      lbl = <span className="font-semibold text-red-700">Released to</span>;
    } else if (isCopy) {
      bg = 'bg-blue-50'; tc = 'text-blue-800';
      icon = <Copy className="w-3 h-3 text-blue-600" />;
      lbl = <span className="font-semibold text-blue-700">Copy queued to</span>;
    } else {
      bg = 'bg-gray-50'; tc = 'text-gray-500';
      icon = <Check className="w-3 h-3 text-emerald-500" />;
      lbl = <span>{isAutoRouted ? 'Routed to' : 'Queued to'}</span>;
    }
    return (
      <div className={`px-4 py-3 flex items-center gap-3 ${bg}`}>
        <div className="opacity-40"><DocThumbnail pages={doc.pages} onPreview={() => onPreview(envelopeId, doc.id)} /></div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm line-through truncate ${tc}`}>
            {doc.title}{doc.pageRange && <span className="ml-1.5 text-gray-400 font-normal">· pp.{doc.pageRange[0]}–{doc.pageRange[1]}</span>}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            {icon}{lbl}
            <span className="font-medium text-gray-700">{folderNameMap[doc.dispatchedTo] || doc.dispatchedTo}</span>
            {senderName && <><span className="text-gray-300">·</span><span>from {senderName}</span></>}
            {doc.docId && <><span className="text-gray-300">·</span><span className="font-mono">#{doc.docId}</span></>}
            <span className="text-gray-300">·</span><span>{doc.pages} pg</span>
            {isAutoRoutedByAi && <><span className="text-gray-300">·</span><span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"><Zap className="w-3 h-3" />{aiConfidencePct}% confident</span></>}
            {isDestTrusted && !isAutoRoutedByAi && <><span className="text-gray-300">·</span><span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"><Star className="w-3 h-3" style={{ fill: '#3b82f6', color: '#3b82f6' }} />Trusted</span></>}
            {!hideLabelActions && labelPrinted && <><span className="text-gray-300">·</span><span className="text-emerald-700 font-medium inline-flex items-center gap-1"><Printer className="w-3 h-3" />Label printed</span></>}
            {!hideLabelActions && labelAi && !isReleased && <><span className="text-gray-300">·</span>
              <span className="text-amber-700 font-medium inline-flex items-center gap-1"><Printer className="w-3 h-3" />Label pending</span>
            </>}
          </p>
          {isAutoRouted && isAutoRoutedByAi && <p className="mt-0.5 flex items-center gap-1" style={{ fontSize: 11, color: '#3b82f6' }}><span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#93c5fd' }} /> Auto-routed by AI</p>}
          {isAutoRouted && !isAutoRoutedByAi && <p className="mt-0.5 flex items-center gap-1" style={{ fontSize: 11, color: '#3b82f6' }}><Star className="w-2.5 h-2.5 flex-shrink-0" style={{ fill: '#93c5fd', color: '#93c5fd' }} /> Auto-routed via trusted rule</p>}
        </div>
        {!isReleased && (
          <button onClick={e => { e.stopPropagation(); isAutoRouted ? onUndoAutoRoute?.(envelopeId, doc) : onRemoveInstance?.(envelopeId, doc); }}
            title={isAutoRouted ? 'Undo auto-route' : isCopy ? 'Remove this copy' : 'Un-queue'}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-white border border-transparent hover:border-gray-200 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // ── Undispatched state ────────────────────────────────────────
  const suggestionFolderName = doc.suggestion ? (folderNameMap[doc.suggestion] || doc.suggestion) : '';

  // Checkbox visibility: forced when selection mode is active or in search mode;
  // otherwise hover-only via group-hover. Slot is always present so layout doesn't
  // shift when entering/leaving selection mode.
  const forceCheckbox = isSearching || selectionMode || isSelected;
  const showCheckboxSlot = !!onToggleSelect;

  // Custom drag image when dragging from a multi-selection: a stacked-card ghost
  // labeled "Moving N documents". Single-card drag keeps the browser default.
  const handleDragStartLocal = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    if (isSelected && (selectionCount ?? 0) > 1) {
      const ghost = document.createElement('div');
      ghost.style.cssText = [
        'position:absolute', 'top:-1000px', 'left:-1000px',
        'padding:10px 14px', 'background:#ffffff', 'border:1px solid #cbd5e1',
        'border-radius:8px', 'font-family:-apple-system,system-ui,sans-serif',
        'font-size:13px', 'font-weight:600', 'color:#1e293b', 'white-space:nowrap',
        'box-shadow:4px 4px 0 -1px #ffffff,4px 4px 0 0 #cbd5e1,8px 8px 0 -1px #ffffff,8px 8px 0 0 #e2e8f0,0 6px 12px -2px rgba(0,0,0,0.15)',
      ].join(';');
      ghost.textContent = `Moving ${selectionCount} documents`;
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      setTimeout(() => { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 0);
    }
    onDragStart(envelopeId, doc, isSelected);
  };

  // Body-click in selection mode toggles selection; in normal mode it's a no-op
  // (action buttons still fire because they stopPropagation).
  const handleBodyClick = (e: React.MouseEvent) => {
    if (selectionMode && !isSearching) {
      e.stopPropagation();
      onToggleSelect?.(doc.id);
    }
  };

  // Kebab menu items in canonical order. Folder Admin gets the upper four;
  // SA/Worker gets the lower three. Caller's prop set determines composition.
  const menuItems: MenuItem[] = [];
  if (onReturnUpstream) {
    menuItems.push({ key: 'return', icon: <CornerUpLeft className="w-3.5 h-3.5" />, label: 'Return upstream', onClick: () => onReturnUpstream(envelopeId, doc) });
  }
  if (onForward) {
    menuItems.push({ key: 'forward', icon: <ForwardIcon className="w-3.5 h-3.5" />, label: 'Forward a copy', onClick: () => onForward(envelopeId, doc), disabled: !canForward, disabledHint: 'Create a child folder before forwarding' });
  }
  if (onMarkAsProcessed) {
    menuItems.push({ key: 'queue', icon: <CheckSquare className="w-3.5 h-3.5" />, label: 'Add to download pile', onClick: () => onMarkAsProcessed(envelopeId, doc) });
  }
  if (!hideLabelActions && onPrintLabel) {
    // `onPrintLabel` is a print-queue toggle in the SA/Worker workspace
    // (kept name for callsite stability). Label is in queue = remove option;
    // otherwise = add option. Printed docs default to "Add" so a reprint
    // re-enters the queue.
    const inPrintQueue = labelAi;
    menuItems.push({
      key: 'queue',
      icon: <Printer className="w-3.5 h-3.5" />,
      label: inPrintQueue ? 'Remove from print queue' : (labelPrinted ? 'Reprint label' : 'Add to print queue'),
      onClick: () => onPrintLabel(envelopeId, doc),
    });
  }
  if (onDuplicate) {
    menuItems.push({ key: 'duplicate', icon: <Copy className="w-3.5 h-3.5" />, label: 'Duplicate', onClick: () => onDuplicate(envelopeId, doc) });
  }
  if (!hideTier1Actions && onDeleteDoc) {
    menuItems.push({ key: 'discard', icon: <Trash2 className="w-3.5 h-3.5" />, label: 'Discard', onClick: () => onDeleteDoc(envelopeId, doc), danger: true });
  }

  return (
    <div className="group pr-4 py-3 transition-colors" style={{ paddingLeft: isSelected ? 13 : 16, ...(isSelected ? { borderLeft: '3px solid #3b82f6' } : {}) }}>
      <div className="flex items-start gap-2.5">
        {showCheckboxSlot && (
          <div onClick={e => { e.stopPropagation(); onToggleSelect?.(doc.id); }}
            className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300 hover:border-blue-400'} ${forceCheckbox ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {((!hideTier1Actions && doc.manualRoute) || doc.inactiveReturnLabel || doc.pageRange || inboxSource) && (
            <div className="mb-2 flex items-center gap-2 flex-wrap">
              {/* AI confidence note moved inline to the meta row (SA/Worker
                  only). manualRoute keeps its small floating tag here. */}
              {!hideTier1Actions && doc.manualRoute && (
                <AIPill suggestion={doc.suggestion || 'junk'} confidence={doc.confidence} manualRoute={doc.manualRoute} hideHighConfidence={true} folderName={suggestionFolderName} />
              )}
              {/* Brief V2 §11/§21 — the "Folder Archived" red tag is removed.
                  Docs whose suggestion points at an archived folder are now
                  classified into the Ungrouped bucket up-front, so the
                  per-card label is no longer needed. */}
              {doc.inactiveReturnLabel && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-800 border border-amber-200">
                  ↩ {doc.inactiveReturnLabel}
                </span>
              )}
              {doc.pageRange && <span className="text-xs text-gray-600 px-1.5 py-0.5 bg-gray-100 rounded font-medium">pp.{doc.pageRange[0]}–{doc.pageRange[1]}</span>}
              {inboxSource && <SourceTag source={inboxSource} senderName={senderName} />}
            </div>
          )}
          <div draggable onDragStart={handleDragStartLocal} onDragEnd={onDragEnd}
            onClick={selectionMode && !isSearching ? handleBodyClick : undefined}
            onMouseDown={e => { if (e.button === 2 && onRightDragStart) onRightDragStart(envelopeId, doc, e); }}
            onContextMenu={e => { if (onRightDragStart) e.preventDefault(); }}
            className={`flex items-center gap-3 select-none rounded-lg transition-all p-2 -mx-2 ${isDragging ? 'opacity-30' : 'hover:bg-gray-50'} ${selectionMode && !isSearching ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}>
            <DocThumbnail pages={doc.pages} onPreview={() => onPreview(envelopeId, doc.id)} />
            <div className="flex-1 min-w-0">
              {isEditing
                ? <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                    onBlur={() => { const t = editValue.trim(); if (t && t !== doc.title) onRename?.(envelopeId, doc.id, t); setIsEditing(false); }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setEditValue(doc.title); setIsEditing(false); } }}
                    onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} draggable={false}
                    className="text-sm font-medium text-gray-900 w-full bg-white border-0 border-b border-blue-400 focus:outline-none pb-px" />
                : <p className="text-sm font-medium text-gray-900 truncate cursor-text" title="Double-click to rename"
                    onDoubleClick={e => { e.stopPropagation(); setEditValue(doc.title); setIsEditing(true); }}>{doc.title}</p>
              }
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                {senderName && <><span>from <span className="font-medium text-gray-700">{senderName}</span></span><span className="text-gray-300">·</span></>}
                {doc.docId && <><span className="font-mono text-gray-600">#{doc.docId}</span><span className="text-gray-300">·</span></>}
                <span>{doc.pages} page{doc.pages > 1 ? 's' : ''}</span>
                {/* Inline AI confidence note (SA/Worker only). Colored text,
                    no pill background. Spelled out so the worker knows what
                    specifically the AI is unsure about — almost always the
                    destination folder. */}
                {!hideTier1Actions && (() => {
                  const pct = Math.round(doc.confidence * 100);
                  if (doc.confidence >= 0.8) return null;
                  const noSuggestion = !doc.suggestion || doc.suggestion === 'junk' || doc.confidence === 0;
                  if (noSuggestion) {
                    return (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-red-700 font-medium inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          AI uncertain · no suggestion · {pct}%
                        </span>
                      </>
                    );
                  }
                  if (doc.confidence < 0.5) {
                    return (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-red-700 font-medium inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          AI uncertain · human review · {pct}%
                        </span>
                      </>
                    );
                  }
                  return (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="text-amber-700 font-medium inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        Review · destination uncertain · {pct}%
                      </span>
                    </>
                  );
                })()}
                {isTrusted && <>
                  <span className="text-gray-300">·</span>
                  <span title="Trusted route active — manage in Configurations" className="text-yellow-700 font-medium inline-flex items-center gap-1">
                    <Star className="w-3 h-3" style={{ fill: '#facc15', color: '#ca8a04' }} />Trusted
                  </span>
                </>}
                {!hideLabelActions && labelPrinted && <>
                  <span className="text-gray-300">·</span>
                  <span className="text-emerald-700 font-medium inline-flex items-center gap-1"><Printer className="w-3 h-3" />Label printed</span>
                </>}
                {!hideLabelActions && labelAi && <>
                  <span className="text-gray-300">·</span>
                  <span className="text-amber-700 font-medium inline-flex items-center gap-1"><Printer className="w-3 h-3" />Label pending</span>
                </>}
                {showFromMainInbox && <><span className="text-gray-300">·</span><span className="text-gray-400 font-medium" style={{ fontSize: 10 }}>From: Main Inbox</span></>}
              </p>
              {/* Document-level urgency. Filled amber chip scoped to the
                  flagged doc, with a trailing (i) icon tooltip exposing the
                  detection trigger. Release Now button stays in the card
                  actions row to the right. */}
              {!hideTier1Actions && doc.urgent && (
                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span>
                    Urgent{doc.urgency_reason ? ` — ${doc.urgency_reason}` : ''}
                  </span>
                  <span
                    title={`Detected: ${doc.urgency_trigger || doc.urgency_reason || 'urgent flag set on document'}`}
                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white border border-red-200 cursor-help text-[9px] font-bold">
                    i
                  </span>
                </div>
              )}
            </div>
            {/* Trusted-route toggle — standalone clickable star immediately
                to the left of the ⋮ menu. Outlined gray when no active route
                matches; filled amber when one does. Click flow handled by
                onTrustStar (mark) / onRevokeTrustStar (revoke). */}
            {onTrustStar && (
              <button
                draggable={false}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation();
                  if (isTrusted) onRevokeTrustStar?.(envelopeId, doc);
                  else onTrustStar(envelopeId, doc);
                }}
                title={isTrusted ? 'Trusted route active · Click to revoke' : 'Mark as trusted route'}
                className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-colors ${isTrusted ? 'hover:bg-yellow-50' : 'hover:bg-amber-50'}`}>
                <Star className="w-4 h-4 transition-all"
                  style={isTrusted
                    ? { fill: '#facc15', color: '#ca8a04' }
                    : { fill: 'none', color: '#9ca3af' }} />
              </button>
            )}
            {menuItems.length > 0 && <KebabMenu items={menuItems} />}
            {!hideTier1Actions && doc.urgent && (
              <button draggable={false} onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onReleaseNow?.(envelopeId, doc); }}
                title="Release this document now"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-md text-xs font-semibold hover:bg-red-700 transition-colors shadow-sm flex-shrink-0">
                <Zap className="w-3.5 h-3.5" /> Release Now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
  danger?: boolean;
}

function KebabMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="relative flex-shrink-0">
      <button ref={btnRef} draggable={false} onMouseDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        title="More actions"
        className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${open ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}>
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div ref={menuRef} role="menu"
          className="absolute right-0 top-8 z-40 bg-white border border-gray-200 rounded-xl shadow-xl py-1"
          style={{ minWidth: 200 }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}>
          {items.map(item => (
            <button key={item.key} role="menuitem" disabled={item.disabled}
              title={item.disabled ? item.disabledHint : undefined}
              onClick={() => { if (!item.disabled) { item.onClick(); setOpen(false); } }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-colors ${
                item.disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : item.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-700 hover:bg-gray-50'
              }`}>
              <span className={`flex-shrink-0 ${item.disabled ? 'text-gray-300' : item.danger ? 'text-red-500' : 'text-gray-500'}`}>{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// V2 §3.0 — top-right source tag rendered on Folder Admin inbox cards.
// Read-only metadata; doesn't affect routing. Underlying enum values
// (via / personal / uploaded) stay the same — only display strings change.
function SourceTag({ source, senderName }: { source: InboxSource; senderName?: string }) {
  if (source.kind === 'via') {
    return (
      <span
        title={`Sent by: ${senderName || 'Unknown'}\nTo: ${source.folderName}`}
        className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-slate-100 text-slate-600 border border-slate-200">
        to {source.folderName}
      </span>
    );
  }
  if (source.kind === 'personal') {
    return (
      <span
        title={`Direct from: ${senderName || 'Unknown'}\nSent to you as an individual recipient`}
        className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-teal-50 text-teal-700 border border-teal-200">
        Direct
      </span>
    );
  }
  const uploader = source.uploadedBy || 'You';
  return (
    <span
      title={`Uploaded by: ${uploader}`}
      className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200">
      Uploaded
    </span>
  );
}
