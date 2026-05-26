'use client';
import { useState } from 'react';
import { UserCog } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  autoFocus?: boolean;
}

export default function RecipientCombobox({ value, onChange, suggestions, placeholder, autoFocus }: Props) {
  const [open, setOpen] = useState(false);
  const q = (value || '').toLowerCase().trim();
  const seen = new Set<string>();
  const filtered = suggestions.filter(s => {
    if (!s || seen.has(s)) return false;
    seen.add(s);
    return !q || s.toLowerCase().includes(q);
  }).slice(0, 6);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400 transition-colors"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 max-h-44 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {filtered.map(s => (
            <button
              key={s}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(s); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-sm text-gray-900 hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              <UserCog className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="truncate">{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
