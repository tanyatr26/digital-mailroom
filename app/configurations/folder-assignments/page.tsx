'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Plus, FolderKey } from 'lucide-react';
import { useUser } from '@/src/context/UserContext';
import { FOLDERS } from '@/src/mocks/data';
import type { Folder } from '@/src/types';
import { SSO_USERS, formatRelative, type SsoUser } from '@/src/mocks/users';
import SsoRecipientPicker from '@/src/components/shared/SsoRecipientPicker';
import { useRoleGate } from '@/src/hooks/useRoleGate';
import { useIsInDelegateContext } from '@/src/context/UserContext';

// Folder Assignments — System Admin + Folder Admin inner page.
//
// One card per folder the current user owns. Each card surfaces two rows:
//   • Primary admin (required): name, email, last login. Change inline.
//   • Delegate (optional): scheduled / active coverage with date range.
//
// SA owns root folders (parent_folder_id === null). FA owns child folders
// (parent_folder_id !== null). Filter is driven by the existing
// `admin_user_id` field already on Folder records.

const isoOf = (d: Date) => d.toISOString().slice(0, 10);
const today = () => new Date();
const fmt = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';

// Stable mock queue count per folder so the same folder always reads
// the same value across reloads without bolting on new mock data.
function queueCountFor(folderId: string): number {
  let h = 0;
  for (let i = 0; i < folderId.length; i++) h = (h * 31 + folderId.charCodeAt(i)) >>> 0;
  return (h % 23) + 1;
}

interface Delegate {
  name: string;
  email: string;
  startIso: string;
  endIso?: string;
}
type Status = 'active' | 'scheduled';
const statusOf = (d: Delegate): Status => {
  const start = new Date(d.startIso + 'T00:00:00');
  return start > today() ? 'scheduled' : 'active';
};
const isLastLoginStale = (iso?: string) => {
  if (!iso) return false;
  // Match formatRelative's reference clock so the page's amber treatment
  // and the relative label agree on what "over 7 days" means.
  const ref = new Date('2026-05-14T12:00:00').getTime();
  return ref - new Date(iso).getTime() > 7 * 86_400_000;
};

function Breadcrumb() {
  return (
    <nav className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
      <Link href="/configurations" className="hover:text-gray-800 transition-colors">Configurations</Link>
      <ChevronRight className="w-3 h-3 text-gray-300" />
      <span>Assignments</span>
      <ChevronRight className="w-3 h-3 text-gray-300" />
      <span className="text-gray-700 font-medium">Folder Assignments</span>
    </nav>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-semibold text-gray-700">
      {initials(name)}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const cls = status === 'active'
    ? 'bg-green-100 text-green-700 border-green-200'
    : 'bg-blue-100 text-blue-700 border-blue-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
      {status === 'active' ? 'Active' : 'Scheduled'}
    </span>
  );
}

