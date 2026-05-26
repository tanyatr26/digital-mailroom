'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, UserCog, Plus, Info, AlertTriangle } from 'lucide-react';
import { useUser } from '@/src/context/UserContext';
import { findFolder } from '@/src/mocks/data';
import { FOLDER_DELEGATIONS } from '@/src/mocks/delegations';
import type { FolderDelegation } from '@/src/types';
import { type SsoUser } from '@/src/mocks/users';
import SetDelegateModal from '@/src/components/modals/SetDelegateModal';
import { useRoleGate } from '@/src/hooks/useRoleGate';

// V2 Wireframe §5.2 + Config Ref §9 — Legacy delegation surface, kept under
// SA-only access while the new Backup Delegate / Folder Assignments pages
// take over from it. No nav/card links anymore — direct URL only.
export default function DelegationPage() {
  const allowed = useRoleGate(['System_Admin']);
  const { user } = useUser();
  const userFolders = user.folders ?? [];

  // Local copy so designate / revoke actions reflect immediately in the page.
  const [delegations, setDelegations] = useState<FolderDelegation[]>(() => [...FOLDER_DELEGATIONS]);
  const [setFor, setSetFor]           = useState<{ folderId: string; folderName: string } | null>(null);
  const [toast, setToast]             = useState('');

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleDesignate = ({ user: delegateUser, endsAtIso }: { user: SsoUser; endsAtIso?: string }) => {
    if (!setFor) return;
    const startedDisplay = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endsDisplay = endsAtIso ? new Date(endsAtIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined;
    setDelegations(prev => [
      // Revoke any current active delegate for this folder (one at a time).
      ...prev.map(d => d.folder_id === setFor.folderId && d.endReason === 'active'
        ? { ...d, endReason: 'revoked' as const, endsDisplay: startedDisplay, endsAtIso: new Date().toISOString(), revokedByName: user.name }
        : d),
      {
        id: 'del-' + Date.now(),
        folder_id: setFor.folderId,
        folder_name: setFor.folderName,
        original_admin_user_id: user.id,
        delegate_user_id: delegateUser.id,
        delegate_name: delegateUser.name,
        delegate_email: delegateUser.email,
        startedAtIso: new Date().toISOString(),
        startedDisplay,
        endsAtIso,
        endsDisplay,
        endReason: 'active',
      },
    ]);
    flash(`Delegate designated for ${setFor.folderName}. Parent folder admin notified. Logged to Admin Audit Trail.`);
    setSetFor(null);
  };

  const handleRevoke = (delegationId: string) => {
    setDelegations(prev => prev.map(d => d.id === delegationId
      ? { ...d, endReason: 'revoked' as const, endsAtIso: new Date().toISOString(), endsDisplay: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), revokedByName: user.name }
      : d,
    ));
    flash('Delegation revoked. Logged to Admin Audit Trail.');
  };

  if (user.role === 'System_Admin') {
    return (
      <div className="p-8 max-w-3xl">
        <Link href="/configurations" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors mb-4">
          <ChevronLeft className="w-3.5 h-3.5" /> All configurations
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Backup Delegate</h1>
        <p className="mt-1 text-sm text-gray-500">Org-wide delegate coverage. Set a backup admin who can stand in across your portfolio during planned absences.</p>
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-gray-700">Backup Delegate surface coming soon</p>
          <p className="text-xs text-gray-400 mt-1.5 max-w-md mx-auto">
            This screen will let you nominate a backup System Admin to receive escalations and stand in for routine approvals while you&apos;re out.
          </p>
        </div>
      </div>
    );
  }
  if (user.role !== 'Folder_Admin') {
    return (
      <div className="p-8 max-w-3xl">
        <Link href="/configurations" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors mb-4">
          <ChevronLeft className="w-3.5 h-3.5" /> All configurations
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Delegation</h1>
        <p className="mt-1 text-sm text-gray-500">Folder admins only.</p>
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">
          Switch to the Folder Admin role to manage delegations.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/configurations" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors mb-4">
        <ChevronLeft className="w-3.5 h-3.5" /> All configurations
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Delegation</h1>
      <p className="mt-1 text-sm text-gray-500">Designate a temporary delegate per folder during planned absences. One delegate per folder at a time.</p>

      <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-900">
        <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
        <span>
          <span className="font-semibold">Delegate powers:</span> route documents, return documents, forward copies, add to the download pile.{' '}
          <span className="font-semibold">Restrictions:</span> cannot create folders, edit trusted routes, invite users, or designate further delegates.
        </span>
      </div>

      <div className="mt-6 space-y-6">
        {userFolders.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-400">
            You don&apos;t admin any folders yet.
          </div>
        ) : userFolders.map(folderId => {
          const folder = findFolder(folderId);
          const folderName = folder?.name ?? folderId;
          const active = delegations.find(d => d.folder_id === folderId && d.endReason === 'active');
          const history = delegations.filter(d => d.folder_id === folderId);
          return (
            <section key={folderId} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <header className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-gray-900">{folderName}</h2>
                </div>
                {!active && (
                  <button onClick={() => setSetFor({ folderId, folderName })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm">
                    <Plus className="w-3 h-3" /> Designate delegate
                  </button>
                )}
              </header>

              <div className="px-5 py-4 bg-slate-50 border-b border-gray-100">
                <p className="text-[11px] uppercase tracking-[0.06em] font-semibold text-gray-400 mb-3">Active delegate</p>
                {active ? (
                  <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                        <UserCog className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{active.delegate_name}</p>
                        <p className="text-xs text-gray-500 truncate">{active.delegate_email}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Started {active.startedDisplay}{active.endsDisplay ? ` · Ends ${active.endsDisplay}` : ' · No end date set'}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => handleRevoke(active.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                      Revoke
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">No active delegate for {folderName}.</p>
                )}
              </div>

              <div className="px-5 py-4">
                <p className="text-[11px] uppercase tracking-[0.06em] font-semibold text-gray-400 mb-3">History</p>
                {history.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No prior delegations.</p>
                ) : (
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <table className="w-full table-fixed">
                      <colgroup>
                        <col style={{ width: '30%' }} />
                        <col style={{ width: '22%' }} />
                        <col style={{ width: '22%' }} />
                        <col style={{ width: '26%' }} />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="px-3 py-2 text-left text-[10px] font-normal text-gray-400 uppercase tracking-[0.06em]">Delegate</th>
                          <th className="px-3 py-2 text-left text-[10px] font-normal text-gray-400 uppercase tracking-[0.06em]">Started</th>
                          <th className="px-3 py-2 text-left text-[10px] font-normal text-gray-400 uppercase tracking-[0.06em]">Ended</th>
                          <th className="px-3 py-2 text-left text-[10px] font-normal text-gray-400 uppercase tracking-[0.06em]">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {history.map(h => (
                          <tr key={h.id}>
                            <td className="px-3 py-2 text-sm text-gray-900 truncate">{h.delegate_name}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">{h.startedDisplay}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">{h.endReason === 'active' ? '—' : (h.endsDisplay ?? '—')}</td>
                            <td className="px-3 py-2 text-xs">
                              {h.endReason === 'active' && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-medium uppercase tracking-wide">Active</span>}
                              {h.endReason === 'auto-expired' && <span className="text-gray-500">Auto-expired</span>}
                              {h.endReason === 'revoked' && <span className="text-gray-500">Revoked{h.revokedByName ? ` by ${h.revokedByName}` : ''}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Out-of-scope reminders for the demo. */}
      <div className="mt-6 flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600">
        <AlertTriangle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
        <span>
          Auto-expiry on the end date is not enforced in this demo — only manual revoke works. Parent-admin notification is a toast; a notification surface lands later.
        </span>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-6 bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-xs text-gray-800 max-w-md">
          {toast}
        </div>
      )}

      {setFor && (
        <SetDelegateModal
          folderName={setFor.folderName}
          currentUserId={user.id}
          onConfirm={handleDesignate}
          onClose={() => setSetFor(null)}
        />
      )}
    </div>
  );
}
