'use client';
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}

const sizes = { sm: 'h-7 px-3 text-[12px]', md: 'h-8 px-4 text-[13px]', lg: 'h-9 px-5 text-[13px]' };

const variants = {
  primary: 'bg-[#6366f1] text-white font-medium hover:bg-[#5558e6] active:bg-[#4f46e5] disabled:opacity-30',
  secondary: 'bg-white/[0.05] text-[#a1a1aa] border border-white/[0.08] hover:bg-white/[0.08] hover:text-white disabled:opacity-30',
  danger: 'bg-[#f87171]/10 text-[#f87171] border border-[#f87171]/20 hover:bg-[#f87171]/20 disabled:opacity-30',
  ghost: 'text-[#71717a] hover:text-white hover:bg-white/[0.04] disabled:opacity-30',
};

export default function Button({ children, variant = 'primary', size = 'md', onClick, disabled, type = 'button', className = '' }: ButtonProps) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md transition-colors duration-150 font-medium disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]} ${className}`}
    >{children}</button>
  );
}
