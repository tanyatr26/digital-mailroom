'use client';
import { Printer } from 'lucide-react';

interface Props {
  pendingCount: number;
  onReview: () => void;
  onSkip: () => void;
  onClose: () => void;
}

export default function LabelReminderModal({ pendingCount, onReview, onSkip, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Printer className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Physical labels pending</h3>
              <p className="text-sm text-gray-500 mt-1">{pendingCount} document{pendingCount !== 1 ? 's have' : ' has'} an AI-suggested label not yet printed or dismissed.</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
          <button onClick={onSkip} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">Skip and finalize</button>
          <button onClick={onReview} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Printer className="w-3.5 h-3.5" /> Review labels
          </button>
        </div>
      </div>
    </div>
  );
}
