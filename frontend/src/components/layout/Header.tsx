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

  useEffect(() => {
    const u = () => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    u(); const id = setInterval(u, 30000); return () => clearInterval(id);
  }, []);

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-56 z-20 h-14 border-b border-white/[0.04] bg-[#09090b]/80 backdrop-blur-xl flex items-center justify-between px-6 lg:px-10">
      <h2 className="text-[13px] font-medium text-[#999] pl-10 lg:pl-0">{titles[path] || 'Cura'}</h2>
      <div className="flex items-center gap-4">
        <span className="text-[12px] text-[#444] font-mono">{time}</span>
        <div className="w-6 h-6 rounded-full bg-[#6366f1] flex items-center justify-center text-[10px] font-bold text-white">D</div>
      </div>
    </header>
  );
}
