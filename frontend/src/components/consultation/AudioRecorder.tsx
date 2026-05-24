'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import type { TranscriptChunk } from '../../types';

interface AudioRecorderProps {
  sessionId: string;
  onTranscriptChunk: (chunk: TranscriptChunk) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
}

function Waveform({ data, active }: { data: number[]; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const anim = useRef(0);
  const bars = useRef<number[]>(new Array(64).fill(0));

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      const w = c.width, h = c.height;
      ctx.clearRect(0, 0, w, h);

      const b = bars.current;
      const bw = 3, gap = 2, total = b.length;

      for (let i = 0; i < total; i++) {
        const target = active && data[i % data.length] != null
          ? data[i % data.length] * (0.7 + Math.sin(Date.now() * 0.002 + i * 0.4) * 0.1)
          : 0.015;
        b[i] += (target - b[i]) * 0.12;

        const bh = Math.max(1, b[i] * h * 0.85);
        const x = i * (bw + gap);
        const y = (h - bh) / 2;

        ctx.fillStyle = active
          ? (b[i] > 0.35 ? 'rgba(99,102,241,0.9)' : 'rgba(99,102,241,0.4)')
          : 'rgba(255,255,255,0.05)';
        ctx.fillRect(x, y, bw, bh);
      }

      anim.current = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(anim.current);
  }, [data, active]);

  return <canvas ref={ref} width={640} height={64} className="w-full h-16" />;
}

export default function AudioRecorder({ sessionId, onTranscriptChunk, isRecording, onToggleRecording }: AudioRecorderProps) {
  const { status, sendAudio, connect, disconnect } = useWebSocket({
    sessionId: isRecording ? sessionId : null,
    onTranscriptChunk: onTranscriptChunk,
  });

  const onChunk = useCallback((d: ArrayBuffer) => { if (status === 'connected') sendAudio(d); }, [status, sendAudio]);
  const { startRecording, stopRecording, waveformData, error, permissionState } = useAudioRecorder({ sendAudio: onChunk });

  useEffect(() => {
    if (isRecording && sessionId) connect(); else disconnect();
  }, [isRecording, sessionId, connect, disconnect]);

  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (isRecording) {
      setElapsed(0);
      timer.current = setInterval(() => setElapsed(p => p + 1), 1000);
    } else if (timer.current) clearInterval(timer.current);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [isRecording]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const toggle = async () => {
    if (!isRecording) await startRecording(); else stopRecording();
    onToggleRecording();
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRecording ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] text-red-400 font-medium">Recording</span>
            </>
          ) : (
            <span className="text-[11px] text-[#555] font-medium">Audio capture</span>
          )}
        </div>
        {isRecording && (
          <span className="text-[14px] font-mono font-medium text-white tabular-nums">{fmt(elapsed)}</span>
        )}
      </div>

      {/* Waveform */}
      <div className={`rounded-lg border p-3 transition-colors duration-200 ${
        isRecording ? 'border-[#6366f1]/20 bg-[var(--bg-surface)]' : 'border-[var(--border)] bg-[var(--bg-raised)]'
      }`}>
        <Waveform data={waveformData} active={isRecording} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={toggle}
          className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 ${
            isRecording
              ? 'bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25'
              : 'bg-[#6366f1] text-white hover:bg-[#7a7ae0]'
          }`}
        >
          {isRecording ? (
            <div className="w-3.5 h-3.5 rounded-sm bg-current" />
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
      </div>

      {/* Status */}
      <div className="flex items-center justify-center gap-3 text-[10px] text-[#444]">
        <span>mic: {permissionState === 'granted' ? '✓' : permissionState}</span>
        <span>·</span>
        <span>ws: {status}</span>
      </div>

      {error && (
        <p className="text-[11px] text-red-400 text-center px-3 py-2 rounded-md bg-red-500/5 border border-red-500/10">{error}</p>
      )}
    </div>
  );
}
