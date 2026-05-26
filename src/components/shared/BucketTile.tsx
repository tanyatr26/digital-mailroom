'use client';
import MacFolder from '@/src/components/icons/MacFolder';
import MacTrash from '@/src/components/icons/MacTrash';

interface Props {
  id?: string;
  name: string;
  subBadge?: React.ReactNode;     // Extra chip rendered below the name (e.g. "admin inactive")
  count: number;
  isFolder: boolean;
  hovered: boolean;
  pulsing: boolean;
  bulkCount?: number;
  customIcon?: React.ReactNode;
  disabled?: boolean;             // V2 §3.1 — inactive_admin folders render muted and refuse drops
  disabledTooltip?: string;
  onClick?: () => void;           // Click (non-drag) drills into the folder's workspace
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
}

export default function BucketTile({
  id, name, subBadge, count, isFolder, hovered, pulsing, bulkCount = 0, customIcon,
  disabled, disabledTooltip,
  onClick, onDragOver, onDragLeave, onDrop, onContextMenu,
}: Props) {
  return (
    <div
      title={disabled ? disabledTooltip : undefined}
      data-drop-bucket={id}
      onClick={disabled ? undefined : onClick}
      onDragOver={disabled ? e => e.preventDefault() : onDragOver}
      onDragLeave={onDragLeave}
      onDrop={disabled ? e => e.preventDefault() : onDrop}
      onContextMenu={id ? e => { e.preventDefault(); onContextMenu?.(e, id); } : undefined}
      className={
        'relative rounded-xl p-2 pb-2.5 transition-all duration-200 select-none ' +
        (disabled ? 'opacity-50 grayscale cursor-not-allowed hover:bg-gray-100 ' : '') +
        (!disabled && onClick ? 'cursor-pointer ' : '') +
        (!disabled && hovered ? 'bg-blue-100 scale-105 ring-2 ring-blue-400' : '') +
        (!disabled && !hovered ? 'bg-transparent hover:bg-gray-100' : '') +
        ' ' + (!disabled && pulsing ? 'animate-bounce' : '')
      }
    >
      <div className="relative w-full flex flex-col items-center">
        <div className={`relative transition-transform w-full ${hovered ? 'scale-110' : ''}`} style={{ maxWidth: 88 }}>
          {customIcon ?? (isFolder ? <MacFolder /> : <MacTrash />)}
          {count > 0 && (
            <div className="absolute flex items-center justify-center bg-red-500 rounded-full ring-2 ring-white shadow-md" style={{ top: -4, right: -4, minWidth: 22, height: 22, padding: '0 6px' }}>
              <span className="font-bold text-white leading-none" style={{ fontSize: 11 }}>{count}</span>
            </div>
          )}
          {hovered && bulkCount > 1 && (
            <div className="absolute left-1/2" style={{ top: -10, transform: 'translateX(-50%)' }}>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white rounded-full font-bold whitespace-nowrap shadow-md text-xs">+{bulkCount} docs</div>
            </div>
          )}
        </div>
        <span className="mt-2 font-medium text-gray-700 text-center leading-tight" style={{ fontSize: 11 }}>{name}</span>
        {subBadge && <div className="mt-1 flex justify-center">{subBadge}</div>}
      </div>
    </div>
  );
}
