'use client';

import React from 'react';
import type { SpeakerSegment } from '../../types';

interface SpeakerLabelsProps {
  segments: SpeakerSegment[];
}

export default function SpeakerLabels({ segments }: SpeakerLabelsProps) {
  if (segments.length === 0) return null;

  // Collect unique speakers with segment counts
  const speakerCounts = segments.reduce<Record<string, number>>((acc, seg) => {
    acc[seg.speaker] = (acc[seg.speaker] || 0) + 1;
    return acc;
  }, {});

  const speakers = Object.entries(speakerCounts);

  const getColor = (speaker: string) => {
    if (speaker === 'Doctor') {
      return {
        bg: 'bg-[#6366f1]/10',
        text: 'text-[#6366f1]',
        border: 'border-[#6366f1]/20',
        dot: 'bg-[#6366f1]',
      };
    }
    return {
      bg: 'bg-emerald-400/10',
      text: 'text-emerald-400',
      border: 'border-emerald-400/20',
      dot: 'bg-emerald-400',
    };
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {speakers.map(([speaker, count]) => {
        const c = getColor(speaker);
        return (
          <div
            key={speaker}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${c.bg} ${c.border} transition-colors duration-150`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
            <span className={`text-[11px] font-medium ${c.text}`}>
              {speaker}
            </span>
            <span className="text-[10px] text-[#555]">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
