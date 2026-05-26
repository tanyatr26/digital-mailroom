'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, UserCog, Circle, CircleDot } from 'lucide-react';
import { SSO_USERS, type SsoUser } from '@/src/mocks/users';

// Live SSO directory search. No free-text recipients — the worker must pick
// a real SSO user. The component takes / emits the picked user's name so the
// rest of the label flow (which stores recipient as a string) stays unchanged.
interface Props {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  maxResults?: number;
}

const MAX_RESULTS_DEFAULT = 6;

function matches(user: SsoUser, q: string): boolean {
  const needle = q.toLowerCase();
  if (user.name.toLowerCase().includes(needle)) return true;
  if (user.email.toLowerCase().includes(needle)) return true;
  if (user.title && user.title.toLowerCase().includes(needle)) return true;
  // Also match against split name parts (first / last) explicitly so a
  // search like "chen" finds "Lisa Chen" via the last name token.
  return user.name.toLowerCase().split(/\s+/).some(part => part.startsWith(needle));
}

export default function SsoRecipientPicker({ value, onChange, placeholder, maxResults }: Props) {
  // Treat `value` as the canonical name string. If it matches an SSO user,
  // we show the chip. Otherwise the input is empty and ready for a search.
  const limit = maxResults ?? MAX_RESULTS_DEFAULT;
  const selected: SsoUser | null = useMemo(
    () => (value ? SSO_USERS.find(u => u.name === value) ?? null : null),
    [value],
  );

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return SSO_USERS.filter(u => matches(u, q)).slice(0, limit);
  }, [query, limit]);

  const showDropdown = open && query.trim().length > 0;

  const commit = (user: SsoUser) => {
    onChange(user.name);
    setQuery('');
    setOpen(false);
    setHighlight(0);
  };
  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(true);
    setHighlight(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || results.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(results.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = results[highlight] ?? results[0];
      if (pick) commit(pick);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  if (selected) {
    const chipLabel = selected.title ? `${selected.name}, ${selected.title}` : selected.name;
    return (
      <div ref={containerRef} className="relative">
        <div className="inline-flex items-center gap-1.5 max-w-full px-2 py-1 bg-blue-50 border border-blue-200 rounded-md">
          <UserCog className="w-3 h-3 text-blue-600 flex-shrink-0" />
          <span className="text-xs font-medium text-blue-900 truncate min-w-0">{chipLabel}</span>
          <button type="button" onClick={clear}
            title="Clear recipient"
            className="w-5 h-5 inline-flex items-center justify-center rounded-full text-blue-700 hover:bg-blue-100 transition-colors flex-shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder={placeholder ?? 'Search SSO users…'}
        className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-blue-400 transition-colors"
      />
      {showDropdown && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-400 italic">No matching users</p>
          ) : (
            <ul role="listbox" className="max-h-60 overflow-y-auto">
              {results.map((u, i) => {
                const isHighlighted = i === highlight;
                return (
                  <li key={u.id}>
                    <button type="button"
                      onMouseDown={e => e.preventDefault()}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => commit(u)}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${isHighlighted ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      {isHighlighted
                        ? <CircleDot className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        : <Circle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
                      <span className="text-sm font-medium text-gray-900 truncate flex-shrink-0">{u.name}</span>
                      <span className="text-[11px] text-gray-500 truncate ml-auto text-right">
                        {u.email}{u.title ? ' · ' + u.title : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
