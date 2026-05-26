'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, AlertTriangle, MoreVertical } from 'lucide-react';
import { SSO_USERS, ORPHANED_FOLDERS, formatRelative, type SsoUser } from '@/src/mocks/users';
import { useRoleGate } from '@/src/hooks/useRoleGate';
import TablePagination from '@/src/components/shared/TablePagination';

const PAGE_SIZE = 25;

export default function UsersAndRolesPage() {
  const allowed = useRoleGate(['System_Admin']);
  const systemAdmins   = SSO_USERS.filter(u => u.systemAdmin);
  const delegateViews = SSO_USERS.filter(u => u.delegateView);
  if (!allowed) return null;

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/configurations" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors mb-4">
        <ChevronLeft className="w-3.5 h-3.5" /> All configurations
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Users &amp; Roles</h1>
      <p className="mt-1 text-sm text-gray-500">Manage System Admins, Delegate Views, and the SSO directory.</p>

      {/* Orphaned folders banner */}
      {ORPHANED_FOLDERS.length > 0 && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <h2 className="text-sm font-semibold text-amber-900">Orphaned folders</h2>
            <span className="text-[11px] uppercase tracking-wide font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
              {ORPHANED_FOLDERS.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {ORPHANED_FOLDERS.map(o => (
              <div key={o.folderName} className="flex items-center justify-between gap-3">
                <p className="text-xs text-amber-900">
                  &quot;{o.folderName}&quot; — admin <span className="font-semibold">{o.formerAdminName}</span> inactive {o.inactiveDays} days
                </p>
                <button className="text-xs font-semibold text-amber-700 hover:text-amber-900 hover:underline">Reassign…</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Admins */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400">System Admins · {systemAdmins.length}</p>
            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Minimum 2 System Admins required.</p>
          </div>
          <button className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">+ Promote SSO user to System Admin</button>
        </div>
        <UserTable users={systemAdmins} columns={['name', 'email', 'lastLogin', 'action']} youId="user-001" />
      </section>

      {/* Delegate Views */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400">Delegate Views · {delegateViews.length}</p>
          <button className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">+ Assign SSO user as Delegate View</button>
        </div>
        <UserTable users={delegateViews} columns={['name', 'email', 'lastLogin', 'action']} youId="user-001" />
      </section>

    </div>
  );
}

function UserTable({ users, columns, youId }: {
  users: SsoUser[];
  columns: Array<'name' | 'email' | 'lastLogin' | 'folders' | 'action'>;
  youId: string;
}) {
  const [page, setPage] = useState(0);
  const pageUsers = users.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <table className="w-full table-fixed">
        <colgroup>
          <col style={{ width: '24%' }} />
          <col style={{ width: '34%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '20%' }} />
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Name</th>
            <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Email</th>
            <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Last login</th>
            <th className="px-4 py-3 text-right text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">
              {columns.includes('folders') ? 'Folders admin' : 'Action'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.length === 0 ? (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No users match.</td></tr>
          ) : pageUsers.map(u => (
            <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${u.active === false ? 'opacity-70' : ''}`}>
              <td className="px-4 py-3 align-top">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">{u.name}</span>
                  {u.active === false && <span className="text-[10px] uppercase tracking-wide font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-1.5 py-0">Inactive</span>}
                </div>
                {u.title && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{u.title}</p>}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 truncate align-top">{u.email}</td>
              <td className="px-4 py-3 text-sm text-gray-500 align-top">{formatRelative(u.lastLoginIso)}</td>
              <td className="px-4 py-3 text-right text-sm text-gray-500 align-top">
                {columns.includes('folders') ? (
                  u.foldersAdminCount ? `${u.foldersAdminCount} folder${u.foldersAdminCount !== 1 ? 's' : ''}` : '—'
                ) : u.id === youId ? (
                  <span className="text-xs text-gray-400">— (you)</span>
                ) : u.systemAdmin && u.delegateView ? (
                  <span className="text-xs text-gray-400">Holds Sys Admin</span>
                ) : (
                  <button className="w-7 h-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={users.length}
        onPageChange={setPage} label="users" />
    </div>
  );
}
