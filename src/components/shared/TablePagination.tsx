'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Reusable pagination footer used across configuration + list tables.
// Shows a "X–Y of N <label>" count on the left and Prev / page / Next on
// the right. Renders nothing when total fits in a single page so it stays
// out of the way on small lists.

interface Props {
  page: number;            // 0-based current page index
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  label?: string;          // e.g. "documents", "users". Defaults to "rows".
}

export default function TablePagination({ page, pageSize, totalItems, onPageChange, label = 'rows' }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  // Hide only when there's nothing at all; on a single page the footer still
  // shows so the page count + total is visible (Prev/Next render disabled).
  if (totalItems === 0) return null;

  const safePage  = Math.min(page, totalPages - 1);
  const startItem = safePage * pageSize + 1;
  const endItem   = Math.min(totalItems, startItem + pageSize - 1);

  return (
    <div className="px-4 py-2.5 border-t border-gray-100 bg-white flex items-center justify-between text-xs text-gray-500">
      <span>
        <span className="tabular-nums">{startItem}–{endItem}</span> of <span className="tabular-nums">{totalItems}</span> {label}
      </span>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(Math.max(0, safePage - 1))} disabled={safePage === 0}
          className={`p-1 rounded transition-colors ${safePage === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
          aria-label="Previous page">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="tabular-nums">Page {safePage + 1} / {totalPages}</span>
        <button onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1}
          className={`p-1 rounded transition-colors ${safePage >= totalPages - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
          aria-label="Next page">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
