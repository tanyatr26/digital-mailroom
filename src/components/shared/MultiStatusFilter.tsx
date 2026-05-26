'use client';
import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// V2 §10 — Multi-select status filter dropdown. Used by both the Mail Log
// (SA/Worker) and the Folder Admin Inbox. Empty selection = "All". Each
// option toggles independently; the dropdown stays open after a click.
// "Has returns" is a virtual option that combines with statuses as AND.
interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Array<Option<T>>;
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
}

export default function MultiStatusFilter<T extends string>({ options, selected, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);

  const toggleOption = (v: T) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  };
  const handleAll = () => onChange(new Set());

  const allSelected = selected.size === 0;
  const buttonLabel = allSelected ? 'Status' : `Status · ${selected.size}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`h-9 inline-flex items-center gap-1.5 pl-3 pr-2 text-sm rounded-lg border bg-white transition-colors ${selected.size > 0 ? 'border-blue-400 text-blue-700' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}
      >
        <span className="font-medium">{buttonLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden" style={{ minWidth: 180 }}>
            <button
              type="button"
              onClick={handleAll}
              className="w-full px-3 py-2 flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${allSelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}>
                {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
              All
            </button>
            <div className="h-px bg-gray-100" />
            {options.map(opt => {
              const isChecked = selected.has(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleOption(opt.value)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isChecked ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}>
                    {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
