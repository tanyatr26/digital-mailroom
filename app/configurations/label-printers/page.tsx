'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Check, Printer } from 'lucide-react';
import { useRoleGate } from '@/src/hooks/useRoleGate';

const PRINTER_MODELS = ['Zebra ZD621', 'Brother QL-1110NWB', 'Other (generic 4×2" or 2×1" support)'];

export default function LabelPrintersPage() {
  const allowed = useRoleGate(['System_Admin']);
  const [connected, setConnected] = useState(true);
  const [model, setModel] = useState('');
  const [connectionType, setConnectionType] = useState<'ip' | 'network'>('ip');
  const [address, setAddress] = useState('');
  const [labelSize, setLabelSize] = useState<'4x2' | '2x1'>('4x2');
  const [toast, setToast] = useState('');

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const handleTestPrint = () => flash('Test page sent to Zebra ZD621.');
  const handleDisconnect = () => { setConnected(false); flash('Printer disconnected.'); };
  const handleTestConnection = () => {
    if (!model || !address.trim()) { flash('Pick a model and enter an address first.'); return; }
    flash('Connection test succeeded.');
  };

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/configurations" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors mb-4">
        <ChevronLeft className="w-3.5 h-3.5" /> All configurations
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Label Printer Setup</h1>
      <p className="mt-1 text-sm text-gray-500">Configure physical label printing. Scanner hardware is not integrated — Delegate Views scan outside the app.</p>

      {/* Connected printer */}
      <div className="mt-6 bg-white border border-gray-200 rounded-2xl px-6 py-5">
        <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400 mb-4">Connected printer</p>
        {connected ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900">Zebra ZD621</p>
              </div>
              <p className="text-xs text-gray-500 mt-1">IP: 192.168.1.42 · Last test print: Nov 10 · 2:30pm</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={handleTestPrint} className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Test print</button>
              <button onClick={handleDisconnect} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">Disconnect</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No printer connected. Add one below.</p>
        )}
      </div>

      {/* Add new printer */}
      <div className="mt-4 bg-white border border-gray-200 rounded-2xl px-6 py-5 space-y-5">
        <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400">Add a new printer</p>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">Printer model</label>
          <select value={model} onChange={e => setModel(e.target.value)}
            className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-blue-400">
            <option value="">Select model…</option>
            {PRINTER_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">Connection</label>
          <div className="flex items-center gap-4 mb-2">
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="radio" checked={connectionType === 'ip'} onChange={() => setConnectionType('ip')} /> IP address
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="radio" checked={connectionType === 'network'} onChange={() => setConnectionType('network')} /> Network path
            </label>
          </div>
          <input value={address} onChange={e => setAddress(e.target.value)}
            placeholder={connectionType === 'ip' ? 'e.g. 192.168.1.42' : 'e.g. \\\\printers\\labels-01'}
            className="w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">Label size</label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="radio" checked={labelSize === '4x2'} onChange={() => setLabelSize('4x2')} /> 4 × 2 inches
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="radio" checked={labelSize === '2x1'} onChange={() => setLabelSize('2x1')} /> 2 × 1 inches
            </label>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          {toast && <p className="text-xs font-medium text-blue-600">{toast}</p>}
          <button onClick={handleTestConnection}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Printer className="w-3.5 h-3.5" /> Test connection
          </button>
        </div>
      </div>
    </div>
  );
}
