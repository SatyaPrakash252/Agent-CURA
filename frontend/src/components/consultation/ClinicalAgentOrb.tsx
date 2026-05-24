'use client';

import React, { useEffect, useRef } from 'react';

interface ClinicalAgentOrbProps {
  data: number[];
  active: boolean;
  elapsed: number;
  language: string;
}

export default function ClinicalAgentOrb({ data, active, elapsed, language }: ClinicalAgentOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const w = canvas.width = canvas.clientWidth * window.devicePixelRatio;
      const h = canvas.height = canvas.clientHeight * window.devicePixelRatio;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      
      // Calculate avg level from waveform data to drive animation scaling
      const sum = data.reduce((acc, val) => acc + val, 0);
      const avg = data.length > 0 ? sum / data.length : 0;
      const pulseFactor = active ? 1.0 + avg * 1.8 : 1.0;
      const baseRadius = Math.min(w, h) * 0.22 * pulseFactor;

      // Draw glowing background aura
      const radialGlow = ctx.createRadialGradient(cx, cy, baseRadius * 0.3, cx, cy, baseRadius * 1.8);
      radialGlow.addColorStop(0, active ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.03)');
      radialGlow.addColorStop(0.5, active ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.01)');
      radialGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = radialGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      if (active) {
        // Draw real-time dynamic sound rings pulsating outwards
        const rings = 3;
        for (let r = 0; r < rings; r++) {
          const ratio = (Date.now() * 0.001 + r * (1 / rings)) % 1.0;
          ctx.strokeStyle = `rgba(99, 102, 241, ${0.45 * (1.0 - ratio)})`;
          ctx.lineWidth = 1.5 + (1 - ratio) * 2;
          ctx.beginPath();
          ctx.arc(cx, cy, baseRadius + ratio * 85, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw radial frequency equalizer bars radiating from the core
        const barCount = 72;
        const startRadius = baseRadius + 4;
        const maxLen = 35 * (0.8 + avg * 2.5);
        for (let i = 0; i < barCount; i++) {
          const angle = (i / barCount) * Math.PI * 2 + (Date.now() * 0.0001);
          const rawVal = data[i % data.length] || 0.05;
          const len = 4 + rawVal * maxLen * (0.85 + Math.sin(Date.now() * 0.003 + i * 0.5) * 0.15);

          const x1 = cx + Math.cos(angle) * startRadius;
          const y1 = cy + Math.sin(angle) * startRadius;
          const x2 = cx + Math.cos(angle) * (startRadius + len);
          const y2 = cy + Math.sin(angle) * (startRadius + len);

          // Gradient color for each bar
          ctx.strokeStyle = i % 2 === 0 ? 'rgba(34, 211, 238, 0.85)' : 'rgba(139, 92, 246, 0.85)';
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      // Draw solid central Scribe Agent Core Shield Orb
      const coreGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, baseRadius);
      coreGrad.addColorStop(0, active ? '#8b5cf6' : '#27272a');
      coreGrad.addColorStop(0.65, active ? '#6366f1' : '#18181b');
      coreGrad.addColorStop(1, active ? '#4f46e5' : '#09090b');
      ctx.fillStyle = coreGrad;
      ctx.shadowColor = active ? 'rgba(99, 102, 241, 0.55)' : 'rgba(0,0,0,0)';
      ctx.shadowBlur = active ? 30 : 0;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; // reset shadow

      // Draw orbiting tracking rings (holographic styling)
      ctx.strokeStyle = active ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * 1.25, 0, Math.PI * 2);
      ctx.stroke();

      // Outer active status node orbiting the ring
      if (active) {
        const orbitAngle = Date.now() * 0.0015;
        const ox = cx + Math.cos(orbitAngle) * (baseRadius * 1.25);
        const oy = cy + Math.sin(orbitAngle) * (baseRadius * 1.25);
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(ox, oy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animRef.current);
  }, [data, active]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const languageNames: Record<string, string> = {
    'auto': '🌐 Auto-Detect',
    'en': '🇺🇸 English',
    'hi': '🇮🇳 Hindi (हिन्दी)',
    'es': '🇪🇸 Spanish',
  };

  return (
    <div className="relative w-full min-h-[380px] rounded-2xl flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[var(--bg-surface)] to-[var(--bg-raised)] border border-[var(--border)] shadow-2xl p-6 transition-all duration-300">
      {/* Cyber Grid Lines Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Holographic Radar Scan Line */}
      {active && (
        <div className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#22d3ee]/40 to-transparent pointer-events-none animate-[holographic-scan_4s_linear_infinite]" />
      )}

      {/* Dynamic Interactive Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Top UI Panel Overlay */}
      <div className="absolute top-4 left-6 right-6 flex items-center justify-between text-[11px] font-mono tracking-widest text-[var(--text-muted)] z-10">
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${active ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`} />
          {active ? 'AGENT SYSTEM: ACTIVE' : 'AGENT SYSTEM: STANDBY'}
        </span>
        <span>SYS_VER_2.0.0</span>
      </div>

      {/* Central Visual UI Display */}
      <div className="z-10 text-center space-y-4">
        {/* Holographic glowing medical icon floating in orb */}
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-md border transition-all duration-300 ${
          active ? 'border-[#6366f1]/40 shadow-lg shadow-[#6366f1]/20 scale-105' : 'border-[var(--border)]'
        }`}>
          <svg className={`w-8 h-8 transition-colors duration-300 ${active ? 'text-indigo-400 animate-pulse' : 'text-[var(--text-muted)]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>

        {/* Dynamic breathing status indicator */}
        <div className="space-y-1">
          <h2 className={`text-lg font-bold tracking-wider transition-colors duration-300 ${active ? 'text-white' : 'text-[var(--text-secondary)]'}`}>
            {active ? 'Clinical Scribe Agent' : 'Ready to Scribe'}
          </h2>
          <p className="text-[13px] text-[var(--text-muted)] max-w-sm mx-auto font-medium">
            {active 
              ? 'Listening, processing & structuring the patient-doctor conversation in real-time.' 
              : 'Tap start recording below to invoke the clinical documentation agent.'
            }
          </p>
        </div>

        {/* Live Audio Metadata Panel */}
        {active && (
          <div className="inline-flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl bg-black/30 border border-white/[0.04] backdrop-blur-md animate-in">
            <span className="text-[18px] font-mono font-bold text-indigo-400 tracking-wider tabular-nums">{fmt(elapsed)}</span>
            <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)] font-mono">
              <span>{languageNames[language] || language}</span>
              <span className="text-zinc-700">|</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-ping" />
                Whisper STT
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom status tracking overlay */}
      <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] z-10">
        <span>LOCALE: {language.toUpperCase()}</span>
        <span>FEED_RATE: 2.0s</span>
      </div>
    </div>
  );
}
