'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import type { TranscriptChunk } from '../../types';
import ClinicalAgentOrb from './ClinicalAgentOrb';

interface AudioRecorderProps {
  sessionId: string;
  patientId: string;
  onTranscriptChunk: (chunk: TranscriptChunk) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  language?: string;
}

export default function AudioRecorder({ sessionId, patientId, onTranscriptChunk, isRecording, onToggleRecording, language }: AudioRecorderProps) {
  const { status, sendAudio, sendControl, connect, disconnect } = useWebSocket({
    sessionId: sessionId,
    onTranscriptChunk: onTranscriptChunk,
    language: language,
  });

  const onChunk = useCallback((d: ArrayBuffer) => { if (status === 'connected') sendAudio(d); }, [status, sendAudio]);
  const { startRecording, stopRecording, waveformData, error, permissionState } = useAudioRecorder({ sendAudio: onChunk });

  useEffect(() => {
    if (isRecording && sessionId) {
      connect();
    } else {
      // Delay disconnect slightly to allow the stop packet to transmit & backend to save audio
      const timer = setTimeout(() => {
        disconnect();
      }, 1000);
      return () => clearTimeout(timer);
    }
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

  const toggle = async () => {
    if (!isRecording) {
      await startRecording();
      onToggleRecording();
    } else {
      // 1. Tell backend to stop and save the audio recording to storage
      if (status === 'connected') {
        sendControl('stop', { patient_id: patientId });
      }
      // 2. Stop local capture
      stopRecording();
      // 3. Toggle state
      onToggleRecording();
    }
  };

  return (
    <div className="space-y-5 animate-in">
      {/* Scribe AI Agent Holographic Portal (Canvas & SVG Visualizer) */}
      <ClinicalAgentOrb
        data={waveformData}
        active={isRecording}
        elapsed={elapsed}
        language={language || 'auto'}
      />

      {/* Primary Recording Console Button */}
      <div className="flex flex-col items-center justify-center gap-2">
        <button
          onClick={toggle}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
            isRecording
              ? 'bg-red-500/20 border-2 border-red-500/50 text-red-400 hover:bg-red-500/30 shadow-red-500/10 scale-105 animate-pulse'
              : 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white hover:from-[#5558e6] hover:to-[#7c4ee6] shadow-indigo-500/20 hover:scale-105'
          }`}
          title={isRecording ? "Stop Consultation Recording" : "Initiate Clinical Scribe"}
        >
          {isRecording ? (
            <div className="w-4 h-4 rounded-sm bg-current" />
          ) : (
            <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
        <span className="text-[11px] font-mono tracking-wider text-[var(--text-muted)] font-bold uppercase mt-1">
          {isRecording ? "CAPTURE IN PROGRESS" : "STANDBY · READY"}
        </span>
      </div>

      {/* Hardware / Network Telemetry indicators */}
      <div className="flex items-center justify-center gap-4 text-[10.5px] font-mono text-[var(--text-dim)] border-t border-[var(--border)] pt-3.5">
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${permissionState === 'granted' ? 'bg-[#10b981]' : 'bg-red-500'}`} />
          MIC: {permissionState === 'granted' ? 'CONNECTED' : permissionState.toUpperCase()}
        </span>
        <span className="text-zinc-800">•</span>
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-[#10b981] animate-pulse' : 'bg-zinc-600'}`} />
          WEB_SOCKET: {status.toUpperCase()}
        </span>
      </div>

      {error && (
        <p className="text-[12px] text-red-400 text-center px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">{error}</p>
      )}
    </div>
  );
}
