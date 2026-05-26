'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUser } from '@/src/context/UserContext';
import type { Role } from '@/src/mocks/currentUser';

interface NavItem {
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const NAV_SYSTEM_ADMIN: NavItem[] = [
  { label: 'Mail Log',       href: '/mail-log',       Icon: Inbox },
  { label: 'Inbox',          href: '/inbox',          Icon: Inbox },
  { label: 'Configurations', href: '/configurations', Icon: Settings },
];

// Mailroom-scope delegate covers a System Admin's mail run surface —
// gets Mail Log only. Folder-scope delegate covers a Folder Admin's
// folder — gets Inbox only.
const NAV_DELEGATE_VIEW_MAILROOM: NavItem[] = [
  { label: 'Mail Log', href: '/mail-log', Icon: Inbox },
];

const NAV_DELEGATE_VIEW_FOLDER: NavItem[] = [
  { label: 'Inbox', href: '/inbox', Icon: Inbox },
];

const NAV_FOLDER_ADMIN: NavItem[] = [
  { label: 'Inbox',          href: '/inbox',          Icon: Inbox },
  { label: 'Configurations', href: '/configurations', Icon: Settings },
];

function getNavItems(role: Role): NavItem[] {
  if (role === 'System_Admin')            return NAV_SYSTEM_ADMIN;
  if (role === 'Delegate_View_Mailroom') return NAV_DELEGATE_VIEW_MAILROOM;
  if (role === 'Delegate_View_Folder')   return NAV_DELEGATE_VIEW_FOLDER;
  return NAV_FOLDER_ADMIN;
}

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function SideMenu({ collapsed, onToggle }: Props) {
  const { user } = useUser();
  const pathname = usePathname();
  const items = getNavItems(user.role);

  return (
    <aside
      className={`flex-shrink-0 flex flex-col bg-white border-r border-gray-200 transition-all duration-200 overflow-hidden ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      <nav className="flex-1 p-2 pt-3 space-y-0.5">
        {items.map(({ label, href, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className={`flex-shrink-0 w-4 h-4 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex-shrink-0 p-2 border-t border-gray-100">
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
          className="w-full flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
