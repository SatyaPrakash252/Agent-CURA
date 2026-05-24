'use client';

import React, { useState } from 'react';
import type { SOAPNote as SOAPNoteType } from '../../types';

interface SOAPNoteProps {
  soap: SOAPNoteType | null;
  confidenceScore?: number;
  isLoading?: boolean;
}

const DEMO_SOAP: SOAPNoteType = {
  subjective:
    'Patient reports persistent headache for 3 days, worse in morning. Rates 6/10 pain. No nausea or vision changes. Takes ibuprofen with partial relief.',
  objective:
    'BP 128/82, HR 72, Temp 98.4°F. Alert, oriented. HEENT: No papilledema. Neck: No rigidity. Neuro: CN II-XII intact.',
  assessment:
    'Tension-type headache, chronic. Rule out secondary causes given duration.',
  plan:
    '1. MRI brain without contrast\n2. Start amitriptyline 10mg qhs\n3. Headache diary\n4. Follow-up 2 weeks\n5. ER precautions reviewed',
};

const SECTIONS = [
  { key: 'subjective' as const, label: 'S', full: 'Subjective' },
  { key: 'objective' as const, label: 'O', full: 'Objective' },
  { key: 'assessment' as const, label: 'A', full: 'Assessment' },
  { key: 'plan' as const, label: 'P', full: 'Plan' },
];

function SkeletonBlock() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 bg-white/[0.04] rounded w-3/4" />
      <div className="h-3 bg-white/[0.04] rounded w-1/2" />
      <div className="h-3 bg-white/[0.04] rounded w-5/6" />
    </div>
  );
}

export default function SOAPNote({ soap, confidenceScore, isLoading }: SOAPNoteProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const isDemo = !soap && !isLoading;
  const data = soap ?? DEMO_SOAP;

  const copySection = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const confidencePct = confidenceScore
    ? confidenceScore > 1
      ? confidenceScore
      : Math.round(confidenceScore * 100)
    : null;

  return (
    <div className="animate-in rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="text-[14.5px] font-semibold text-[var(--text-primary)] tracking-tight">
            SOAP Note
          </span>
          {isDemo && (
            <span className="text-[11.5px] font-medium text-[var(--text-muted)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded-md">
              DEMO
            </span>
          )}
        </div>
        {confidencePct !== null && (
          <span
            className={`text-[11.5px] font-semibold px-2 py-0.5 rounded-md ${
              confidencePct >= 80
                ? 'text-emerald-400 bg-emerald-400/10'
                : confidencePct >= 60
                ? 'text-amber-400 bg-amber-400/10'
                : 'text-red-400 bg-red-400/10'
            }`}
          >
            {confidencePct}% confidence
          </span>
        )}
      </div>

      {/* Sections grid */}
      <div className="grid grid-cols-1 divide-y divide-[var(--border)]">
        {SECTIONS.map((sec) => {
          const content = data[sec.key] || '';
          return (
            <div key={sec.key} className="group relative px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors duration-150">
              <div className="flex items-start gap-3">
                {/* Letter badge */}
                <span className="flex-shrink-0 w-6 h-6 rounded-md bg-[#6366f1]/10 text-[#6366f1] text-[12.5px] font-bold flex items-center justify-center mt-0.5">
                  {sec.label}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-[11.5px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    {sec.full}
                  </p>
                  {isLoading ? (
                    <SkeletonBlock />
                  ) : (
                    <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
                      {content || 'No data available'}
                    </p>
                  )}
                </div>

                {/* Copy button */}
                {!isLoading && content && (
                  <button
                    onClick={() => copySection(sec.key, content)}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1 rounded-md hover:bg-white/[0.06] text-[#444] hover:text-white"
                    title={`Copy ${sec.full}`}
                  >
                    {copied === sec.key ? (
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
