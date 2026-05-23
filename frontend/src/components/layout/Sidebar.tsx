'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { API_BASE_URL } from '../../lib/constants';
import type { HealthResponse } from '../../types';

const nav = [
  { href: '/', label: 'Dashboard', shortcut: '1', icon: <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zM3 14h7v7H3v-7z" /> },
  { href: '/consultation', label: 'Consultation', shortcut: '2', icon: <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8" /> },
  { href: '/patients', label: 'Patients', shortcut: '3', icon: <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zm14 14v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /> },
  { href: '/history', label: 'History', shortcut: '4', icon: <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
];

export default function Sidebar() {
  const path = usePathname();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const r = await fetch(`${API_BASE_URL}/api/health`, {
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
      <button onClick={() => setOpen(!open)} className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-md bg-[#111113] border border-white/[0.06] text-[#71717a]">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {open ? <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>

      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed top-0 left-0 z-40 h-screen w-56 border-r border-white/[0.06] bg-[#09090b] flex flex-col transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#6366f1] flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white tracking-tight">Project Cura</p>
            <p className="text-[10px] text-[#52525b] leading-none">Clinical AI</p>
          </div>
        </div>

        <nav className="flex-1 px-2.5 space-y-0.5 mt-2">
          {nav.map((item) => {
            const active = path === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] transition-colors duration-150 ${
                  active ? 'bg-white/[0.07] text-white font-medium' : 'text-[#71717a] hover:text-[#a1a1aa] hover:bg-white/[0.03]'}`}>
                <svg className="w-[15px] h-[15px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  {item.icon}
                </svg>
                <span>{item.label}</span>
                <kbd className={`ml-auto text-[10px] font-mono px-1 py-px rounded ${active ? 'text-[#52525b]' : 'text-[#3f3f46]'}`}>{item.shortcut}</kbd>
              </Link>
            );
          })}
        </nav>

        {/* Service status — REAL indicators */}
        <div className="px-3.5 py-4 border-t border-white/[0.04] space-y-2">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[9px] text-[#52525b] font-semibold uppercase tracking-wider">Services</span>
            <span className={`text-[8px] font-mono px-1 py-px rounded ${
              backendOnline ? 'text-[#34d399] bg-[#34d399]/10' : 'text-[#f87171] bg-[#f87171]/10'
            }`}>{backendOnline ? 'live' : 'offline'}</span>
          </div>
          {services.map((s) => (
            <div key={s.k} className="flex items-center gap-2 text-[11px]">
              <span className={`w-[5px] h-[5px] rounded-full ${s.ok ? 'bg-[#34d399]' : 'bg-[#f87171]/50'}`} />
              <span className="text-[#71717a]">{s.k}</span>
              <span className={`ml-auto font-mono text-[10px] ${s.ok ? 'text-[#34d399]' : 'text-[#f87171]/50'}`}>
                {s.ok ? 'ok' : '—'}
              </span>
            </div>
          ))}
          {backendOnline && health && (
            <p className="text-[9px] text-[#3f3f46] font-mono mt-1">v{health.version}</p>
          )}
        </div>
      </aside>
    </>
  );
}
