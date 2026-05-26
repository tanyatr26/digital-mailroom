// Per-folder AI maturation phase data for Configurations §4.6 (AI Configuration).

export type AIPhase = 'Phase 1' | 'Phase 2' | 'Phase 3';

export interface FolderAIPhase {
  folder_id: string;
  folderPath: string;           // Display path like "CA / Jobsite A"
  phase: AIPhase;
  decisions: number;            // Total routing decisions in this folder
  accuracy: number | null;      // null when not enough data (Phase 1)
  autoRoutesPerWeek: number;    // 0 unless Phase 3 with promoted rules
  coldStart?: boolean;
}

export const FOLDER_AI_PHASES: FolderAIPhase[] = [
  { folder_id: 'jobsites',     folderPath: 'Operations',              phase: 'Phase 3', decisions: 4210, accuracy: 0.992,  autoRoutesPerWeek: 142 },
  { folder_id: 'jobsite-a',    folderPath: 'CA / Jobsite A',          phase: 'Phase 3', decisions: 892,  accuracy: 0.997,  autoRoutesPerWeek: 34 },
  { folder_id: 'sales',        folderPath: 'Sales',                   phase: 'Phase 3', decisions: 1180, accuracy: 0.988,  autoRoutesPerWeek: 28 },
  { folder_id: 'billing',      folderPath: 'Billing',                 phase: 'Phase 3', decisions: 642,  accuracy: 0.972,  autoRoutesPerWeek: 19 },
  { folder_id: 'enrollments',  folderPath: 'Enrollments',             phase: 'Phase 2', decisions: 312,  accuracy: 0.921,  autoRoutesPerWeek: 0 },
  { folder_id: 'claims',       phase: 'Phase 2', folderPath: 'Claims', decisions: 198, accuracy: 0.901,  autoRoutesPerWeek: 0 },
  { folder_id: 'payroll',      folderPath: 'Payroll',                 phase: 'Phase 2', decisions: 124,  accuracy: 0.881,  autoRoutesPerWeek: 0 },
  { folder_id: 'ops-dept',     folderPath: 'CA / Jobsite A / Operations', phase: 'Phase 1', decisions: 18,  accuracy: null, autoRoutesPerWeek: 0 },
  { folder_id: 'safety-dept',  folderPath: 'CA / Jobsite A / Safety',     phase: 'Phase 1', decisions: 12,  accuracy: null, autoRoutesPerWeek: 0 },
  { folder_id: 'banking',      folderPath: 'Banking',                 phase: 'Phase 1', decisions: 6,   accuracy: null,   autoRoutesPerWeek: 0 },
  { folder_id: 'garnishments', folderPath: 'Garnishments',            phase: 'Phase 1', decisions: 3,   accuracy: null,   autoRoutesPerWeek: 0, coldStart: true },
  { folder_id: 'shipping',     folderPath: 'Shipping',                phase: 'Phase 1', decisions: 0,   accuracy: null,   autoRoutesPerWeek: 0, coldStart: true },
];
