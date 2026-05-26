// Org-wide trusted routes for Configurations §4.7 (Trusted Routes — All Folders).
// Mirrors the per-folder TrustedRoute shape with the additional folder_id field
// that identifies which folder owns the rule.

import type { TrustedRoute } from '@/src/types';

export interface FolderScopedTrustedRoute extends TrustedRoute {
  folder_id: string;        // Folder owning the rule
}

export const ORG_TRUSTED_ROUTES: FolderScopedTrustedRoute[] = [
  {
    id: 'tr-ca-001',
    folder_id: 'ca-state',
    pattern: { sender: 'ABC Construction', document_type: 'Invoice' },
    destination: 'jobsite-a',
    markedBy: 'Admin',
    markedAt: 'Oct 12, 2025',
    isActive: true,
    usageCount: 47,
  },
  {
    id: 'tr-ca-002',
    folder_id: 'ca-state',
    pattern: { sender: 'TechSupply Co.', document_type: 'Receipt' },
    destination: 'jobsite-a',
    markedBy: 'AI',
    markedAt: 'Nov 02, 2025',
    isActive: true,
    usageCount: 23,
  },
  {
    id: 'tr-nv-001',
    folder_id: 'jobsites',
    pattern: { sender: 'State Dept of Revenue', document_type: 'Tax Notice' },
    destination: 'payroll',
    markedBy: 'Admin',
    markedAt: 'Oct 15, 2025',
    isActive: false,
    usageCount: 12,
  },
  {
    id: 'tr-sales-001',
    folder_id: 'sales',
    pattern: { sender: 'Westfield Properties LLC', document_type: 'Sales Contract' },
    destination: 'r-001',
    markedBy: 'AI',
    markedAt: 'Nov 11, 2025',
    isActive: true,
    usageCount: 4,
  },
  {
    id: 'tr-sales-002',
    folder_id: 'sales',
    pattern: { sender: 'Apex Commercial Group', document_type: 'Proposal' },
    destination: 'r-001',
    markedBy: 'Admin',
    markedAt: 'Oct 28, 2025',
    isActive: true,
    usageCount: 9,
  },
  {
    id: 'tr-billing-001',
    folder_id: 'billing',
    pattern: { sender: 'TechSupply Co.', document_type: 'Receipt' },
    destination: 'jobsite-a',
    markedBy: 'Admin',
    markedAt: 'Nov 10, 2025',
    isActive: true,
    usageCount: 2,
  },
];
