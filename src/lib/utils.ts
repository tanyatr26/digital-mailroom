import type { Document, Envelope, TrustedRoute } from '@/src/types';
import { FOLDERS, getRootFolders } from '@/src/mocks/data';

const PAGE_CONTENT_POOL = [
  ['invoice', 'amount', 'remit', 'due', 'payment', 'net 30', 'wire transfer', 'po number'],
  ['signature', 'authorized', 'date', 'agreement', 'witness', 'notary', 'seal'],
  ['address', 'phone', 'email', 'contact', 'license', 'permit', 'license number'],
  ['tax', 'subtotal', 'total', 'balance', 'sales tax', 'federal tax', 'withholding'],
  ['materials', 'labor', 'services', 'description', 'quantity', 'rate', 'hours'],
  ['contract', 'terms', 'conditions', 'clause', 'liability', 'warranty', 'indemnify'],
  ['receipt', 'transaction', 'reference', 'confirmation', 'order', 'tracking'],
  ['enrollment', 'employee', 'benefits', 'plan', 'coverage', 'premium', 'deductible'],
  ['claim', 'injury', 'workers comp', 'medical', 'treatment', 'date of loss', 'adjuster'],
  ['property', 'parcel', 'lot', 'deed', 'title', 'closing', 'escrow'],
];

export function getPageLines(n: number): number[] {
  const base = [85, 100, 70, 100, 90, 60, 100, 95, 80, 100, 65, 88, 72, 50, 78];
  return base.map((w, i) => ((w + n * 11 + i * 9) % 35) + 60);
}

export function getPageContent(doc: Document, pageNum: number): string[] {
  const tw = (doc.title || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
  const s = ((doc.id ? doc.id.charCodeAt(doc.id.length - 1) : 0) + pageNum * 7) % PAGE_CONTENT_POOL.length;
  return [...tw, ...PAGE_CONTENT_POOL[s], ...PAGE_CONTENT_POOL[(s + 3) % PAGE_CONTENT_POOL.length]];
}

export function pageMatchesQuery(doc: Document, pageNum: number, query: string): boolean {
  if (!query) return false;
  const q = query.toLowerCase().trim();
  return getPageContent(doc, pageNum).some(w => w.includes(q));
}

export const formatLabelDate = (d: Date = new Date()): string =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function generateBarcode(id: string | undefined): number[] {
  const bars: number[] = [];
  const s = String(id || '000000');
  for (let i = 0; i < 34; i++) {
    const c = s.charCodeAt(i % s.length);
    bars.push(((c + i * 13) % 4) + 1);
  }
  return bars;
}

export function deriveDocType(title = '', suggestion = ''): string {
  const t = title.toLowerCase();
  if (t.includes('receipt')) return 'Receipt';
  if (t.includes('invoice')) return 'Invoice';
  if (t.includes('sales contract') || t.includes('contract')) return 'Contract';
  if (t.includes('tax notice')) return 'Tax Notice';
  if (t.includes('withholding') || t.includes('tax form')) return 'Tax Form';
  if (t.includes('permit')) return 'Permit';
  if (t.includes('enrollment') || t.includes('enroll')) return 'Enrollment Form';
  if (t.includes('claim')) return 'Claim';
  if (t.includes('agreement') || t.includes('license agreement')) return 'License Agreement';
  if (t.includes('cover letter')) return 'Cover Letter';
  const folder = FOLDERS.find(f => f.id === suggestion);
  if (folder) return folder.name + ' Document';
  return 'Document';
}

export function patternMatches(doc: Document, envelope: Envelope, route: TrustedRoute): boolean {
  if (!route.isActive) return false;
  const sOk = envelope.sender.toLowerCase().includes(route.pattern.sender.toLowerCase());
  const tOk = deriveDocType(doc.title, doc.suggestion).toLowerCase().includes(route.pattern.document_type.toLowerCase());
  return sOk && tOk;
}

export function applyTrustedRoutes(envelopes: Envelope[], routes: TrustedRoute[]): Envelope[] {
  return envelopes.map(env => ({
    ...env,
    documents: env.documents.map(doc => {
      if (doc.dispatchedTo) return doc;
      const m = routes.find(r => patternMatches(doc, env, r));
      if (!m) return doc;
      return { ...doc, dispatchedTo: m.destination, autoRouted: true, trustedRouteId: m.id };
    }),
  }));
}

export function computeInitialCounts(envelopes: Envelope[]): Record<string, number> {
  // Only root folders are dispatch targets at the Worker level.
  const c: Record<string, number> = Object.fromEntries(
    [...getRootFolders().map(f => [f.id, 0] as [string, number]), ['junk', 0] as [string, number]]
  );
  envelopes.forEach(env =>
    env.documents.forEach(d => {
      if (d.dispatchedTo && d.autoRouted) c[d.dispatchedTo] = (c[d.dispatchedTo] || 0) + d.pages;
    })
  );
  return c;
}