// ── Assign / Change primary admin modal ──────────────────────────
function AssignAdminModal({ folderName, currentName, onConfirm, onClose }: {
  folderName: string;
  currentName?: string;
  onConfirm: (user: SsoUser) => void;
  onClose: () => void;
}) {
  const [pickedName, setPickedName] = useState('');
  const handleSubmit = () => {
    const u = SSO_USERS.find(x => x.name === pickedName);
    if (u) onConfirm(u);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{currentName ? 'Change primary admin' : 'Assign primary admin'}</h2>
          <p className="text-xs text-gray-500 mt-0.5">Pick an SSO user to own {folderName}.</p>
        </div>
        <div className="px-6 py-5 space-y-3">
          <label className="block text-[11px] uppercase tracking-wide font-medium text-gray-500">SSO user</label>
          <SsoRecipientPicker value={pickedName} onChange={setPickedName} placeholder="Search SSO users by name or email…" />
        </div>
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={!pickedName.trim()}
            className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors ${pickedName.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
            {currentName ? 'Change admin' : 'Assign admin'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add / replace delegate modal ─────────────────────────────────
function AddDelegateModal({ folderName, onConfirm, onClose }: {
  folderName: string;
  onConfirm: (d: Delegate) => void;
  onClose: () => void;
}) {
  const [pickedName, setPickedName] = useState('');
  const [startIso, setStartIso]     = useState(isoOf(today()));
  const [endIso, setEndIso]         = useState('');
  const canSubmit = !!pickedName.trim() && !!startIso;
  const handleSubmit = () => {
    const u = SSO_USERS.find(x => x.name === pickedName);
    if (!u) return;
    onConfirm({ name: u.name, email: u.email, startIso, endIso: endIso || undefined });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Add delegate</h2>
          <p className="text-xs text-gray-500 mt-0.5">Pick an SSO user and set the coverage window for {folderName}.</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wide font-medium text-gray-500 mb-1">SSO user</label>
            <SsoRecipientPicker value={pickedName} onChange={setPickedName} placeholder="Search SSO users by name or email…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wide font-medium text-gray-500 mb-1">Start date <span className="text-red-500">*</span></label>
              <input type="date" value={startIso} onChange={e => setStartIso(e.target.value)}
                className="w-full h-9 px-3 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide font-medium text-gray-500 mb-1">End date <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
              <input type="date" value={endIso} onChange={e => setEndIso(e.target.value)}
                className="w-full h-9 px-3 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors ${canSubmit ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
            Add delegate
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FolderAssignmentsPage() {
  const allowed = useRoleGate(['System_Admin', 'Folder_Admin']);
  const { user } = useUser();
  const isSA = user.role === 'System_Admin';
  const isFA = user.role === 'Folder_Admin';

  // Folders shown on Folder Assignments, scoped by role:
  //   SA → root folders they created (parent === null). Key off
  //        created_by_user_id so reassigned admins don't change what
  //        the SA sees on this page.
  //   FA → every non-root folder in their owned subtree, i.e. any
  //        descendant of a folder in user.folders. Mike Torres / James
  //        Wu / Lisa Chen / Sarah Kim show under Sales for the Sales
  //        FA; Operations and Safety show under Jobsite A for that FA.
  const ownedFolders = useMemo(() => {
    if (!isSA && !isFA) return [];
    if (isSA) {
      return FOLDERS.filter(f =>
        f.created_by_user_id === user.id
        && f.parent_folder_id === null
        && !f.is_archived,
      );
    }
    // FA: collect every descendant of each folder in user.folders.
    const ownedIds = new Set(user.folders ?? []);
    const isDescendantOfOwned = (f: Folder): boolean => {
      let cur: Folder | undefined = f;
      while (cur && cur.parent_folder_id) {
        if (ownedIds.has(cur.parent_folder_id)) return true;
        cur = FOLDERS.find(p => p.id === cur!.parent_folder_id);
      }
      return false;
    };
    return FOLDERS.filter(f =>
      f.parent_folder_id !== null
      && !f.is_archived
      && (ownedIds.has(f.id) || isDescendantOfOwned(f)),
    );
  }, [isSA, isFA, user.id, user.folders]);

  // Local per-folder primary-admin overrides and delegate state. Seeds
  // start with what's already in FOLDERS / SSO_USERS — no new data.
  const [adminOverrides, setAdminOverrides] = useState<Record<string, string>>({});
  const [delegates, setDelegates] = useState<Record<string, Delegate | undefined>>(() => {
    // Seed one folder with a demo delegate so the populated state is
    // visible without the admin having to add one first.
    const seed: Record<string, Delegate | undefined> = {};
    const first = ownedFolders[0];
    if (first) {
      seed[first.id] = {
        name: 'Karen Ng',
        email: 'k.ng@acme.com',
        startIso: isoOf(new Date(Date.now() - 5 * 86_400_000)),
        endIso: isoOf(new Date(Date.now() + 12 * 86_400_000)),
      };
    }
    return seed;
  });

  const [adminModalFolder, setAdminModalFolder] = useState<{ id: string; name: string; currentName?: string } | null>(null);
  const [delegateModalFolder, setDelegateModalFolder] = useState<{ id: string; name: string } | null>(null);
  // Brief §4a — admin reassignment + delegate designation are both
  // restricted while acting on behalf of another user.
  const inDelegateContext = useIsInDelegateContext();

  const resolveAdmin = (folderId: string, baseAdminId?: string): SsoUser | undefined => {
    const overrideId = adminOverrides[folderId];
    const id = overrideId ?? baseAdminId;
    return id ? SSO_USERS.find(u => u.id === id) : undefined;
  };

  // Non-admin (e.g. Delegate View) reaches the route → soft gate.
  if (!isSA && !isFA) {
    return (
      <div className="p-8 max-w-3xl">
        <Breadcrumb />
        <h1 className="text-2xl font-semibold text-gray-900">Folder Assignments</h1>
        <p className="mt-1 text-sm text-gray-500">Admins only.</p>
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">
          Switch to a Folder Admin or System Admin role to manage folder assignments.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <Breadcrumb />
      <h1 className="text-2xl font-semibold text-gray-900">Folder Assignments</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manage the primary admin and optional delegate for each folder you own. Every folder requires a primary admin.
      </p>

      {ownedFolders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          You don&apos;t own any folders yet.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {ownedFolders.map(folder => {
            const admin = resolveAdmin(folder.id, folder.admin_user_id);
            const delegate = delegates[folder.id];
            const recipientLabel = (folder.recipient_type ?? 'group') === 'personal' ? 'Individual' : 'Group';
            const queue = queueCountFor(folder.id);
            const staleLastLogin = isLastLoginStale(admin?.lastLoginIso);
            return (
              <section key={folder.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                {/* Card header */}
                <header className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                    <FolderKey className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-gray-900 truncate">{folder.name}</h2>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {recipientLabel} · {queue} doc{queue !== 1 ? 's' : ''} in queue
                    </p>
                  </div>
                </header>

                {/* Primary admin row */}
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                  <div className="w-24 flex-shrink-0">
                    <p className="text-[11px] uppercase tracking-[0.06em] font-semibold text-gray-400">Primary admin</p>
                    <p className="text-[10px] uppercase tracking-wide text-red-500 mt-0.5">Required</p>
                  </div>
                  {admin ? (
                    <>
                      <Avatar name={admin.name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{admin.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {admin.email}
                          <span className="text-gray-300 mx-1.5">·</span>
                          <span className={staleLastLogin ? 'text-amber-700' : 'text-gray-500'}>
                            Last login {formatRelative(admin.lastLoginIso)}
                          </span>
                        </p>
                      </div>
                      <button onClick={() => setAdminModalFolder({ id: folder.id, name: folder.name, currentName: admin.name })}
                        disabled={inDelegateContext}
                        title={inDelegateContext ? 'Disabled while acting as another user.' : undefined}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex-shrink-0 ${
                          inDelegateContext
                            ? 'text-gray-300 border border-gray-200 cursor-not-allowed'
                            : 'text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}>
                        Change
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="flex-1 text-sm text-gray-500 italic">No primary admin assigned</p>
                      <button onClick={() => setAdminModalFolder({ id: folder.id, name: folder.name })}
                        disabled={inDelegateContext}
                        title={inDelegateContext ? 'Disabled while acting as another user.' : undefined}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-colors flex-shrink-0 ${
                          inDelegateContext
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}>
                        <Plus className="w-3 h-3" /> Assign
                      </button>
                    </>
                  )}
                </div>

                {/* Delegate row */}
                <div className="px-5 py-3 flex items-center gap-3">
                  <div className="w-24 flex-shrink-0">
                    <p className="text-[11px] uppercase tracking-[0.06em] font-semibold text-gray-400">Delegate</p>
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">Optional</p>
                  </div>
                  {delegate ? (
                    <>
                      <Avatar name={delegate.name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 truncate">{delegate.name}</p>
                          <StatusBadge status={statusOf(delegate)} />
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {delegate.email}
                          <span className="text-gray-300 mx-1.5">·</span>
                          {fmt(delegate.startIso)} {delegate.endIso ? `– ${fmt(delegate.endIso)}` : '– No end date'}
                        </p>
                      </div>
                      <button onClick={() => setDelegates(prev => ({ ...prev, [folder.id]: undefined }))}
                        disabled={inDelegateContext}
                        title={inDelegateContext ? 'Disabled while acting as another user.' : undefined}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex-shrink-0 ${
                          inDelegateContext
                            ? 'text-gray-300 border border-gray-200 cursor-not-allowed'
                            : 'text-red-600 border border-red-200 hover:bg-red-50'
                        }`}>
                        Revoke
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="flex-1 text-sm text-gray-500 italic">No delegate assigned</p>
                      <button onClick={() => setDelegateModalFolder({ id: folder.id, name: folder.name })}
                        disabled={inDelegateContext}
                        title={inDelegateContext ? 'Disabled while acting as another user.' : undefined}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-colors flex-shrink-0 ${
                          inDelegateContext
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}>
                        <Plus className="w-3 h-3" /> Add delegate
                      </button>
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {adminModalFolder && (
        <AssignAdminModal
          folderName={adminModalFolder.name}
          currentName={adminModalFolder.currentName}
          onConfirm={u => {
            setAdminOverrides(prev => ({ ...prev, [adminModalFolder.id]: u.id }));
            setAdminModalFolder(null);
          }}
          onClose={() => setAdminModalFolder(null)}
        />
      )}
      {delegateModalFolder && (
        <AddDelegateModal
          folderName={delegateModalFolder.name}
          onConfirm={d => {
            setDelegates(prev => ({ ...prev, [delegateModalFolder.id]: d }));
            setDelegateModalFolder(null);
          }}
          onClose={() => setDelegateModalFolder(null)}
        />
      )}
    </div>
  );
}
