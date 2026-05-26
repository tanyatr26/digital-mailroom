'use client';
import { X, Bell } from 'lucide-react';
import { useNotifications } from '@/src/context/NotificationsContext';
import NotificationRow from '@/src/components/notifications/NotificationRow';
import type { Notification } from '@/src/types/notifications';

// V2 §22 (F6) + Configs Ref §2 — Send reminder flow. SA opens this from
// a non-owned row's ⋮ menu in Folder Tree. Each active badge produces one
// preview card (reusing the live NotificationRow in preview mode). On
// confirm, one F6 notification per badge is emitted to the folder admin.

export interface ReminderPreview {
  badge: 'inactive' | 'orphaned' | 'no-delegate';
  title: string;
  body: string;
  href: string;
  actionLabel: string;
}

interface Props {
  folderId: string;
  folderName: string;
  folderAdminUserId?: string;
  previews: ReminderPreview[];
  onClose: () => void;
  onSent: () => void;     // Parent handles toast + close.
}

export default function SendReminderModal({ folderId, folderName, folderAdminUserId, previews, onClose, onSent }: Props) {
  const { emit } = useNotifications();
  const canSend = previews.length > 0 && !!folderAdminUserId;

  const handleSend = () => {
    if (!canSend || !folderAdminUserId) return;
    // Emit one F6 per active badge. Each carries its own title, body, href,
    // and action-label override so the recipient's drawer shows the right
    // CTA per condition (Open inbox / Assign admin / Designate backup).
    //
    // Demo proxy: this mock has a single identity (user-001 / J. Smith),
    // so a notification addressed to anyone else never surfaces during a
    // role-switch test. We mirror each F6 onto user-001 when the real
    // recipient is someone else, so switching role to Folder_Admin or
    // Delegate_View_Folder reveals the reminder as the folder admin would
    // see it. The real recipient still gets their original copy.
    previews.forEach(p => {
      const base = {
        code:        'F6' as const,
        severity:    'action' as const,
        title:       p.title,
        body:        p.body,
        href:        p.href,
        actionLabel: p.actionLabel,
        source_kind: 'folder' as const,
        source_id:   folderId,
        type:        `F6_${p.badge}`,
      };
      emit({ ...base, recipient_user_id: folderAdminUserId });
      if (folderAdminUserId !== 'user-001') {
        emit({ ...base, recipient_user_id: 'user-001' });
      }
    });
    onSent();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 520, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900 truncate">Send reminder about {folderName}</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">This is the reminder the folder admin will receive:</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {previews.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-6">No active warnings on this folder.</p>
          ) : (
            previews.map(p => (
              <div key={p.badge} className="rounded-xl border border-gray-200 overflow-hidden">
                <NotificationRow n={buildPreviewNotification(folderId, p)} previewMode />
              </div>
            ))
          )}
          {!folderAdminUserId && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This folder has no admin assigned, so there is no one to remind. Assign an admin first.
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2 flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSend} disabled={!canSend}
            className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors ${
              canSend ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}>
            Send reminder
          </button>
        </div>
      </div>
    </div>
  );
}

// Synthesizes a Notification-shaped object for preview rendering only.
// Not added to the store; NotificationRow's preview mode prevents any
// navigation or state mutation on click.
function buildPreviewNotification(folderId: string, p: ReminderPreview): Notification {
  return {
    id:                `preview-${p.badge}`,
    recipient_user_id: 'preview',
    type:              `F6_${p.badge}`,
    code:              'F6',
    severity:          'action',
    title:             p.title,
    body:              p.body,
    href:              p.href,
    actionLabel:       p.actionLabel,
    created_at:        new Date().toISOString(),
    seen_at:           null,
    read_at:           null,
    archived_at:       null,
    source_kind:       'folder',
    source_id:         folderId,
  };
}
