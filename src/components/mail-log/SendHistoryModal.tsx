'use client';
import type { MailRun } from '@/src/types';
import DispatchedBatchModal, { type BatchDocRecord } from '@/src/components/modals/DispatchedBatchModal';

interface Props {
  run: MailRun;
  onClose: () => void;
}

// V2 §6 — Thin wrapper around the shared dispatched-batch modal. Maps the
// MailRun.dispatchHistory shape into BatchDocRecord and opens it in the
// `send-history` variant so the Released-run detail layout kicks in
// (Label, Sent + Last activity columns, admin tooltips, no Physical Split
// in the document preview).
export default function SendHistoryModal({ run, onClose }: Props) {
  const records: BatchDocRecord[] = (run.dispatchHistory ?? []).map(r => ({
    docId: r.docId,
    title: r.title,
    destination: r.destination,
    destinationFolderId: r.destinationFolderId,
    timestamp: r.timestamp,
    pages: r.pages,
    currentLocation: r.currentLocation,
    labelStatus: r.labelStatus,
    lastActivity: r.lastActivity,
    finalRecipient: r.finalRecipient,
    returnedBy: r.returnedBy,
    returnReason: r.returnReason,
  }));
  const subtitle = `Released ${run.releasedAt ?? ''} · ${run.docCount} documents`;
  return <DispatchedBatchModal title={run.name} subtitle={subtitle} records={records} onClose={onClose} variant="send-history" />;
}
