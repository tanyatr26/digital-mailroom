'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Search, X, Pencil, AlertTriangle, Sparkles, FileText } from 'lucide-react';
import { DOCUMENT_TYPES } from '@/src/mocks/documentTypes';
import { useRoleGate } from '@/src/hooks/useRoleGate';
import TablePagination from '@/src/components/shared/TablePagination';

const PAGE_SIZE = 25;

export default function DocTypesListPage() {
  const allowed = useRoleGate(['System_Admin']);
  const [search, setSearch] = useState('');
  const [regulatedOnly, setRegulatedOnly] = useState(false);
  const [page, setPage] = useState(0);

  const types = useMemo(() => {
    let list = [...DOCUMENT_TYPES];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(t => t.display_name.toLowerCase().includes(q));
    if (regulatedOnly) list = list.filter(t => t.regulated);
    return list;
  }, [search, regulatedOnly]);

  useEffect(() => { setPage(0); }, [search, regulatedOnly]);
  const pageTypes = types.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/configurations" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors mb-4">
        <ChevronLeft className="w-3.5 h-3.5" /> All configurations
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Document Type Registry</h1>
      <p className="mt-1 text-sm text-gray-500">Per-type retention, regulatory flags, and the example PDFs the AI uses to recognize each type.</p>

      <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-900">
        <Sparkles className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
        <span><span className="font-semibold">AI training:</span> Each type&apos;s example documents drive visual classification. When the AI sees new mail, it compares against these examples to choose a type. More examples = higher confidence.</span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search types…"
              className="h-9 pl-8 pr-7 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400"
              style={{ width: 240 }} />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={regulatedOnly} onChange={e => setRegulatedOnly(e.target.checked)} /> Regulated only
          </label>
        </div>
        <button className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">+ New document type</button>
      </div>

      <div className="mt-5 bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: '32%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '6%' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Name</th>
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Retention</th>
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Regulated</th>
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Auto-urgent</th>
              <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Examples</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {types.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No document types match.</td></tr>
            ) : pageTypes.map(t => {
              const years = (t.retention_days / 365);
              const retentionLabel = years >= 1 ? Math.round(years) + ' year' + (Math.round(years) !== 1 ? 's' : '') : t.retention_days + ' days';
              const exCount = t.example_documents.length;
              const exLow = exCount < 3;
              return (
                <tr key={t.type_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 truncate">{t.display_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{retentionLabel}</td>
                  <td className="px-4 py-3 text-sm">
                    {t.regulated
                      ? <span className="inline-flex items-center gap-1 text-amber-700 font-medium"><AlertTriangle className="w-3 h-3" /> Regulated</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {t.auto_urgent
                      ? <span className="text-emerald-700 font-medium">✓</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center gap-1 ${exLow ? 'text-amber-700' : 'text-gray-700'}`}>
                      <FileText className="w-3 h-3" /> {exCount}
                      {exLow && <span className="text-[10px] uppercase tracking-wide font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-1.5 py-0 ml-1">low</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/configurations/doc-types/${t.type_id}`}
                      className="w-7 h-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={types.length}
          onPageChange={setPage} label="types" />
      </div>
      <p className="mt-3 text-xs text-gray-400">{DOCUMENT_TYPES.length} document types defined.</p>
    </div>
  );
}
