export const COLORS: Record<string, { bg: string; text: string; border: string }> = {
  sales:        { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  enrollments:  { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200' },
  payroll:      { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
  billing:      { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  jobsites:     { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  claims:       { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  garnishments: { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  benefits:     { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
  banking:      { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200' },
  shipping:     { bg: 'bg-lime-50',    text: 'text-lime-700',    border: 'border-lime-200' },
  junk:         { bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-300' },
};

export const DEPT_DOTS: Record<string, string> = {
  sales:        '#10b981',
  enrollments:  '#0ea5e9',
  payroll:      '#f43f5e',
  billing:      '#f97316',
  jobsites:     '#f59e0b',
  claims:       '#ef4444',
  garnishments: '#6366f1',
  benefits:     '#14b8a6',
  banking:      '#06b6d4',
  shipping:     '#84cc16',
  junk:         '#64748b',
};
