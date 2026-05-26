'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info } from 'lucide-react';
import { useRoleGate } from '@/src/hooks/useRoleGate';

// Values come from V2 Configurations Reference §5.
const INITIAL = {
  autoRouteConfidence: 99,
  returnReasonMin: 10,
  inactiveAlertDays: 7,
  inactiveEscalationDays: 14,
  inactiveAutoMarkDays: 30,
  inactiveAutoMarkEnabled: false,
  telemetryRetentionYears: 7,
};

interface FieldRowProps {
  label: string;
  hint: string;
  value: number;
  suffix?: string;
  scopeNote?: string;
  onChange: (n: number) => void;
}

function FieldRow({ label, hint, value, suffix, scopeNote, onChange }: FieldRowProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-800 mb-1.5">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-24 px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400"
        />
        {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
        <div className="flex items-start gap-1.5 text-xs text-gray-500 flex-1">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-300" />
          <span>{hint}</span>
        </div>
      </div>
      {scopeNote && <p className="text-[11px] text-gray-400 mt-1.5">{scopeNote}</p>}
    </div>
  );
}

export default function TunableDefaultsPage() {
  const allowed = useRoleGate(['System_Admin']);
  const [values, setValues] = useState(INITIAL);
  const [savedMessage, setSavedMessage] = useState('');

  const update = (key: keyof typeof INITIAL) => (n: number) =>
    setValues(prev => ({ ...prev, [key]: n }));

  const handleSave = () => {
    setSavedMessage('Tunable Defaults saved.');
    setTimeout(() => setSavedMessage(''), 2500);
  };

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/configurations" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors mb-4">
        <ChevronLeft className="w-3.5 h-3.5" /> All configurations
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Tunable Defaults</h1>
      <p className="mt-1 text-sm text-gray-500">Org-wide parameters. Some can be overridden per folder by folder admins.</p>

      <div className="mt-6 bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
        <section className="px-6 py-5">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400 mb-4">AI confidence</p>
          <FieldRow
            label="Auto-route confidence threshold"
            value={values.autoRouteConfidence}
            suffix="%"
            hint="Above this, AI promotes the routing pattern to a trusted route and routes without further human review."
            scopeNote="Folder admin can override per folder."
            onChange={update('autoRouteConfidence')}
          />
        </section>

        <section className="px-6 py-5 space-y-6">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400">Returns</p>
          <FieldRow
            label="Return reason minimum length"
            value={values.returnReasonMin}
            suffix="characters"
            hint="Shortest acceptable reason when returning a document upstream."
            onChange={update('returnReasonMin')}
          />
        </section>

        <section className="px-6 py-5 space-y-6">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400">Inactive admin succession</p>
          <FieldRow
            label="Inactive admin alert threshold"
            value={values.inactiveAlertDays}
            suffix="days"
            hint="Days of no inbox activity before the next active admin up the tree is alerted."
            onChange={update('inactiveAlertDays')}
          />
          <FieldRow
            label="Inactive admin escalation threshold"
            value={values.inactiveEscalationDays}
            suffix="days"
            hint="Days of no inbox activity before the alert escalates to System Admin."
            onChange={update('inactiveEscalationDays')}
          />
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">Inactive admin auto-mark threshold</label>
            <div className="flex items-center gap-3">
              <input type="number" value={values.inactiveAutoMarkDays}
                onChange={e => update('inactiveAutoMarkDays')(Number(e.target.value))}
                className="w-24 px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400" />
              <span className="text-sm text-gray-500">days</span>
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input type="checkbox" checked={values.inactiveAutoMarkEnabled}
                  onChange={e => setValues(prev => ({ ...prev, inactiveAutoMarkEnabled: e.target.checked }))} />
                Auto-mark enabled
              </label>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              Off by default. When enabled, the system auto-marks the admin inactive without manual confirmation after this many days.
            </p>
          </div>
        </section>

        <section className="px-6 py-5">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400 mb-4">Storage</p>
          <FieldRow
            label="Telemetry retention"
            value={values.telemetryRetentionYears}
            suffix="years"
            hint="How long routing history entries are kept."
            onChange={update('telemetryRetentionYears')}
          />
        </section>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        {savedMessage && <p className="text-xs font-medium text-emerald-600">{savedMessage}</p>}
        <button onClick={handleSave}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          Save
        </button>
      </div>
    </div>
  );
}
