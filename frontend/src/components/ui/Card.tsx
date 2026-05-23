"use client";
import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  id?: string;
  onClick?: () => void;
  glowColor?: string;
}

const pad = { none: "", sm: "p-3", md: "p-4", lg: "p-6" };

export default function Card({ children, className = "", hoverable, padding = "md", id, onClick, glowColor }: CardProps) {
  return (
    <div
      id={id}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`
        rounded-lg bg-[#111113] border border-white/[0.06]
        ${pad[padding]}
        ${hoverable ? 'cursor-pointer transition-colors duration-150 hover:bg-[#161618] hover:border-white/[0.1]' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
