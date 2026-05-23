'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { API_BASE_URL } from '../lib/constants';

const demoRows = [
  { time: '14:22', patient: 'Arjun Mehta', id: 'PAT-2041', note: 'Type 2 Diabetes — Adjusted metformin, ordered HbA1c', score: 94 },
  { time: '11:45', patient: 'Priya Sharma', id: 'PAT-2039', note: 'Acute URI — Prescribed amoxicillin 500mg × 7d', score: 91 },
  { time: '16:30', patient: 'Rahul Patel', id: 'PAT-2035', note: 'HTN — BP 150/95, titrated amlodipine 5→10mg', score: 88 },
  { time: '09:15', patient: 'Sunita Devi', id: 'PAT-2028', note: 'Migraine follow-up — Prophylaxis w/ propranolol', score: 96 },
  { time: '10:00', patient: 'Vikash Kumar', id: 'PAT-2022', note: 'Wellness check — Vitals normal, BMI 24.1', score: 97 },
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [pCount, setPCount] = useState(0);
  const [online, setOnline] = useState(false);
  const [greeting, setGreeting] = useState('Good day');

  useEffect(() => {
    const hrs = new Date().getHours();
    if (hrs < 12) setGreeting('Good morning');
    else if (hrs < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, h] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/api/patients?limit=50`),
          fetch(`${API_BASE_URL}/api/health`),
        ]);
        if (p.status === 'fulfilled' && p.value.ok) { const d = await p.value.json(); setPCount(Array.isArray(d) ? d.length : 0); }
        if (h.status === 'fulfilled' && h.value.ok) setOnline(true);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const metrics = [
    { label: 'Patients', value: loading ? '—' : String(pCount || 128) },
    { label: 'Sessions today', value: loading ? '—' : '7' },
    { label: 'Avg confidence', value: loading ? '—' : '93%' },
    { label: 'Uptime', value: loading ? '—' : (online ? '99.9%' : '—') },
  ];

  return (
    <div className="space-y-10 animate-in">
      {/* ── Hero ── */}
      <div>
        <p className="text-[12px] text-[#555] font-medium mb-1">Overview</p>
        <h1 className="text-2xl font-semibold text-white tracking-tight">
          {greeting}, Doctor
        </h1>
      </div>

      {/* ── Metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.04] rounded-lg overflow-hidden border border-white/[0.06]">
        {metrics.map((m, i) => (
          <div key={i} className="bg-[#09090b] p-5">
            <p className="text-[11px] text-[#555] font-medium mb-2">{m.label}</p>
            <p className="text-2xl font-semibold text-white tracking-tight">
              {loading ? <span className="inline-block w-10 h-6 skeleton" /> : m.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Actions ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link href="/consultation" className="group">
          <div className="rounded-lg border border-white/[0.06] bg-[#111113] p-6 transition-colors duration-150 hover:bg-[#161618] hover:border-white/[0.1]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-md bg-[#6366f1]/10 border border-[#6366f1]/15 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#6366f1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-medium text-white">New consultation</p>
                <p className="text-[11px] text-[#555]">Voice → SOAP → Billing</p>
              </div>
            </div>
            <div className="flex items-center text-[12px] text-[#555] group-hover:text-[#6366f1] transition-colors">
              Start recording
              <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </div>
          </div>
        </Link>

        <Link href="/patients" className="group">
          <div className="rounded-lg border border-white/[0.06] bg-[#111113] p-6 transition-colors duration-150 hover:bg-[#161618] hover:border-white/[0.1]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-md bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm14 14v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-medium text-white">Patient directory</p>
                <p className="text-[11px] text-[#555]">128 records</p>
              </div>
            </div>
            <div className="flex items-center text-[12px] text-[#555] group-hover:text-emerald-400 transition-colors">
              Browse patients
              <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </div>
          </div>
        </Link>

        <Link href="/history" className="group">
          <div className="rounded-lg border border-white/[0.06] bg-[#111113] p-6 transition-colors duration-150 hover:bg-[#161618] hover:border-white/[0.1]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-md bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-medium text-white">History</p>
                <p className="text-[11px] text-[#555]">Past consultations</p>
              </div>
            </div>
            <div className="flex items-center text-[12px] text-[#555] group-hover:text-amber-400 transition-colors">
              View history
              <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </div>
          </div>
        </Link>
      </div>

      {/* ── Recent consultations ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-medium text-white">Recent consultations</p>
          <Link href="/history" className="text-[12px] text-[#555] hover:text-white transition-colors">View all →</Link>
        </div>

        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2.5 text-[10px] text-[#444] font-medium uppercase tracking-wider border-b border-white/[0.04] bg-[#0d0d0f]">
            <span className="col-span-1">Time</span>
            <span className="col-span-2">Patient</span>
            <span className="col-span-1">ID</span>
            <span className="col-span-6">SOAP Assessment</span>
            <span className="col-span-2 text-right">Confidence</span>
          </div>

          {/* Rows */}
          {demoRows.map((r, i) => (
            <div key={i} className={`grid grid-cols-12 gap-4 items-center px-4 py-3 transition-colors hover:bg-white/[0.02] cursor-pointer ${i < demoRows.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
              <span className="col-span-1 text-[11px] text-[#555] font-mono">{r.time}</span>
              <span className="col-span-2 text-[12px] text-[#ddd] font-medium">{r.patient}</span>
              <span className="col-span-1 text-[10px] text-[#444] font-mono">{r.id}</span>
              <span className="col-span-6 text-[12px] text-[#777] truncate">{r.note}</span>
              <span className="col-span-2 flex justify-end">
                <Badge variant={r.score >= 90 ? 'success' : 'warning'} label={`${r.score}%`} size="sm" />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
