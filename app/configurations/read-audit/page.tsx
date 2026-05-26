'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronDown, Download } from 'lucide-react';
import { READ_AUDIT_ENTRIES, type AccessMethod } from '@/src/mocks/auditLogs';
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

const ACCESS_METHOD_LABEL: Record<AccessMethod, string> = {
  folder_browse:        'Folder browse',
  cross_folder_search:  'Cross-folder search',
  direct_link:          'Direct link',
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

function formatDuration(seconds: number): string {
  if (seconds < 60) return seconds + 's';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + 'm ' + (s.toString().padStart(2, '0')) + 's';
}

export default function ReadAuditPage() {
  const allowed = useRoleGate(['System_Admin']);
  const [userFilter, setUserFilter]     = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<AccessMethod | 'all'>('all');
  const [range, setRange]               = useState<DateRange>('30d');
  const [page, setPage]                 = useState(0);

  const rows = useMemo(() => {
    let list = [...READ_AUDIT_ENTRIES];
    if (userFilter !== 'all') list = list.filter(r => r.userId === userFilter);
    if (methodFilter !== 'all') list = list.filter(r => r.accessMethod === methodFilter);
    list = list.filter(r => inRange(r.timestampIso, range));
    list.sort((a, b) => b.timestampIso.localeCompare(a.timestampIso));
    return list;
  }, [userFilter, methodFilter, range]);

  useEffect(() => { setPage(0); }, [userFilter, methodFilter, range]);
  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/configurations" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors mb-4">
        <ChevronLeft className="w-3.5 h-3.5" /> All configurations
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Read Audit Log</h1>
      <p className="mt-1 text-sm text-gray-500">Every document view by any user · HIPAA-ready.</p>

      <div className="mt-5 flex items-center gap-2 flex-wrap">
        <SelectChevron value={userFilter} onChange={setUserFilter}>
          <option value="all">All users</option>
          {SSO_USERS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </SelectChevron>
        <SelectChevron value={methodFilter} onChange={v => setMethodFilter(v as AccessMethod | 'all')}>
          <option value="all">All access methods</option>
          {Object.entries(ACCESS_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
            <col style={{ width: '17%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '23%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Timestamp</th>
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">User</th>
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Document</th>
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Access method</th>
              <th className="px-4 py-3 text-right text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No entries match.</td></tr>
            ) : pageRows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-600">{formatTimestamp(r.timestampIso)}</td>
                <td className="px-4 py-3 text-sm text-gray-700 truncate">{r.userName}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="font-mono text-gray-500">#{r.docId}</span>
                  <span className="text-gray-300 mx-1.5">·</span>
                  <span className="text-gray-700">{r.docTitle}</span>
                  <span className="text-gray-300 mx-1.5">·</span>
                  <span className="text-gray-500 text-xs">{r.folderName}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{ACCESS_METHOD_LABEL[r.accessMethod]}</td>
                <td className="px-4 py-3 text-sm text-gray-500 text-right font-mono">{formatDuration(r.durationSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={rows.length}
          onPageChange={setPage} label="views" />
      </div>
      <p className="mt-3 text-xs text-gray-400">{rows.length} view{rows.length !== 1 ? 's' : ''} in selected range</p>
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
