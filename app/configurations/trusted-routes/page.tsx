'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Search, X, ChevronDown, Star, Sparkles, MoreVertical } from 'lucide-react';
import { ORG_TRUSTED_ROUTES, type FolderScopedTrustedRoute } from '@/src/mocks/trustedRoutes';
import { findFolder } from '@/src/mocks/data';
import { useRoleGate } from '@/src/hooks/useRoleGate';
import TablePagination from '@/src/components/shared/TablePagination';

const PAGE_SIZE = 25;

export default function TrustedRoutesAllPage() {
  const allowed = useRoleGate(['System_Admin']);
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter]     = useState<string>('all');
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(0);
  const [rows, setRows] = useState<FolderScopedTrustedRoute[]>(ORG_TRUSTED_ROUTES);

  const folderOptions = useMemo(() => {
    const ids = new Set(ORG_TRUSTED_ROUTES.map(r => r.folder_id));
    return Array.from(ids);
  }, []);
  const sourceOptions = useMemo(() => Array.from(new Set(ORG_TRUSTED_ROUTES.map(r => r.pattern.sender))), []);
  const typeOptions   = useMemo(() => Array.from(new Set(ORG_TRUSTED_ROUTES.map(r => r.pattern.document_type))), []);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (folderFilter !== 'all') list = list.filter(r => r.folder_id === folderFilter);
    if (sourceFilter !== 'all') list = list.filter(r => r.pattern.sender === sourceFilter);
    if (typeFilter   !== 'all') list = list.filter(r => r.pattern.document_type === typeFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(r =>
      r.pattern.sender.toLowerCase().includes(q) ||
      r.pattern.document_type.toLowerCase().includes(q) ||
      (findFolder(r.destination)?.name ?? '').toLowerCase().includes(q),
    );
    return list;
  }, [rows, folderFilter, sourceFilter, typeFilter, search]);

  useEffect(() => { setPage(0); }, [folderFilter, sourceFilter, typeFilter, search]);
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const folderName = (id: string) => findFolder(id)?.name ?? id;
  const activeCount = rows.filter(r => r.isActive).length;
  const folderCount = new Set(rows.filter(r => r.isActive).map(r => r.folder_id)).size;

  const toggle = (id: string) => setRows(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
  const revoke = (id: string) => setRows(prev => prev.map(r => r.id === id ? { ...r, isActive: false } : r));

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/configurations" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors mb-4">
        <ChevronLeft className="w-3.5 h-3.5" /> All configurations
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Trusted Routes — All Folders</h1>
      <p className="mt-1 text-sm text-gray-500">Read + revoke only. Folder admins create their own rules.</p>

      <div className="mt-5 flex items-center gap-2 flex-wrap">
        <FilterSelect value={folderFilter} onChange={setFolderFilter}
          options={[{ value: 'all', label: 'All folders' }, ...folderOptions.map(id => ({ value: id, label: folderName(id) }))]} />
        <FilterSelect value={sourceFilter} onChange={setSourceFilter}
          options={[{ value: 'all', label: 'All sources' }, ...sourceOptions.map(s => ({ value: s, label: s }))]} />
        <FilterSelect value={typeFilter} onChange={setTypeFilter}
          options={[{ value: 'all', label: 'All types' }, ...typeOptions.map(t => ({ value: t, label: t }))]} />
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-9 pl-8 pr-7 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400"
            style={{ width: 220 }} />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
        </div>
      </div>

      <div className="mt-5 bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '6%' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Folder</th>
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">From</th>
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Doc type</th>
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">→ Destination</th>
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No trusted routes match the filters.</td></tr>
            ) : pageRows.map(r => (
              <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${r.isActive ? '' : 'opacity-60'}`}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 truncate">{folderName(r.folder_id)}</td>
                <td className="px-4 py-3 text-sm text-gray-700 truncate">{r.pattern.sender}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{r.pattern.document_type}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{folderName(r.destination)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    {r.markedBy === 'AI'
                      ? <Sparkles className="w-3 h-3 text-blue-500" />
                      : <Star className="w-3 h-3 text-amber-500" style={{ fill: '#facc15' }} />}
                    {r.markedBy} · {r.markedAt} · {r.usageCount} use{r.usageCount !== 1 ? 's' : ''}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button onClick={() => toggle(r.id)}
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border transition-colors ${r.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}>
                      {r.isActive ? 'On' : 'Off'}
                    </button>
                    <RowMenu onRevoke={() => revoke(r.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={filtered.length}
          onPageChange={setPage} label="routes" />
      </div>
      <p className="mt-3 text-xs text-gray-400">{activeCount} active rule{activeCount !== 1 ? 's' : ''} across {folderCount} folder{folderCount !== 1 ? 's' : ''}</p>
    </div>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="h-9 text-sm text-gray-900 border border-gray-300 rounded-lg pl-3 pr-8 appearance-none bg-white focus:outline-none focus:border-blue-400">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none w-3.5 h-3.5 text-gray-400" />
    </div>
  );
}

function RowMenu({ onRevoke }: { onRevoke: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-gray-200 rounded-xl shadow-xl py-1 overflow-hidden" style={{ minWidth: 180 }}>
            <button onClick={() => { setOpen(false); }} className="w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50">View matching docs</button>
            <button onClick={() => { setOpen(false); }} className="w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50">Open folder</button>
            <div className="h-px bg-gray-100 mx-3 my-0.5" />
            <button onClick={() => { setOpen(false); onRevoke(); }} className="w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50">Revoke</button>
          </div>
        </>
      )}
    </div>
  );
}
