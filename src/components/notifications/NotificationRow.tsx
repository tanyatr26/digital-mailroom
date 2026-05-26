'use client';
import { AlertTriangle, AlertCircle, Info, ChevronRight, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useNotifications, actionLabelFor, formatNotificationTime } from '@/src/context/NotificationsContext';
import type { Notification, NotificationSeverity } from '@/src/types/notifications';

const ICON_BY_SEVERITY: Record<NotificationSeverity, React.ComponentType<{ className?: string }>> = {
  action:  AlertCircle,
  warning: AlertTriangle,
  info:    Info,
};

const ACCENT_BY_SEVERITY: Record<NotificationSeverity, { left: string; icon: string; chip: string; label: string }> = {
  action:  { left: 'border-l-4 border-l-red-500',   icon: 'text-red-500',    chip: 'bg-red-50 text-red-700 border-red-200',       label: 'Action required' },
  warning: { left: 'border-l-4 border-l-amber-500', icon: 'text-amber-500',  chip: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Warning' },
  info:    { left: 'border-l-4 border-l-gray-200',  icon: 'text-blue-500',   chip: 'bg-blue-50 text-blue-700 border-blue-200',    label: 'Info' },
};

interface Props {
  n: Notification;
  onNavigate?: () => void;
  compact?: boolean;
  // Render as a static preview (e.g. inside the Send reminder modal):
  // click does not navigate or mutate state, dismiss X is hidden.
  previewMode?: boolean;
}

export default function NotificationRow({ n, onNavigate, compact, previewMode }: Props) {
  const router = useRouter();
  const { markRead, dismiss } = useNotifications();
  const Icon = ICON_BY_SEVERITY[n.severity];
  const accent = ACCENT_BY_SEVERITY[n.severity];
  const isUnread = n.read_at === null;
  const actionLabel = n.actionLabel ?? actionLabelFor(n.code);

  const handleNavigate = (e: React.MouseEvent) => {
    e.preventDefault();
    if (previewMode) return;
    markRead(n.id);
    if (onNavigate) onNavigate();
    router.push(n.href);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismiss(n.id);
  };

  return (
    <div
      className={`relative group ${accent.left} ${isUnread ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-50 transition-colors`}>
      <button
        onClick={handleNavigate}
        className="w-full text-left px-4 py-3 flex items-start gap-3">
        <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${accent.icon}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
            <p className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
              {n.title}
            </p>
          </div>
          {!compact && (
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] text-gray-400">{formatNotificationTime(n.created_at)}</span>
            <span className="text-gray-300">·</span>
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700">
              {actionLabel} <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </button>
      {!previewMode && (
        <button
          onClick={handleDismiss}
          title="Dismiss"
          aria-label="Dismiss notification"
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
