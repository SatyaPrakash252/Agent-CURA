'use client';
import React from 'react';

interface LoaderProps { text?: string; variant?: 'dots' | 'ring' | 'waveform'; size?: 'sm' | 'md'; }

export default function Loader({ text, variant = 'dots', size = 'md' }: LoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-4">
      {variant === 'dots' && (
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <div key={i} className={`rounded-full bg-[#555] ${size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5'}`}
              style={{ animation: 'pulse-slow 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      )}
      {variant === 'ring' && (
        <div className={`border-2 border-white/[0.06] border-t-[#6366f1] rounded-full animate-spin ${size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'}`} />
      )}
      {variant === 'waveform' && (
        <div className="flex items-end gap-[2px] h-6">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="w-[2px] bg-[#6366f1] rounded-sm"
              style={{ animation: 'waveformAnim 0.7s ease-in-out infinite alternate', animationDelay: `${i*0.08}s`, height: '4px' }} />
          ))}
        </div>
      )}
      {text && <p className={`text-[#555] font-medium ${size === 'sm' ? 'text-[10px]' : 'text-[11px]'}`}>{text}</p>}
    </div>
  );
}
