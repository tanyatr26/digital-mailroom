'use client';
import { useEffect, useRef, useState } from 'react';
import { X, UploadCloud, FileText, Pencil } from 'lucide-react';

// Brief V2 §8 — Folder Admin "Upload Document" flow. Same three-stage
// shape as NewMailRunModal but without the AI routing + flagged-items
// review. Uploaded docs land in the inbox as-is for manual routing.

const ACCEPTED_MIME = 'application/pdf,image/jpeg,image/png,image/tiff';
const ACCEPTED_LABEL = 'PDF, JPG, PNG, TIFF';
const ACCEPTED_EXT_RE = /\.(pdf|jpe?g|png|tiff?)$/i;

type Stage = 'upload' | 'progress' | 'confirm';

interface Props {
  // Brief V2 §8 — Uploaded docs land in the admin's aggregated inbox and
  // are tagged with `inboxSource: { kind: 'uploaded' }`, which renders as
  // an "Uploaded" badge on the doc card. No per-upload destination folder
  // is selected here — origin is conveyed by the badge.
  // `fileNames` lets the parent synthesize per-doc cards in the inbox
  // table and downstream workspace; the underlying File objects aren't
  // persisted.
  onAdd: (batch: { name: string; docCount: number; fileNames: string[] }) => void;
  onClose: () => void;
}

function deriveBatchName(files: File[]): string {
  if (files.length === 1) {
    const base = files[0].name.replace(ACCEPTED_EXT_RE, '').replace(/[-_]+/g, ' ').trim();
    return base || 'Untitled Upload';
  }
  const d = new Date();
  const hour = d.getHours();
  const timeBand = hour < 11 ? 'Morning' : hour < 15 ? 'Afternoon' : 'Late';
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${timeBand} Upload — ${dateStr}`;
}

export default function UploadDocumentModal({ onAdd, onClose }: Props) {
  const [stage, setStage]           = useState<Stage>('upload');
  const [files, setFiles]           = useState<File[]>([]);
  const [progress, setProgress]     = useState(0);
  const [batchName, setBatchName]   = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef                = useRef<HTMLInputElement | null>(null);

  const acceptFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming).filter(f => ACCEPTED_EXT_RE.test(f.name));
    if (list.length === 0) return;
    setFiles(list);
    setStage('progress');
    setProgress(0);
  };

  useEffect(() => {
    if (stage !== 'progress') return;
    if (!files.length) return;
    const start = Date.now();
    const DURATION = 1400;
    const tick = () => {
      const elapsed = Date.now() - start;
      const ratio = Math.min(1, elapsed / DURATION);
      setProgress(Math.round(ratio * 100));
      if (ratio < 1) requestAnimationFrame(tick);
      else {
        setBatchName(deriveBatchName(files));
        setStage('confirm');
      }
    };
    requestAnimationFrame(tick);
  }, [stage, files]);

  const handleBrowse      = () => fileInputRef.current?.click();
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) acceptFiles(e.target.files);
    e.target.value = '';
  };
  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop      = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files) acceptFiles(e.dataTransfer.files); };

  const confirmAdd = () => {
    const trimmed = batchName.trim() || deriveBatchName(files);
    onAdd({ name: trimmed, docCount: files.length, fileNames: files.map(f => f.name) });
  };

  const filesProcessed = Math.round((progress / 100) * files.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 520, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Upload Document</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {stage === 'upload'   && 'Upload one or more files. They will land in your inbox tagged Uploaded for routing.'}
              {stage === 'progress' && 'Uploading…'}
              {stage === 'confirm'  && 'Ready to add to your inbox.'}
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
                <p className="text-xs text-gray-500 mt-0.5">Uploading…</p>
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
              <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-400 mb-1.5">Batch name</label>
              <div className="relative">
                <input value={batchName} onChange={e => setBatchName(e.target.value)}
                  className="w-full px-3 py-2 pr-9 text-sm font-medium text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400" />
                <Pencil className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">AI suggested · click to edit.</p>
            </div>
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">{files.length} document{files.length !== 1 ? 's' : ''} ready</span> · no action needed
            </p>
            <p className="text-[11px] text-gray-400">Documents will land in your inbox as <span className="font-medium text-gray-600">New</span> for manual routing.</p>
          </div>
        )}

        {stage === 'confirm' && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
            <button onClick={confirmAdd} disabled={!batchName.trim()}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors shadow-sm ${batchName.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
              Add to Inbox →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
