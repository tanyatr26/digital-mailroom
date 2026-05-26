'use client';
import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, Search, X, ChevronRight, ChevronDown,
  Folder as FolderIcon, MoreVertical, UserPlus, Eye, Bell,
} from 'lucide-react';
import { useUser } from '@/src/context/UserContext';
import { useRoleGate } from '@/src/hooks/useRoleGate';
import { FOLDERS, getRootFolders, getChildFolders } from '@/src/mocks/data';
import { findUser, formatRelative } from '@/src/mocks/users';
import SendReminderModal, { type ReminderPreview } from '@/src/components/modals/SendReminderModal';
import type { Folder } from '@/src/types';

// Mock in-flight counts so the tree has plausible numbers.
const IN_FLIGHT: Record<string, number> = {
  sales: 5, jobsites: 12, billing: 3, payroll: 4, enrollments: 6,
  'ca-state': 8, 'jobsite-a': 3, 'ops-dept': 2, 'safety-dept': 1,
  'r-001': 4, 'r-002': 2, 'r-003': 1, 'r-004': 0,
};

function getInFlight(id: string): number {
  return IN_FLIGHT[id] ?? 0;
}

function adminLabel(folder: Folder): string {
  const u = folder.admin_user_id ? findUser(folder.admin_user_id) : undefined;
  return u?.name ?? '— unassigned';
}

// ── Health-dashboard signals ──────────────────────────────────────
// Reference clock matches users.ts so the "inactive admin" amber
// threshold agrees with the formatRelative output.
const REFERENCE_NOW = new Date('2026-05-14T12:00:00').getTime();
// Day threshold drives both the "Idle Nd+" badge label and its tooltip
// copy. Hooks up to the Tunable Defaults inactiveAlertDays input when
// that wiring lands; hardcoded to 7 for the demo today.
const STALE_THRESHOLD_DAYS = 7;
const STALE_THRESHOLD_MS = STALE_THRESHOLD_DAYS * 86_400_000;

// Mock backup-delegate assignment per folder. Only the folders listed here
// are considered to have a delegate; everything else flags "No delegate".
const DELEGATED_FOLDERS = new Set<string>(['sales', 'jobsites', 'billing']);

function isStaleAdmin(adminId?: string): boolean {
  if (!adminId) return false;
  const u = findUser(adminId);
  if (!u) return false;
  if (u.active === false) return true;
  if (!u.lastInboxActivityIso) return false;
  return REFERENCE_NOW - new Date(u.lastInboxActivityIso).getTime() >= STALE_THRESHOLD_MS;
}
function isOrphaned(f: Folder): boolean {
  return !f.admin_user_id;
}
function hasNoDelegate(f: Folder): boolean {
  if (!f.admin_user_id) return false; // Orphaned supersedes "no delegate".
  return !DELEGATED_FOLDERS.has(f.id);
}

type FilterKey = 'all' | 'inactive' | 'orphaned' | 'no-delegate';
const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all',         label: 'All' },
  { key: 'inactive',    label: `Idle ${STALE_THRESHOLD_DAYS}+ days` },
  { key: 'orphaned',    label: 'No admin' },
  { key: 'no-delegate', label: 'No delegate' },
];

function matchesFilter(f: Folder, key: FilterKey): boolean {
  switch (key) {
    case 'all':         return true;
    case 'inactive':    return isStaleAdmin(f.admin_user_id);
    case 'orphaned':    return isOrphaned(f);
    case 'no-delegate': return hasNoDelegate(f);
  }
}

interface BadgeData {
  inactive: boolean;
  orphaned: boolean;
  noDelegate: boolean;
}
function badgesFor(f: Folder): BadgeData {
  return {
    inactive:   isStaleAdmin(f.admin_user_id),
    orphaned:   isOrphaned(f),
    noDelegate: hasNoDelegate(f),
  };
}

