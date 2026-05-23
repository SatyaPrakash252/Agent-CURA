'use client';

import React, { useState, useEffect } from 'react';
import Badge from '../ui/Badge';
import { API_BASE_URL } from '../../lib/constants';
import type { HealthResponse } from '../../types';

export default function StatusBar() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`);
        if (res.ok) { setHealth(await res.json()); setIsLive(true); }
      } catch { setIsLive(false); }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Show active in demo mode
  const whisper = isLive ? health?.whisper_loaded : true;
  const groq = isLive ? health?.groq_configured : true;
  const supabase = isLive ? health?.supabase_connected : true;

  return (
    <div className="flex items-center gap-4 surface px-4 py-2">
      <span className="label">System</span>
      {!isLive && <span className="text-[8px] text-[#6366f1] font-mono px-1 py-px rounded bg-[#6366f1]/10">demo</span>}
      <div className="flex items-center gap-3">
        <Badge variant={whisper ? 'success' : 'danger'} label="Whisper" size="sm" pulse={!!whisper} />
        <Badge variant={groq ? 'success' : 'danger'} label="Groq" size="sm" pulse={!!groq} />
        <Badge variant={supabase ? 'success' : 'danger'} label="Supabase" size="sm" pulse={!!supabase} />
      </div>
      {health && <span className="ml-auto text-[10px] text-[#52525b]">v{health.version}</span>}
    </div>
  );
}
