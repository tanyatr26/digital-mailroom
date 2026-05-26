'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ScrollText, Shield, Info } from 'lucide-react';
import { useUser } from '@/src/context/UserContext';
import { useRoleGate } from '@/src/hooks/useRoleGate';
import TablePagination from '@/src/components/shared/TablePagination';
import { READ_AUDIT_ENTRIES, ADMIN_AUDIT_ENTRIES, type AccessMethod, type AdminAuditAction } from '@/src/mocks/auditLogs';

const PAGE_SIZE = 25;

// Unified Audit Log inner page. Both roles arrive here from the
// Configurations landing — content branches on role:
//   • System Admin: Document Views + Config Changes tabs.
//   • Folder Admin: Document Views only, scoped to their owned subtree.

const ACCESS_METHOD_LABEL: Record<AccessMethod, string> = {
  folder_browse:        'Folder browse',
  cross_folder_search:  'Cross-folder search',
  direct_link:          'Direct link',
};

const ACTION_LABEL: Record<AdminAuditAction, string> = {
  folder_created:           'Folder created',
  folder_archived:          'Folder archived',
  admin_assigned:           'Admin assigned',
  admin_reassigned:         'Admin reassigned',
  delegate_assigned:        'Delegate assigned',
  trusted_route_created:    'Trusted route created',
  trusted_route_revoked:    'Trusted route revoked',
  document_type_changed:    'Document type changed',
  tunable_default_changed:  'Tunable default changed',
  folder_admin_reminded:    'Folder admin reminded',
  sa_promoted_from_bd:      'System Admin promoted from Backup Delegate',
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

// FA scoping is a demo proxy: hide entries whose folder isn't part of the
// folder names the FA owns. In a real system this would join against
// folder_id on each entry. Falls back to showing all if no folder list.
function inFaSubtree(folderName: string, allowed: Set<string>): boolean {
  if (allowed.size === 0) return true;
  return allowed.has(folderName);
}

function Breadcrumb() {
  return (
    <nav className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
      <Link href="/configurations" className="hover:text-gray-800 transition-colors">Configurations</Link>
      <ChevronRight className="w-3 h-3 text-gray-300" />
      <span>Operations</span>
      <ChevronRight className="w-3 h-3 text-gray-300" />
      <span className="text-gray-700 font-medium">Audit Log</span>
    </nav>
  );
}

type Tab = 'views' | 'changes';

export default function AuditLogPage() {
  const allowed = useRoleGate(['System_Admin', 'Folder_Admin']);
  const { user } = useUser();
  const isSA = user.role === 'System_Admin';
  const [tab, setTab] = useState<Tab>('views');
  const [viewPage, setViewPage]     = useState(0);
  const [changePage, setChangePage] = useState(0);

  // FA proxy scope: their owned folder ids → treat as folder names too.
  const faFolderScope = useMemo(() => new Set(user.folders ?? []), [user.folders]);

  const viewRows = useMemo(() => {
    const list = [...READ_AUDIT_ENTRIES].sort((a, b) => b.timestampIso.localeCompare(a.timestampIso));
    if (isSA) return list;
    return list.filter(r => inFaSubtree(r.folderName.toLowerCase(), new Set([...faFolderScope].map(s => s.toLowerCase()))));
  }, [isSA, faFolderScope]);

  const changeRows = useMemo(() => {
    return [...ADMIN_AUDIT_ENTRIES].sort((a, b) => b.timestampIso.localeCompare(a.timestampIso));
  }, []);

  // Pagination always resets when the underlying row set or tab changes.
  useEffect(() => { setViewPage(0); },   [viewRows.length]);
  useEffect(() => { setChangePage(0); }, [changeRows.length, tab]);

  const pagedViews   = viewRows.slice(viewPage * PAGE_SIZE, viewPage * PAGE_SIZE + PAGE_SIZE);
  const pagedChanges = changeRows.slice(changePage * PAGE_SIZE, changePage * PAGE_SIZE + PAGE_SIZE);

  if (!allowed) return null;

  const activeTab: Tab = isSA ? tab : 'views';

  return (
    <div className="p-8 max-w-5xl">
      <Breadcrumb />
      <h1 className="text-2xl font-semibold text-gray-900">Audit Log</h1>
      <p className="mt-1 text-sm text-gray-500">
        {isSA
          ? 'Document views and admin configuration changes across the org. HIPAA-ready.'
          : 'Document views in folders you own. Scoped to your subtree.'}
      </p>

      {!isSA && (
        <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-900">
          <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">Scoped view.</span> You see read activity only for folders under your administration.
          </span>
        </div>
      )}

      {/* Tabs — SA only */}
      {isSA && (
        <div className="mt-5 flex items-center gap-1 border-b border-gray-200">
          <button onClick={() => setTab('views')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === 'views' ? 'text-blue-700 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-800'
            }`}>
            <ScrollText className="w-3.5 h-3.5" /> Document Views
            <span className="text-[10px] tabular-nums text-gray-400">{viewRows.length}</span>
          </button>
          <button onClick={() => setTab('changes')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === 'changes' ? 'text-blue-700 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-800'
            }`}>
            <Shield className="w-3.5 h-3.5" /> Config Changes
            <span className="text-[10px] tabular-nums text-gray-400">{changeRows.length}</span>
          </button>
        </div>
      )}

      <div className="mt-5 bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {activeTab === 'views' ? (
          <>
            <div className="px-5 py-3 border-b border-gray-100 grid grid-cols-12 gap-4 text-[11px] uppercase tracking-[0.06em] text-gray-400 font-normal">
              <div className="col-span-2">When</div>
              <div className="col-span-2">User</div>
              <div className="col-span-4">Document</div>
              <div className="col-span-2">Folder</div>
              <div className="col-span-1">Method</div>
              <div className="col-span-1 text-right">Duration</div>
            </div>
            <ul className="divide-y divide-gray-100">
              {viewRows.length === 0 ? (
                <li className="px-5 py-8 text-center text-sm text-gray-400">No document views in your scope.</li>
              ) : pagedViews.map(r => (
                <li key={r.id} className="px-5 py-2.5 grid grid-cols-12 gap-4 text-xs items-center">
                  <div className="col-span-2 text-gray-500">{formatTimestamp(r.timestampIso)}</div>
                  <div className="col-span-2 text-gray-900 font-medium truncate">{r.userName}</div>
                  <div className="col-span-4 text-gray-900 truncate">
                    {r.docTitle}
                    <span className="text-gray-400"> · #{r.docId}</span>
                  </div>
                  <div className="col-span-2 text-gray-600 truncate">{r.folderName}</div>
                  <div className="col-span-1 text-gray-500 truncate">{ACCESS_METHOD_LABEL[r.accessMethod]}</div>
                  <div className="col-span-1 text-right text-gray-500 tabular-nums">{formatDuration(r.durationSeconds)}</div>
                </li>
              ))}
            </ul>
            <TablePagination page={viewPage} pageSize={PAGE_SIZE} totalItems={viewRows.length}
              onPageChange={setViewPage} label="views" />
          </>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-gray-100 grid grid-cols-12 gap-4 text-[11px] uppercase tracking-[0.06em] text-gray-400 font-normal">
              <div className="col-span-2">When</div>
              <div className="col-span-2">User</div>
              <div className="col-span-3">Action</div>
              <div className="col-span-5">Target</div>
            </div>
            <ul className="divide-y divide-gray-100">
              {changeRows.length === 0 ? (
                <li className="px-5 py-8 text-center text-sm text-gray-400">No configuration changes recorded.</li>
              ) : pagedChanges.map(r => (
                <li key={r.id} className="px-5 py-2.5 grid grid-cols-12 gap-4 text-xs items-center">
                  <div className="col-span-2 text-gray-500">{formatTimestamp(r.timestampIso)}</div>
                  <div className="col-span-2 text-gray-900 font-medium truncate">{r.userName}</div>
                  <div className="col-span-3 text-gray-700 truncate">{ACTION_LABEL[r.action]}</div>
                  <div className="col-span-5 text-gray-900 truncate">{r.targetSummary}</div>
                </li>
              ))}
            </ul>
            <TablePagination page={changePage} pageSize={PAGE_SIZE} totalItems={changeRows.length}
              onPageChange={setChangePage} label="changes" />
          </>
        )}
      </div>
    </div>
  );
}
