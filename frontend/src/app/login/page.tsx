'use client';

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError('');
    const err = await login(username, password);
    if (err) {
      setError(err);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] mb-4 shadow-lg shadow-[#6366f1]/20">
            <span className="text-2xl">🛡️</span>
          </div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Project Cura</h1>
          <p className="text-[12px] text-[#52525b] mt-1">Agentic Clinical Documentation OS</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="surface p-6 space-y-4">
            <div>
              <label className="label mb-1.5 block">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                autoFocus
                className="input w-full"
              />
            </div>

            <div>
              <label className="label mb-1.5 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="input w-full"
              />
            </div>

            {error && (
              <div className="px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20">
                <p className="text-[11px] text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-md bg-[#6366f1] hover:bg-[#5558e6] text-white text-[13px] font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          <p className="text-center text-[10px] text-[#3f3f46]">
            Default credentials: admin / admin123
          </p>
        </form>
      </div>
    </div>
  );
}
