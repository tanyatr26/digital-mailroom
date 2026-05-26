'use client';
import { useMemo, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Upload, FileText, X, Sparkles, AlertTriangle, Search } from 'lucide-react';
import { DOCUMENT_TYPES, findDocumentType } from '@/src/mocks/documentTypes';
import { FOLDERS } from '@/src/mocks/data';
import { findUser } from '@/src/mocks/users';
import { useUser } from '@/src/context/UserContext';
import { useRoleGate } from '@/src/hooks/useRoleGate';
import type { ExampleDocument, Folder } from '@/src/types';

interface Props { params: Promise<{ typeId: string }> }

export default function DocTypeEditPage({ params }: Props) {
  const allowed = useRoleGate(['System_Admin']);
  const { user } = useUser();
  const { typeId } = use(params);
  const router = useRouter();
  const original = findDocumentType(typeId) ?? DOCUMENT_TYPES[0];

  const [displayName, setDisplayName]     = useState(original.display_name);
  const [retention, setRetention]         = useState(original.retention_days);
  const [autoUrgent, setAutoUrgent]       = useState(original.auto_urgent);
  const [examples, setExamples]           = useState<ExampleDocument[]>([...original.example_documents]);
  const [savedMessage, setSavedMessage]   = useState('');

  // V2 §17 — Routing hint. Optional folder picker. Same keystroke-gated
  // pattern as the Assign recipient field in the Add Recipient modal.
  const [routingHintFolder, setRoutingHintFolder] = useState<Folder | null>(() => {
    const id = original.routing_hint_folder_id;
    return id ? FOLDERS.find(f => f.id === id) ?? null : null;
  });
  const [folderSearch, setFolderSearch] = useState('');
  const folderCandidates = useMemo(() => {
    // Scope to the SA's owned folders — same created_by_user_id gate
    // Folder Assignments + Folder Tree's owned-menu use. Also exclude
    // archived and inactive-admin folders, plus personal mailboxes
    // (a doc-type routing hint should land in a group folder, never
    // funnel every doc of a type into one person's inbox).
    let list = FOLDERS.filter(f =>
      f.created_by_user_id === user.id
      && !f.is_archived
      && f.admin_status !== 'inactive_admin'
      && f.recipient_type !== 'personal',
    );
    const q = folderSearch.trim().toLowerCase();
    if (q) list = list.filter(f => f.name.toLowerCase().includes(q));
    return list.slice(0, 8);
  }, [folderSearch, user.id]);

  const handleRemoveExample = (id: string) => setExamples(prev => prev.filter(e => e.id !== id));
  const handleAddExample = () => {
    const stamp = Date.now();
    setExamples(prev => [...prev, {
      id: 'ex-' + stamp,
      filename: 'new_example_' + (prev.length + 1) + '.pdf',
      uploadedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      sizeKb: 200,
    }]);
  };

  const handleSave = () => {
    setSavedMessage('Saved. (Demo only — not persisted across reloads.)');
    setTimeout(() => setSavedMessage(''), 2500);
  };

  const years = (retention / 365);
  const yearsLabel = years >= 1 ? '≈ ' + Math.round(years * 10) / 10 + ' years' : retention + ' days';
  const exCount = examples.length;
  const exShortfall = exCount < 3;

  const hintAdminName = routingHintFolder?.admin_user_id ? findUser(routingHintFolder.admin_user_id)?.name : undefined;

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/configurations/doc-types" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors mb-4">
        <ChevronLeft className="w-3.5 h-3.5" /> Back to Document Types
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Edit Document Type — {original.display_name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        Type ID: <span className="font-mono">{original.type_id}</span> <span className="text-gray-400">(immutable)</span>
      </p>

      <div className="mt-6 bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
        <section className="px-6 py-5">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400 mb-4">Display</p>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
            Display name <span className="text-red-500">*</span>
          </label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400" />
        </section>

        <section className="px-6 py-5 space-y-5">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400">Behavior</p>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              Retention period <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3">
              <input type="number" value={retention} onChange={e => setRetention(Number(e.target.value))}
                className="w-28 px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400" />
              <span className="text-sm text-gray-500">days</span>
              <span className="text-xs text-gray-400">( {yearsLabel} )</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">Auto-urgent</label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="checkbox" checked={autoUrgent} onChange={e => setAutoUrgent(e.target.checked)} />
              Automatically flag all docs of this type as urgent
            </label>
          </div>
        </section>

        <section className="px-6 py-5 space-y-4">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400">Routing</p>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">Suggested destination</label>
            {routingHintFolder ? (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-900 truncate">{routingHintFolder.name}</p>
                  {hintAdminName && <p className="text-[11px] text-blue-700/80 truncate">Admin: {hintAdminName}</p>}
                </div>
                <button onClick={() => { setRoutingHintFolder(null); setFolderSearch(''); }}
                  title="Clear suggested destination"
                  className="flex-shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md text-blue-700 hover:bg-blue-100 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input value={folderSearch} onChange={e => setFolderSearch(e.target.value)}
                  placeholder="Search folders…"
                  className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400" />
              </div>
            )}
            {!routingHintFolder && folderSearch.trim().length > 0 && (
              <ul className="mt-2 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100" style={{ maxHeight: 200, overflowY: 'auto' }}>
                {folderCandidates.length === 0 ? (
                  <li className="px-3 py-3 text-xs text-gray-400 italic text-center">No matching folders.</li>
                ) : folderCandidates.map(f => {
                  const adminName = f.admin_user_id ? findUser(f.admin_user_id)?.name : undefined;
                  return (
                    <li key={f.id}>
                      <button onClick={() => { setRoutingHintFolder(f); setFolderSearch(''); }}
                        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-white transition-colors">
                        <div className="w-4 h-4 rounded-full border bg-white border-gray-300" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{f.name}</p>
                          {adminName && <p className="text-[11px] text-gray-500 truncate">Admin: {adminName}</p>}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
              Helps the AI route this document type when it has little or no routing history to go on. High-confidence learned routes always take priority.
            </p>
          </div>
        </section>

        <section className="px-6 py-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400">AI training — example documents</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                The AI compares incoming mail against these PDFs to classify documents as this type. Upload 3–5 varied examples for best results.
                Files are stored securely and never visible to non-admin users.
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-semibold text-blue-700">{exCount} uploaded</span>
            </div>
          </div>

          {exShortfall && (
            <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 leading-relaxed">
                Only {exCount} example{exCount !== 1 ? 's' : ''} uploaded — AI classification accuracy may be low. Add at least 3 varied examples.
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-3">
            {examples.map(ex => (
              <div key={ex.id} className="group relative aspect-[4/3] flex flex-col items-center justify-center gap-1 border border-gray-200 rounded-lg bg-gray-50 px-3 py-2 hover:border-gray-300 transition-colors">
                <button onClick={() => handleRemoveExample(ex.id)}
                  title="Remove example"
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100">
                  <X className="w-3 h-3" />
                </button>
                <FileText className="w-6 h-6 text-blue-400" />
                <p className="text-xs font-medium text-gray-700 truncate w-full text-center">{ex.filename}</p>
                <p className="text-[10px] text-gray-400">Uploaded {ex.uploadedAt}</p>
                {typeof ex.sizeKb === 'number' && <p className="text-[10px] text-gray-400">{ex.sizeKb} KB</p>}
              </div>
            ))}
            <button onClick={handleAddExample}
              className="aspect-[4/3] flex flex-col items-center justify-center gap-1 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors">
              <Upload className="w-4 h-4" /> Upload more
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 italic">Upload is demo-only — files are not persisted in this pass.</p>
        </section>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button onClick={() => router.push('/configurations/doc-types')}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
        <div className="flex items-center gap-3">
          {savedMessage && <p className="text-xs font-medium text-emerald-600">{savedMessage}</p>}
          <button onClick={handleSave}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
