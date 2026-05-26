'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Crown } from 'lucide-react';
import TopBar from '@/src/components/shell/TopBar';
import SideMenu from '@/src/components/shell/SideMenu';
import DelegationBanner from '@/src/components/shell/DelegationBanner';
import { useUser } from '@/src/context/UserContext';

// Routes where the side menu is hidden and workspace fills content.
// These routes mount full-screen h-screen components; the CSS override in
// globals.css (.workspace-container > * { height: 100% }) corrects the height
// so the component fills the shell's content area (100vh - topbar) exactly.
// /inbox is intentionally excluded — it uses the full shell (top bar + side menu).
const WORKSPACE_ROUTES = new Set(['/']);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isWorkspace = WORKSPACE_ROUTES.has(pathname);
  const { user, needsBackupDelegate, justPromoted, setJustPromoted } = useUser();

  // Brief V2 §4 — newly promoted SA must designate a Backup Delegate
  // before any other Configurations surface is reachable. Belt-and-
  // suspenders alongside the landing card grey-out: if the user types
  // /configurations/folder-tree (or any other configs URL) directly,
  // bounce them back to the BD page.
  useEffect(() => {
    if (!needsBackupDelegate) return;
    if (pathname.startsWith('/configurations/') && pathname !== '/configurations/backup-delegate') {
      router.replace('/configurations/backup-delegate');
    }
  }, [needsBackupDelegate, pathname, router]);

  return (
    <>
      <TopBar />
      <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 52px)', marginTop: 52 }}>
        <DelegationBanner />
        {needsBackupDelegate && <BackupDelegateGateBanner />}
        <div className="flex flex-1 overflow-hidden">
          {!isWorkspace && (
            <SideMenu collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
          )}
          <main className={`flex-1 overflow-y-auto bg-white${isWorkspace ? ' workspace-container' : ''}`}>
            {children}
          </main>
        </div>
      </div>
      {justPromoted && (
        <PostPromotionFullScreen
          name={user.name}
          onDesignate={() => {
            setJustPromoted(false);
            router.push('/configurations/backup-delegate');
          }} />
      )}
    </>
  );
}

function BackupDelegateGateBanner() {
  return (
    <div className="flex-shrink-0 flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
      <span className="flex-1 font-semibold">Designate a Backup Delegate to enable all admin features.</span>
      <Link href="/configurations/backup-delegate"
        className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors flex-shrink-0">
        Designate now
      </Link>
    </div>
  );
}

function PostPromotionFullScreen({ name, onDesignate }: { name: string; onDesignate: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full" style={{ maxWidth: 560 }}>
        <div className="px-8 py-7 border-b border-gray-200 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Crown className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-gray-900">You are now the System Admin</h2>
            <p className="text-sm text-gray-500 mt-1">Welcome, {name}.</p>
          </div>
        </div>
        <div className="px-8 py-7 text-sm text-gray-700 leading-relaxed">
          <p>
            To complete the transition, designate at least one Backup Delegate. Your previous role kept the org covered — now it&apos;s your turn to do the same.
          </p>
        </div>
        <div className="px-8 py-5 border-t border-gray-200 bg-gray-50 flex items-center justify-end">
          <button onClick={onDesignate}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors">
            Designate Backup Delegate
          </button>
        </div>
      </div>
    </div>
  );
}
