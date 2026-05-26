'use client';
import { AlertTriangle } from 'lucide-react';
import { useUser } from '@/src/context/UserContext';
import { findUser } from '@/src/mocks/users';

// Brief V2 §4a — Persistent banner shown across every page when the
// active context is NOT self. Single line, amber, with a Switch back link
// that resets the delegation context to self.

export default function DelegationBanner() {
  const { actingAs, setActingAs } = useUser();
  if (!actingAs) return null;
  const covered = findUser(actingAs);
  const name = covered?.name ?? actingAs;
  return (
    <div className="flex-shrink-0 bg-amber-100 border-b border-amber-300 px-6 py-2 flex items-center gap-2 text-xs">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
      <span className="text-amber-900">
        You are acting as <span className="font-semibold">{name}</span>.
      </span>
      <button onClick={() => setActingAs(null)}
        className="ml-1 text-amber-900 font-semibold underline hover:text-amber-700 transition-colors">
        Switch back
      </button>
    </div>
  );
}
