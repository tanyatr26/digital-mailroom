'use client';
import { useState, useEffect } from 'react';
import { X, Printer, Check, ChevronDown, ChevronUp, Eye, Plus } from 'lucide-react';
import type { BulkLabelUpdate, EnvelopeDoc } from '@/src/types';
import { formatLabelDate } from '@/src/lib/utils';
import { DEPT_DOTS } from '@/src/lib/constants';
import { SSO_USERS } from '@/src/mocks/users';
import SsoRecipientPicker from '@/src/components/shared/SsoRecipientPicker';

// V2 — Print Queue Modal. Replaces the older BulkLabelModal for the AI-flag
// + manual-queue flow. Each item is a condensed line: checkbox, title, ID +
// sender, read-only destination, recipient picker, expandable label preview,
// and a "No label needed" action that removes the doc from the queue with a
// short reason logged to routing history.
interface Props {
  items: EnvelopeDoc[];
  allRecipients: string[];
  folderNameMap: Record<string, string>;
  // Default recipient name for a destination folder (admin name). Optional
  // — the picker stays empty if not supplied.
  defaultRecipientForFolder?: (folderId: string) => string | undefined;
  onConfirm: (updates: BulkLabelUpdate[]) => void;
  onSkip: (envelopeId: string, docId: string, reason: string) => void;
  // Opens the Document Preview modal for the underlying scanned doc.
  // Distinct from the inline "Preview label" toggle which shows the
  // printable label artifact.
  onPreviewDoc?: (envelopeId: string, docId: string) => void;
  // Creates a duplicate entry for the same doc with an empty recipient.
  // Lets a worker print multiple physical labels for one doc with
  // different addressees. The parent owns the duplicates list.
  onDuplicate?: (envelopeId: string, docId: string) => void;
  // Duplicate-row destination override. Available folders for the dropdown.
  destinationOptions?: Array<{ id: string; name: string }>;
  // Fires when a dup row picks a different destination folder.
  onChangeEntryDestination?: (entryId: string, folderId: string) => void;
  onClose: () => void;
}

