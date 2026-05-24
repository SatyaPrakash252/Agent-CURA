'use client';

import React, { useEffect, useState } from 'react';
import Badge from '../../components/ui/Badge';
import Loader from '../../components/ui/Loader';
import { API_V1 } from '../../lib/constants';

interface HistoryRecord {
  session_id: string;
  patient_id: string;
  soap_subjective: string;
  soap_objective: string;
  soap_assessment: string;
  soap_plan: string;
  confidence_score: number;
  billing_codes: any[];
  safety_flags: any[];
  created_at: string;
}

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [allPatients, setAllPatients] = useState<any[]>([]);

  // Load patients on mount
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const token = localStorage.getItem('cura_token');
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_V1}/patients?limit=100`, { headers });
        if (res.ok) setAllPatients(await res.json());
      } catch {}
    };
    fetchPatients();
  }, []);

  // Fetch history for a patient
  const fetchHistory = async (patientId: string) => {
    if (!patientId.trim()) { setRecords([]); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem('cura_token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_V1}/patients/${encodeURIComponent(patientId)}/history`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRecords(Array.isArray(data) ? data : []);
      } else {
        setRecords([]);
      }
    } catch { setRecords([]); }
    setLoading(false);
  };

  // Debounced search
  useEffect(() => {
    if (!search.trim()) { setRecords([]); return; }
    const t = setTimeout(() => fetchHistory(search.trim()), 600);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-5 animate-in">
      {/* Search */}
      <div className="flex items-center gap-3 surface px-4 py-3">
        <svg className="w-4 h-4 text-[#52525b] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" placeholder="Enter Patient ID to view history (e.g. PAT-2041)…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="input flex-1" />
      </div>

      {/* Quick patient chips */}
      {allPatients.length > 0 && !search && (
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] text-[#52525b] font-semibold uppercase tracking-wider self-center mr-1">Recent patients:</span>
          {allPatients.slice(0, 8).map((p: any) => (
            <button key={p.patient_id} onClick={() => setSearch(p.patient_id)}
              className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-[11px] text-[#a1a1aa] hover:bg-white/[0.08] hover:text-white transition-colors">
              {p.patient_id} {p.name && <span className="text-[#52525b]">· {p.name}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="py-12"><Loader text="Loading history…" /></div>
      ) : !search ? (
        <div className="py-16 text-center">
          <svg className="w-8 h-8 text-[#3f3f46] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[14.5px] text-[#71717a] font-medium">Consultation History</p>
          <p className="text-[12.5px] text-[#52525b] mt-1">Enter a Patient ID or click a recent patient to view their consultation history from Supabase.</p>
        </div>
      ) : records.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[13.5px] text-[#71717a]">No consultations found for &quot;{search}&quot;</p>
          <p className="text-[11.5px] text-[#52525b] mt-1">Make sure the Patient ID is correct and that consultations have been finalized.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[12.5px] text-[#52525b] font-medium">{records.length} consultation{records.length !== 1 ? 's' : ''} found for {search}</p>
          {records.map((r, i) => {
            const exp = expandedId === r.session_id;
            return (
              <div key={r.session_id || i} className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
                <button onClick={() => setExpandedId(exp ? null : r.session_id)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-hover)]/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-[11.5px] text-[#52525b] font-mono">{r.created_at?.slice(0, 16)?.replace('T', ' ') || '—'}</span>
                    <Badge variant="info" label={r.patient_id} size="sm" />
                    <span className="text-[13.5px] text-[#a1a1aa] font-medium truncate max-w-[400px]">{r.soap_assessment || 'No assessment'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.confidence_score > 0 && <Badge variant={r.confidence_score >= 80 ? 'success' : 'warning'} label={`${r.confidence_score}%`} size="sm" />}
                    {r.billing_codes?.length > 0 && <span className="text-[10.5px] text-[#52525b] font-mono">{r.billing_codes.length} codes</span>}
                    <svg className={`w-3.5 h-3.5 text-[#52525b] transition-transform duration-200 ${exp ? 'rotate-180' : ''}`}
                       fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {exp && (
                  <div className="px-4 pb-4 pt-2 border-t border-[var(--border)] space-y-3 animate-in">
                    {[
                      { key: 'Subjective', val: r.soap_subjective },
                      { key: 'Objective', val: r.soap_objective },
                      { key: 'Assessment', val: r.soap_assessment },
                      { key: 'Plan', val: r.soap_plan },
                    ].map((s) => (
                      <div key={s.key}>
                        <p className="text-[11.5px] text-[#52525b] uppercase tracking-wider font-semibold mb-0.5">{s.key}</p>
                        <p className="text-[13.5px] text-[#a1a1aa] whitespace-pre-line">{s.val || '—'}</p>
                      </div>
                    ))}

                    {r.billing_codes && r.billing_codes.length > 0 && (
                      <div>
                        <p className="text-[11.5px] text-[#52525b] uppercase tracking-wider font-semibold mb-1">Billing Codes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {r.billing_codes.map((b: any, j: number) => (
                            <span key={j} className="text-[11.5px] px-2 py-0.5 rounded-md bg-white/[0.03] text-[#a1a1aa] border border-white/[0.06]">
                              {b.code}: {b.description}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {r.safety_flags && r.safety_flags.length > 0 && (
                      <div>
                        <p className="text-[11.5px] text-[#52525b] uppercase tracking-wider font-semibold mb-1">Safety Alerts</p>
                        {r.safety_flags.map((f: any, j: number) => (
                          <p key={j} className="text-[12.5px] text-[#f87171]">[{f.level}] {f.message}</p>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-white/[0.04]">
                      <span className="text-[10px] text-[#3f3f46] font-mono">Session: {r.session_id}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
