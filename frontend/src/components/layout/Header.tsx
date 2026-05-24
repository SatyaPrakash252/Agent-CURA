'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/consultation': 'Consultation',
  '/patients': 'Patients',
  '/history': 'History',
};

export default function Header() {
  const path = usePathname();
  const [time, setTime] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const u = () => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    u(); const id = setInterval(u, 30000); return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('cura_theme') as 'dark' | 'light';
    if (saved) {
      setTheme(saved);
      if (saved === 'light') {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('cura_theme', next);
    if (next === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  };

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-56 z-20 h-14 border-b border-[var(--border)] bg-[var(--bg-base)]/80 backdrop-blur-xl flex items-center justify-between px-6 lg:px-10 transition-colors duration-200">
      <h2 className="text-[14.5px] font-semibold text-[var(--text-secondary)] pl-10 lg:pl-0">{titles[path] || 'Cura'}</h2>
      <div className="flex items-center gap-4">
        <span className="text-[13px] text-[var(--text-muted)] font-mono">{time}</span>
        
        {/* Theme Toggle Button */}
        <button 
          onClick={toggleTheme} 
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[14px] transition-all duration-150 shadow-sm"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <div className="w-7 h-7 rounded-full bg-[#6366f1] flex items-center justify-center text-[11px] font-bold text-white shadow-sm">D</div>
      </div>
    </header>
  );
}
