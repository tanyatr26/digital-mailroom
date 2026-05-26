'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronDown, Download, X } from 'lucide-react';
import { ADMIN_AUDIT_ENTRIES, type AdminAuditAction, type AdminAuditEntry } from '@/src/mocks/auditLogs';
import { SSO_USERS } from '@/src/mocks/users';
import { useRoleGate } from '@/src/hooks/useRoleGate';
import TablePagination from '@/src/components/shared/TablePagination';

const PAGE_SIZE = 25;

type DateRange = '24h' | '7d' | '30d' | '90d' | 'all';

const RANGE_LABEL: Record<DateRange, string> = {
  '24h': 'Last 24 hours',
  '7d':  'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all:   'All time',
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

const NOW = Date.parse('2026-05-14T12:00:00');
function inRange(iso: string, range: DateRange): boolean {
  if (range === 'all') return true;
  const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
  return NOW - Date.parse(iso) <= days * 86_400_000;
}
function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function AdminAuditPage() {
  const allowed = useRoleGate(['System_Admin']);
  const [actionFilter, setActionFilter] = useState<AdminAuditAction | 'all'>('all');
  const [userFilter, setUserFilter]     = useState<string>('all');
  const [range, setRange]               = useState<DateRange>('30d');
  const [detailsFor, setDetailsFor]     = useState<AdminAuditEntry | null>(null);
  const [page, setPage]                 = useState(0);

  const rows = useMemo(() => {
    let list = [...ADMIN_AUDIT_ENTRIES];
    if (actionFilter !== 'all') list = list.filter(r => r.action === actionFilter);
    if (userFilter !== 'all')   list = list.filter(r => r.userId === userFilter);
    list = list.filter(r => inRange(r.timestampIso, range));
    list.sort((a, b) => b.timestampIso.localeCompare(a.timestampIso));
    return list;
  }, [actionFilter, userFilter, range]);

  useEffect(() => { setPage(0); }, [actionFilter, userFilter, range]);
  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/configurations" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors mb-4">
        <ChevronLeft className="w-3.5 h-3.5" /> All configurations
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Admin Audit Trail</h1>
      <p className="mt-1 text-sm text-gray-500">Every configuration change · Immutable.</p>

      <div className="mt-5 flex items-center gap-2 flex-wrap">
        <SelectChevron value={actionFilter} onChange={v => setActionFilter(v as AdminAuditAction | 'all')}>
          <option value="all">All actions</option>
          {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectChevron>
        <SelectChevron value={userFilter} onChange={setUserFilter}>
          <option value="all">All users</option>
          {SSO_USERS.filter(u => u.systemAdmin || u.foldersAdminCount).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </SelectChevron>
        <SelectChevron value={range} onChange={v => setRange(v as DateRange)}>
          {Object.entries(RANGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectChevron>
        <button className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="mt-5 bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '32%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Timestamp</th>
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">User</th>
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Action</th>
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Target</th>
              <th className="px-4 py-3 text-right text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No entries match.</td></tr>
            ) : pageRows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-600">{formatTimestamp(r.timestampIso)}</td>
                <td className="px-4 py-3 text-sm text-gray-700 truncate">{r.userName}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{ACTION_LABEL[r.action]}</td>
                <td className="px-4 py-3 text-sm text-gray-600 truncate">{r.targetSummary}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setDetailsFor(r)}
                    className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                    details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={rows.length}
          onPageChange={setPage} label="entries" />
      </div>
      <p className="mt-3 text-xs text-gray-400">{rows.length} entr{rows.length !== 1 ? 'ies' : 'y'} in selected range</p>

      {detailsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={() => setDetailsFor(null)}>
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: 640, maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400">Admin Audit Entry</p>
                <h2 className="mt-1 text-base font-semibold text-gray-900">{ACTION_LABEL[detailsFor.action]}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{detailsFor.userName} · {formatTimestamp(detailsFor.timestampIso)}</p>
              </div>
              <button onClick={() => setDetailsFor(null)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400 mb-1.5">Target</p>
                <p className="text-sm text-gray-700">{detailsFor.targetSummary}</p>
              </div>
              {detailsFor.beforeState && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400 mb-1.5">Before</p>
                  <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto font-mono text-gray-800 whitespace-pre-wrap">{JSON.stringify(detailsFor.beforeState, null, 2)}</pre>
                </div>
              )}
              {detailsFor.afterState && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400 mb-1.5">After</p>
                  <pre className="text-xs bg-emerald-50 border border-emerald-200 rounded-lg p-3 overflow-x-auto font-mono text-gray-800 whitespace-pre-wrap">{JSON.stringify(detailsFor.afterState, null, 2)}</pre>
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-gray-200 flex justify-end bg-gray-50 flex-shrink-0">
              <button onClick={() => setDetailsFor(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectChevron({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="h-9 text-sm text-gray-900 border border-gray-300 rounded-lg pl-3 pr-8 appearance-none bg-white focus:outline-none focus:border-blue-400">
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none w-3.5 h-3.5 text-gray-400" />
    </div>
  );
}