// Brief §22 F6 — Each active badge on a folder produces one reminder
// preview card (and, on send, one F6 notification for the folder admin).
function buildReminderPreviews(f: Folder): ReminderPreview[] {
  const badges = badgesFor(f);
  const out: ReminderPreview[] = [];
  if (badges.inactive) {
    out.push({
      badge:       'inactive',
      title:       `Reminder: ${f.name} needs attention`,
      body:        `Admin hasn't taken any inbox action in ${STALE_THRESHOLD_DAYS}+ days. Mail is accumulating.`,
      href:        '/inbox',
      actionLabel: 'Open inbox',
    });
  }
  if (badges.orphaned) {
    out.push({
      badge:       'orphaned',
      title:       `Reminder: ${f.name} needs an admin`,
      body:        'No primary admin assigned. Incoming mail has no one to handle it.',
      href:        '/configurations/folder-assignments',
      actionLabel: 'Assign admin',
    });
  }
  if (badges.noDelegate) {
    out.push({
      badge:       'no-delegate',
      title:       `Reminder: ${f.name} needs a delegate`,
      // Per-folder delegate, not the admin's main-inbox backup. Routes
      // to Folder Assignments where the FA can add a delegate for the
      // specific folder card.
      body:        `No folder delegate assigned to ${f.name}. Add one to ensure coverage if you're out.`,
      href:        '/configurations/folder-assignments',
      actionLabel: 'Add delegate',
    });
  }
  return out;
}

// Stable mocks for the read-only folder detail modal so each folder shows
// a consistent set of history entries + in-flight doc titles.
function mockHistoryFor(folderId: string) {
  const hist = [
    { action: 'Routed to',     actor: 'Maria Santos', target: 'CA / Jobsite A', whenIso: '2026-05-13T10:32:00' },
    { action: 'Returned from', actor: 'James Wu',     target: 'CA / Jobsite A', whenIso: '2026-05-12T08:15:00' },
    { action: 'Routed to',     actor: 'Tom Park',     target: 'Payroll',        whenIso: '2026-05-10T15:40:00' },
    { action: 'Routed to',     actor: 'Sarah Chen',   target: 'Sales',          whenIso: '2026-05-08T11:05:00' },
    { action: 'Archived doc',  actor: 'J. Smith',     target: '',               whenIso: '2026-05-06T14:22:00' },
  ];
  let h = 0;
  for (let i = 0; i < folderId.length; i++) h = (h * 31 + folderId.charCodeAt(i)) >>> 0;
  return hist.slice(0, (h % 4) + 2);
}
function mockInFlightFor(folder: Folder) {
  const titles = ['Invoice #4421', 'PO Confirmation', 'Safety Incident Report', 'Benefits Election', 'COI Certificate'];
  const received = ['2 hr ago', 'Yesterday', '3 days ago', '4 days ago', 'Last week'];
  const n = Math.min(getInFlight(folder.id), 5);
  let h = 0;
  for (let i = 0; i < folder.id.length; i++) h = (h * 31 + folder.id.charCodeAt(i)) >>> 0;
  return Array.from({ length: n }, (_, i) => ({
    title:    titles[(h + i) % titles.length],
    received: received[i],
  }));
}

