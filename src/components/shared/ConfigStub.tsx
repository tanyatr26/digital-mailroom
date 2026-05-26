import Link from 'next/link';
import { ChevronLeft, Construction } from 'lucide-react';

interface Props {
  title: string;
  subtitle: string;
  step: 'step 2' | 'step 3';
  note?: string;
}

export default function ConfigStub({ title, subtitle, step, note }: Props) {
  return (
    <div className="p-8 max-w-3xl">
      <Link href="/configurations" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors mb-4">
        <ChevronLeft className="w-3.5 h-3.5" /> All configurations
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>

      <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white px-8 py-12 text-center">
        <Construction className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700">Coming in {step}</p>
        {note && <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto leading-relaxed">{note}</p>}
      </div>
    </div>
  );
}
