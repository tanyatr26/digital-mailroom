'use client';
import { useMemo, useState } from 'react';
import { X, UserCog, Search, Info } from 'lucide-react';
import { SSO_USERS, type SsoUser } from '@/src/mocks/users';

// V2 §5 — Inactive-admin delegate assignment. Distinct from the
// "Designate Temporary Delegate" self-service flow in /configurations/
// delegation (SetDelegateModal): this is for someone ELSE's folder while
// that folder's admin is inactive. Delegate can route / return / forward,
// but cannot create folders, edit trusted routes, or sub-delegate.
interface Props {
  folderName: string;
  adminName: string;            // The inactive admin whose folder this is.
  excludeUserId?: string;       // Filter the inactive admin out of their own delegate picker
  onConfirm: (data: { delegate: SsoUser; endsAtIso?: string }) => void;
  onClose: () => void;
}

export default function AssignDelegateModal({ folderName, adminName, excludeUserId, onConfirm, onClose }: Props) {
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<SsoUser | null>(null);
  const [endsAtIso, setEndsAtIso] = useState('');

  const candidates = useMemo(() => {
    let list = SSO_USERS.filter(u => u.active !== false && u.id !== excludeUserId);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    return list.slice(0, 8);
  }, [search, excludeUserId]);

  const handleConfirm = () => {
    if (!selected) return;
    onConfirm({ delegate: selected, endsAtIso: endsAtIso || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
              <UserCog className="w-4 h-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900">Assign Delegate — {folderName}</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            While <span className="font-medium text-gray-800">{adminName}</span>&apos;s account is inactive, a delegate can handle routing for this folder. This does not change folder ownership.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Delegate <span className="text-red-500">*</span></label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setSelected(null); }}
                placeholder="Search SSO users by name or email…"
                className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400"
                autoFocus
              />
            </div>
            {selected && (
              <p className="text-[11px] text-gray-500 mt-1.5">
                Selected: <span className="font-medium text-gray-800">{selected.name}</span> <span className="text-gray-400">({selected.email})</span>
              </p>
            )}
          </div>

          {search.trim().length > 0 && (
            <ul className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100" style={{ maxHeight: 200, overflowY: 'auto' }}>
              {candidates.length === 0 ? (
                <li className="px-3 py-3 text-xs text-gray-400 italic text-center">No matching SSO users.</li>
              ) : candidates.map(u => (
                <li key={u.id}>
                  <button
                    onClick={() => setSelected(u)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${selected?.id === u.id ? 'bg-blue-50' : 'hover:bg-white'}`}
                  >
                    <div className={`w-4 h-4 rounded-full border ${selected?.id === u.id ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">
                        {u.name}{u.title && <span className="text-gray-500 font-normal"> · {u.title}</span>}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">{u.email}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">End date (optional)</label>
            <input
              type="date"
              value={endsAtIso}
              onChange={e => setEndsAtIso(e.target.value)}
              className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400"
            />
            <p className="text-[11px] text-gray-400 mt-1">Delegation auto-revokes on this date. Leave blank to keep open-ended.</p>
          </div>

          <div className="flex items-start gap-1.5 text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5">
            <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
            This action will be logged to Change History.
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleConfirm} disabled={!selected}
            className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors ${selected ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
            Assign Delegate
          </button>
        </div>
      </div>
    </div>
  );
}
