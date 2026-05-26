'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/src/context/UserContext';
import { DEFAULT_ROUTES, type Role } from '@/src/mocks/currentUser';

// Route-level role gate. A page calls this with the explicit set of roles
// allowed to view it. If the current role is not in the set the user is
// redirected to their default landing surface. The boolean return lets the
// caller short-circuit render to `null` during the redirect tick so the
// disallowed content never paints.
export function useRoleGate(allowed: Role[]): boolean {
  const { user } = useUser();
  const router = useRouter();
  const ok = allowed.includes(user.role);
  useEffect(() => {
    if (!ok) router.replace(DEFAULT_ROUTES[user.role]);
  }, [ok, user.role, router]);
  return ok;
}
