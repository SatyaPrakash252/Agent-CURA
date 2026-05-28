'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Badge from '../components/ui/Badge';
import { API_V1 } from '../lib/constants';
import { useAuth } from '../hooks/useAuth'; // updated ref

interface DashboardStats {
  patient_count: number;
  today_sessions: number;
  avg_confidence: number;
}

interface RecentConsultation {
  session_id: string;
  patient_id: string;
  soap_assessment: string;
  confidence_score: number;
  created_at: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({ patient_count: 0, today_sessions: 0, avg_confidence: 0 });
  const [recent, setRecent] = useState<RecentConsultation[]>([]);
  const [online, setOnline] = useState(false);
  const [greeting, setGreeting] = useState('Good day');

  useEffect(() => {
    const hrs = new Date().getHours();
    if (hrs < 12) setGreeting('Good morning');
    else if (hrs < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('cura_token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    // Health check with retry (handles Render free tier cold starts)
    const checkHealth = async (retries = 3, delay = 3000): Promise<boolean> => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch(`${API_V1}/health`, { signal: AbortSignal.timeout(10000) });
          if (res.ok) return true;
        } catch {}
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, delay));
          delay *= 2; // exponential backoff: 3s, 6s, 12s
        }
      }
      return false;
    };

    const load = async () => {
      try {
        // Health check with retries first
        const isOnline = await checkHealth();
        setOnline(isOnline);

        if (isOnline) {
          // Only fetch data if backend is reachable
          const [statsRes, recentRes] = await Promise.allSettled([
            fetch(`${API_V1}/consultation/stats/dashboard`, { headers }),
            fetch(`${API_V1}/consultation/`, { headers }),
          ]);

          if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
            const d = await statsRes.value.json();
            setStats(d);
          }

          if (recentRes.status === 'fulfilled' && recentRes.value.ok) {
            const d = await recentRes.value.json();
            if (Array.isArray(d)) setRecent(d.slice(0, 8));
          }
        }
      } catch {}
      setLoading(false);
    };
    load();

    // Periodic health polling every 60s (detects Render wake-ups)
    const healthPoll = setInterval(async () => {
      try {
        const res = await fetch(`${API_V1}/health`, { signal: AbortSignal.timeout(8000) });
        setOnline(res.ok);
      } catch {
        setOnline(false);
      }
    }, 60000);

    return () => clearInterval(healthPoll);
  }, []);

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return '—'; }
  };

  const metrics = [
    { label: 'Patients', value: loading ? '—' : String(stats.patient_count || 0) },
    { label: 'Sessions today', value: loading ? '—' : String(stats.today_sessions || 0) },
    { label: 'Avg confidence', value: loading ? '—' : `${stats.avg_confidence || 0}%` },
    { label: 'API status', value: loading ? '—' : (online ? 'Online' : 'Offline') },
  ];

  return (
    <div className="space-y-10 animate-in">
      {/* Hero */}
      <div>
        <p className="text-[13px] text-[var(--text-muted)] font-medium mb-1.5 uppercase tracking-wider">Overview</p>
        <h1 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
          {greeting}, {user?.full_name || 'Doctor'}
        </h1>
        {user?.expertise && (
          <p className="text-[14px] text-[#6366f1] font-semibold mt-2">
            🩺 {user.expertise} &nbsp;•&nbsp; 💳 Verified Credentials: <span className="font-mono text-[#8b5cf6]">{user.credentials || 'N/A'}</span>
          </p>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--border)] rounded-xl overflow-hidden border border-[var(--border)] shadow-sm">
        {metrics.map((m, i) => (
          <div key={i} className="bg-[var(--bg-surface)] p-6">
            <p className="text-[12px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-2">{m.label}</p>
            <p className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              {loading ? <span className="inline-block w-12 h-8 skeleton" /> : m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/consultation" className="group">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 transition-all duration-150 hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)] shadow-sm">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#6366f1]/10 border border-[#6366f1]/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#6366f1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <p className="text-[14.5px] font-bold text-[var(--text-primary)]">New consultation</p>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5">Voice → SOAP → Billing</p>
              </div>
            </div>
            <div className="flex items-center text-[13px] text-[var(--text-muted)] group-hover:text-[#6366f1] transition-colors font-medium">
              Start recording
              <svg className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </div>
          </div>
        </Link>

        <Link href="/patients" className="group">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 transition-all duration-150 hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)] shadow-sm">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm14 14v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                </svg>
              </div>
              <div>
                <p className="text-[14.5px] font-bold text-[var(--text-primary)]">Patient directory</p>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{stats.patient_count || 0} records</p>
              </div>
            </div>
            <div className="flex items-center text-[13px] text-[var(--text-muted)] group-hover:text-emerald-400 transition-colors font-medium">
              Browse patients
              <svg className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </div>
          </div>
        </Link>

        <Link href="/history" className="group">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 transition-all duration-150 hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)] shadow-sm">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[14.5px] font-bold text-[var(--text-primary)]">History</p>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5">Past consultations</p>
              </div>
            </div>
            <div className="flex items-center text-[13px] text-[var(--text-muted)] group-hover:text-amber-400 transition-colors font-medium">
              View history
              <svg className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent consultations — REAL DATA */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-bold text-[var(--text-primary)]">Recent consultations</p>
          <Link href="/history" className="text-[13px] text-[#6366f1] hover:text-[#8b5cf6] font-semibold transition-colors">View all →</Link>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider border-b border-[var(--border)] bg-[var(--bg-raised)]">
            <span className="col-span-2">Time</span>
            <span className="col-span-2">Patient ID</span>
            <span className="col-span-6">Assessment</span>
            <span className="col-span-2 text-right">Confidence</span>
          </div>

          {/* Rows */}
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="grid grid-cols-12 gap-4 items-center px-5 py-4 border-b border-[var(--border)]">
                <span className="col-span-2 skeleton h-4 w-12 rounded" />
                <span className="col-span-2 skeleton h-4 w-20 rounded" />
                <span className="col-span-6 skeleton h-4 w-full rounded" />
                <span className="col-span-2 skeleton h-4 w-12 rounded ml-auto" />
              </div>
            ))
          ) : recent.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[13.5px] text-[var(--text-secondary)]">No consultations yet. Start your first one!</p>
            </div>
          ) : (
            recent.map((r, i) => (
              <div key={r.session_id || i} className={`grid grid-cols-12 gap-4 items-center px-5 py-4 transition-colors hover:bg-[var(--bg-hover)]/30 cursor-pointer ${i < recent.length - 1 ? 'border-b border-[var(--border)]' : ''}`}>
                <span className="col-span-2 text-[12.5px] text-[var(--text-muted)] font-mono">{formatTime(r.created_at)}</span>
                <span className="col-span-2 text-[13.5px] text-[var(--text-primary)] font-semibold">{r.patient_id}</span>
                <span className="col-span-6 text-[13.5px] text-[var(--text-secondary)] truncate">{r.soap_assessment || 'No assessment'}</span>
                <span className="col-span-2 flex justify-end">
                  <Badge variant={(r.confidence_score || 0) >= 80 ? 'success' : 'warning'} label={`${r.confidence_score || 0}%`} size="sm" />
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
