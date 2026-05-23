'use client';
import React from 'react';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  label: string;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

const styles = {
  success: 'pill-success',
  warning: 'pill-warning',
  danger: 'pill-danger',
  info: 'pill-accent',
  neutral: 'bg-white/[0.04] text-[#a1a1aa] border border-white/[0.06]',
};

export default function Badge({ variant = 'info', label, size = 'md', pulse }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md font-medium ${styles[variant]} ${size === 'sm' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]'}`}>
      {pulse && <span className="w-1 h-1 rounded-full bg-current animate-pulse" />}
      {label}
    </span>
  );
}
