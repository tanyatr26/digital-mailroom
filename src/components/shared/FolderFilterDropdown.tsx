'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// Folder filter — single multi-select dropdown that replaces the old chip
// row used across the workroom views. Empty selection means "show all".
// Pure UI: parent owns the selected set and the count source.

export interface FolderFilterOption {
  id: string;
  name: string;
  count: number;
}

interface Props {
  options: FolderFilterOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  label?: string;
}

export default function FolderFilterDropdown({ options, selected, onChange, label = 'Folders' }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  const listboxId  = useId();

  // Escape closes; outside-click dismisses.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };
  const allSelected = options.length > 0 && options.every(o => selected.has(o.id));
  const handleAllToggle = () => {
    onChange(allSelected ? new Set() : new Set(options.map(o => o.id)));
  };

  // Space toggles a focused option. Enter is left to default behavior so
  // it activates the underlying label/checkbox the way native checkboxes do.
  const onOptionKey = (e: React.KeyboardEvent, id: string) => {
    if (e.key === ' ') { e.preventDefault(); toggle(id); }
  };

  const count = selected.size;
  const triggerLabel = count > 0 ? `${label} (${count})` : label;
  const active = count > 0;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded-full border transition-colors ${
          active
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900'
        }`}>
        <span>{triggerLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''} ${active ? 'opacity-80' : 'text-gray-500'}`} />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={listboxId}
          role="listbox"
          aria-multiselectable
          className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[240px]">
          <button
            type="button"
            onClick={handleAllToggle}
            className="w-full px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors text-left border-b border-gray-100 flex items-center justify-between">
            <span>{allSelected ? 'Clear all' : 'Select all'}</span>
            {count > 0 && <span className="text-gray-400 font-normal">{count} selected</span>}
          </button>
          <ul className="max-h-72 overflow-y-auto py-1">
            {options.length === 0 ? (
              <li className="px-3 py-3 text-xs text-gray-400 italic">No folders.</li>
            ) : options.map(opt => {
              const checked = selected.has(opt.id);
              return (
                <li key={opt.id}>
                  <label
                    tabIndex={0}
                    role="option"
                    aria-selected={checked}
                    onKeyDown={e => onOptionKey(e, opt.id)}
                    className="flex items-center gap-2.5 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 cursor-pointer focus:bg-blue-50 focus:outline-none">
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${checked ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-400'}`}>
                      {checked && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.id)}
                      className="sr-only" />
                    <span className="flex-1 truncate">{opt.name}</span>
                    <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">({opt.count})</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
