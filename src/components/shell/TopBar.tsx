'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Settings, ChevronDown, Check } from 'lucide-react';
import { useUser } from '@/src/context/UserContext';
import type { Role } from '@/src/mocks/currentUser';
import { ROLE_LABELS, DEFAULT_ROUTES } from '@/src/mocks/currentUser';
import NotificationBell from '@/src/components/notifications/NotificationBell';
import UserAccountMenu from '@/src/components/shell/UserAccountMenu';

const ALL_ROLES: Role[] = ['System_Admin', 'Delegate_View_Mailroom', 'Delegate_View_Folder', 'Folder_Admin'];

export default function TopBar() {
  const { user, setRole } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleRoleChange = (role: Role) => {
    setRole(role);
    setOpen(false);
    router.push(DEFAULT_ROUTES[role]);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-40 h-[52px] bg-white border-b border-gray-200 flex items-center justify-between px-4">
      {/* Wordmark */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <Mail className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold text-gray-900 tracking-tight">Digital Mailroom</span>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1.5">
        {/* Notification bell — left of the role switcher per V2 §22. */}
        <NotificationBell />
        {/* Production account menu (Brief §4a) — left of the demo role
            chip. Holds Acting As, profile, sign out. */}
        <UserAccountMenu />
        <div className="w-px h-5 bg-gray-200 mx-0.5" />
        {/* Role badge + switcher */}
        <div className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <span>Role: <span className="font-semibold">{ROLE_LABELS[user.role]}</span></span>
            <ChevronDown className="w-3 h-3 text-gray-500" />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[200px]">
                <div className="px-3 pt-2.5 pb-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Switch role</p>
                </div>
                {ALL_ROLES.map(role => (
                  <button
                    key={role}
                    onClick={() => handleRoleChange(role)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 transition-colors text-left"
                  >
                    <span>{ROLE_LABELS[role]}</span>
                    {user.role === role && <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Settings gear — placeholder */}
        <button
          title="Settings"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
