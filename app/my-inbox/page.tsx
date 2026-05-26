'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/src/context/UserContext';
import { DEFAULT_ROUTES } from '@/src/mocks/currentUser';

// V2 dropped the Recipient role. A leaf-folder admin is now just a Folder Admin
// whose folder happens to have no children. This route redirects to wherever
// the user's current role lands them — for Folder Admin that's /inbox.
export default function MyInboxPage() {
  const { user } = useUser();
  const router = useRouter();
  useEffect(() => {
    router.replace(DEFAULT_ROUTES[user.role]);
  }, [user.role, router]);
  return null;
}
