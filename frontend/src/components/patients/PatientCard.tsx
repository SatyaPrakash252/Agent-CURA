'use client';

import React from 'react';
import type { PatientResponse } from '../../types';

interface PatientCardProps {
  patient: PatientResponse;
  onClick?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

export default function PatientCard({ patient, onClick }: PatientCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-[#111113] border border-white/[0.06] rounded-lg p-3 transition-colors duration-150 ${
        onClick ? 'cursor-pointer hover:bg-[#161618]' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-md bg-[#6366f1]/10 border border-[#6366f1]/20 flex items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-semibold text-[#6366f1]">
            {getInitials(patient.name || patient.patient_id)}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-white truncate">
            {patient.name || patient.patient_id}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-[#555] font-mono">
              {patient.patient_id}
            </span>
            {patient.age != null && (
              <>
                <span className="text-[10px] text-[#444]">·</span>
                <span className="text-[10px] text-[#888]">{patient.age}y</span>
              </>
            )}
            {patient.gender && (
              <>
                <span className="text-[10px] text-[#444]">·</span>
                <span className="text-[10px] text-[#888]">{patient.gender}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
