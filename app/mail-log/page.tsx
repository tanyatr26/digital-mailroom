'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/src/context/UserContext';
import { useNotifications } from '@/src/context/NotificationsContext';
import { DEFAULT_ROUTES, canAccessMailroom } from '@/src/mocks/currentUser';
import { MAIL_RUNS } from '@/src/mocks/mailRuns';
import MailLogScreen from '@/src/components/mail-log/MailLogScreen';
import MailDispatch from '@/src/components/MailDispatch';
import type { Envelope, MailRun, MailRunStatus } from '@/src/types';

// Mail Log → row click pattern matches the Inbox page: state lifts here so
// the same component (MailDispatch) renders inline for the selected run.
// Released runs open the in-screen send-history modal inside MailLogScreen.
// V2 §11 — Save Progress lives at this layer so snapshots survive
// navigation back to the Mail Log table.
const SAVED_SESSIONS_KEY = 'mail-log-saved-sessions';
interface SavedSession { envelopes: Envelope[]; savedAtIso: string }

function loadSavedSessions(): Record<string, SavedSession> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(SAVED_SESSIONS_KEY);
    return raw ? JSON.parse(raw) as Record<string, SavedSession> : {};
  } catch { return {}; }
}
function persistSavedSessions(map: Record<string, SavedSession>) {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(SAVED_SESSIONS_KEY, JSON.stringify(map)); } catch {}
}

export default function MailLogPage() {
  const { user } = useUser();
  const { emit: emitNotification } = useNotifications();
  const router = useRouter();
  const [openRun, setOpenRun] = useState<MailRun | null>(null);
  const [savedSessions, setSavedSessions] = useState<Record<string, SavedSession>>({});

  useEffect(() => {
    setSavedSessions(loadSavedSessions());
  }, []);

  // Brief V2 §4 — gate by the Mailroom Worker tag (always true for SA,
  // explicit on DV-Mailroom + Mailroom-tagged users) rather than the
  // legacy role-only check, so the BD-promoted-to-SA flow inherits the
  // capability via the tag.
  const canEnter = canAccessMailroom(user);

  useEffect(() => {
    if (!canEnter) router.replace(DEFAULT_ROUTES[user.role]);
  }, [canEnter, user.role, router]);

  // Capability lost while workspace is open → close it
  useEffect(() => {
    if (!canEnter) setOpenRun(null);
  }, [canEnter]);

  if (!canEnter) return null;

  const handleSaveProgress = (runId: string, envelopes: Envelope[]) => {
    const next = { ...savedSessions, [runId]: { envelopes, savedAtIso: new Date().toISOString() } };
    setSavedSessions(next);
    persistSavedSessions(next);
    // §22 B9 — Seed the saved-batch reminder as already-aged so it lands
    // in the Yesterday bucket immediately (no real timer needed for demo).
    const runName = MAIL_RUNS.find(r => r.id === runId)?.name ?? 'Mail run';
    const yesterday = new Date(Date.now() - 24 * 3_600_000).toISOString();
    emitNotification({
      code:        'B9',
      severity:    'info',
      title:       'Saved mail run waiting on you',
      body:        `"${runName}" has been in saved-progress for over 24 hours. Resume to finish dispatch.`,
      href:        '/mail-log',
      source_kind: 'folder',
      source_id:   runId,
      created_at:  yesterday,
    });
  };

  if (openRun) {
    return (
      <MailDispatch
        run={openRun}
        onBackToMailLog={() => setOpenRun(null)}
        onSaveProgress={env => handleSaveProgress(openRun.id, env)}
      />
    );
  }

  // Runs with a saved snapshot flip to In_Progress regardless of mock status.
  const statusOverrides: Record<string, MailRunStatus> = {};
  Object.keys(savedSessions).forEach(id => { statusOverrides[id] = 'In_Progress'; });

  return <MailLogScreen onOpenRun={setOpenRun} statusOverrides={statusOverrides} />;
}
