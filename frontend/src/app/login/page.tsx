'use client';

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  
  // Fields for both
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Fields for signup
  const [fullName, setFullName] = useState('');
  const [expertise, setExpertise] = useState('General Medicine');
  const [credentials, setCredentials] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'login') {
      if (!username.trim() || !password.trim()) {
        setError('Please enter both username and password');
        return;
      }
      setLoading(true);
      const err = await login(username, password);
      if (err) {
        setError(err);
      }
      setLoading(false);
    } else {
      if (!fullName.trim() || !username.trim() || !password.trim() || !credentials.trim()) {
        setError('Please fill in all details including license credentials');
        return;
      }
      setLoading(true);
      const err = await signup(username, password, fullName, expertise, credentials);
      if (err) {
        setError(err);
      } else {
        setSuccess('Doctor profile registered and verified successfully!');
        setTimeout(() => {
          setMode('login');
          setSuccess('');
        }, 1500);
      }
      setLoading(false);
    }
  };

  const specialties = [
    'General Medicine',
    'Cardiology',
    'Pediatrics',
    'Internal Medicine',
    'Family Medicine',
    'Neurology',
    'Orthopedics',
    'Dermatology',
    'Emergency Medicine',
    'Other Specialty'
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo and Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] mb-4 shadow-xl shadow-[#6366f1]/20">
            <span className="text-3xl">🛡️</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Project Cura</h1>
          <p className="text-[13px] text-[#52525b] mt-1.5">Agentic Clinical Documentation OS</p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="surface p-8 space-y-5 rounded-2xl border border-[#27272a]/40 bg-[#09090b]/50 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-[#27272a]/60 pb-3 mb-2">
              <h2 className="text-[15px] font-semibold text-white">
                {mode === 'login' ? 'Doctor Sign In' : 'Register New Doctor'}
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                Secure Portal
              </span>
            </div>

            {mode === 'signup' && (
              <>
                <div>
                  <label className="label mb-1.5 block">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Sarah Jenkins, MD"
                    className="input w-full"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label mb-1.5 block">Medical Specialty</label>
                    <select
                      value={expertise}
                      onChange={(e) => setExpertise(e.target.value)}
                      className="input w-full bg-[#09090b] text-white border-[#27272a] focus:border-[#6366f1]"
                    >
                      {specialties.map((spec) => (
                        <option key={spec} value={spec} className="bg-[#09090b]">
                          {spec}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label mb-1.5 block">License / NPI Number</label>
                    <input
                      type="text"
                      value={credentials}
                      onChange={(e) => setCredentials(e.target.value)}
                      placeholder="e.g. NPI-8749204"
                      className="input w-full"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="label mb-1.5 block">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="doctor_username"
                autoComplete="username"
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="label mb-1.5 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="input w-full"
                required
              />
            </div>

            {error && (
              <div className="px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-[12px] text-red-400">{error}</p>
              </div>
            )}

            {success && (
              <div className="px-3.5 py-2.5 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20">
                <p className="text-[12px] text-[#10b981]">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#5558e6] hover:to-[#7c4ee6] text-white text-[13px] font-medium transition-all duration-150 shadow-lg shadow-[#6366f1]/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying Credentials…
                </span>
              ) : (
                mode === 'login' ? 'Sign in' : 'Verify & Register Doctor Profile'
              )}
            </button>
          </div>

          {/* Toggle Modes and Fallbacks */}
          <div className="flex flex-col items-center space-y-3 mt-4 text-[12px]">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
                setSuccess('');
              }}
              className="text-[#6366f1] hover:text-[#8b5cf6] font-medium transition-colors duration-150"
            >
              {mode === 'login' 
                ? "Are you a new doctor? Create your credentialed profile" 
                : "Already have a verified account? Sign In"}
            </button>

            {mode === 'login' && (
              <p className="text-[#3f3f46] text-[11px]">
                Default Administrator fallback: <code className="text-[#52525b] bg-[#18181b] px-1.5 py-0.5 rounded">admin</code> / <code className="text-[#52525b] bg-[#18181b] px-1.5 py-0.5 rounded">admin123</code>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
