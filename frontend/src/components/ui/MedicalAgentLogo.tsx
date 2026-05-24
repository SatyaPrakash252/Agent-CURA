'use client';

import React from 'react';

export default function MedicalAgentLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={`${className} animate-neural-pulse`} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Glow Effects and Gradients */}
      <defs>
        <radialGradient id="shieldGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
        <linearGradient id="brainGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      {/* Background Outer Glow */}
      <circle cx="100" cy="100" r="80" fill="url(#shieldGlow)" className="opacity-70" />

      {/* Premium Shield Base */}
      <path
        d="M100 25C130 25 165 35 165 70C165 120 125 160 100 175C75 160 35 120 35 70C35 35 70 25 100 25Z"
        stroke="url(#shieldGrad)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#09090b"
        fillOpacity="0.85"
        className="drop-shadow-lg"
      />

      {/* Cyber Grid Lines on Shield */}
      <path d="M100 25V175" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
      <path d="M35 70H165" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
      <path d="M45 105H155" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />

      {/* Neural AI Core Nodes and Circuits inside Shield */}
      <g className="animate-orbit" style={{ transformOrigin: '100px 95px' }}>
        {/* Connection Paths */}
        <path d="M75 90L100 70L125 90L100 115L75 90Z" stroke="url(#brainGrad)" strokeWidth="1.5" strokeOpacity="0.65" strokeDasharray="3 3" />
        <path d="M100 70V115" stroke="url(#brainGrad)" strokeWidth="1" strokeOpacity="0.4" />
        <path d="M75 90H125" stroke="url(#brainGrad)" strokeWidth="1" strokeOpacity="0.4" />

        {/* Outer Circular Circuit Ring */}
        <circle cx="100" cy="92" r="38" stroke="#6366f1" strokeWidth="1.2" strokeOpacity="0.25" strokeDasharray="4 4" />
        
        {/* Core Nodes */}
        <circle cx="100" cy="70" r="4.5" fill="#22d3ee" className="animate-pulse" />
        <circle cx="75" cy="90" r="4" fill="#10b981" />
        <circle cx="125" cy="90" r="4" fill="#10b981" />
        <circle cx="100" cy="115" r="4.5" fill="#8b5cf6" />
        
        {/* Additional circuit tracks */}
        <path d="M100 70L100 58" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M75 90L63 90" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M125 90L137 90" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Floating Sparkles representing active AI Agent */}
      <circle cx="65" cy="55" r="2" fill="#fff" className="animate-pulse" />
      <circle cx="135" cy="55" r="2.5" fill="#22d3ee" className="animate-pulse" />
      <circle cx="140" cy="135" r="2" fill="#8b5cf6" className="animate-pulse" />
      <circle cx="60" cy="130" r="1.5" fill="#10b981" className="animate-pulse" />
      
      {/* Dynamic Core Stethoscope/Heartbeat Pulse in center */}
      <path
        d="M84 92H93L97 81L102 105L106 89L110 92H118"
        stroke="url(#shieldGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
