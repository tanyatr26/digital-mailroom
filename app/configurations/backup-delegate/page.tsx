'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, AlertTriangle, Info, Plus, X, Crown, LogOut, ShieldCheck } from 'lucide-react';
import { useUser } from '@/src/context/UserContext';
import { SSO_USERS, type SsoUser } from '@/src/mocks/users';
import SsoRecipientPicker from '@/src/components/shared/SsoRecipientPicker';
import { useRoleGate } from '@/src/hooks/useRoleGate';
import { useNotifications } from '@/src/context/NotificationsContext';
import { useIsInDelegateContext } from '@/src/context/UserContext';
import { ADMIN_AUDIT_ENTRIES } from '@/src/mocks/auditLogs';

// Backup Delegate — role-aware inner page.
//
// Folder Admin + System Admin:
//   Self-service list of people who cover the user's account during
//   absences. Add / revoke inline; minimum 1 required (warning banner
//   when the list is empty).
//
// Delegate View:
//   Read-only. Their backup is set by a System Admin; no add/revoke.

interface BackupEntry {
  id: string;
  name: string;
  email: string;
  startIso: string;       // ISO date (yyyy-mm-dd) — start of coverage
  endIso?: string;        // optional end of coverage
  assignedByName?: string; // SA name shown to the Delegate View
  // Brief V2 §4 — exactly one BD per SA carries this flag. When the SA
  // has a single BD, the flag is implicit (single BD is always the
  // primary successor regardless of the stored value). Multiple BDs
  // require the SA to pick one explicitly.
  isPrimarySuccessor?: boolean;
}

type Status = 'active' | 'scheduled';

const isoOf = (d: Date) => d.toISOString().slice(0, 10);
const today = () => new Date();
const fmt = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
const statusOf = (b: BackupEntry): Status => {
  const now = today();
  const start = new Date(b.startIso + 'T00:00:00');
  return start > now ? 'scheduled' : 'active';
};

// Per-role seed data. The Delegate View variant carries `assignedByName`
// so the row can show "Assigned by [SA name]".
function seedFor(role: string): BackupEntry[] {
  const tPlus = (days: number) => isoOf(new Date(Date.now() + days * 86_400_000));
  const tMinus = (days: number) => isoOf(new Date(Date.now() - days * 86_400_000));
  if (role === 'System_Admin') {
    // Karen Ng is the open-ended primary successor; Sarah Chen is a
    // scheduled, non-successor BD. Demo seed for the SA departure flow.
    return [
      { id: 'bd-1', name: 'Karen Ng',     email: 'k.ng@acme.com',    startIso: tMinus(20),                       isPrimarySuccessor: true  },
      { id: 'bd-2', name: 'Sarah Chen',   email: 's.chen@acme.com',  startIso: tPlus(5), endIso: tPlus(15),     isPrimarySuccessor: false },
    ];
  }
  if (role === 'Folder_Admin') {
    return [
      { id: 'bd-1', name: 'James Wu',     email: 'j.wu@acme.com',    startIso: tMinus(7),  endIso: tPlus(14) },
    ];
  }
  if (role === 'Delegate_View_Mailroom' || role === 'Delegate_View_Folder') {
    return [
      { id: 'bd-1', name: 'Tom Park',     email: 't.park@acme.com',  startIso: tMinus(3), assignedByName: 'J. Smith' },
    ];
  }
  return [];
}

// Demo: which folders the newly promoted SA admins. Drives Folder
// Assignments and other folders-array-dependent surfaces after the swap.
// Hardcoded for the small fixed set of plausible successors in the seed.
function folderIdsForPromoted(userId: string): string[] | undefined {
  if (userId === 'user-kn') return ['ca-state'];
  if (userId === 'user-sc') return ['payroll', 'enrollments', 'reports'];
  return undefined;
}

