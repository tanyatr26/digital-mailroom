'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronDown, Search, X, Info, Sparkles } from 'lucide-react';
import { FOLDER_AI_PHASES, type AIPhase } from '@/src/mocks/aiPhases';
import { useRoleGate } from '@/src/hooks/useRoleGate';
import TablePagination from '@/src/components/shared/TablePagination';

const PAGE_SIZE = 25;

type PhaseFilter = 'all' | AIPhase;
type SortKey = 'phaseAsc' | 'phaseDesc' | 'decisions' | 'name';

const PHASE_LABEL: Record<AIPhase, { tint: string; desc: string }> = {
  'Phase 1': { tint: 'bg-gray-100 text-gray-600 border-gray-200',     desc: 'Observation' },
  'Phase 2': { tint: 'bg-blue-100 text-blue-700 border-blue-200',     desc: 'Suggestion' },
  'Phase 3': { tint: 'bg-emerald-100 text-emerald-700 border-emerald-200', desc: 'Auto-routing' },
};

export default function AIConfigPage() {
  const allowed = useRoleGate(['System_Admin']);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<PhaseFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('phaseDesc');
  const [page, setPage]       = useState(0);

  const rows = useMemo(() => {
    let list = [...FOLDER_AI_PHASES];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(r => r.folderPath.toLowerCase().includes(q));
    if (filter !== 'all') list = list.filter(r => r.phase === filter);
    list.sort((a, b) => {
      if (sortKey === 'name') return a.folderPath.localeCompare(b.folderPath);
      if (sortKey === 'decisions') return b.decisions - a.decisions;
      const an = parseInt(a.phase.replace('Phase ', ''), 10);
      const bn = parseInt(b.phase.replace('Phase ', ''), 10);
      return sortKey === 'phaseAsc' ? an - bn : bn - an;
    });
    return list;
  }, [search, filter, sortKey]);

  useEffect(() => { setPage(0); }, [search, filter, sortKey]);
  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/configurations" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors mb-4">
        <ChevronLeft className="w-3.5 h-3.5" /> All configurations
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">AI Configuration</h1>
      <p className="mt-1 text-sm text-gray-500">Per-folder AI maturation status.</p>

      <section className="mt-6 bg-white border border-gray-200 rounded-2xl px-6 py-5">
        <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400">How it works</p>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li><span className="font-semibold text-gray-900">Phase 1 — Observation:</span> AI watches decisions, no suggestions shown.</li>
          <li><span className="font-semibold text-gray-900">Phase 2 — Suggestion:</span> AI proposes routes, folder admin confirms each.</li>
          <li><span className="font-semibold text-gray-900">Phase 3 — Auto-routing:</span> AI promotes consistent high-confidence patterns to trusted routes that auto-route without review.</li>
        </ul>
        <p className="mt-3 text-xs text-gray-500">Phase transitions happen automatically as data accumulates per folder.</p>
      </section>

      <section className="mt-6">
        <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400 mb-3">Folder phase status · {FOLDER_AI_PHASES.length} folders</p>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search folders…"
              className="h-9 pl-8 pr-7 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400"
              style={{ width: 240 }} />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
          </div>
          <div className="relative">
            <select value={filter} onChange={e => setFilter(e.target.value as PhaseFilter)}
              className="h-9 text-sm text-gray-900 border border-gray-300 rounded-lg pl-3 pr-8 appearance-none bg-white focus:outline-none focus:border-blue-400">
              <option value="all">All phases</option>
              <option value="Phase 1">Phase 1</option>
              <option value="Phase 2">Phase 2</option>
              <option value="Phase 3">Phase 3</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none w-3.5 h-3.5 text-gray-400" />
          </div>
          <div className="relative">
            <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
              className="h-9 text-sm text-gray-900 border border-gray-300 rounded-lg pl-3 pr-8 appearance-none bg-white focus:outline-none focus:border-blue-400">
              <option value="phaseDesc">Sort by phase progress (high → low)</option>
              <option value="phaseAsc">Sort by phase progress (low → high)</option>
              <option value="decisions">Sort by decisions</option>
              <option value="name">Sort by folder name</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none w-3.5 h-3.5 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: '40%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Folder</th>
                <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Phase</th>
                <th className="px-4 py-3 text-right text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Decisions</th>
                <th className="px-4 py-3 text-right text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">AI accuracy</th>
                <th className="px-4 py-3 text-right text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Auto-routes / wk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No folders match the filters.</td></tr>
              ) : pageRows.map(r => {
                const meta = PHASE_LABEL[r.phase];
                return (
                  <tr key={r.folder_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 truncate">
                      {r.folderPath}
                      {r.coldStart && <span className="ml-2 text-[10px] uppercase tracking-wide font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-1.5 py-0">cold start</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium border ${meta.tint}`}>{r.phase}</span>
                      <span className="ml-1.5 text-gray-400">{meta.desc}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">{r.decisions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">{r.accuracy !== null ? (r.accuracy * 100).toFixed(1) + '%' : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">
                      {r.autoRoutesPerWeek > 0
                        ? <span className="inline-flex items-center gap-1 font-medium text-emerald-700"><Sparkles className="w-3 h-3" /> {r.autoRoutesPerWeek}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={rows.length}
            onPageChange={setPage} label="folders" />
        </div>
      </section>

      <section className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 leading-relaxed">
            <p className="font-semibold mb-1">Cold start guidance</p>
            <p>
              New folders always start in Phase 1. They progress as their admin makes routing decisions. Folder admins can pre-seed admin-marked
              trusted routes from day one to maintain efficiency during the learning period. A folder remains in cold start until its first
              trusted route is marked.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
