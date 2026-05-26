import type { FolderDelegation } from '@/src/types';

// V2 Brief §4 — one active delegate per folder admin at a time. The active
// row has endReason='active' and (optionally) an endsAtIso for auto-expiry.
// Historical rows are 'auto-expired' or 'revoked'.

export const FOLDER_DELEGATIONS: FolderDelegation[] = [
  // Active: Karen Ng covering J. Smith's Jobsite A folder through Nov 25.
  {
    id: 'del-001',
    folder_id: 'jobsite-a',
    folder_name: 'Jobsite A',
    original_admin_user_id: 'user-001',
    delegate_user_id: 'user-kn',
    delegate_name: 'Karen Ng',
    delegate_email: 'k.ng@acme.com',
    startedAtIso: '2025-11-08T09:00:00',
    startedDisplay: 'Nov 8, 2025',
    endsAtIso:   '2025-11-25T23:59:59',
    endsDisplay: 'Nov 25, 2025',
    endReason: 'active',
  },
  // History — auto-expired
  {
    id: 'del-002',
    folder_id: 'jobsite-a',
    folder_name: 'Jobsite A',
    original_admin_user_id: 'user-001',
    delegate_user_id: 'user-mt',
    delegate_name: 'Mike Torres',
    delegate_email: 'm.torres@acme.com',
    startedAtIso: '2025-09-03T09:00:00',
    startedDisplay: 'Sep 3, 2025',
    endsAtIso:   '2025-09-17T23:59:59',
    endsDisplay: 'Sep 17, 2025',
    endReason: 'auto-expired',
  },
  // History — revoked early by the admin themselves
  {
    id: 'del-003',
    folder_id: 'sales',
    folder_name: 'Sales',
    original_admin_user_id: 'user-001',
    delegate_user_id: 'user-kn',
    delegate_name: 'Karen Ng',
    delegate_email: 'k.ng@acme.com',
    startedAtIso: '2025-07-14T09:00:00',
    startedDisplay: 'Jul 14, 2025',
    endsAtIso:   '2025-07-28T13:30:00',
    endsDisplay: 'Jul 28, 2025',
    endReason: 'revoked',
    revokedByName: 'J. Smith',
  },
];

export function activeDelegationFor(folderId: string): FolderDelegation | undefined {
  return FOLDER_DELEGATIONS.find(d => d.folder_id === folderId && d.endReason === 'active');
}

export function delegationHistoryFor(folderId: string): FolderDelegation[] {
  return FOLDER_DELEGATIONS.filter(d => d.folder_id === folderId);
}