function Breadcrumb() {
  return (
    <nav className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
      <Link href="/configurations" className="hover:text-gray-800 transition-colors">Configurations</Link>
      <ChevronRight className="w-3 h-3 text-gray-300" />
      <span>Assignments</span>
      <ChevronRight className="w-3 h-3 text-gray-300" />
      <span className="text-gray-700 font-medium">Backup Delegate</span>
    </nav>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700 border border-green-200">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700 border border-blue-200">
      Scheduled
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-semibold text-gray-700">
      {initials(name)}
    </div>
  );
}

function dateRangeLine(b: BackupEntry): string {
  const start = fmt(b.startIso);
  if (b.endIso) return `${start} – ${fmt(b.endIso)}`;
  return `${start} – No end date`;
}

interface AddBackupModalProps {
  onAdd: (entry: { name: string; email: string; startIso: string; endIso?: string }) => void;
  onClose: () => void;
}

function AddBackupModal({ onAdd, onClose }: AddBackupModalProps) {
  const [pickedName, setPickedName] = useState('');
  const [startIso, setStartIso]     = useState(isoOf(today()));
  const [endIso, setEndIso]         = useState('');

  const handleSubmit = () => {
    if (!pickedName.trim() || !startIso) return;
    const user = SSO_USERS.find((u: SsoUser) => u.name === pickedName);
    if (!user) return;
    onAdd({
      name: user.name,
      email: user.email,
      startIso,
      endIso: endIso || undefined,
    });
  };

  const canSubmit = !!pickedName.trim() && !!startIso;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add backup delegate</h2>
            <p className="text-xs text-gray-500 mt-0.5">Pick an SSO user and set the coverage window.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
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
            Add backup
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BackupDelegatePage() {
  const allowed = useRoleGate(['System_Admin', 'Folder_Admin']);
  const {
    user, setUser,
    needsBackupDelegate, setNeedsBackupDelegate,
    setJustPromoted,
  } = useUser();
  const { emit: emitNotification, clearByCode } = useNotifications();
  const [backups, setBackups] = useState<BackupEntry[]>(() => seedFor(user.role));
  const [showAdd, setShowAdd] = useState(false);
  // SA departure flow modals (Brief V2 §4).
  const [showDeparture, setShowDeparture] = useState(false);
  // Pick-primary prompt — fires after a 2nd+ BD is added, and when the
  // current primary is revoked with at least one other BD remaining.
  const [primaryPrompt, setPrimaryPrompt] = useState<
    | { kind: 'on-add'; candidates: BackupEntry[] }
    | { kind: 'on-revoke'; revokingId: string; candidates: BackupEntry[] }
    | null
  >(null);

  // Re-sort: active first, then scheduled, each ordered by startIso asc.
  const sorted = useMemo(() => {
    const score = (b: BackupEntry) => (statusOf(b) === 'active' ? 0 : 1);
    return [...backups].sort((a, b) => {
      const s = score(a) - score(b);
      return s !== 0 ? s : a.startIso.localeCompare(b.startIso);
    });
  }, [backups]);

  // When the gate flips on (BD-promoted-to-SA flow), the newly promoted SA
  // starts with an empty list regardless of the seeded data for their role.
  useEffect(() => {
    if (needsBackupDelegate) setBackups([]);
  }, [needsBackupDelegate]);

  const isDelegateView =
    user.role === 'Delegate_View_Mailroom' || user.role === 'Delegate_View_Folder';
  const isSystemAdmin = user.role === 'System_Admin';
  // Brief §4a — designating further delegates is one of the restricted
  // actions while acting on behalf of someone else.
  const inDelegateContext = useIsInDelegateContext();

  // Brief V2 §4 — primary successor derivation. The flag is implicit
  // when there's only one BD, so the renderer + departure flow both
  // resolve "who is primary" through this single source of truth.
  const effectivePrimaryId: string | null = (() => {
    if (sorted.length === 0) return null;
    if (sorted.length === 1) return sorted[0].id;
    return sorted.find(b => b.isPrimarySuccessor)?.id ?? null;
  })();
  const primaryBackup = effectivePrimaryId ? sorted.find(b => b.id === effectivePrimaryId) : undefined;
  // Departure modal targets the primary successor specifically.
  const successor = primaryBackup;

  const setPrimary = (id: string) => {
    setBackups(prev => prev.map(b => ({ ...b, isPrimarySuccessor: b.id === id })));
  };

  const handleAdd = ({ name, email, startIso, endIso }: { name: string; email: string; startIso: string; endIso?: string }) => {
    const newBd: BackupEntry = { id: 'bd-' + Date.now(), name, email, startIso, endIso };
    setBackups(prev => {
      const next = [...prev, newBd];
      // §22 A9 state-tied: clear "zero backup delegates" warning when the
      // list goes from 0 → 1.
      if (prev.length === 0) clearByCode('A9');
      // §4 post-promotion gate: first BD designation lifts the org-wide
      // restriction on the newly promoted SA's config surface.
      if (prev.length === 0 && needsBackupDelegate) {
        setNeedsBackupDelegate(false);
      }
      // §4 multiple BDs need an explicit primary successor (SA only).
      // The 1 → 2 transition prompts the SA to pick. FAs skip the prompt
      // since their BDs are not successors.
      if (isSystemAdmin && prev.length === 1) {
        setPrimaryPrompt({ kind: 'on-add', candidates: next });
      }
      return next;
    });
    setShowAdd(false);
  };
  const handleRevoke = (id: string) => {
    // §4 If the SA revokes the current primary while other BDs remain,
    // prompt them to designate a new primary before the revoke confirms.
    if (isSystemAdmin && id === effectivePrimaryId && backups.length > 1) {
      const remaining = backups.filter(b => b.id !== id);
      setPrimaryPrompt({ kind: 'on-revoke', revokingId: id, candidates: remaining });
      return;
    }
    setBackups(prev => {
      const next = prev.filter(b => b.id !== id);
      // §22 A9 state-tied: emit "zero backup delegates" warning when the
      // list drops from 1 → 0.
      if (prev.length === 1 && next.length === 0) {
        emitNotification({
          code:        'A9',
          severity:    'warning',
          title:       'You have zero backup delegates',
          body:        'Minimum 1 backup delegate is required. Designate one to clear this warning.',
          href:        '/configurations/backup-delegate',
          source_kind: 'admin',
          source_id:   user.id,
        });
      }
      return next;
    });
  };
  const handleChoosePrimary = (chosenId: string) => {
    if (!primaryPrompt) return;
    if (primaryPrompt.kind === 'on-add') {
      setPrimary(chosenId);
    } else {
      // Set the new primary first, then drop the old one.
      setBackups(prev => prev
        .map(b => ({ ...b, isPrimarySuccessor: b.id === chosenId }))
        .filter(b => b.id !== primaryPrompt.revokingId));
    }
    setPrimaryPrompt(null);
  };

  const handleConfirmDeparture = () => {
    if (!successor) return;
    const successorSso = SSO_USERS.find(u => u.email === successor.email);
    const previousSelf = { id: user.id, name: user.name };
    const promotedAt = new Date().toISOString();
    // Push the audit entry first so the timestamp reflects the action.
    ADMIN_AUDIT_ENTRIES.unshift({
      id:            'aa-promo-' + Date.now(),
      timestampIso:  promotedAt,
      userId:        'system',
      userName:      'System',
      action:        'sa_promoted_from_bd',
      targetSummary: `${previousSelf.name} departed → ${successor.name} promoted to System Admin (Mailroom Worker tag transferred)`,
      beforeState:   {
        previousSystemAdminUserId: previousSelf.id,
        previousSystemAdminName:   previousSelf.name,
        previous_is_system_admin:  true,
        previous_is_mailroom_worker: true,
      },
      afterState:    {
        promotedUserId:   successorSso?.id ?? 'unknown',
        promotedUserName: successor.name,
        promotedAt,
        new_is_system_admin:   true,
        new_is_mailroom_worker: true,
      },
    });
    // Swap demo identity to the promoted user and flip the gates.
    // setUser normalizes the MW flag for the System_Admin role, but we
    // pass it explicitly too so the audit log + downstream consumers
    // can rely on the field being present.
    setUser({
      id:                 successorSso?.id ?? 'user-promoted',
      name:               successor.name,
      email:              successor.email,
      role:               'System_Admin',
      folders:            successorSso ? folderIdsForPromoted(successorSso.id) : undefined,
      is_mailroom_worker: true,
    });
    setNeedsBackupDelegate(true);
    setJustPromoted(true);
    setShowDeparture(false);
  };

  // ── Delegate View variant: read-only.
  if (isDelegateView) {
    return (
      <div className="p-8 max-w-3xl">
        <Breadcrumb />
        <h1 className="text-2xl font-semibold text-gray-900">Backup Delegate</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your backup is assigned by a System Admin. Contact your System Admin to add or change a backup.
        </p>

        <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-900">
          <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">This is read-only.</span> Your backup is managed by your System Admin.
          </span>
        </div>

        <section className="mt-6">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400 mb-3">Your backup</p>
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No backup assigned yet. Contact your System Admin.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
              {sorted.map(b => (
                <div key={b.id} className="px-4 py-3 flex items-center gap-3">
                  <Avatar name={b.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{b.name}</p>
                      <StatusBadge status={statusOf(b)} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{b.email} · {dateRangeLine(b)}</p>
                    {b.assignedByName && (
                      <p className="text-[11px] text-gray-400 mt-0.5">Assigned by {b.assignedByName}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ── System Admin + Folder Admin variant: self-service.
  return (
    <div className="p-8 max-w-3xl">
      <Breadcrumb />
      <h1 className="text-2xl font-semibold text-gray-900">Backup Delegate</h1>
      <p className="mt-1 text-sm text-gray-500">
        People who cover your account when you&apos;re out of office or on leave. Applies across all folders you own. Minimum 1 required at all times.
      </p>

      {/* Role-aware explainer (Brief V2 §4 — succession vs. absence coverage). */}
      {isSystemAdmin ? (
        <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-900">
          <Crown className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">Your Backup Delegate is also your designated successor.</span> If you leave the organization, they will be promoted to System Admin and will need to designate their own Backup Delegate.
          </span>
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700">
          <ShieldCheck className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">Your Backup Delegate covers your account during absences only.</span> If you permanently leave, your folders are reassigned by the parent folder admin.
          </span>
        </div>
      )}

      {backups.length === 0 && (
        <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">No backup delegate assigned.</span> At least 1 is required at all times.
          </span>
        </div>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400">Your backups</p>
          <button onClick={() => setShowAdd(true)} disabled={inDelegateContext}
            title={inDelegateContext ? 'Disabled while acting as another user.' : undefined}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shadow-sm ${
              inDelegateContext
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}>
            <Plus className="w-3 h-3" /> Add backup
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No backups designated yet.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
            {sorted.map(b => {
              const isPrimary = b.id === effectivePrimaryId;
              // "Set as primary successor" is SA-only and only meaningful
              // when there are 2+ BDs (single BD is implicit primary).
              const canSetPrimary = isSystemAdmin && !isPrimary && sorted.length > 1;
              return (
                <div key={b.id} className="px-4 py-3 flex items-center gap-3">
                  <Avatar name={b.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{b.name}</p>
                      <StatusBadge status={statusOf(b)} />
                      {isSystemAdmin && isPrimary && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                          <Crown className="w-3 h-3" /> Primary successor
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{b.email} · {dateRangeLine(b)}</p>
                  </div>
                  {canSetPrimary && (
                    <button onClick={() => setPrimary(b.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors flex-shrink-0">
                      Set as primary successor
                    </button>
                  )}
                  <button onClick={() => handleRevoke(b.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                    Revoke
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SA departure flow — demo trigger (Brief V2 §4). */}
      {isSystemAdmin && (
        <section className="mt-10 border-t border-gray-200 pt-6">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400 mb-2">Departure</p>
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs text-gray-500 max-w-md leading-relaxed">
              Leaving the organization promotes your Backup Delegate to System Admin. The new SA must designate their own Backup Delegate before any other admin actions become available.
            </p>
            <button onClick={() => setShowDeparture(true)} disabled={inDelegateContext}
              title={inDelegateContext ? 'Disabled while acting as another user.' : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex-shrink-0 ${
                inDelegateContext
                  ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
              }`}>
              <LogOut className="w-3 h-3" /> Leave organization
            </button>
          </div>
        </section>
      )}

      {showAdd && <AddBackupModal onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
      {showDeparture && (
        <DepartureModal
          successor={successor}
          onConfirm={handleConfirmDeparture}
          onClose={() => setShowDeparture(false)} />
      )}
      {primaryPrompt && (
        <ChoosePrimaryModal
          kind={primaryPrompt.kind}
          candidates={primaryPrompt.candidates}
          onConfirm={handleChoosePrimary}
          onClose={() => setPrimaryPrompt(null)} />
      )}
    </div>
  );
}

interface DepartureModalProps {
  successor: BackupEntry | undefined;
  onConfirm: () => void;
  onClose: () => void;
}

function DepartureModal({ successor, onConfirm, onClose }: DepartureModalProps) {
  const hasSuccessor = !!successor;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${hasSuccessor ? 'bg-red-100' : 'bg-amber-100'}`}>
              {hasSuccessor
                ? <LogOut className="w-4 h-4 text-red-600" />
                : <AlertTriangle className="w-4 h-4 text-amber-600" />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {hasSuccessor ? 'Confirm departure' : 'No Backup Delegate designated'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {hasSuccessor
                  ? 'This action cannot be undone.'
                  : 'You must designate one before leaving.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 text-sm text-gray-700 space-y-3">
          {hasSuccessor ? (
            <>
              <p>
                Your departure will promote <span className="font-semibold text-gray-900">{successor!.name}</span> to System Admin. They will inherit all SA capabilities including the Mailroom Worker tag.
              </p>
              <p>
                After promotion, <span className="font-semibold text-gray-900">{successor!.name}</span> must designate their own Backup Delegate before they can take any other admin action.
              </p>
              <p className="text-xs text-gray-500">This action cannot be undone.</p>
            </>
          ) : (
            <p>
              You must designate a Backup Delegate before leaving. Add one above in Configurations → Assignments → Backup Delegate.
            </p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          {hasSuccessor && (
            <button onClick={onConfirm}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors">
              Confirm departure
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChoosePrimaryModalProps {
  kind: 'on-add' | 'on-revoke';
  candidates: BackupEntry[];
  onConfirm: (id: string) => void;
  onClose: () => void;
}

function ChoosePrimaryModal({ kind, candidates, onConfirm, onClose }: ChoosePrimaryModalProps) {
  const defaultId = candidates.find(b => b.isPrimarySuccessor)?.id ?? candidates[0]?.id ?? '';
  const [selected, setSelected] = useState(defaultId);
  const title = kind === 'on-add'
    ? 'You now have multiple Backup Delegates'
    : 'Choose a new primary successor';
  const subtitle = kind === 'on-add'
    ? 'Which one should be your primary successor?'
    : 'The current primary successor is being revoked. Pick a replacement before the revoke confirms.';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 480 }}>
        <div className="px-6 py-5 border-b border-gray-200 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Crown className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <ul className="px-6 py-4 space-y-1">
          {candidates.map(c => {
            const active = selected === c.id;
            return (
              <li key={c.id}>
                <button onClick={() => setSelected(c.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors border ${
                    active ? 'border-blue-300 bg-blue-50' : 'border-transparent hover:bg-gray-50'
                  }`}>
                  <span className={`relative w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    active ? 'border-blue-600' : 'border-gray-300'
                  }`}>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                    <p className="text-[11px] text-gray-500 truncate">{c.email}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={() => onConfirm(selected)} disabled={!selected}
            className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors ${
              selected ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
