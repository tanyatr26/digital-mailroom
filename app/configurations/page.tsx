'use client';
import Link from 'next/link';
import { useUser } from '@/src/context/UserContext';
import { useRoleGate } from '@/src/hooks/useRoleGate';
import {
  FolderTree, FileType, Sliders, Sparkles, Star,
  Search, ScrollText, UserCog, Printer, FolderKey,
} from 'lucide-react';

interface Card {
  href: string;
  title: string;
  status: string;
  Icon: React.ComponentType<{ className?: string }>;
  group: 'Assignments' | 'Organization' | 'Behavior' | 'Operations' | 'Hardware' | 'Personal';
  systemAdmin: boolean;
  folderAdmin: boolean;
}

const CARDS: Card[] = [
  { href: '/configurations/folder-tree',        title: 'Folder Tree',        status: '10 root · 342 total',       Icon: FolderTree, group: 'Organization', systemAdmin: true,  folderAdmin: false },
  { href: '/configurations/doc-types',          title: 'Doc Type Registry',  status: '12 active',                 Icon: FileType,   group: 'Organization', systemAdmin: true,  folderAdmin: false },
  { href: '/configurations/tunable-defaults',   title: 'Tunable Defaults',   status: '6 parameters',              Icon: Sliders,    group: 'Behavior',     systemAdmin: true,  folderAdmin: false },
  { href: '/configurations/ai-config',          title: 'AI Configuration',   status: 'Phase status',              Icon: Sparkles,   group: 'Behavior',     systemAdmin: true,  folderAdmin: false },
  { href: '/configurations/trusted-routes',     title: 'Trusted Routes',     status: '47 active',                 Icon: Star,       group: 'Behavior',     systemAdmin: true,  folderAdmin: false },
  { href: '/configurations/cross-folder-search',title: 'Document Archive',   status: 'Find any document you have access to', Icon: Search, group: 'Operations',   systemAdmin: true,  folderAdmin: true  },
  // Unified Audit Log. SA collapses the old Read Audit + Admin Audit pair into
  // a single entry covering doc views and config changes. FA sees the same
  // entry but scoped to their owned subtree (subtitle override below).
  { href: '/configurations/audit-log',          title: 'Audit Log',          status: 'Document views, scoped to your subtree', Icon: ScrollText, group: 'Operations',   systemAdmin: true,  folderAdmin: true  },
  // SA and FA both land on the new Backup Delegate inner page; content
  // branches on role inside the page.
  { href: '/configurations/backup-delegate',    title: 'Backup Delegate',    status: 'None active',               Icon: UserCog,    group: 'Assignments',  systemAdmin: true,  folderAdmin: true  },
  { href: '/configurations/folder-assignments', title: 'Folder Assignments', status: '3 folders',                 Icon: FolderKey,  group: 'Assignments',  systemAdmin: true,  folderAdmin: true  },
  { href: '/configurations/label-printers',     title: 'Label Printers',     status: 'Zebra ZD621',               Icon: Printer,    group: 'Hardware',     systemAdmin: true,  folderAdmin: false },
];

const GROUP_ORDER: Card['group'][] = ['Assignments', 'Organization', 'Behavior', 'Operations', 'Hardware', 'Personal'];
// Folder Admin variant — Assignments (Backup Delegate, Folder Assignments)
// surfaces at the top above Organization.
const GROUP_ORDER_FOLDER_ADMIN: Card['group'][] = ['Assignments', 'Organization', 'Behavior', 'Operations', 'Hardware'];

// SA-specific subtitle overrides — the underlying counts/scope differ from
// the FA view of the same card.
const SA_STATUS_OVERRIDES: Record<string, string> = {
  '/configurations/folder-assignments': '4 folders',
  '/configurations/audit-log':          'Document views + config changes · HIPAA-ready',
};

export default function ConfigurationsLanding() {
  const allowed = useRoleGate(['System_Admin', 'Folder_Admin']);
  const { user, needsBackupDelegate } = useUser();
  const cards = CARDS.filter(c =>
    (user.role === 'System_Admin' && c.systemAdmin) ||
    (user.role === 'Folder_Admin' && c.folderAdmin)
  );
  const groupOrder = user.role === 'Folder_Admin' ? GROUP_ORDER_FOLDER_ADMIN : GROUP_ORDER;
  const statusFor = (href: string, fallback: string): string =>
    user.role === 'System_Admin' ? (SA_STATUS_OVERRIDES[href] ?? fallback) : fallback;

  // Brief V2 §4 — newly promoted SA must designate a Backup Delegate
  // before any other admin action is available.
  const gated = (href: string) =>
    needsBackupDelegate && href !== '/configurations/backup-delegate';

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Configurations</h1>
        <p className="mt-1 text-sm text-gray-500">Org-wide settings and admin tools</p>
      </header>

      <div className="space-y-8">
        {groupOrder.map(group => {
          const groupCards = cards.filter(c => c.group === group);
          if (!groupCards.length) return null;
          return (
            <section key={group}>
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400 mb-3">{group}</p>
              <div className="grid grid-cols-3 gap-3">
                {groupCards.map(({ href, title, status, Icon }) => {
                  const isGated = gated(href);
                  if (isGated) {
                    return (
                      <div key={href} aria-disabled
                        title="Designate a Backup Delegate to unlock"
                        className="bg-gray-50 border border-gray-200 rounded-xl p-4 cursor-not-allowed opacity-60 select-none">
                        <Icon className="w-6 h-6 text-gray-400" />
                        <p className="mt-3 text-sm font-semibold text-gray-500">{title}</p>
                        <p className="mt-0.5 text-xs text-gray-400">{statusFor(href, status)}</p>
                      </div>
                    );
                  }
                  return (
                    <Link key={href} href={href}
                      className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer">
                      <Icon className="w-6 h-6 text-gray-500 group-hover:text-blue-600 transition-colors" />
                      <p className="mt-3 text-sm font-semibold text-gray-900">{title}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{statusFor(href, status)}</p>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
