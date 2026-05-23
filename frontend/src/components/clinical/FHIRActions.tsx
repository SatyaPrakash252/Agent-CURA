'use client';

import React, { useState } from 'react';
import type { ClinicalIntent } from '../../types';

interface FHIRActionsProps {
  intents: ClinicalIntent[];
  fhirBundle?: Record<string, unknown> | null;
}

const DEMO_INTENTS: ClinicalIntent[] = [
  { type: 'LAB', item: 'Complete Blood Count (CBC)', urgency: 'routine' },
  { type: 'MEDICINE', item: 'Amitriptyline 10mg oral qHS', urgency: 'routine' },
  { type: 'LAB', item: 'MRI Brain w/o contrast', urgency: 'routine' },
  { type: 'FOLLOWUP', item: 'Follow-up in 2 weeks', urgency: 'routine' },
];

const TYPE_META: Record<string, { icon: string; label: string }> = {
  LAB: { icon: '⬡', label: 'Lab / Imaging' },
  MEDICINE: { icon: '⬢', label: 'Prescription' },
  FOLLOWUP: { icon: '◇', label: 'Follow-up' },
  REFERRAL: { icon: '◈', label: 'Referral' },
};

export default function FHIRActions({ intents, fhirBundle }: FHIRActionsProps) {
  const [expandedJson, setExpandedJson] = useState(false);
  const [transmitted, setTransmitted] = useState<Set<number>>(new Set());

  const isDemo = intents.length === 0 && !fhirBundle;
  const data = intents.length === 0 ? DEMO_INTENTS : intents;

  const handleTransmit = (index: number) => {
    setTransmitted((prev) => new Set(prev).add(index));
  };

  return (
    <div className="animate-in rounded-lg border border-white/[0.06] bg-[#111113] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-white tracking-tight">
            FHIR Actions
          </span>
          {isDemo && (
            <span className="text-[10px] font-medium text-[#555] bg-white/[0.04] px-1.5 py-0.5 rounded-md">
              DEMO
            </span>
          )}
        </div>
        <span className="text-[10px] text-[#444]">
          {data.length} intent{data.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Intent rows */}
      <div className="divide-y divide-white/[0.06]">
        {data.map((intent, i) => {
          const meta = TYPE_META[intent.type] || { icon: '◻', label: intent.type };
          const done = transmitted.has(i);

          return (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#161618] transition-colors duration-150"
            >
              {/* Icon */}
              <span className="flex-shrink-0 w-7 h-7 rounded-md bg-[#6366f1]/10 text-[#6366f1] text-[12px] flex items-center justify-center">
                {meta.icon}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-white truncate">
                  {intent.item}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-medium text-[#6366f1] bg-[#6366f1]/10 px-1.5 py-0.5 rounded-md">
                    {meta.label}
                  </span>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                      intent.urgency === 'urgent'
                        ? 'text-red-400 bg-red-400/10'
                        : 'text-[#555] bg-white/[0.04]'
                    }`}
                  >
                    {intent.urgency}
                  </span>
                </div>
              </div>

              {/* Action */}
              {done ? (
                <span className="flex-shrink-0 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                  Transmitted
                </span>
              ) : (
                <button
                  onClick={() => handleTransmit(i)}
                  className="flex-shrink-0 text-[11px] font-medium text-white bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.06] px-3 py-1 rounded-md transition-colors duration-150"
                >
                  Transmit
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* FHIR Bundle JSON viewer */}
      {fhirBundle && (
        <div className="border-t border-white/[0.06]">
          <button
            onClick={() => setExpandedJson(!expandedJson)}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-[11px] text-[#555] hover:text-white transition-colors duration-150"
          >
            <svg
              className={`w-3 h-3 transition-transform duration-150 ${expandedJson ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            View FHIR Bundle JSON
          </button>
          {expandedJson && (
            <pre className="mx-4 mb-3 p-3 rounded-md bg-[#0a0a0b] border border-white/[0.06] text-[10px] text-[#555] overflow-auto max-h-[280px] font-mono">
              {JSON.stringify(fhirBundle, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