export default function FolderTreePage() {
  const allowed = useRoleGate(['System_Admin']);
  const { user } = useUser();
  const roots = useMemo(() => getRootFolders(), []);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<FilterKey>('all');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(roots.map(r => r.id)));
  const [openMenuFolderId, setOpenMenuFolderId] = useState<string | null>(null);
  const [detailFolderId, setDetailFolderId]     = useState<string | null>(null);
  const [reminderFolderId, setReminderFolderId] = useState<string | null>(null);
  const [toast, setToast]                       = useState<string>('');

  const toggleExpand = (id: string) => setExpanded(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  // Search filter: keep folders matching the query plus their ancestors.
  const matchedIds = useMemo<Set<string> | null>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const matches = new Set<string>();
    FOLDERS.forEach(f => {
      if (f.name.toLowerCase().includes(q)) {
        // Add this folder + all ancestors.
        let cur: Folder | undefined = f;
        while (cur) {
          matches.add(cur.id);
          cur = cur.parent_folder_id ? FOLDERS.find(p => p.id === cur!.parent_folder_id) : undefined;
        }
      }
    });
    return matches;
  }, [search]);

  // Filter pill set: folders satisfying the active condition + their
  // ancestors so the hierarchy stays navigable. null when "All" is active.
  const filterIds = useMemo<Set<string> | null>(() => {
    if (filter === 'all') return null;
    const ids = new Set<string>();
    FOLDERS.forEach(f => {
      if (matchesFilter(f, filter)) {
        let cur: Folder | undefined = f;
        while (cur) {
          ids.add(cur.id);
          cur = cur.parent_folder_id ? FOLDERS.find(p => p.id === cur!.parent_folder_id) : undefined;
        }
      }
    });
    return ids;
  }, [filter]);

  const passes = (id: string): boolean => {
    if (matchedIds && !matchedIds.has(id)) return false;
    if (filterIds  && !filterIds.has(id))  return false;
    return true;
  };

  const visibleAtRoot = roots.filter(r => passes(r.id));

  // Auto-expand matched/filtered folders so the user lands on them.
  useEffect(() => {
    const auto = new Set<string>();
    if (matchedIds) matchedIds.forEach(id => auto.add(id));
    if (filterIds)  filterIds.forEach(id  => auto.add(id));
    if (auto.size) setExpanded(prev => new Set([...prev, ...Array.from(auto)]));
  }, [matchedIds, filterIds]);

  // Counts surface next to each pill so the SA can triage at a glance.
  const counts = useMemo(() => {
    const c = { all: FOLDERS.length, inactive: 0, orphaned: 0, 'no-delegate': 0 } as Record<FilterKey, number>;
    FOLDERS.forEach(f => {
      if (isStaleAdmin(f.admin_user_id)) c.inactive += 1;
      if (isOrphaned(f))                 c.orphaned += 1;
      if (hasNoDelegate(f))              c['no-delegate'] += 1;
    });
    return c;
  }, []);

  const detailFolder = detailFolderId ? FOLDERS.find(f => f.id === detailFolderId) ?? null : null;
  const reminderFolder = reminderFolderId ? FOLDERS.find(f => f.id === reminderFolderId) ?? null : null;
  // Build the F6 preview payload from whichever badges are currently
  // active on the folder. One preview = one notification fired on send.
  const reminderPreviews: ReminderPreview[] = reminderFolder
    ? buildReminderPreviews(reminderFolder)
    : [];

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/configurations" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors mb-4">
        <ChevronLeft className="w-3.5 h-3.5" /> All configurations
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Folder Tree</h1>
      <p className="mt-1 text-sm text-gray-500">Folder health at a glance. Scan for inactive admins, orphaned folders, and missing delegates — and act on them inline.</p>

      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search folders…"
            className="h-9 pl-8 pr-7 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400"
            style={{ width: 260 }} />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
        </div>
      </div>

      {/* Health filter pills */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button key={key} onClick={() => setFilter(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors border ${
                active
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}>
              {label}
              <span className={`text-[10px] tabular-nums ${active ? 'text-blue-100' : 'text-gray-400'}`}>{counts[key]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 bg-white rounded-2xl border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 rounded-t-2xl grid grid-cols-12 gap-4 text-[11px] uppercase tracking-[0.06em] text-gray-400 font-normal">
          <div className="col-span-8">Folder</div>
          <div className="col-span-2">Admin</div>
          <div className="col-span-1 text-right">In-flight</div>
          <div className="col-span-1" />
        </div>
        <ul className="divide-y divide-gray-100">
          {visibleAtRoot.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-gray-400">No folders match the current filters.</li>
          ) : (
            visibleAtRoot.map(f => (
              <FolderRow
                key={f.id}
                folder={f}
                depth={0}
                expanded={expanded}
                passes={passes}
                toggle={toggleExpand}
                currentUserId={user.id}
                openMenuFolderId={openMenuFolderId}
                onOpenMenu={setOpenMenuFolderId}
                onOpenDetail={setDetailFolderId}
                onOpenReminder={setReminderFolderId}
                onFlashToast={flashToast}
              />
            ))
          )}
        </ul>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      {detailFolder && (
        <FolderDetailModal folder={detailFolder} onClose={() => setDetailFolderId(null)} />
      )}
      {reminderFolder && (
        <SendReminderModal
          folderId={reminderFolder.id}
          folderName={reminderFolder.name}
          folderAdminUserId={reminderFolder.admin_user_id}
          previews={reminderPreviews}
          onClose={() => setReminderFolderId(null)}
          onSent={() => {
            const count = reminderPreviews.length;
            setReminderFolderId(null);
            flashToast(`Reminder sent · ${count} item${count !== 1 ? 's' : ''}.`);
          }}
        />
      )}
    </div>
  );
}

interface FolderRowProps {
  folder: Folder;
  depth: number;
  expanded: Set<string>;
  passes: (id: string) => boolean;
  toggle: (id: string) => void;
  currentUserId: string;
  openMenuFolderId: string | null;
  onOpenMenu: (id: string | null) => void;
  onOpenDetail: (id: string | null) => void;
  onOpenReminder: (id: string) => void;
  onFlashToast: (msg: string) => void;
}

function FolderRow({
  folder, depth, expanded, passes, toggle,
  currentUserId, openMenuFolderId, onOpenMenu, onOpenDetail, onOpenReminder, onFlashToast,
}: FolderRowProps) {
  const children = useMemo(() => getChildFolders(folder.id), [folder.id]);
  const visibleChildren = children.filter(c => passes(c.id));
  const isOpen = expanded.has(folder.id);
  const hasChildren = visibleChildren.length > 0;
  const inFlight = getInFlight(folder.id);
  const badges = badgesFor(folder);
  // Owned vs read-only menu is keyed off who created the folder — same
  // signal Folder Assignments uses. Depth doesn't matter; what matters is
  // whether the logged-in user created this row. Subfolders created by
  // downstream admins (e.g. recipient self-onboarded mailboxes, FA-built
  // child folders) always render the Notify menu for the SA.
  const saCreated = folder.created_by_user_id === currentUserId;
  const isMenuOpen = openMenuFolderId === folder.id;

  return (
    <>
      <li className="px-5 py-2 grid grid-cols-12 gap-4 hover:bg-gray-50 transition-colors items-center">
        <div className="col-span-8 flex items-center gap-1.5 min-w-0 flex-wrap" style={{ paddingLeft: depth * 18 }}>
          {hasChildren ? (
            <button onClick={() => toggle(folder.id)}
              className="w-5 h-5 inline-flex items-center justify-center text-gray-400 hover:text-gray-700 rounded transition-colors flex-shrink-0">
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-5 h-5 inline-flex items-center justify-center flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
            </span>
          )}
          <FolderIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <button onClick={() => onOpenDetail(folder.id)}
            className="text-sm font-medium text-gray-900 truncate hover:text-blue-700 transition-colors text-left">
            {folder.name}
          </button>
          {!folder.parent_folder_id && (
            <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded-full px-1.5 py-0">root</span>
          )}
          {badges.orphaned && (
            <span
              title={saCreated
                ? 'No primary admin assigned. Use Assign admin to resume routing.'
                : 'No primary admin assigned. Incoming mail has no one to handle it.'}
              className="text-[10px] uppercase tracking-wide font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
              No admin
            </span>
          )}
          {badges.inactive && (
            <span
              title={saCreated
                ? `Admin hasn't taken any inbox action in ${STALE_THRESHOLD_DAYS}+ days. Mail is accumulating. Use Reassign admin or contact them directly.`
                : `Admin hasn't taken any inbox action in ${STALE_THRESHOLD_DAYS}+ days. Mail is accumulating.`}
              className="text-[10px] uppercase tracking-wide font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
              Idle {STALE_THRESHOLD_DAYS}+ days
            </span>
          )}
          {badges.noDelegate && (
            <span
              title={saCreated
                ? 'No backup designated. Use Add delegate to ensure coverage.'
                : 'No backup designated. If the admin goes out, there\'s no coverage.'}
              className="text-[10px] uppercase tracking-wide font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-1.5 py-0.5">
              No delegate
            </span>
          )}
        </div>
        <div className="col-span-2 text-xs text-gray-600 truncate">{adminLabel(folder)}</div>
        <div className="col-span-1 text-right text-xs">
          {inFlight > 0
            ? <span className="font-semibold text-amber-700">{inFlight}</span>
            : <span className="text-gray-300">0</span>}
        </div>
        <div className="col-span-1 relative text-right">
          <button onClick={() => onOpenMenu(isMenuOpen ? null : folder.id)}
            className="w-7 h-7 inline-flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
          {isMenuOpen && (
            <FolderActionMenu
              folder={folder}
              saCreated={saCreated}
              badges={badges}
              onClose={() => onOpenMenu(null)}
              onOpenDetail={() => { onOpenDetail(folder.id); onOpenMenu(null); }}
              onOpenReminder={() => { onOpenReminder(folder.id); onOpenMenu(null); }}
              onFlashToast={onFlashToast}
            />
          )}
        </div>
      </li>
      {isOpen && visibleChildren.map(c => (
        <FolderRow
          key={c.id}
          folder={c}
          depth={depth + 1}
          expanded={expanded}
          passes={passes}
          toggle={toggle}
          currentUserId={currentUserId}
          openMenuFolderId={openMenuFolderId}
          onOpenMenu={onOpenMenu}
          onOpenDetail={onOpenDetail}
          onOpenReminder={onOpenReminder}
          onFlashToast={onFlashToast}
        />
      ))}
    </>
  );
}

interface FolderActionMenuProps {
  folder: Folder;
  saCreated: boolean;
  badges: BadgeData;
  onClose: () => void;
  onOpenDetail: () => void;
  onOpenReminder: () => void;
  onFlashToast: (msg: string) => void;
}

function FolderActionMenu({ folder, saCreated, badges, onClose, onOpenDetail, onOpenReminder, onFlashToast }: FolderActionMenuProps) {
  const handleAssignDelegate = () => { onFlashToast(`Assign delegate flow opened for "${folder.name}"`); onClose(); };
  const handleReassign       = () => { onFlashToast(`Reassign admin flow opened for "${folder.name}"`); onClose(); };
  // Owned-row action gating: each action is only shown when an active
  // warning badge calls for it. A "clean" folder (no warnings) shows only
  // Open details — there is nothing to action.
  const showReassign       = saCreated && (badges.inactive || badges.orphaned);
  const showAssignDelegate = saCreated && badges.noDelegate && !badges.orphaned;
  // Non-owned: Send reminder only renders when at least one badge is
  // active — there's nothing actionable to remind about otherwise.
  const anyBadgeActive = badges.inactive || badges.orphaned || badges.noDelegate;
  const showSendReminder = !saCreated && anyBadgeActive;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[200px] text-left overflow-hidden">
        {saCreated ? (
          <>
            {showAssignDelegate && (
              <button onClick={handleAssignDelegate}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <UserPlus className="w-3.5 h-3.5 text-gray-400" /> Assign delegate
              </button>
            )}
            {showReassign && (
              <button onClick={handleReassign}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <UserPlus className="w-3.5 h-3.5 text-gray-400" /> Reassign admin
              </button>
            )}
            {(showAssignDelegate || showReassign) && <div className="h-px bg-gray-100 my-1" />}
            <button onClick={onOpenDetail}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <Eye className="w-3.5 h-3.5 text-gray-400" /> Open details
            </button>
          </>
        ) : (
          <>
            {showSendReminder && (
              <>
                <button onClick={onOpenReminder} disabled={!folder.admin_user_id}
                  title={!folder.admin_user_id ? 'No admin assigned to notify' : undefined}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    !folder.admin_user_id ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'
                  }`}>
                  <Bell className="w-3.5 h-3.5 text-gray-400" /> Send reminder
                  {!folder.admin_user_id && <span className="ml-auto text-[10px] text-gray-400 normal-case font-normal">No admin</span>}
                </button>
                <div className="h-px bg-gray-100 my-1" />
              </>
            )}
            <button onClick={onOpenDetail}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <Eye className="w-3.5 h-3.5 text-gray-400" /> Open details
              <span className="ml-auto text-[10px] text-gray-400 normal-case font-normal">read-only</span>
            </button>
          </>
        )}
      </div>
    </>
  );
}

function FolderDetailModal({ folder, onClose }: { folder: Folder; onClose: () => void }) {
  const admin = folder.admin_user_id ? findUser(folder.admin_user_id) : undefined;
  const history = mockHistoryFor(folder.id);
  const docs = mockInFlightFor(folder);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400">Folder details · read-only</p>
            <h2 className="text-base font-semibold text-gray-900 mt-0.5 truncate">{folder.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              Admin: {admin?.name ?? '— unassigned'}
              {admin && <> · Last activity {formatRelative(admin.lastInboxActivityIso ?? admin.lastLoginIso)}</>}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 grid grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400 mb-3">Routing history</p>
            <ul className="space-y-2">
              {history.map((h, i) => (
                <li key={i} className="text-xs text-gray-700">
                  <span className="font-medium text-gray-900">{h.actor}</span>
                  <span className="text-gray-500"> {h.action.toLowerCase()} </span>
                  {h.target && <span className="font-medium text-gray-900">{h.target}</span>}
                  <span className="text-gray-400"> · {formatRelative(h.whenIso)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400 mb-3">In-flight docs ({getInFlight(folder.id)})</p>
            {docs.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No documents currently in flight.</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((d, i) => (
                  <li key={i} className="text-xs text-gray-700">
                    <span className="font-medium text-gray-900">{d.title}</span>
                    <span className="text-gray-400"> · received {d.received}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}
