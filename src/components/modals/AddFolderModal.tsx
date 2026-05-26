'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search } from 'lucide-react';
import { SSO_USERS, findUser, type SsoUser } from '@/src/mocks/users';
import { useUser } from '@/src/context/UserContext';
import type { Folder, RecipientType } from '@/src/types';

interface Props {
  parentName?: string;            // Set when scoped under a parent folder (admin flow). Omit for root creation.
  initialFolder?: Folder;         // Edit mode when provided — prefills fields and switches title/CTA.
  autoFocusAdmin?: boolean;       // True when opened from an inactive-admin folder; pushes focus + clears admin so user picks fresh.
  onSubmit: (folder: { name: string; folder_type: string; recipient_type: RecipientType; initialAdminUserId?: string }) => void;
  onClose: () => void;
}

// V2 Wireframes §2.M.8 (root, SA flow) + §3.M.2 (child, folder-admin flow) +
// V2 §3 (Edit Recipient — unified rename + retype + reassign modal). The
// same form serves "Add Recipient" and "Edit recipient" — caller decides via
// the optional `initialFolder` prop. folder_type stays in the payload for
// the backend but is no longer surfaced in the UI.
export default function AddFolderModal({ parentName, initialFolder, autoFocusAdmin, onSubmit, onClose }: Props) {
  const { user } = useUser();
  const isEdit = !!initialFolder;

  const [name, setName] = useState(initialFolder?.name ?? '');
  const [recipientType, setRecipientType] = useState<RecipientType>(initialFolder?.recipient_type ?? 'group');
  const [adminSearch, setAdminSearch] = useState('');
  const initialAdminUser = useMemo<SsoUser | null>(() => {
    // Inactive-admin edits push the user to pick fresh — start empty + focused.
    if (autoFocusAdmin) return null;
    if (initialFolder?.admin_user_id) return findUser(initialFolder.admin_user_id) ?? null;
    return findUser(user.id) ?? null;
  }, [initialFolder, autoFocusAdmin, user.id]);
  const [selectedAdmin, setSelectedAdmin] = useState<SsoUser | null>(initialAdminUser);

  // Focus management — admin search when autoFocusAdmin, otherwise the name
  // field. useEffect runs once on mount so the ref is wired up.
  const adminSearchRef = useRef<HTMLInputElement | null>(null);
  const nameRef        = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (autoFocusAdmin) adminSearchRef.current?.focus();
    else                nameRef.current?.focus();
  }, [autoFocusAdmin]);

  const ok = name.trim().length > 0 && !!selectedAdmin;

  const adminCandidates = useMemo(() => {
    let list = SSO_USERS.filter(u => u.active !== false);
    const q = adminSearch.trim().toLowerCase();
    if (q) list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    return list.slice(0, 8);
  }, [adminSearch]);

  const handleSubmit = () => {
    if (!ok) return;
    onSubmit({
      name: name.trim(),
      folder_type: initialFolder?.folder_type ?? '',
      recipient_type: recipientType,
      initialAdminUserId: selectedAdmin?.id,
    });
  };

  const title    = isEdit ? 'Edit recipient' : 'Add Recipient';
  const ctaLabel = isEdit ? 'Save changes'   : 'Add Recipient';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 480, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Folder name <span className="text-red-500">*</span></label>
            <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder={parentName ? 'e.g. Jobsite C, Quarterly Audits' : 'e.g. Legal, Operations, HR Inbox'}
              className="w-full text-sm text-gray-900 placeholder:text-gray-400 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Recipient type</label>
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white">
              <button type="button" onClick={() => setRecipientType('group')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${recipientType === 'group' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                Group
              </button>
              <button type="button" onClick={() => setRecipientType('personal')}
                className={`px-3 py-1.5 text-xs font-medium border-l border-gray-300 transition-colors ${recipientType === 'personal' ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                Individual
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {recipientType === 'group'
                ? 'Routes to a shared inbox handled by one or more admins.'
                : 'Bound to a single admin’s personal inbox stream.'}
            </p>
          </div>

          {/* Recipient assignment — picker is uniform across create / edit flows.
              In edit mode of an inactive_admin folder the picker auto-focuses
              and the prior admin is cleared so the user picks fresh. */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Assign recipient <span className="text-red-500">*</span></label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input ref={adminSearchRef} value={adminSearch}
                onChange={e => { setAdminSearch(e.target.value); setSelectedAdmin(null); }}
                placeholder="Search SSO users by name or email…"
                className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>
            {selectedAdmin && (
              <p className="text-[11px] text-gray-500 mt-1.5">
                Selected: <span className="font-medium text-gray-800">{selectedAdmin.name}</span> <span className="text-gray-400">({selectedAdmin.email})</span>
              </p>
            )}
          </div>
          {adminSearch.trim().length > 0 && (
            <ul className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100" style={{ maxHeight: 180, overflowY: 'auto' }}>
              {adminCandidates.length === 0 ? (
                <li className="px-3 py-3 text-xs text-gray-400 italic text-center">No matching SSO users.</li>
              ) : adminCandidates.map(u => (
                <li key={u.id}>
                  <button
                    onClick={() => setSelectedAdmin(u)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${selectedAdmin?.id === u.id ? 'bg-blue-50' : 'hover:bg-white'}`}
                  >
                    <div className={`w-4 h-4 rounded-full border ${selectedAdmin?.id === u.id ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`} />
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
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={!ok}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors shadow-sm ${ok ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
