'use client';
import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Scissors, Search, Check } from 'lucide-react';
import type { Document, SplitGroup } from '@/src/types';
import { getPageLines, pageMatchesQuery } from '@/src/lib/utils';
import { COLORS, DEPT_DOTS } from '@/src/lib/constants';
import { getRootFolders } from '@/src/mocks/data';
import BucketTile from '@/src/components/shared/BucketTile';

interface FolderNameMap { [id: string]: string }

/* ─── Preview body ───────────────────────────────────────────── */
function PreviewBody({ doc }: { doc: Document }) {
  const [cur, setCur] = useState(1);
  const pages = Array.from({ length: doc.pages }, (_, i) => i + 1);
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-8">
        <div className="bg-white shadow-xl rounded-lg p-12" style={{ width: 460, minHeight: 580 }}>
          <div className="text-center mb-6 pb-4 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-700">{doc.title}</p>
            <p className="text-xs text-gray-400 mt-1">Page {cur} of {doc.pages}</p>
          </div>
          <div className="space-y-3">
            {getPageLines(cur).map((w, i) => <div key={i} className="bg-gray-200 rounded" style={{ height: i === 0 ? 10 : 7, width: w + '%' }} />)}
          </div>
        </div>
      </div>
      <div className="px-6 py-3 bg-white border-t border-gray-200 flex items-center justify-center gap-2 flex-shrink-0">
        <button onClick={() => setCur(Math.max(1, cur - 1))} disabled={cur === 1} className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
        <div className="flex gap-1.5 flex-wrap justify-center">
          {pages.map(p => <button key={p} onClick={() => setCur(p)} className={`w-9 h-10 rounded border text-xs font-medium transition-colors ${cur === p ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'}`}>{p}</button>)}
        </div>
        <button onClick={() => setCur(Math.min(doc.pages, cur + 1))} disabled={cur === doc.pages} className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

/* ─── Split mode body ────────────────────────────────────────── */
function SplitModeBody({ doc, folderNameMap, onCancel, onApply }: { doc: Document; folderNameMap: FolderNameMap; onCancel: () => void; onApply: (groups: SplitGroup[]) => void }) {
  const [pageAssignments, setPageAssignments] = useState<Record<number, string>>({});
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [lastSelected, setLastSelected] = useState<number | null>(null);
  const [draggedPages, setDraggedPages] = useState<number[]>([]);
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [assignPulsing, setAssignPulsing] = useState<string | null>(null);
  const [pageSearchTerm, setPageSearchTerm] = useState('');
  const pages = Array.from({ length: doc.pages }, (_, i) => i + 1);
  const pageQ = pageSearchTerm.trim();
  const matchingPagesSet = new Set<number>();
  if (pageQ) pages.forEach(p => { if (pageMatchesQuery(doc, p, pageQ)) matchingPagesSet.add(p); });
  const uniqueFolders = new Set(Object.values(pageAssignments).filter(Boolean));
  const assignedCount = Object.values(pageAssignments).filter(Boolean).length;
  const allAssigned = assignedCount === doc.pages;
  const canApply = allAssigned && uniqueFolders.size >= 2;
  const isDragging = draggedPages.length > 0;
  const folderPageCounts: Record<string, number> = {};
  Object.values(pageAssignments).forEach(d => { if (d) folderPageCounts[d] = (folderPageCounts[d] || 0) + 1; });

  const handleTileClick = (e: React.MouseEvent, n: number) => {
    setPreviewPage(n);
    const next = new Set(selectedPages);
    if (e.shiftKey && lastSelected !== null) {
      const lo = Math.min(lastSelected, n), hi = Math.max(lastSelected, n);
      for (let p = lo; p <= hi; p++) next.add(p);
    } else {
      if (next.has(n)) next.delete(n); else next.add(n);
    }
    setSelectedPages(next);
    setLastSelected(n);
  };

  const handleSelectAll = () => setSelectedPages(selectedPages.size === doc.pages ? new Set() : new Set(pages));

  const handleDragStart = (e: React.DragEvent, n: number) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedPages(selectedPages.has(n) && selectedPages.size > 0 ? [...selectedPages] : [n]);
  };

  const handleFolderDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setHoveredFolder(id); };

  const handleFolderDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!draggedPages.length) return;
    setPageAssignments(prev => { const next = { ...prev }; draggedPages.forEach(p => { next[p] = id; }); return next; });
    setSelectedPages(new Set());
    setAssignPulsing(id);
    setTimeout(() => setAssignPulsing(null), 600);
    setDraggedPages([]);
    setHoveredFolder(null);
  };

  const getGroups = (): SplitGroup[] => {
    const r: SplitGroup[] = [];
    let i = 1;
    while (i <= doc.pages) {
      const d = pageAssignments[i];
      if (d) { let j = i + 1; while (j <= doc.pages && pageAssignments[j] === d) j++; r.push({ start: i, end: j - 1, folder: d }); i = j; }
      else i++;
    }
    return r;
  };

  return (
    <>
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-3 flex-shrink-0">
        <div className="relative" style={{ width: 320 }}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          <input type="text" value={pageSearchTerm} onChange={e => setPageSearchTerm(e.target.value)} placeholder="Search page contents…" className="w-full pl-7 pr-7 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg bg-white focus:border-blue-400 focus:outline-none" />
          {pageSearchTerm && <button onClick={() => setPageSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
        </div>
        {pageQ && (matchingPagesSet.size > 0
          ? <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-600"><span className="font-semibold text-amber-700">{matchingPagesSet.size}</span> page{matchingPagesSet.size !== 1 ? 's' : ''} match</span>
              <button onClick={() => setSelectedPages(prev => new Set([...prev, ...matchingPagesSet]))} className="px-2 py-1 bg-amber-50 text-amber-700 font-medium rounded-md hover:bg-amber-100 transition-colors border border-amber-200">Select all matches</button>
            </div>
          : <span className="text-xs text-gray-400">No pages contain &quot;{pageQ}&quot;</span>
        )}
        <span className="ml-auto text-gray-400 italic" style={{ fontSize: 10 }}>Demo: keywords inferred from OCR</span>
      </div>
      <div className="flex-1 flex overflow-hidden">
        {/* Page list */}
        <div className="border-r border-gray-200 flex flex-col bg-gray-50 flex-shrink-0" style={{ width: 132 }}>
          <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-600">Pages</p>
              <p className={`text-xs mt-0.5 ${selectedPages.size > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                {selectedPages.size > 0 ? selectedPages.size + ' selected' : assignedCount + '/' + doc.pages + ' assigned'}
              </p>
            </div>
            <button onClick={handleSelectAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-1">{selectedPages.size === doc.pages ? 'None' : 'All'}</button>
          </div>
          <div className="px-2 py-1.5 border-b border-blue-100 bg-blue-50">
            <p className="text-blue-700 leading-snug" style={{ fontSize: 10 }}>click · Shift+click · drag to folder</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {pages.map(n => {
              const folder = pageAssignments[n], isSel = selectedPages.has(n), isBeingDragged = draggedPages.includes(n), isPrev = previewPage === n, isMatch = matchingPagesSet.has(n);
              return (
                <div key={n} draggable onClick={e => handleTileClick(e, n)} onDragStart={e => handleDragStart(e, n)} onDragEnd={() => { setDraggedPages([]); setHoveredFolder(null); }}
                  className={`relative flex items-start gap-1.5 p-1.5 rounded-lg border transition-all cursor-grab select-none ${isSel ? 'bg-blue-50 border-blue-400 shadow-sm' : isMatch ? 'bg-amber-50 border-amber-400 shadow-sm' : isPrev ? 'bg-white border-gray-300 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'} ${isBeingDragged ? 'opacity-25' : ''}`}>
                  {folder && (
                    <button onClick={e => { e.stopPropagation(); setPageAssignments(prev => { const next = { ...prev }; delete next[n]; return next; }); }} onMouseDown={e => e.stopPropagation()} draggable={false}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-gray-300 hover:bg-red-50 hover:border-red-400 text-gray-400 hover:text-red-600 flex items-center justify-center shadow-sm transition-colors z-10">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                  {isMatch && !isSel && !folder && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />}
                  <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSel ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}>
                    {isSel && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-white border border-gray-200 rounded shadow-sm p-1" style={{ height: 44 }}>
                      <div className="space-y-0.5">{[100, 75, 90, 60, 85, 50].map((w, i) => <div key={i} className="bg-gray-200 rounded-full" style={{ height: 2, width: w + '%' }} />)}</div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs font-medium text-gray-700">p.{n}</p>
                      {folder && <div className="rounded-full" style={{ width: 6, height: 6, backgroundColor: DEPT_DOTS[folder] || '#9CA3AF' }} />}
                    </div>
                    {folder && <p className={`truncate ${(COLORS[folder] || COLORS.junk).text}`} style={{ fontSize: 9 }}>{folderNameMap[folder] || folder}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Preview center */}
        <div className="flex-1 overflow-auto bg-gray-100 flex flex-col items-center justify-center p-6 gap-3">
          {selectedPages.size > 1 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full text-xs font-medium shadow-md">
              <Scissors className="w-3.5 h-3.5" /> {selectedPages.size} pages selected — drag any to assign all
            </div>
          )}
          <div className="bg-white shadow-xl rounded-lg overflow-hidden" style={{ width: 360 }}>
            <div className="px-8 pt-6 pb-4 border-b border-gray-100 text-center">
              <p className="text-xs font-medium text-gray-700 truncate">{doc.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">Page {previewPage} of {doc.pages}</p>
              {pageAssignments[previewPage]
                ? <div className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-medium border ${(COLORS[pageAssignments[previewPage]] || COLORS.junk).bg} ${(COLORS[pageAssignments[previewPage]] || COLORS.junk).text} ${(COLORS[pageAssignments[previewPage]] || COLORS.junk).border}`}>
                    <Check className="w-3 h-3" /> Assigned to {folderNameMap[pageAssignments[previewPage]] || pageAssignments[previewPage]}
                  </div>
                : <p className="text-xs text-gray-400 mt-2 italic">Unassigned — select &amp; drag to a folder</p>
              }
            </div>
            <div className="px-8 py-6 space-y-2.5">
              {getPageLines(previewPage).map((w, i) => <div key={i} className="bg-gray-200 rounded" style={{ height: i === 0 ? 10 : 7, width: w + '%' }} />)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {pages.map(p => {
              const folder = pageAssignments[p], isSel = selectedPages.has(p);
              return <button key={p} onClick={() => setPreviewPage(p)} className="rounded-full transition-all border-2"
                style={{ width: previewPage === p ? 20 : 8, height: 8, backgroundColor: folder ? (DEPT_DOTS[folder] || '#9CA3AF') : isSel ? '#93c5fd' : '#D1D5DB', borderColor: previewPage === p ? '#3b82f6' : 'transparent' }} />;
            })}
          </div>
        </div>
        {/* Folder drop zone */}
        <div className="border-l border-gray-200 flex flex-col bg-white flex-shrink-0" style={{ width: 196 }}>
          <div className="px-3 py-2.5 border-b border-gray-200">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-700">{isDragging && draggedPages.length > 1 ? 'Drop ' + draggedPages.length + ' pages' : 'Drop pages here'}</p>
              {assignedCount > 0 && <button onClick={() => setPageAssignments({})} className="text-xs font-medium text-red-600 hover:text-red-800 hover:underline flex-shrink-0">Reset all</button>}
            </div>
            {uniqueFolders.size >= 2
              ? <p className="text-xs text-emerald-600 mt-0.5 font-medium">{uniqueFolders.size} folders assigned</p>
              : <p className="text-xs text-gray-400 mt-0.5">Assign to 2+ folders to split</p>
            }
          </div>
          <div className="flex-1 p-2 overflow-y-auto bg-gradient-to-b from-slate-50 to-slate-100">
            <div className="grid grid-cols-2 gap-1">
              {getRootFolders().map(folder => (
                <BucketTile key={folder.id} name={folderNameMap[folder.id] || folder.name} count={folderPageCounts[folder.id] || 0} isFolder={true}
                  hovered={hoveredFolder === folder.id && isDragging} pulsing={assignPulsing === folder.id}
                  onDragOver={e => handleFolderDragOver(e, folder.id)} onDragLeave={() => setHoveredFolder(null)} onDrop={e => handleFolderDrop(e, folder.id)} />
              ))}
              <BucketTile name="Junk" count={folderPageCounts['junk'] || 0} isFolder={false}
                hovered={hoveredFolder === 'junk' && isDragging} pulsing={assignPulsing === 'junk'}
                onDragOver={e => handleFolderDragOver(e, 'junk')} onDragLeave={() => setHoveredFolder(null)} onDrop={e => handleFolderDrop(e, 'junk')} />
            </div>
          </div>
        </div>
      </div>
      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-white flex-shrink-0">
        <p className="text-xs text-gray-500">
          {canApply ? getGroups().length + ' sections will be created.' : allAssigned && uniqueFolders.size < 2 ? 'Assign pages to at least 2 folders to enable split.' : (doc.pages - assignedCount) + ' page' + (doc.pages - assignedCount !== 1 ? 's' : '') + ' unassigned.'}
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md">Cancel</button>
          <button onClick={() => { if (canApply) onApply(getGroups()); }} disabled={!canApply}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${canApply ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
            Apply splits
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Main export ─────────────────────────────────────────────── */
interface Props {
  doc: Document;
  envelopeId: string;
  folderNameMap: FolderNameMap;
  onClose: () => void;
  onApplySplit: (envelopeId: string, docId: string, groups: SplitGroup[]) => void;
  // Hides the "Physical Split" action. Used when the preview is opened from
  // the Released Mail Run detail modal — the document has already been
  // dispatched, so splitting it isn't a valid action at this point.
  hideSplit?: boolean;
}

export default function DocumentPreviewModal({ doc, envelopeId, folderNameMap, onClose, onApplySplit, hideSplit }: Props) {
  const [splitMode, setSplitMode] = useState(false);
  if (!doc) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden" style={{ maxWidth: 960, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-gray-900 truncate">{splitMode ? 'Physical Split — ' + doc.title : doc.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {splitMode ? 'Select pages and drag them to folders. Apply when ready.' : doc.pages + ' page' + (doc.pages > 1 ? 's' : '') + (doc.suggestion ? ' · ' + (doc.manualRoute ? 'Routes to' : 'AI suggests') + ' ' + (folderNameMap[doc.suggestion] || doc.suggestion) : '')}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            {!hideSplit && !splitMode && doc.pages > 1 && (
              <button onClick={() => setSplitMode(true)} className="px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5" /> Physical Split
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md"><X className="w-4 h-4" /></button>
          </div>
        </div>
        {splitMode
          ? <SplitModeBody doc={doc} folderNameMap={folderNameMap} onCancel={() => setSplitMode(false)} onApply={groups => { onApplySplit(envelopeId, doc.id, groups); onClose(); }} />
          : <PreviewBody doc={doc} />
        }
      </div>
    </div>
  );
}
