'use client';
import { Pencil, Archive, UserPlus } from 'lucide-react';

// V2 §3 — Right-click menu condenses to Edit + Archive. Add-child has been
// removed (admins navigate into the folder first to add nested recipients).
// Inactive-admin folders gain an "Assign delegate" entry between the two.
// All three items are structural changes — they are omitted entirely for
// Delegate View roles. Callers gate each callback by role.
interface Props {
  x: number;
  y: number;
  name: string;
  editEmphasized?: boolean;       // True for inactive-admin folders — flips Edit to the blue accent
  onEdit?: () => void;            // Omit for roles that can't restructure (Delegate View)
  onAssignDelegate?: () => void;  // Only set on inactive-admin folders, and only for owner roles
  onArchive?: () => void;         // Omit for roles that can't archive (Delegate View)
  onClose: () => void;
}

export default function FolderContextMenu({ x, y, name, editEmphasized, onEdit, onAssignDelegate, onArchive, onClose }: Props) {
  const itemCount = (onEdit ? 1 : 0) + (onAssignDelegate ? 1 : 0) + (onArchive ? 1 : 0);
  const W = 220, H = 60 + itemCount * 36 + (onArchive ? 8 : 0);
  const sx = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - W - 8) : x;
  const sy = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - H - 8) : y;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 overflow-hidden" style={{ top: sy, left: sx, minWidth: W }}>
        <div className="px-3 py-1.5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 truncate uppercase tracking-wide">{name}</p>
        </div>
        {onEdit && (
          <button onClick={onEdit}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left ${editEmphasized ? 'text-blue-700 font-semibold bg-blue-50 hover:bg-blue-100' : 'text-gray-700 hover:bg-gray-50'}`}>
            <Pencil className={`w-3.5 h-3.5 flex-shrink-0 ${editEmphasized ? 'text-blue-600' : 'text-gray-400'}`} /> Edit recipient
          </button>
        )}
        {onAssignDelegate && (
          <button onClick={onAssignDelegate} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
            <UserPlus className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> Assign delegate
          </button>
        )}
        {onArchive && (
          <>
            <div className="h-px bg-gray-100 mx-3 my-0.5" />
            <button onClick={onArchive} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left">
              <Archive className="w-3.5 h-3.5 flex-shrink-0" /> Archive recipient
            </button>
          </>
        )}
      </div>
    </>
  );
}
