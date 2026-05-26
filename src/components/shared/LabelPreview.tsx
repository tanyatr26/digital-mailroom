'use client';
import { generateBarcode } from '@/src/lib/utils';

interface Props {
  docId: string | undefined;
  date: string;
  folderName: string;
  recipient: string;
}

export default function LabelPreview({ docId, date, folderName, recipient }: Props) {
  const bars = generateBarcode(docId);
  return (
    <div className="bg-white border-2 border-gray-900 shadow-md font-mono select-none" style={{ width: 300, height: 150, padding: '10px 14px', borderRadius: 3 }}>
      <div className="flex items-start justify-between">
        <div className="font-black tracking-wider text-gray-900 leading-none" style={{ fontSize: 26 }}>#{docId}</div>
        <div className="text-xs text-gray-900 leading-none mt-1">{date}</div>
      </div>
      <div className="mt-2 text-sm font-bold text-gray-900 truncate">to {folderName}</div>
      {recipient
        ? <div className="text-xs text-gray-900 truncate mt-0.5">Attn: {recipient}</div>
        : <div className="text-xs text-gray-400 italic mt-0.5">No recipient specified</div>
      }
      <div className="mt-2 flex items-end gap-px" style={{ height: 24 }}>
        {bars.map((w, i) => <div key={i} className="bg-gray-900" style={{ width: w, height: '100%' }} />)}
      </div>
      <div className="text-center text-gray-900 tracking-wider mt-0.5" style={{ fontSize: 9 }}>* {docId} *</div>
    </div>
  );
}
