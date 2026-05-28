'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import AudioRecorder from '../../components/consultation/AudioRecorder';
import LiveTranscript from '../../components/consultation/LiveTranscript';
import SpeakerLabels from '../../components/consultation/SpeakerLabels';
import SOAPNote from '../../components/clinical/SOAPNote';
import BillingCodes from '../../components/clinical/BillingCodes';
import FHIRActions from '../../components/clinical/FHIRActions';
import SafetyAlerts from '../../components/clinical/SafetyAlerts';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import { ToastContainer } from '../../components/ui/Toast';
import { API_V1 } from '../../lib/constants';
import { useToast } from '../../hooks/useToast';
import { generateReport } from '../../lib/generateReport';
import type { SpeakerSegment, TranscriptChunk, ConsultationResult } from '../../types';

type View = 'record' | 'results';

function genPatientId() {
  return `PAT-${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function ConsultationPage() {
  const [patientId, setPatientId] = useState(() => genPatientId());
  const [sessionId, setSessionId] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [segments, setSegments] = useState<SpeakerSegment[]>([]);
  const [result, setResult] = useState<ConsultationResult | null>(null);
  const [view, setView] = useState<View>('record');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const segmentCounterRef = useRef(0);
  const { toasts, dismissToast, success: toastSuccess, error: toastError } = useToast();

  // Patient Registration Details Mode & Fields
  const [patientMode, setPatientMode] = useState<'select' | 'new'>('new');
  const [existingPatients, setExistingPatients] = useState<any[]>([]);
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('Unknown');
  const [patientContact, setPatientContact] = useState('');
  const [patientNotes, setPatientNotes] = useState('');
  const [activeLanguage, setActiveLanguage] = useState('auto');
  const [activeSpeaker, setActiveSpeaker] = useState<'auto' | 'Doctor' | 'Patient'>('auto');

  const fetchExistingPatients = async () => {
    try {
      const token = localStorage.getItem('cura_token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_V1}/patients?limit=100`, { headers });
      if (res.ok) {
        setExistingPatients(await res.json());
      }
    } catch (err) {
      console.error('Failed to load patients list:', err);
    }
  };

  useEffect(() => {
    fetchExistingPatients();
  }, []);

  const genSessionId = () => `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Called by AudioRecorder when WebSocket delivers a transcript chunk
  const handleTranscriptChunk = useCallback((chunk: TranscriptChunk) => {
    let resolvedSpeaker = chunk.speaker || 'Doctor';
    if (activeSpeaker !== 'auto') {
      resolvedSpeaker = activeSpeaker;
    }

    const newSeg: SpeakerSegment = {
      speaker: resolvedSpeaker,
      text: chunk.text,
      start_time: chunk.timestamp,
      end_time: chunk.timestamp + 1,
      is_final: chunk.is_final,
    };

    if (chunk.is_final) {
      // Final result: replace the last interim segment (if any) with the final version
      segmentCounterRef.current += 1;
      setSegments((prev) => {
        // If the last segment was interim (not final), replace it
        if (prev.length > 0 && !prev[prev.length - 1].is_final) {
          return [...prev.slice(0, -1), newSeg];
        }
        // Otherwise just append
        return [...prev, newSeg];
      });
    } else {
      // Interim result: update the last segment in-place for instant visual feedback
      setSegments((prev) => {
        if (prev.length > 0 && !prev[prev.length - 1].is_final) {
          // Replace the last interim segment with the updated interim
          return [...prev.slice(0, -1), newSeg];
        }
        // First interim for a new utterance — append it
        return [...prev, newSeg];
      });
    }
  }, [activeSpeaker]);

  const handleStart = () => {
    const sid = genSessionId();
    setSessionId(sid);
    setIsRecording(true);
    // If starting a brand new consultation after a previous finalized one,
    // clear the segments and generate a new Patient ID automatically if in 'new' mode.
    if (result) {
      setSegments([]);
      if (patientMode === 'new') {
        setPatientId(genPatientId());
        setPatientName('');
        setPatientAge('');
        setPatientGender('Unknown');
        setPatientContact('');
        setPatientNotes('');
      }
    }
    setResult(null);
    setView('record');
    segmentCounterRef.current = 0;
  };

  const handleStop = () => {
    setIsRecording(false);
  };

  const handleClear = () => {
    setIsRecording(false);
    setSegments([]);
    setResult(null);
    setSessionId('');
    if (patientMode === 'new') {
      setPatientId(genPatientId());
      setPatientName('');
      setPatientAge('');
      setPatientGender('Unknown');
      setPatientContact('');
      setPatientNotes('');
    }
    setView('record');
    segmentCounterRef.current = 0;
  };

  const handleEditTranscript = (index: number, newText: string) => {
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, text: newText } : s)));
  };

  const handleToggleSpeaker = (index: number) => {
    setSegments((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, speaker: s.speaker === 'Doctor' ? 'Patient' : 'Doctor' }
          : s
      )
    );
  };

  const handleSwapAllSpeakers = () => {
    setSegments((prev) =>
      prev.map((s) => ({
        ...s,
        speaker: s.speaker === 'Doctor' ? 'Patient' : 'Doctor',
      }))
    );
    toastSuccess('Swapped all speakers (Doctor ↔ Patient)!');
  };

  const handleFinalize = async () => {
    if (segments.length === 0) {
      toastError('Cannot finalize: No transcription segments captured yet.');
      return;
    }

    // Client-side intake form validation
    if (patientMode === 'new') {
      if (!patientName.trim()) {
        toastError("Please enter the patient's Full Name before finalizing.");
        return;
      }
      if (!patientId.trim()) {
        toastError('Please provide a valid Patient ID.');
        return;
      }
      if (patientAge && (isNaN(parseInt(patientAge)) || parseInt(patientAge) <= 0)) {
        toastError('Please enter a valid age greater than 0.');
        return;
      }
    } else {
      if (!patientId || patientId === '') {
        toastError('Please choose a registered patient context before finalizing.');
        return;
      }
    }

    setIsProcessing(true);
    setView('results');
    setProcessingStage('Scribe');


    try {
      const transcript = segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');
      const finalSessionId = sessionId || genSessionId();

      // Simulate stage progression
      const stageTimer = setInterval(() => {
        setProcessingStage((prev) => {
          if (prev === 'Scribe') return 'Auditor';
          if (prev === 'Auditor') return 'Billing';
          return prev;
        });
      }, 3000);

      const token = localStorage.getItem('cura_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_V1}/consultation/finalize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session_id: finalSessionId,
          patient_id: patientId,
          transcript,
          speaker_segments: segments,
          patient_name: patientMode === 'new' ? patientName : undefined,
          patient_age: patientMode === 'new' && patientAge ? parseInt(patientAge) : undefined,
          patient_gender: patientMode === 'new' ? patientGender : undefined,
          patient_contact: patientMode === 'new' ? patientContact : undefined,
          patient_notes: patientMode === 'new' ? patientNotes : undefined,
        }),
      });

      clearInterval(stageTimer);

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        toastSuccess('Consultation finalized successfully!');
        // Refresh local listings
        fetchExistingPatients();
      } else {
        const errorText = await res.text();
        console.error('Finalize error:', res.status, errorText);
        toastError(`Finalization failed: ${res.status === 401 ? 'Authentication required' : 'Server error. Please try again.'}`);
      }
    } catch (err) {
      console.error('Finalize network error:', err);
      toastError('Network error. Is the backend running?');
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      await generateReport({
        patientId,
        sessionId: sessionId || 'SESSION',
        date: new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
        segments,
        result,
      });
    } catch (err) { console.error('PDF error:', err); }
    finally { setPdfLoading(false); }
  };

  return (
    <div className="animate-in">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-5">
        <button onClick={() => setView('record')}
          className={`px-3 py-1.5 rounded-md text-[13.5px] font-medium transition-colors duration-150 ${
            view === 'record' ? 'bg-white/[0.07] text-white' : 'text-[#71717a] hover:text-white hover:bg-white/[0.03]'}`}>
          Recording
        </button>
        <button onClick={() => setView('results')}
          className={`px-3 py-1.5 rounded-md text-[13.5px] font-medium transition-colors duration-150 ${
            view === 'results' ? 'bg-white/[0.07] text-white' : 'text-[#71717a] hover:text-white hover:bg-white/[0.03]'}`}>
          Results {result && <span className="ml-1 text-[11.5px] text-[#34d399]">●</span>}
        </button>
        <div className="flex-1" />
        {segments.length > 0 && (
          <span className="text-[12px] text-[#52525b] font-mono mr-3">{segments.length} segments</span>
        )}
        {view === 'results' && result && (
          <Button variant="primary" size="sm" onClick={handleDownloadPdf} disabled={pdfLoading}>
            {pdfLoading ? 'Generating…' : '↓ Download PDF Report'}
          </Button>
        )}
      </div>

      {/* ── RECORDING VIEW ── */}
      {view === 'record' && (
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Patient Selection & Registration Form */}
          <div className="surface p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <span className="text-[12.5px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Patient Information</span>
              <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => { setPatientMode('new'); setPatientId(genPatientId()); }}
                  disabled={isRecording}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all duration-150 ${
                    patientMode === 'new' ? 'bg-[#6366f1] text-white shadow-sm' : 'text-[#71717a] hover:text-white'
                  }`}
                >
                  New Patient
                </button>
                <button
                  type="button"
                  onClick={() => { setPatientMode('select'); fetchExistingPatients(); }}
                  disabled={isRecording}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all duration-150 ${
                    patientMode === 'select' ? 'bg-[#6366f1] text-white shadow-sm' : 'text-[#71717a] hover:text-white'
                  }`}
                >
                  Choose Registered
                </button>
              </div>
            </div>

            {patientMode === 'select' ? (
              <div className="space-y-1.5 animate-in">
                <label className="text-[11.5px] text-[var(--text-muted)] font-bold uppercase tracking-wider block">Select Active Patient Context</label>
                {existingPatients.length === 0 ? (
                  <p className="text-[12.5px] text-[var(--text-muted)] py-1.5">No patients registered in database. Toggle "New Patient" above.</p>
                ) : (
                  <select
                    value={patientId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setPatientId(pid);
                      const matched = existingPatients.find(p => p.patient_id === pid);
                      if (matched) {
                        toastSuccess(`Loaded context for ${matched.name || pid}`);
                      }
                    }}
                    disabled={isRecording}
                    className="input w-full block bg-[var(--bg-base)] border-[var(--border)]"
                  >
                    <option value="">-- Choose patient record --</option>
                    {existingPatients.map((p) => (
                      <option key={p.patient_id} value={p.patient_id}>
                        {p.patient_id} &bull; {p.name || 'Anonymous'} &bull; {p.gender || 'Unknown'} ({p.age ? `${p.age} yrs` : 'Age N/A'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="space-y-3.5 animate-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider block mb-1">Patient ID *</label>
                    <input
                      type="text"
                      value={patientId}
                      onChange={(e) => setPatientId(e.target.value)}
                      disabled={isRecording}
                      className="input w-full bg-[var(--bg-base)]"
                      placeholder="PAT-XXXX"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider block mb-1">Full Name</label>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      disabled={isRecording}
                      className="input w-full bg-[var(--bg-base)]"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider block mb-1">Age</label>
                    <input
                      type="number"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                      disabled={isRecording}
                      className="input w-full bg-[var(--bg-base)]"
                      placeholder="35"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider block mb-1">Gender</label>
                    <select
                      value={patientGender}
                      onChange={(e) => setPatientGender(e.target.value)}
                      disabled={isRecording}
                      className="input w-full bg-[var(--bg-base)]"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider block mb-1">Contact Details</label>
                    <input
                      type="text"
                      value={patientContact}
                      onChange={(e) => setPatientContact(e.target.value)}
                      disabled={isRecording}
                      className="input w-full bg-[var(--bg-base)]"
                      placeholder="Phone or email"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider block mb-1">Clinical Intake Notes</label>
                  <textarea
                    value={patientNotes}
                    onChange={(e) => setPatientNotes(e.target.value)}
                    disabled={isRecording}
                    className="input w-full h-14 min-h-[50px] max-h-[100px] resize-y py-2 bg-[var(--bg-base)]"
                    placeholder="Enter basic medical complaints, symptoms, or past history..."
                  />
                </div>
              </div>
            )}

            {sessionId && (
              <div className="flex items-center justify-between text-[10.5px] text-[#52525b] font-mono border-t border-white/[0.03] pt-3 mt-1">
                <span>Intake Target: <span className="text-indigo-400 font-semibold">{patientId}</span></span>
                <span>Active Session: <span className="text-[var(--text-secondary)]">{sessionId.slice(0, 20)}…</span></span>
              </div>
            )}
          </div>

          {/* Audio Recorder — REAL: connects to WebSocket, streams PCM to backend */}
          <div className="surface p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <div>
                <span className="text-[12.5px] text-[var(--text-muted)] font-bold uppercase tracking-wider block">Live Capture</span>
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5 block">Record doctor-patient clinical session</span>
              </div>
              
              {/* Force Language Selection Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] text-[#71717a] font-medium hidden sm:inline">Locale:</span>
                <select
                  value={activeLanguage}
                  onChange={(e) => setActiveLanguage(e.target.value)}
                  disabled={isRecording}
                  className="input px-2.5 py-1 text-[11.5px] bg-white/[0.03] border border-white/[0.06] rounded-md focus:border-[#6366f1] transition-all cursor-pointer font-medium text-white max-w-[130px]"
                >
                  <option value="auto">🌐 Auto-Detect</option>
                  <option value="en">🇺🇸 English</option>
                  <option value="hi">🇮🇳 Hindi (हिन्दी)</option>
                  <option value="es">🇪🇸 Spanish</option>
                </select>
              </div>
            </div>

            <AudioRecorder
              sessionId={sessionId || 'pending'}
              patientId={patientId}
              onTranscriptChunk={handleTranscriptChunk}
              isRecording={isRecording}
              onToggleRecording={() => (isRecording ? handleStop() : handleStart())}
              language={activeLanguage}
            />

            {/* Active Speaker Override Toggle */}
            {isRecording && (
              <div className="flex flex-col items-center gap-2 mt-4 pt-4 border-t border-white/[0.03] animate-in">
                <span className="text-[10px] font-mono text-[var(--text-muted)] font-bold uppercase tracking-wider">Active Speaker Override</span>
                <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setActiveSpeaker('auto')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 flex items-center gap-1.5 ${
                      activeSpeaker === 'auto'
                        ? 'bg-[#6366f1] text-white shadow-md'
                        : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.02]'
                    }`}
                  >
                    🤖 Auto-Detect
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSpeaker('Doctor')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 flex items-center gap-1.5 ${
                      activeSpeaker === 'Doctor'
                        ? 'bg-[#6366f1] text-white shadow-md'
                        : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.02]'
                    }`}
                  >
                    👨‍⚕️ Force Doctor
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSpeaker('Patient')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 flex items-center gap-1.5 ${
                      activeSpeaker === 'Patient'
                        ? 'bg-emerald-500 text-white shadow-md'
                        : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.02]'
                    }`}
                  >
                    🤒 Force Patient
                  </button>
                </div>
              </div>
            )}
          </div>          {/* Speaker Labels */}
          {segments.length > 0 && <SpeakerLabels segments={segments} />}

          {/* Live Transcript — shows real-time text from Deepgram */}
          {(segments.length > 0 || isRecording) && (
            <div className="surface p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="label">Live Transcript</h3>
                  {segments.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSwapAllSpeakers}
                      className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.1] text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.1] transition-all flex items-center gap-1 font-semibold select-none"
                      title="Swap Doctor and Patient speakers for all segments"
                    >
                      🔁 Swap Speakers
                    </button>
                  )}
                </div>
                <span className="text-[11.5px] text-[#52525b] font-mono">{segments.length} segments</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <LiveTranscript 
                  segments={segments} 
                  onEdit={handleEditTranscript} 
                  onToggleSpeaker={handleToggleSpeaker} 
                />
              </div>
            </div>
          )}

          {/* Empty state */}
          {segments.length === 0 && !isRecording && (
            <div className="surface p-8 text-center">
              <svg className="w-8 h-8 mx-auto mb-3 text-[#3f3f46]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
              <p className="text-[14.5px] text-[#71717a] font-medium">Ready to record</p>
              <p className="text-[12.5px] text-[#52525b] mt-1">Click the microphone button to start capturing audio.<br/>Audio is streamed in real-time to Deepgram for instant transcription.</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2 surface px-4 py-2.5">
            {!isRecording ? (
              <Button variant="primary" size="sm" onClick={handleStart} disabled={isProcessing}>
                <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
                Start recording
              </Button>
            ) : (
              <Button variant="danger" size="sm" onClick={handleStop}>
                <div className="w-2.5 h-2.5 rounded-sm bg-current mr-1" />
                Stop
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="primary" size="sm" onClick={handleFinalize}
              disabled={segments.length === 0 || isRecording || isProcessing}>
              {isProcessing ? 'Processing…' : 'Finalize →'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClear}
              disabled={isRecording || isProcessing}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* ── RESULTS VIEW ── */}
      {view === 'results' && (
        <div className="space-y-4 max-w-4xl mx-auto pb-8">
          {isProcessing && (
            <div className="surface p-8 text-center">
              <Loader variant="ring" text="AI agents processing consultation…" />
              <div className="flex justify-center gap-5 mt-4">
                {['Scribe', 'Auditor', 'Billing'].map((stage) => (
                  <span key={stage} className={`text-[12px] font-medium transition-colors duration-300 ${
                    processingStage === stage ? 'text-[#6366f1] animate-pulse' : 'text-[#3f3f46]'
                  }`}>{stage}</span>
                ))}
              </div>
              <p className="text-[11.5px] text-[#52525b] mt-3 font-mono">
                Transcript → Groq LLM → SOAP Note → Clinical Audit → Billing Codes → FHIR Bundle
              </p>
            </div>
          )}

          {!isProcessing && !result && (
            <div className="surface p-8 text-center">
              <p className="text-[14.5px] text-[#71717a]">No results yet. Record a consultation and click Finalize.</p>
              <button onClick={() => setView('record')} className="text-[13.5px] text-[#6366f1] hover:text-[#818cf8] font-medium mt-2 transition-colors">
                ← Go to recording
              </button>
            </div>
          )}

          {result && (
            <>
              {/* Summary bar */}
              <div className="surface px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-[13.5px] text-[#a1a1aa]">Patient: <span className="text-white font-medium">{patientId}</span></span>
                  <span className="text-[13.5px] text-[#a1a1aa]">Segments: <span className="text-white font-medium">{segments.length}</span></span>
                  <span className="text-[13.5px] text-[#a1a1aa]">Confidence: <span className="text-[#34d399] font-medium">{result.confidence_score}%</span></span>
                </div>
                <button onClick={() => setView('record')} className="text-[12.5px] text-[#6366f1] hover:text-[#818cf8] font-medium transition-colors">
                  ← Back to recording
                </button>
              </div>

              <SOAPNote soap={result.soap} confidenceScore={result.confidence_score} isLoading={false} />
              <SafetyAlerts flags={result.safety_flags || []} />
              <BillingCodes codes={result.billing_codes || []} />
              <FHIRActions sessionId={sessionId} intents={result.intents || []} fhirBundle={result.fhir_bundle} />

              {/* PDF Download */}
              <div className="surface p-5 flex items-center justify-between">
                <div>
                  <p className="text-[14.5px] font-medium text-white">Clinical Report</p>
                  <p className="text-[12.5px] text-[#71717a] mt-0.5">Download complete consultation report with diagnosis, prescription & billing</p>
                </div>
                <Button variant="primary" size="md" onClick={handleDownloadPdf} disabled={pdfLoading}>
                  {pdfLoading ? 'Generating…' : '↓ Download PDF'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
