'use client';

import React from 'react';
import type { PatientResponse } from '../../types';

interface PatientListProps {
  patients: PatientResponse[];
  isLoading: boolean;
  onSearch: (query: string) => void;
  onAddNew: () => void;
  onSelectPatient?: (patient: PatientResponse) => void;
}

const DEMO_PATIENTS: PatientResponse[] = [
  { patient_id: 'PAT-2041', name: 'Arjun Mehta',   age: 45, gender: 'Male',   consultation_count: 0, created_at: '' },
  { patient_id: 'PAT-2039', name: 'Priya Sharma',  age: 32, gender: 'Female', consultation_count: 0, created_at: '' },
  { patient_id: 'PAT-2035', name: 'Rahul Patel',   age: 58, gender: 'Male',   consultation_count: 0, created_at: '' },
  { patient_id: 'PAT-2028', name: 'Sunita Devi',   age: 41, gender: 'Female', consultation_count: 0, created_at: '' },
  { patient_id: 'PAT-2022', name: 'Vikash Kumar',  age: 29, gender: 'Male',   consultation_count: 0, created_at: '' },
  { patient_id: 'PAT-2015', name: 'Ananya Gupta',  age: 36, gender: 'Female', consultation_count: 0, created_at: '' },
];

export default function PatientList({
  patients,
  isLoading,
  onSearch,
  onAddNew,
  onSelectPatient,
}: PatientListProps) {
  const displayPatients = patients.length === 0 && !isLoading ? DEMO_PATIENTS : patients;

  return (
    <div className="space-y-3">
      {/* Search + Add */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#555]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search patients…"
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[13.5px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[#6366f1]/40 transition-colors duration-150"
          />
        </div>
        <button
          onClick={onAddNew}
          className="px-3 py-2 rounded-lg bg-[#6366f1] text-white text-[13.5px] font-medium hover:bg-[#5558e6] transition-colors duration-150"
        >
          + Add
        </button>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-[#6366f1]/30 border-t-[#6366f1] rounded-full animate-spin" />
          <span className="ml-2 text-[13.5px] text-[#555]">Loading patients…</span>
        </div>
      ) : (
        /* Table */
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--bg-raised)]">
                <th className="text-left text-[11.5px] font-medium text-[var(--text-muted)] uppercase tracking-wider px-3 py-2">
                  ID
                </th>
                <th className="text-left text-[11.5px] font-medium text-[#555] uppercase tracking-wider px-3 py-2">
                  Name
                </th>
                <th className="text-left text-[11.5px] font-medium text-[#555] uppercase tracking-wider px-3 py-2">
                  Age
                </th>
                <th className="text-left text-[11.5px] font-medium text-[#555] uppercase tracking-wider px-3 py-2">
                  Gender
                </th>
              </tr>
            </thead>
            <tbody>
              {displayPatients.map((p) => (
                <tr
                  key={p.patient_id}
                  onClick={() => onSelectPatient?.(p)}
                  className="border-t border-white/[0.06] hover:bg-[#161618] cursor-pointer transition-colors duration-150"
                >
                  <td className="px-3 py-2.5 text-[12.5px] text-[#888] font-mono">
                    {p.patient_id}
                  </td>
                  <td className="px-3 py-2.5 text-[13.5px] text-white font-medium">
                    {p.name}
                  </td>
                  <td className="px-3 py-2.5 text-[13.5px] text-[#888]">
                    {p.age ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-[13.5px] text-[#888]">
                    {p.gender || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
