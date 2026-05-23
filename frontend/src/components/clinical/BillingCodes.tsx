'use client';

import React from 'react';
import type { BillingCode } from '../../types';

interface BillingCodesProps {
  codes: BillingCode[];
}

const DEMO_CODES: BillingCode[] = [
  { code: 'G89.4', description: 'Chronic pain syndrome', code_type: 'ICD-10-CM' },
  { code: '99214', description: 'Office visit, est. patient, moderate', code_type: 'HCPCS' },
  { code: 'R51.9', description: 'Headache, unspecified', code_type: 'ICD-10-CM' },
  { code: '72148', description: 'MRI lumbar spine w/o contrast', code_type: 'HCPCS' },
];

export default function BillingCodes({ codes }: BillingCodesProps) {
  const isDemo = codes.length === 0;
  const data = isDemo ? DEMO_CODES : codes;

  return (
    <div className="animate-in rounded-lg border border-white/[0.06] bg-[#111113] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-white tracking-tight">
            Billing Codes
          </span>
          {isDemo && (
            <span className="text-[10px] font-medium text-[#555] bg-white/[0.04] px-1.5 py-0.5 rounded-md">
              DEMO
            </span>
          )}
        </div>
        <span className="text-[10px] text-[#444]">
          {data.length} code{data.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="divide-y divide-white/[0.06]">
        {/* Column headers */}
        <div className="grid grid-cols-[80px_1fr_100px] px-4 py-2 text-[10px] font-medium text-[#444] uppercase tracking-wider">
          <span>Code</span>
          <span>Description</span>
          <span className="text-right">Type</span>
        </div>

        {/* Rows */}
        {data.map((item, i) => (
          <div
            key={i}
            className="grid grid-cols-[80px_1fr_100px] items-center px-4 py-2.5 hover:bg-[#161618] transition-colors duration-150"
          >
            <span className="font-mono text-[12px] font-semibold text-[#6366f1]">
              {item.code}
            </span>
            <span className="text-[12px] text-[#888] truncate pr-3">
              {item.description}
            </span>
            <span className="text-right">
              <span
                className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                  item.code_type === 'ICD-10-CM'
                    ? 'text-amber-400 bg-amber-400/10'
                    : 'text-emerald-400 bg-emerald-400/10'
                }`}
              >
                {item.code_type}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
