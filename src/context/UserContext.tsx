'use client';
import { createContext, useContext, useState, useCallback } from 'react';
import type { Role, CurrentUser } from '@/src/mocks/currentUser';
import { MOCK_USER } from '@/src/mocks/currentUser';
import { findUser } from '@/src/mocks/users';

interface UserContextValue {
  user: CurrentUser;
  setUser: (u: CurrentUser) => void;
  setRole: (role: Role) => void;
  // Brief V2 §4a — Delegation context. null = acting as self; a user-id
  // means the current user is acting on behalf of that covered admin.
  // Restrictions (folder create, trusted-route edit, etc.) gate on this,
  // not on the user's real role.
  actingAs: string | null;
  setActingAs: (userId: string | null) => void;
  // Brief V2 §4 — SA succession via Backup Delegate promotion.
  // `needsBackupDelegate` gates the rest of the Configurations surface
  // until the newly promoted SA designates their first BD (replacing the
  // old "minimum 2 System Admins" rule). `justPromoted` is a one-shot
  // flag the BD page reads to surface the post-promotion modal once.
  needsBackupDelegate: boolean;
  setNeedsBackupDelegate: (v: boolean) => void;
  justPromoted: boolean;
  setJustPromoted: (v: boolean) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<CurrentUser>(MOCK_USER);
  const [actingAs, setActingAsState] = useState<string | null>(null);
  const [needsBackupDelegate, setNeedsBackupDelegateState] = useState(false);
  const [justPromoted, setJustPromotedState]               = useState(false);

  // Brief V2 §4 — invariant: System Admin always carries the Mailroom
  // Worker tag, and that tag cannot be unset while the user is SA.
  // DV-Mailroom is the dedicated Mailroom Worker role so it also forces
  // the flag on. FA / DV-Folder preserve whatever the underlying user
  // already had (a Folder Admin who is also a Mailroom Worker keeps both
  // capabilities across role-chip switches).
  const normalizeMwFlag = (next: CurrentUser): CurrentUser => {
    if (next.role === 'System_Admin' || next.role === 'Delegate_View_Mailroom') {
      return { ...next, is_mailroom_worker: true };
    }
    return next;
  };

  const setUser = useCallback((u: CurrentUser) => {
    setUserState(normalizeMwFlag(u));
  }, []);

  const setRole = useCallback((role: Role) => {
    setUserState(prev => normalizeMwFlag({ ...prev, role }));
  }, []);

  const setActingAs = useCallback((userId: string | null) => {
    setActingAsState(userId);
  }, []);

  const setNeedsBackupDelegate = useCallback((v: boolean) => {
    setNeedsBackupDelegateState(v);
  }, []);
  const setJustPromoted = useCallback((v: boolean) => {
    setJustPromotedState(v);
  }, []);

  return (
    <UserContext.Provider value={{
      user, setUser, setRole,
      actingAs, setActingAs,
      needsBackupDelegate, setNeedsBackupDelegate,
      justPromoted, setJustPromoted,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}

// Convenience: true when the current user is acting on behalf of someone
// else. Use to gate structural actions per §4a restrictions list.
export function useIsInDelegateContext(): boolean {
  const { actingAs } = useUser();
  return actingAs !== null;
}

// Audit attribution helper. Returns the actor label used in routing
// history + Audit Log entries. Format: "[acting user]" when in self
// context, "[acting user] on behalf of [covered user]" when delegated.
export function useActorAttribution(): { actorName: string; onBehalfOfName: string | null; label: string } {
  const { user, actingAs } = useUser();
  const covered = actingAs ? findUser(actingAs) : null;
  return {
    actorName:      user.name,
    onBehalfOfName: covered?.name ?? null,
    label:          covered ? `${user.name} on behalf of ${covered.name}` : user.name,
  };
}
