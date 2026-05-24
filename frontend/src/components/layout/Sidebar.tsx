'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { API_V1 } from '../../lib/constants';
import { useAuth } from '../../hooks/useAuth';
import type { HealthResponse } from '../../types';

const nav = [
  { href: '/', label: 'Dashboard', shortcut: '1', icon: <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zM3 14h7v7H3v-7z" /> },
  { href: '/consultation', label: 'Consultation', shortcut: '2', icon: <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8" /> },
  { href: '/patients', label: 'Patients', shortcut: '3', icon: <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm14 14v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /> },
  { href: '/history', label: 'History', shortcut: '4', icon: <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { href: '/database', label: 'Database View', shortcut: '5', icon: <path d="M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4m0 5c0 2.21-3.58 4-8 4s-8-1.79-8-4" /> },
];

export default function Sidebar() {
  const path = usePathname();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    const checkHealth = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const r = await fetch(`${API_V1}/health`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeout);
        if (r.ok) { setHealth(await r.json()); setBackendOnline(true); }
        else { setBackendOnline(false); }
      } catch {
        clearTimeout(timeout);
        setBackendOnline(false);
      }
    };
    // Initial check + retry after 3s (backend may still be starting)
    checkHealth();
    const retry = setTimeout(checkHealth, 3000);
    const interval = setInterval(checkHealth, 12000);
    return () => { clearTimeout(retry); clearInterval(interval); };
  }, []);

  const services = [
    { k: 'Whisper', ok: backendOnline && health?.whisper_loaded },
    { k: 'Groq', ok: backendOnline && health?.groq_configured },
    { k: 'Supabase', ok: backendOnline && health?.supabase_connected },
  ];

  return (
    <>
      <button onClick={() => setOpen(!open)} className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)]">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {open ? <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>

      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed top-0 left-0 z-40 h-screen w-56 border-r border-[var(--border)] bg-[var(--bg-surface)] flex flex-col transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} transition-colors duration-200`}>
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#6366f1] flex items-center justify-center shadow-sm">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div>
            <p className="text-[14.5px] font-bold text-[var(--text-primary)] tracking-tight">Project Cura</p>
            <p className="text-[11px] text-[var(--text-muted)] leading-none mt-0.5">Clinical AI</p>
          </div>
        </div>

        <nav className="flex-1 px-2.5 space-y-1 mt-3">
          {nav.map((item) => {
            const active = path === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-[9px] rounded-md text-[14.5px] transition-all duration-150 ${
                  active ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] font-semibold shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]/40'}`}>
                <svg className="w-[17px] h-[17px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  {item.icon}
                </svg>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Service status — REAL indicators */}
        <div className="px-4 py-4 border-t border-[var(--border)] space-y-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Services</span>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
              backendOnline ? 'text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/15' : 'text-[#f87171] bg-[#f87171]/10 border border-[#f87171]/15'
            }`}>{backendOnline ? 'live' : 'offline'}</span>
          </div>
          {services.map((s) => (
            <div key={s.k} className="flex items-center gap-2.5 text-[12.5px]">
              <span className={`w-[6px] h-[6px] rounded-full ${s.ok ? 'bg-[#10b981]' : 'bg-[#f87171]/40'}`} />
              <span className="text-[var(--text-secondary)]">{s.k}</span>
              <span className={`ml-auto font-mono text-[11px] ${s.ok ? 'text-[#10b981]' : 'text-[#f87171]/40'}`}>
                {s.ok ? 'ok' : '—'}
              </span>
            </div>
          ))}
          {backendOnline && health && (
            <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1.5">v{health.version}</p>
          )}
        </div>

        {/* User & Logout */}
        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-raised)]">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] text-[var(--text-primary)] font-semibold truncate" title={user?.full_name || user?.username}>{user?.full_name || user?.username || 'User'}</p>
              <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">{user?.role || 'doctor'}</p>
            </div>
            <button
              onClick={logout}
              className="text-[11px] text-[var(--text-muted)] hover:text-[#f87171] hover:bg-[#f87171]/5 transition-all px-2.5 py-1.5 rounded ml-2 flex-shrink-0"
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
