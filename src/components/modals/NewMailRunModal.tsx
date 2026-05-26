'use client';
import { useEffect, useRef, useState } from 'react';
import { X, UploadCloud, FileText, AlertTriangle, Pencil, Eye, RotateCcw, Check, FileUp } from 'lucide-react';

// Brief V2 §8 — Delegate View / System Admin scan-and-upload flow.
// Three stages: upload → progress → confirm. Batch-level progress only
// (no per-file granularity). Only flagged items surface for review; the
// rest are presumed ready and the user can create the run immediately.

const ACCEPTED_MIME = 'application/pdf,image/jpeg,image/png,image/tiff';
const ACCEPTED_LABEL = 'PDF, JPG, PNG, TIFF';
const ACCEPTED_EXT_RE = /\.(pdf|jpe?g|png|tiff?)$/i;

type Stage = 'upload' | 'progress' | 'confirm';
type FlagType = 'unreadable' | 'blank' | 'duplicate';
type FlagState = 'flagged' | 'retrying' | 'retry-failed' | 'resolved';

interface FlaggedItem {
  id: string;
  type: FlagType;
  docId: string;
  fileName: string;
  duplicateOf?: string;
  state: FlagState;
}

interface Props {
  onCreate: (run: { name: string; docCount: number }) => void;
  onClose: () => void;
}

// Pull a sensible-feeling "AI" name out of a filename or batch shape.
function deriveRunName(files: File[]): string {
  if (files.length === 1) {
    const base = files[0].name.replace(ACCEPTED_EXT_RE, '').replace(/[-_]+/g, ' ').trim();
    return base || 'Untitled Mail Run';
  }
  const d = new Date();
  const hour = d.getHours();
  const timeBand = hour < 11 ? 'Morning' : hour < 15 ? 'Afternoon' : 'Late';
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${timeBand} Run — ${dateStr}`;
}

// Mock a few realistic issues. Roughly 3% of files, capped at 5; never on
// tiny batches.
function deriveFlaggedItems(files: File[]): FlaggedItem[] {
  if (files.length < 4) return [];
  const target = Math.min(5, Math.max(1, Math.round(files.length * 0.03)));
  const types: FlagType[] = ['unreadable', 'blank', 'duplicate'];
  const out: FlaggedItem[] = [];
  let docNum = 441920 + Math.floor(Math.random() * 50);
  for (let i = 0; i < target; i++) {
    const type = types[i % types.length];
    const docId = String(++docNum);
    const sourceFile = files[i % files.length];
    out.push({
      id: `flag-${i}-${Date.now()}`,
      type,
      docId,
      fileName: sourceFile?.name ?? `scan-${docId}.pdf`,
      duplicateOf: type === 'duplicate' ? String(docNum - Math.floor(Math.random() * 5) - 1) : undefined,
      state: 'flagged',
    });
  }
  return out;
}

function flagLabel(item: FlaggedItem): string {
  if (item.type === 'unreadable') return 'Unreadable scan';
  if (item.type === 'blank')      return 'Blank page detected';
  return `Duplicate of #${item.duplicateOf}`;
}

