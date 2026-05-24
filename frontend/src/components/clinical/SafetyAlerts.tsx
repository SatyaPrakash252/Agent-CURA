'use client';

import React from 'react';
import type { SafetyFlag } from '../../types';

interface SafetyAlertsProps {
  flags: SafetyFlag[];
  isDemo?: boolean;
}

const DEMO_FLAGS: SafetyFlag[] = [
  {
    level: 'WARNING',
    message: 'Amitriptyline + Ibuprofen: Monitor for increased GI bleeding risk',
    requires_review: true,
  },
];

const LEVEL_STYLES: Record<
  string,
  { border: string; bg: string; text: string; badge: string; label: string }
> = {
  CRITICAL: {
    border: 'border-l-red-400',
    bg: 'bg-red-400/5',
    text: 'text-red-400',
    badge: 'text-red-400 bg-red-400/10',
    label: 'Critical',
  },
  WARNING: {
    border: 'border-l-amber-400',
    bg: 'bg-amber-400/5',
    text: 'text-amber-400',
    badge: 'text-amber-400 bg-amber-400/10',
    label: 'Warning',
  },
  INFO: {
    border: 'border-l-blue-400',
    bg: 'bg-blue-400/5',
    text: 'text-blue-400',
    badge: 'text-blue-400 bg-blue-400/10',
    label: 'Info',
  },
};

export default function SafetyAlerts({ flags, isDemo = false }: SafetyAlertsProps) {
  const data = isDemo && flags.length === 0 ? DEMO_FLAGS : flags;

  if (data.length === 0) {
    return (
      <div className="animate-in rounded-lg border border-[#10b981]/20 bg-[#10b981]/5 px-4 py-3.5 flex items-center gap-3">
        <svg className="w-5 h-5 text-[#10b981] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">Clinical Audit Passed</p>
          <p className="text-[12.5px] text-[var(--text-secondary)] mt-0.5">No contraindications, medication discrepancies, or safety warnings detected in this consultation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="text-[14.5px] font-semibold text-[var(--text-primary)] tracking-tight">
            Safety Alerts
          </span>
          {isDemo && flags.length === 0 && (
            <span className="text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded-md">
              DEMO
            </span>
          )}
        </div>
        {data.some((f) => f.level === 'CRITICAL') && (
          <span className="text-[10px] font-semibold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-md animate-pulse">
            Action Required
          </span>
        )}
      </div>

      {/* Alert rows */}
      <div className="divide-y divide-[var(--border)]">
        {data.map((flag, i) => {
          const style = LEVEL_STYLES[flag.level] || LEVEL_STYLES.INFO;

          return (
            <div
              key={i}
              className={`flex items-start gap-3 px-4 py-3 border-l-2 ${style.border} ${style.bg} hover:bg-[var(--bg-hover)] transition-colors duration-150`}
            >
              {/* Severity icon */}
              <div className="flex-shrink-0 mt-0.5">
                {flag.level === 'CRITICAL' ? (
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : flag.level === 'WARNING' ? (
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${style.badge}`}>
                    {style.label}
                  </span>
                  {flag.requires_review && (
                    <span className="text-[11px] font-semibold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-md">
                      MD Review
                    </span>
                  )}
                </div>
                <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                  {flag.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
