'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/src/context/UserContext';
import { DEFAULT_ROUTES } from '@/src/mocks/currentUser';
import MailDispatch from '@/src/components/MailDispatch';

export default function Home() {
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user.role !== 'System_Admin' && user.role !== 'Delegate_View_Mailroom') {
      router.replace(DEFAULT_ROUTES[user.role]);
    }
  }, [user.role, router]);

  if (user.role !== 'System_Admin' && user.role !== 'Delegate_View_Mailroom') {
    return null;
  }

  return <MailDispatch />;
}
