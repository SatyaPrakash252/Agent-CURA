import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        cura: {
          bg: "#0a1628",
          surface: "#111d32",
          "surface-hover": "#1a2940",
          border: "#1e3a5f",
          primary: "#00d4ff",
          "primary-glow": "rgba(0, 212, 255, 0.15)",
          success: "#10b981",
          warning: "#f59e0b",
          danger: "#ef4444",
          "text-primary": "#e2e8f0",
          "text-secondary": "#94a3b8",
          "text-muted": "#64748b",
          doctor: "#00d4ff",
          patient: "#f59e0b",
        },
      },
      animation: {
        fadeIn: "fadeIn 0.5s ease-out forwards",
        slideUp: "slideUp 0.4s ease-out forwards",
        slideRight: "slideRight 0.3s ease-out forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
        "bounce-stagger-1": "bounceStagger 1.4s ease-in-out infinite",
        "bounce-stagger-2": "bounceStagger 1.4s ease-in-out 0.2s infinite",
        "bounce-stagger-3": "bounceStagger 1.4s ease-in-out 0.4s infinite",
        "waveform-1": "waveform 0.6s ease-in-out infinite alternate",
        "waveform-2": "waveform 0.6s ease-in-out 0.1s infinite alternate",
        "waveform-3": "waveform 0.6s ease-in-out 0.2s infinite alternate",
        "waveform-4": "waveform 0.6s ease-in-out 0.3s infinite alternate",
        "waveform-5": "waveform 0.6s ease-in-out 0.4s infinite alternate",
        "slide-in-modal": "slideInModal 0.3s ease-out forwards",
        "pulse-ring": "pulseRing 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "critical-flash": "criticalFlash 1s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideRight: {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-glow": {
          "0%, 100%": {
            boxShadow: "0 0 5px rgba(0, 212, 255, 0.2), 0 0 20px rgba(0, 212, 255, 0.1)",
          },
          "50%": {
            boxShadow: "0 0 20px rgba(0, 212, 255, 0.4), 0 0 40px rgba(0, 212, 255, 0.2)",
          },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        bounceStagger: {
          "0%, 80%, 100%": { transform: "scale(0)" },
          "40%": { transform: "scale(1)" },
        },
        waveform: {
          "0%": { height: "8px" },
          "100%": { height: "32px" },
        },
        slideInModal: {
          "0%": { opacity: "0", transform: "translateY(16px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pulseRing: {
          "0%": { transform: "scale(1)", opacity: "0.8" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        criticalFlash: {
          "0%, 100%": { borderColor: "rgba(239, 68, 68, 0.3)" },
          "50%": { borderColor: "rgba(239, 68, 68, 0.8)" },
        },
      },
      backdropBlur: {
        xs: "2px",
        "2xl": "40px",
        "3xl": "64px",
      },
      boxShadow: {
        glow: "0 0 15px rgba(0, 212, 255, 0.3), 0 0 45px rgba(0, 212, 255, 0.1)",
        "glow-sm": "0 0 8px rgba(0, 212, 255, 0.2)",
        "glow-lg": "0 0 30px rgba(0, 212, 255, 0.4), 0 0 60px rgba(0, 212, 255, 0.15)",
        "glow-success": "0 0 15px rgba(16, 185, 129, 0.3)",
        "glow-warning": "0 0 15px rgba(245, 158, 11, 0.3)",
        "glow-danger": "0 0 15px rgba(239, 68, 68, 0.3)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        "card-hover": "0 12px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 212, 255, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
