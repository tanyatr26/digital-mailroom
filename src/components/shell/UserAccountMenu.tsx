'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Check } from 'lucide-react';
import { useUser } from '@/src/context/UserContext';
import { activeCoveredByDelegate } from '@/src/mocks/backupDelegations';
import { findUser } from '@/src/mocks/users';
import { DEFAULT_ROUTES } from '@/src/mocks/currentUser';
import { INBOX_GROUPS } from '@/src/mocks/inboxData';

// Brief V2 §4a — Production account menu, separate from the demo role
// switcher chip. Lets the user switch their active context between self
// and any backup-delegation they currently hold.

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
}

// Primary-blue avatar treatment: translucent blue wash with deeper blue
// initials. Consistent identity tone across self and covered rows; no
// per-user palette — the name beside it carries the identity.
function Avatar({ name, size = 28, badge, textClass = 'text-[11px]' }: { name: string; size?: number; badge?: boolean; textClass?: string }) {
  return (
    <div className="relative flex-shrink-0">
      <div
        style={{ width: size, height: size }}
        className="rounded-full flex items-center justify-center bg-blue-500/10 text-blue-700">
        <span className={`${textClass} font-semibold leading-none tracking-tight`}>{initialsOf(name)}</span>
      </div>
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
      )}
    </div>
  );
}

// Untouched-work count for the demo user (J. Smith). Counts:
//   • Groups whose effective status is 'New'
//   • Processed groups carrying unresolved returned docs
// Status overrides from saved-progress sessions are read off the same
// sessionStorage keys the Inbox page writes to so the badges stay in
// sync with what the Inbox table renders.
const SAVED_SESSIONS_KEY = 'folder-admin-inbox-saved';
const RESOLVED_RETURNS_KEY = 'folder-admin-inbox-resolved-returns';
function readSavedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.sessionStorage.getItem(SAVED_SESSIONS_KEY);
    if (!raw) return new Set();
    return new Set(Object.keys(JSON.parse(raw) as Record<string, unknown>));
  } catch { return new Set(); }
}
function readResolvedReturnIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.sessionStorage.getItem(RESOLVED_RETURNS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
}
function computeSelfUntouchedCount(): number {
  const savedIds    = readSavedIds();
  const resolvedIds = readResolvedReturnIds();
  let count = 0;
  for (const g of INBOX_GROUPS) {
    const status = savedIds.has(g.id) ? 'In_Progress' : g.status;
    if (status === 'New') count += 1;
    if (status === 'Processed' && (g.returnedDocs?.length ?? 0) > 0 && !resolvedIds.has(g.id)) {
      count += 1;
    }
  }
  return count;
}

// Per-covered-admin mock counts for the dropdown. Real backend would query
// each admin's inbox surface; in the single-tenant mock we stub a couple
// of users so the "Covering: …" rows demonstrate the indicator.
const COVERED_UNTOUCHED_MOCK: Record<string, number> = {
  'user-kn': 3,
};

export default function UserAccountMenu() {
  const { user, actingAs, setActingAs } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const covered = activeCoveredByDelegate(user.id);
  const isSelfContext = actingAs === null;
  const activeContextName = actingAs ? (findUser(actingAs)?.name ?? actingAs) : user.name;

  // Counts: self derived from INBOX_GROUPS + sessionStorage overlay so it
  // stays in step with the Inbox surface; covered admins use the mock map
  // until a real per-admin inbox API exists. Recomputed when the dropdown
  // opens to capture any Save Progress / Resolve Returns side effects.
  const [selfCount, setSelfCount] = useState(0);
  useEffect(() => { setSelfCount(computeSelfUntouchedCount()); }, []);
  useEffect(() => { if (open) setSelfCount(computeSelfUntouchedCount()); }, [open]);
  const coveredCounts = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    covered.forEach(d => { out[d.admin_user_id] = COVERED_UNTOUCHED_MOCK[d.admin_user_id] ?? 0; });
    return out;
  }, [covered]);
  const totalCount = selfCount + Object.values(coveredCounts).reduce((s, n) => s + n, 0);
  const hasAnyUntouched = totalCount > 0;

  const handleSelectSelf = () => {
    setActingAs(null);
    setOpen(false);
    // Brief: switching context "reloads app data scoped to" the selected
    // identity. Routing to the user's default landing approximates that
    // in the single-page mock.
    router.push(DEFAULT_ROUTES[user.role]);
  };

  const handleSelectCovered = (adminUserId: string) => {
    setActingAs(adminUserId);
    setOpen(false);
    router.push(DEFAULT_ROUTES[user.role]);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-gray-100 transition-colors">
        <Avatar name={activeContextName} badge={hasAnyUntouched} />
        <span className="text-xs font-medium text-gray-900 max-w-[160px] truncate">
          {activeContextName}
          {isSelfContext && <span className="text-gray-400 font-normal"> (You)</span>}
        </span>
        <ChevronDown className="w-3 h-3 text-gray-500" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden p-1"
            style={{ width: 296 }}>
            {/* Header — non-interactive identity card */}
            <div className="px-2.5 py-2.5 flex items-center gap-3">
              <Avatar name={user.name} size={40} textClass="text-sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
              </div>
            </div>

            {/* Acting as */}
            <div className="px-2.5 pt-2 pb-1">
              <p className="text-[10px] uppercase tracking-[0.1em] font-semibold text-gray-400">Acting as</p>
            </div>
            <ContextRow
              name={user.name}
              meta={<span className="text-gray-400 font-normal"> (You)</span>}
              selected={actingAs === null}
              count={selfCount}
              onClick={handleSelectSelf} />
            {covered.map(d => {
              const admin = findUser(d.admin_user_id);
              const name = admin?.name ?? d.admin_user_id;
              const count = coveredCounts[d.admin_user_id] ?? 0;
              return (
                <ContextRow
                  key={d.id}
                  name={name}
                  meta={<span className="text-gray-400 font-normal"> · Covering</span>}
                  selected={actingAs === d.admin_user_id}
                  count={count}
                  onClick={() => handleSelectCovered(d.admin_user_id)} />
              );
            })}

            {/* Footer */}
            <div className="border-t border-gray-100 mt-1 mb-1" />
            <FooterItem icon={<LogOut className="w-4 h-4" />} label="Sign out" onClick={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}

// Single row in the Acting As section. Selected state: subtle blue tint
// + bold name + check icon at right. Unselected: regular weight, no icon.
// Count (when > 0) renders as a minimal semibold number — no pill chrome.
function ContextRow({ name, meta, selected, count, onClick }: {
  name: string;
  meta?: React.ReactNode;
  selected: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${
        selected ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-gray-50'
      }`}>
      <Avatar name={name} size={28} />
      <span className={`flex-1 truncate text-sm ${selected ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>
        {name}{meta}
      </span>
      {count > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-bold tabular-nums flex-shrink-0">
          {count > 99 ? '99+' : count}
        </span>
      )}
      {selected && <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
    </button>
  );
}

function FooterItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
      <span className="text-gray-400">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