export default function PrintQueueModal({
  items, folderNameMap, defaultRecipientForFolder, destinationOptions, onConfirm, onSkip, onPreviewDoc, onDuplicate, onChangeEntryDestination, onClose,
}: Props) {
  const today = formatLabelDate();
  const [includeMap, setIncludeMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    items.forEach(it => { m[it.doc.id] = true; });
    return m;
  });
  const [recipientMap, setRecipientMap] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    items.forEach(it => {
      const folderId = it.doc.dispatchedTo || it.doc.suggestion || '';
      // Duplicate entries start empty so the worker must pick a distinct
      // recipient. Source rows fall back to the destination folder's admin.
      const isDup = it.doc.id.includes('__dup__');
      const fallback = isDup ? '' : (defaultRecipientForFolder?.(folderId) || '');
      m[it.doc.id] = it.doc.labelRecipient || fallback;
    });
    return m;
  });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Per-row "No label needed" reason editor state.
  const [skipDraft, setSkipDraft] = useState<Record<string, string>>({});

  // Initialize maps for any newly-arrived entries (e.g. a freshly-duplicated
  // row). Existing entries' state is preserved.
  useEffect(() => {
    items.forEach(it => {
      if (!(it.doc.id in includeMap)) {
        setIncludeMap(prev => ({ ...prev, [it.doc.id]: true }));
      }
      if (!(it.doc.id in recipientMap)) {
        const folderId = it.doc.dispatchedTo || it.doc.suggestion || '';
        const isDup = it.doc.id.includes('__dup__');
        const fallback = isDup ? '' : (defaultRecipientForFolder?.(folderId) || '');
        setRecipientMap(prev => ({ ...prev, [it.doc.id]: it.doc.labelRecipient || fallback }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map(it => it.doc.id).join('|')]);

  const includedCount = items.filter(it => includeMap[it.doc.id]).length;

  const handleConfirm = () => {
    const updates: BulkLabelUpdate[] = items.filter(it => includeMap[it.doc.id]).map(it => {
      const folderId = it.doc.dispatchedTo || it.doc.suggestion || '';
      return {
        envelopeId: it.envelope.id,
        docId: it.doc.id,
        labelStatus: 'printed',
        labelDate: today,
        labelRecipient: (recipientMap[it.doc.id] || '').trim(),
        labelRoute: folderId,
      };
    });
    onConfirm(updates);
  };

  const beginSkip = (docId: string) => setSkipDraft(prev => ({ ...prev, [docId]: prev[docId] ?? '' }));
  const cancelSkip = (docId: string) => setSkipDraft(prev => {
    const next = { ...prev };
    delete next[docId];
    return next;
  });
  const confirmSkip = (it: EnvelopeDoc) => {
    const reason = (skipDraft[it.doc.id] || '').trim();
    if (reason.length < 10) return;
    onSkip(it.envelope.id, it.doc.id, reason);
    cancelSkip(it.doc.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 640, maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0"><Printer className="w-4 h-4 text-blue-600" /></div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Print Queue · {items.length} document{items.length !== 1 ? 's' : ''}</h2>
              <p className="text-xs text-gray-500 mt-0.5">Review recipients and print all labels.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close print queue"
            aria-label="Close print queue"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-700 border border-gray-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 shadow-sm transition-colors flex-shrink-0">
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
          {items.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
              The print queue is empty.
            </div>
          )}
          {items.map(it => {
            const folderId = it.doc.dispatchedTo || it.doc.suggestion || '';
            const folderName = folderNameMap[folderId] || folderId || 'Unrouted';
            const dotColor = DEPT_DOTS[folderId] || '#64748b';
            const included = includeMap[it.doc.id];
            const isExpanded = !!expanded[it.doc.id];
            const skipping = skipDraft[it.doc.id] !== undefined;
            const skipReason = skipDraft[it.doc.id] || '';
            return (
              <div key={it.doc.id} className={`p-3 rounded-xl border transition-all ${included ? 'border-blue-200 bg-white shadow-sm' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                <div className="flex items-start gap-3">
                  <div onClick={() => setIncludeMap(prev => ({ ...prev, [it.doc.id]: !prev[it.doc.id] }))}
                    className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${included ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300 hover:border-blue-400'}`}>
                    {included && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate flex-1 min-w-0">{it.doc.title}</p>
                      {onPreviewDoc && (
                        <button type="button"
                          onClick={() => onPreviewDoc(it.envelope.id, it.doc.id)}
                          title="Open the scanned document"
                          className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
                          <Eye className="w-3 h-3" /> Preview document
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono">#{it.doc.docId}</span>
                      <span className="text-gray-300">·</span>
                      <span>from {it.envelope.sender}</span>
                    </div>
                    <div className="text-xs mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <span className="text-gray-500">Destination:</span>
                      {(() => {
                        const isDup = it.doc.id.includes('__dup__');
                        // Dup rows let the worker re-target the destination
                        // on the spot. A different destination triggers a
                        // routing copy in the new folder on print.
                        if (isDup && destinationOptions && destinationOptions.length > 0 && onChangeEntryDestination) {
                          return (
                            <>
                              <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: dotColor }} />
                              <select value={folderId}
                                onChange={e => onChangeEntryDestination(it.doc.id, e.target.value)}
                                className="px-2 py-0.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md focus:outline-none focus:border-blue-400">
                                {destinationOptions.map(opt => (
                                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                                ))}
                              </select>
                            </>
                          );
                        }
                        return (
                          <span className="inline-flex items-center gap-1 font-medium text-gray-700">
                            <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: dotColor }} />
                            {folderName}
                          </span>
                        );
                      })()}
                    </div>
                    {included && (() => {
                      const folderId = it.doc.dispatchedTo || it.doc.suggestion || '';
                      const defaultName = defaultRecipientForFolder?.(folderId);
                      const isDefault = !!defaultName && (recipientMap[it.doc.id] || '') === defaultName;
                      return (
                        <div className="mt-2">
                          <label className="block text-[11px] uppercase tracking-wide font-medium text-gray-500 mb-1">Recipient</label>
                          <SsoRecipientPicker
                            value={recipientMap[it.doc.id] || ''}
                            onChange={v => setRecipientMap(prev => ({ ...prev, [it.doc.id]: v }))}
                            placeholder="Search SSO users by name or email…"
                          />
                          {isDefault && (
                            <p className="mt-1 text-[10px] text-gray-400">Defaults to destination folder admin. Override if known.</p>
                          )}
                        </div>
                      );
                    })()}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <button onClick={() => setExpanded(prev => ({ ...prev, [it.doc.id]: !prev[it.doc.id] }))}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
                        {isExpanded ? <><ChevronUp className="w-3 h-3" /> Hide label preview</> : <><ChevronDown className="w-3 h-3" /> Preview label</>}
                      </button>
                      {!skipping && onDuplicate && (
                        <button onClick={() => onDuplicate(it.envelope.id, it.doc.id)}
                          title="Add another label entry for this same document"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors">
                          <Plus className="w-3 h-3" /> Duplicate
                        </button>
                      )}
                      {!skipping && (
                        <button onClick={() => beginSkip(it.doc.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                          <X className="w-3 h-3" /> No label needed
                        </button>
                      )}
                    </div>
                    {isExpanded && (() => {
                      const recipientText = (recipientMap[it.doc.id] || '').trim();
                      // Render "Name, Title" on the printed label when the
                      // picked recipient matches an SSO user with a title.
                      const recipientUser = recipientText ? SSO_USERS.find(u => u.name === recipientText) : undefined;
                      const recipientLabel = recipientUser?.title
                        ? `${recipientUser.name}, ${recipientUser.title}`
                        : recipientText;
                      return (
                        <div className="mt-2 rounded-lg bg-gray-100 p-4">
                          <div className="bg-white border-2 border-black px-5 py-4 font-mono text-black"
                            style={{ fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace' }}>
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="font-bold" style={{ fontSize: 22, letterSpacing: '-0.5px' }}>#{it.doc.docId}</span>
                              <span className="text-black" style={{ fontSize: 12 }}>{today}</span>
                            </div>
                            <div className="mt-2 font-bold" style={{ fontSize: 14 }}>
                              <span className="font-normal">to </span>{folderName}
                            </div>
                            {recipientLabel && (
                              <div style={{ fontSize: 12 }}>
                                Attn: {recipientLabel}
                              </div>
                            )}
                            <div className="mt-3 flex flex-col items-center">
                              <Barcode value={String(it.doc.docId ?? '')} />
                              <div className="mt-1 text-black tracking-[0.25em]" style={{ fontSize: 11 }}>
                                * {it.doc.docId} *
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    {skipping && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                        <label className="block text-[11px] font-semibold text-red-800 mb-1">Reason for skipping (min 10 chars)</label>
                        <input autoFocus value={skipReason}
                          onChange={e => setSkipDraft(prev => ({ ...prev, [it.doc.id]: e.target.value }))}
                          placeholder="Why doesn't this need a physical label?"
                          className="w-full px-2 py-1 text-xs border border-red-200 rounded-md focus:outline-none focus:border-red-400 bg-white" />
                        <div className="mt-1.5 flex items-center justify-end gap-1.5">
                          <button onClick={() => cancelSkip(it.doc.id)}
                            className="px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
                          <button onClick={() => confirmSkip(it)} disabled={skipReason.trim().length < 10}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${skipReason.trim().length < 10 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}>
                            Remove from queue
                          </button>
                        </div>
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

// Code-128-ish visual barcode. Not a real symbology — generates a stable
// pattern of variable-width bars and gaps from the docId so each label
// reads as a distinct printed artifact.
function Barcode({ value, height = 42 }: { value: string; height?: number }) {
  const seed = (value || '').split('').reduce((acc, ch) => ((acc * 31) + ch.charCodeAt(0)) >>> 0, 0x9e3779b1) >>> 0;
  let v = seed || 1;
  const next = () => { v = (v * 1664525 + 1013904223) >>> 0; return v; };
  // Build alternating bar/gap segments with widths in [1, 4].
  const segments: Array<{ black: boolean; width: number }> = [];
  // Quiet zone (white) + start guard (black)
  segments.push({ black: false, width: 2 });
  segments.push({ black: true,  width: 3 });
  for (let i = 0; i < 60; i++) {
    segments.push({ black: i % 2 === 0, width: (next() % 3) + 1 });
  }
  segments.push({ black: true,  width: 3 });
  segments.push({ black: false, width: 2 });
  return (
    <div className="flex items-stretch" style={{ height }}>
      {segments.map((s, i) => (
        <div key={i} style={{ width: s.width, backgroundColor: s.black ? '#000' : 'transparent' }} />
      ))}
    </div>
  );
}
