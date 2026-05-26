import type { DocumentType, ExampleDocument } from '@/src/types';

// V2 Brief §17 — Document Type Registry. The DocumentType data model is now
// minimal: identification, retention, regulated/auto-urgent flags, and the
// uploaded example PDFs the AI uses to learn this type visually.

const ex = (n: number, prefix: string, dates: string[]): ExampleDocument[] =>
  Array.from({ length: n }, (_, i) => ({
    id: prefix + '-' + (i + 1),
    filename: prefix + '_' + (i + 1) + '.pdf',
    uploadedAt: dates[i] ?? dates[dates.length - 1],
    sizeKb: 240 + i * 35,
  }));

export const DOCUMENT_TYPES: DocumentType[] = [
  {
    type_id: 'dt-sales-contract',
    display_name: 'Sales Contract',
    retention_days: 2555, // 7 years
    regulated: false,
    auto_urgent: false,
    example_documents: ex(3, 'contract', ['Oct 8, 2025', 'Oct 12, 2025', 'Oct 22, 2025']),
  },
  {
    type_id: 'dt-invoice',
    display_name: 'Invoice',
    retention_days: 2555,
    regulated: false,
    auto_urgent: false,
    example_documents: ex(4, 'invoice', ['Sep 14, 2025', 'Sep 28, 2025', 'Oct 5, 2025', 'Nov 1, 2025']),
  },
  {
    type_id: 'dt-receipt',
    display_name: 'Receipt',
    retention_days: 1095, // 3 years
    regulated: false,
    auto_urgent: false,
    example_documents: ex(3, 'receipt', ['Sep 30, 2025', 'Oct 14, 2025', 'Oct 30, 2025']),
  },
  {
    type_id: 'dt-tax-notice',
    display_name: 'Tax Notice',
    retention_days: 2555,
    regulated: true,
    auto_urgent: true,
    example_documents: ex(5, 'tax_notice', ['Aug 20, 2025', 'Sep 5, 2025', 'Sep 18, 2025', 'Oct 2, 2025', 'Oct 20, 2025']),
  },
  {
    type_id: 'dt-enrollment-form',
    display_name: 'Enrollment Form',
    retention_days: 2555,
    regulated: true,
    auto_urgent: false,
    example_documents: ex(3, 'enrollment', ['Oct 1, 2025', 'Oct 15, 2025', 'Nov 2, 2025']),
  },
  {
    type_id: 'dt-permit',
    display_name: 'Permit',
    retention_days: 1825,
    regulated: false,
    auto_urgent: false,
    example_documents: ex(2, 'permit', ['Sep 22, 2025', 'Oct 12, 2025']),
  },
  {
    type_id: 'dt-claim',
    display_name: 'Claim',
    retention_days: 3650, // 10 years
    regulated: true,
    auto_urgent: false,
    example_documents: ex(4, 'claim', ['Aug 12, 2025', 'Sep 2, 2025', 'Sep 24, 2025', 'Oct 18, 2025']),
  },
  {
    type_id: 'dt-proposal',
    display_name: 'Proposal',
    retention_days: 1095,
    regulated: false,
    auto_urgent: false,
    example_documents: ex(3, 'proposal', ['Oct 5, 2025', 'Oct 20, 2025', 'Nov 5, 2025']),
  },
  {
    type_id: 'dt-amendment',
    display_name: 'Amendment',
    retention_days: 2555,
    regulated: false,
    auto_urgent: false,
    example_documents: ex(2, 'amendment', ['Sep 16, 2025', 'Oct 24, 2025']),
  },
  {
    type_id: 'dt-purchase-order',
    display_name: 'Purchase Order',
    retention_days: 1825,
    regulated: false,
    auto_urgent: false,
    example_documents: ex(3, 'po', ['Oct 10, 2025', 'Oct 24, 2025', 'Nov 6, 2025']),
  },
  {
    type_id: 'dt-renewal',
    display_name: 'Renewal',
    retention_days: 1825,
    regulated: false,
    auto_urgent: false,
    example_documents: ex(2, 'renewal', ['Sep 28, 2025', 'Oct 30, 2025']),
  },
  {
    type_id: 'dt-cover-letter',
    display_name: 'Cover Letter',
    retention_days: 365,
    regulated: false,
    auto_urgent: false,
    example_documents: ex(1, 'cover_letter', ['Oct 22, 2025']),
  },
];

export function findDocumentType(type_id?: string): DocumentType | undefined {
  if (!type_id) return undefined;
  return DOCUMENT_TYPES.find(t => t.type_id === type_id);
}
