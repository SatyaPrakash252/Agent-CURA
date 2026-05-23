'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { SpeakerSegment } from '../../types';

interface LiveTranscriptProps {
  segments: SpeakerSegment[];
  onEdit?: (index: number, newText: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function LiveTranscript({ segments, onEdit }: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments]);

  const handleStartEdit = (index: number, text: string) => {
    if (!onEdit) return;
    setEditingIndex(index);
    setEditText(text);
  };

  const handleCommitEdit = () => {
    if (editingIndex !== null && onEdit) {
      onEdit(editingIndex, editText);
    }
    setEditingIndex(null);
    setEditText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitEdit();
    }
    if (e.key === 'Escape') {
      setEditingIndex(null);
      setEditText('');
    }
  };

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] px-4">
        <div className="w-10 h-10 rounded-lg bg-[#111113] border border-white/[0.06] flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </div>
        <p className="text-[12px] text-[#555]">Waiting for audio…</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto space-y-1 pr-1">
      {segments.map((seg, i) => {
        const isDoctor = seg.speaker === 'Doctor';
        const isEditing = editingIndex === i;

        return (
          <div
            key={i}
            className="group flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-[#161618] transition-colors duration-150"
          >
            {/* Speaker label */}
            <div className="flex-shrink-0 pt-px">
              <span
                className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-medium tracking-wide uppercase ${
                  isDoctor
                    ? 'bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20'
                    : 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                }`}
              >
                {seg.speaker}
              </span>
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={handleCommitEdit}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className="w-full bg-[#111113] border border-white/[0.06] rounded-md px-2 py-1 text-[12px] text-white outline-none focus:border-[#6366f1]/40 transition-colors duration-150"
                />
              ) : (
                <p
                  className={`text-[12px] text-white leading-relaxed ${
                    onEdit ? 'cursor-text' : ''
                  }`}
                  onClick={() => handleStartEdit(i, seg.text)}
                >
                  {seg.text}
                </p>
              )}
              <span className="text-[10px] text-[#444] font-mono mt-0.5 block">
                {formatTime(seg.start_time)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
