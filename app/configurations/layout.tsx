'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/src/context/UserContext';
import { DEFAULT_ROUTES } from '@/src/mocks/currentUser';
import {
  FolderTree, FileType, Sliders, Sparkles, Star,
  Search, ScrollText, UserCog, Printer, FolderKey,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  group: 'Assignments' | 'Organization' | 'Behavior' | 'Operations' | 'Hardware' | 'Personal';
  // Visibility per V2 access matrix (Configurations Reference §0).
  systemAdmin: boolean;
  folderAdmin: boolean;
}

const NAV: NavItem[] = [
  { href: '/configurations/folder-tree',        label: 'Folder Tree',        Icon: FolderTree,  group: 'Organization', systemAdmin: true,  folderAdmin: false },
  { href: '/configurations/doc-types',          label: 'Doc Type Registry',  Icon: FileType,    group: 'Organization', systemAdmin: true,  folderAdmin: false },
  { href: '/configurations/tunable-defaults',   label: 'Tunable Defaults',   Icon: Sliders,     group: 'Behavior',     systemAdmin: true,  folderAdmin: false },
  { href: '/configurations/ai-config',          label: 'AI Configuration',   Icon: Sparkles,    group: 'Behavior',     systemAdmin: true,  folderAdmin: false },
  { href: '/configurations/trusted-routes',     label: 'Trusted Routes',     Icon: Star,        group: 'Behavior',     systemAdmin: true,  folderAdmin: false },
  { href: '/configurations/cross-folder-search',label: 'Document Archive',   Icon: Search,      group: 'Operations',   systemAdmin: true,  folderAdmin: true  },
  // Unified Audit Log. SA sees doc views + admin-config changes (replaces the
  // old Read Audit Log + Admin Audit Trail pair). FA sees doc views narrowed
  // to their owned subtree. The inner page branches on role.
  { href: '/configurations/audit-log',          label: 'Audit Log',          Icon: ScrollText,  group: 'Operations',   systemAdmin: true,  folderAdmin: true  },
  // SA and FA both route to the new Backup Delegate inner page; the page
  // itself renders role-appropriate content.
  { href: '/configurations/backup-delegate',    label: 'Backup Delegate',    Icon: UserCog,     group: 'Assignments',  systemAdmin: true,  folderAdmin: true  },
  { href: '/configurations/folder-assignments', label: 'Folder Assignments', Icon: FolderKey,   group: 'Assignments',  systemAdmin: true,  folderAdmin: true  },
  { href: '/configurations/label-printers',     label: 'Label Printers',     Icon: Printer,     group: 'Hardware',     systemAdmin: true,  folderAdmin: false },
];

const GROUP_ORDER: NavItem['group'][] = ['Assignments', 'Organization', 'Behavior', 'Operations', 'Hardware', 'Personal'];
// Folder Admin variant — Assignments group (Backup Delegate, Folder
// Assignments) surfaces at the top above Organization.
const GROUP_ORDER_FOLDER_ADMIN: NavItem['group'][] = ['Assignments', 'Organization', 'Behavior', 'Operations', 'Hardware'];

export default function ConfigurationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();

  // Hard role gate: Delegate View (both scopes) has no Configurations access.
  // Bounce them out before any inner layout chrome paints. Per-page gates
  // remain as defense-in-depth.
  const allowed = user.role === 'System_Admin' || user.role === 'Folder_Admin';
  useEffect(() => {
    if (!allowed) router.replace(DEFAULT_ROUTES[user.role]);
  }, [allowed, user.role, router]);
  if (!allowed) return null;

  const visible = NAV.filter(item =>
    (user.role === 'System_Admin' && item.systemAdmin) ||
    (user.role === 'Folder_Admin' && item.folderAdmin)
  );
  const isLanding = pathname === '/configurations';
  const groupOrder = user.role === 'Folder_Admin' ? GROUP_ORDER_FOLDER_ADMIN : GROUP_ORDER;

  return (
    <div className="flex h-full bg-slate-50">
      {/* Left rail */}
      <aside className="flex-shrink-0 w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-100">
          <Link href="/configurations" className="block">
            <h2 className={`text-sm font-semibold transition-colors ${isLanding ? 'text-blue-700' : 'text-gray-900 hover:text-blue-700'}`}>Configurations</h2>
            <p className="text-xs text-gray-400 mt-0.5">Org-wide settings &amp; tools</p>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-3">
          {groupOrder.map(group => {
            const items = visible.filter(i => i.group === group);
            if (!items.length) return null;
            return (
              <div key={group}>
                <p className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-[0.08em] font-semibold text-gray-400">{group}</p>
                {items.map(({ href, label, Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + '/');
                  return (
                    <Link key={href} href={href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}>
                      <Icon className={`flex-shrink-0 w-4 h-4 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