// Stylised placeholder of a scanned page. Visual cue varies by flag type
// — unreadable is blurred + noisy, blank is empty, duplicate is normal.
function ScanPreview({ item }: { item: FlaggedItem }) {
  const isUnreadable = item.type === 'unreadable';
  const isBlank      = item.type === 'blank';

  const lines = [88, 70, 92, 64, 80, 50, 74, 88, 60];
  return (
    <div className="relative mx-auto" style={{ width: 240 }}>
      <div className="rounded-md bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ aspectRatio: '8.5 / 11' }}>
        <div className="h-full p-4 flex flex-col gap-2" style={isUnreadable ? { filter: 'blur(1.6px) contrast(0.8)', opacity: 0.85 } : undefined}>
          {!isBlank && (
            <>
              <div className="h-2.5 w-3/5 bg-gray-300 rounded-sm mb-1" />
              <div className="h-px bg-gray-200 mb-1" />
              {lines.map((w, i) => (
                <div key={i} className="h-1.5 bg-gray-200 rounded-sm" style={{ width: `${w}%` }} />
              ))}
              {item.type === 'duplicate' && (
                <div className="mt-auto inline-flex self-start items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-[9px] uppercase tracking-wide font-semibold text-amber-800">
                  Duplicate of #{item.duplicateOf}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {isUnreadable && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="px-2 py-1 rounded-md bg-white/90 border border-gray-200 text-[10px] uppercase tracking-wide font-semibold text-gray-600">
            Unable to OCR
          </span>
        </div>
      )}
      {isBlank && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">Page intentionally blank</span>
        </div>
      )}
    </div>
  );
}

export default function NewMailRunModal({ onCreate, onClose }: Props) {
  const [stage, setStage]               = useState<Stage>('upload');
  const [files, setFiles]               = useState<File[]>([]);
  const [progress, setProgress]         = useState(0);
  const [runName, setRunName]           = useState('');
  const [flagged, setFlagged]           = useState<FlaggedItem[]>([]);
  const [removedCount, setRemovedCount] = useState(0);
  const [previewId, setPreviewId]       = useState<string | null>(null);
  const [replacingId, setReplacingId]   = useState<string | null>(null);
  const [isDragOver, setIsDragOver]     = useState(false);
  const fileInputRef                    = useRef<HTMLInputElement | null>(null);
  const replacementInputRef             = useRef<HTMLInputElement | null>(null);

  const acceptFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming).filter(f => ACCEPTED_EXT_RE.test(f.name));
    if (list.length === 0) return;
    setFiles(list);
    setStage('progress');
    setProgress(0);
  };

  // Fake batch progress — simulated ~1.6s ramp to 100% regardless of size.
  useEffect(() => {
    if (stage !== 'progress') return;
    const total = files.length;
    if (!total) return;
    const start = Date.now();
    const DURATION = 1600;
    const tick = () => {
      const elapsed = Date.now() - start;
      const ratio = Math.min(1, elapsed / DURATION);
      setProgress(Math.round(ratio * 100));
      if (ratio < 1) requestAnimationFrame(tick);
      else {
        // Transition to confirm stage with AI-derived name + flagged items.
        setRunName(deriveRunName(files));
        setFlagged(deriveFlaggedItems(files));
        setStage('confirm');
      }
    };
    requestAnimationFrame(tick);
  }, [stage, files]);

  const handleBrowse        = () => fileInputRef.current?.click();
  const handleInputChange   = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) acceptFiles(e.target.files);
    e.target.value = '';
  };
  const handleDragOver      = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave     = () => setIsDragOver(false);
  const handleDrop          = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files) acceptFiles(e.dataTransfer.files); };

  // Flagged-item actions ------------------------------------------------
  // Remove drops the doc from the batch entirely (total ready -1).
  const handleRemove = (id: string) => {
    setFlagged(prev => prev.filter(f => f.id !== id));
    setRemovedCount(c => c + 1);
    if (previewId === id) setPreviewId(null);
  };

  // Retry simulates re-OCR / re-detection on the existing scan.
  const handleRetry = (id: string) => {
    setFlagged(prev => prev.map(f => f.id === id ? { ...f, state: 'retrying' } : f));
    window.setTimeout(() => {
      const success = Math.random() < 0.65;
      setFlagged(prev => prev.map(f => f.id === id ? { ...f, state: success ? 'resolved' : 'retry-failed' } : f));
      if (success) {
        // Brief green flash, then sweep the resolved item out.
        window.setTimeout(() => {
          setFlagged(prev => prev.filter(f => f.id !== id));
          if (previewId === id) setPreviewId(null);
        }, 900);
      }
    }, 1400);
  };

  // Upload replacement — pick a single fresh file for this doc.
  const handleStartReplace = (id: string) => {
    setReplacingId(id);
    // Defer click so React updates before the picker opens.
    window.setTimeout(() => replacementInputRef.current?.click(), 0);
  };
  const handleReplacementChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = replacingId;
    setReplacingId(null);
    e.target.value = '';
    if (!file || !id) return;
    // Show retrying state during the simulated re-ingest, then resolve.
    setFlagged(prev => prev.map(f => f.id === id ? { ...f, state: 'retrying', fileName: file.name } : f));
    window.setTimeout(() => {
      setFlagged(prev => prev.map(f => f.id === id ? { ...f, state: 'resolved' } : f));
      window.setTimeout(() => {
        setFlagged(prev => prev.filter(f => f.id !== id));
        if (previewId === id) setPreviewId(null);
      }, 900);
    }, 900);
  };

  const confirmCreate = () => {
    const trimmed = runName.trim() || deriveRunName(files);
    onCreate({ name: trimmed, docCount: files.length - removedCount });
  };

  const previewItem      = previewId ? flagged.find(f => f.id === previewId) ?? null : null;
  const filesProcessed   = Math.round((progress / 100) * files.length);
  const totalReady       = files.length - removedCount;
  // "Others ready" excludes anything still under review.
  const stillNeedsReview = flagged.filter(f => f.state !== 'resolved');
  const othersCount      = Math.max(0, totalReady - stillNeedsReview.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 560, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">New Mail Run</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {stage === 'upload'   && 'Drop your batch of scanned mail to start a new run.'}
              {stage === 'progress' && 'Uploading documents…'}
              {stage === 'confirm'  && 'Resolve flagged items inline — the rest are ready to go.'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        {stage === 'upload' && (
          <div className="px-6 py-6 overflow-y-auto">
            <div onClick={handleBrowse} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer text-center px-6 py-12 ${isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'}`}>
              <UploadCloud className={`w-10 h-10 mx-auto mb-3 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
              <p className="text-sm font-semibold text-gray-900">Drag &amp; drop files here</p>
              <p className="text-xs text-gray-500 mt-1">or click to browse</p>
              <p className="text-[11px] text-gray-400 mt-3">Accepted: {ACCEPTED_LABEL}</p>
            </div>
            <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_MIME} onChange={handleInputChange} className="hidden" />
          </div>
        )}

        {stage === 'progress' && (
          <div className="px-6 py-10 overflow-y-auto">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{filesProcessed} of {files.length} files · {progress}%</p>
                <p className="text-xs text-gray-500 mt-0.5">Scanning and indexing…</p>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all" style={{ width: progress + '%' }} />
            </div>
          </div>
        )}

        {stage === 'confirm' && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div>
              <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-400 mb-1.5">Run name</label>
              <div className="relative">
                <input value={runName} onChange={e => setRunName(e.target.value)}
                  className="w-full px-3 py-2 pr-9 text-sm font-medium text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400" />
                <Pencil className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">AI suggested · click to edit.</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-900">{totalReady} document{totalReady !== 1 ? 's' : ''} ready</p>
              {flagged.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-amber-200 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-semibold text-amber-900">
                      {stillNeedsReview.length} need{stillNeedsReview.length !== 1 ? '' : 's'} review
                    </p>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-amber-200">
                    {flagged.map(item => <FlaggedRow key={item.id}
                      item={item}
                      onPreview={() => setPreviewId(item.id)}
                      onRetry={() => handleRetry(item.id)}
                      onReupload={() => handleStartReplace(item.id)}
                      onRemove={() => handleRemove(item.id)}
                    />)}
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2.5">
                {othersCount} other{othersCount !== 1 ? 's' : ''} ready · no action needed
              </p>
            </div>
            <input ref={replacementInputRef} type="file" accept={ACCEPTED_MIME} onChange={handleReplacementChosen} className="hidden" />
          </div>
        )}

        {stage === 'confirm' && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
            <button onClick={confirmCreate} disabled={!runName.trim() || totalReady < 1}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors shadow-sm ${runName.trim() && totalReady >= 1 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
              Create Mail Run →
            </button>
          </div>
        )}
      </div>

      {/* Preview overlay — its own z layer above the modal body. */}
      {previewItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={() => setPreviewId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 360 }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-gray-200 flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">Preview · <span className="font-mono text-gray-700">#{previewItem.docId}</span></p>
                <p className="text-[11px] text-gray-500 truncate mt-0.5">{previewItem.fileName}</p>
              </div>
              <button onClick={() => setPreviewId(null)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="px-5 py-5 bg-gray-50">
              <ScanPreview item={previewItem} />
              <div className="mt-3 flex items-center gap-2 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span className="text-amber-900 font-medium">{flagLabel(previewItem)}</span>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 bg-white flex items-center justify-end gap-2">
              <button onClick={() => handleRemove(previewItem.id)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Remove
              </button>
              <button onClick={() => handleRetry(previewItem.id)} disabled={previewItem.state === 'retrying' || previewItem.state === 'retry-failed'}
                title={previewItem.state === 'retry-failed' ? 'Already retried — try reupload' : 'Re-run detection on this scan'}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1 ${previewItem.state === 'retrying' || previewItem.state === 'retry-failed' ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}>
                <RotateCcw className={`w-3.5 h-3.5 ${previewItem.state === 'retrying' ? 'animate-spin' : ''}`} /> Retry
              </button>
              <button onClick={() => { setPreviewId(null); handleStartReplace(previewItem.id); }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm inline-flex items-center gap-1">
                <FileUp className="w-3.5 h-3.5" /> Reupload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Per-row state machine ──────────────────────────────────────────────
// Default:       [👁 Preview] [↻ Retry] [⬆ Reupload] [× Remove]
//                Retry re-runs detection on the existing scan; Reupload
//                lets the admin swap in a fresh file without redoing the
//                whole batch.
// Retrying:      spinner + "Retrying…", actions hidden.
// Retry-failed:  amber → red, default actions kept but Reupload is
//                emphasized as the recovery path; Retry is disabled.
// Resolved:      brief green flash for ~900ms before the row sweeps out.
interface RowProps {
  item: FlaggedItem;
  onPreview: () => void;
  onRetry: () => void;
  onReupload: () => void;
  onRemove: () => void;
}
function FlaggedRow({ item, onPreview, onRetry, onReupload, onRemove }: RowProps) {
  if (item.state === 'resolved') {
    return (
      <div className="px-3 py-2 flex items-center gap-2 bg-emerald-50 transition-colors">
        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
        <p className="flex-1 text-xs font-medium text-emerald-800 truncate">
          Recovered · <span className="font-mono">#{item.docId}</span>
        </p>
      </div>
    );
  }

  if (item.state === 'retrying') {
    return (
      <div className="px-3 py-2 flex items-center gap-2">
        <RotateCcw className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 animate-spin" />
        <p className="flex-1 text-xs text-amber-900 truncate">
          Retrying · <span className="font-mono">#{item.docId}</span>
        </p>
      </div>
    );
  }

  const failed = item.state === 'retry-failed';
  const wrapClass = failed
    ? 'px-3 py-2 flex items-center gap-2 bg-red-50'
    : 'px-3 py-2 flex items-center gap-2';
  const textClass = failed ? 'text-red-800' : 'text-amber-900';
  const accentClass = failed ? 'text-red-700' : 'text-amber-700';
  const hoverClass  = failed ? 'hover:bg-red-100' : 'hover:bg-amber-100';

  return (
    <div className={wrapClass}>
      <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 ${failed ? 'text-red-600' : 'text-amber-600'}`} />
      <p className={`flex-1 text-xs truncate ${textClass}`}>
        {failed ? 'Retry failed' : flagLabel(item)} <span className={accentClass}>· <span className="font-mono">#{item.docId}</span></span>
      </p>
      <button onClick={onPreview} title="Preview document"
        className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${accentClass} ${hoverClass}`}>
        <Eye className="w-3 h-3" />
      </button>
      <button onClick={onRetry} disabled={failed}
        title={failed ? 'Already retried — try reupload' : 'Retry scan'}
        className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${failed ? 'text-red-300 cursor-not-allowed' : `${accentClass} ${hoverClass}`}`}>
        <RotateCcw className="w-3 h-3" />
      </button>
      <button onClick={onReupload}
        title="Reupload a fresh file for this scan"
        className={failed
          ? 'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 rounded-md transition-colors'
          : `w-6 h-6 flex items-center justify-center rounded-md transition-colors ${accentClass} ${hoverClass}`}>
        <FileUp className="w-3 h-3" />{failed && <span>Reupload</span>}
      </button>
      <button onClick={onRemove} title="Remove from upload"
        className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${accentClass} ${hoverClass}`}>
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
