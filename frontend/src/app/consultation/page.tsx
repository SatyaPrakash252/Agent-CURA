'use client';

import React, { useState, useCallback, useRef } from 'react';
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


  const genSessionId = () => `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Called by AudioRecorder when WebSocket delivers a transcript chunk
  const handleTranscriptChunk = useCallback((chunk: TranscriptChunk) => {
    segmentCounterRef.current += 1;
    setSegments((prev) => [
      ...prev,
      {
        speaker: chunk.speaker || 'Doctor',
        text: chunk.text,
        start_time: chunk.timestamp,
        end_time: chunk.timestamp + 1,
      },
    ]);
  }, []);

  const handleStart = () => {
    const sid = genSessionId();
    setSessionId(sid);
    setIsRecording(true);
    // If starting a brand new consultation after a previous finalized one,
    // clear the segments and generate a new Patient ID automatically.
    if (result) {
      setSegments([]);
      setPatientId(genPatientId());
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
    setPatientId(genPatientId());
    setView('record');
    segmentCounterRef.current = 0;
  };

  const handleEditTranscript = (index: number, newText: string) => {
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, text: newText } : s)));
  };

  const handleFinalize = async () => {
    if (segments.length === 0) return;
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
        }),
      });

      clearInterval(stageTimer);

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        toastSuccess('Consultation finalized successfully!');
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
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors duration-150 ${
            view === 'record' ? 'bg-white/[0.07] text-white' : 'text-[#71717a] hover:text-white hover:bg-white/[0.03]'}`}>
          Recording
        </button>
        <button onClick={() => setView('results')}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors duration-150 ${
            view === 'results' ? 'bg-white/[0.07] text-white' : 'text-[#71717a] hover:text-white hover:bg-white/[0.03]'}`}>
          Results {result && <span className="ml-1 text-[10px] text-[#34d399]">●</span>}
        </button>
        <div className="flex-1" />
        {segments.length > 0 && (
          <span className="text-[10px] text-[#52525b] font-mono mr-3">{segments.length} segments</span>
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
          {/* Patient ID */}
          <div className="flex items-center gap-3 surface px-4 py-3">
            <label className="label whitespace-nowrap">Patient</label>
            <input type="text" value={patientId} onChange={(e) => setPatientId(e.target.value)} disabled={isRecording}
              className="input flex-1" placeholder="PAT-XXXX" />
            {sessionId && (
              <span className="text-[10px] text-[#52525b] font-mono truncate max-w-[140px]">{sessionId.slice(0, 20)}…</span>
            )}
          </div>

          {/* Audio Recorder — REAL: connects to WebSocket, streams PCM to backend */}
          <div className="surface p-5">
            <AudioRecorder
              sessionId={sessionId || 'pending'}
              onTranscriptChunk={handleTranscriptChunk}
              isRecording={isRecording}
              onToggleRecording={() => (isRecording ? handleStop() : handleStart())}
            />
          </div>

          {/* Speaker Labels */}
          {segments.length > 0 && <SpeakerLabels segments={segments} />}

          {/* Live Transcript — shows real-time text from Whisper */}
          {segments.length > 0 && (
            <div className="surface p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="label">Live Transcript</h3>
                <span className="text-[10px] text-[#52525b] font-mono">{segments.length} segments</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <LiveTranscript segments={segments} onEdit={handleEditTranscript} />
              </div>
            </div>
          )}

          {/* Empty state */}
          {segments.length === 0 && !isRecording && (
            <div className="surface p-8 text-center">
              <svg className="w-8 h-8 mx-auto mb-3 text-[#3f3f46]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
              <p className="text-[13px] text-[#71717a] font-medium">Ready to record</p>
              <p className="text-[11px] text-[#52525b] mt-1">Click the microphone button to start capturing audio.<br/>Audio is streamed in real-time to Whisper for transcription.</p>
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
                  <span key={stage} className={`text-[10px] font-medium transition-colors duration-300 ${
                    processingStage === stage ? 'text-[#6366f1] animate-pulse' : 'text-[#3f3f46]'
                  }`}>{stage}</span>
                ))}
              </div>
              <p className="text-[10px] text-[#52525b] mt-3 font-mono">
                Transcript → Groq LLM → SOAP Note → Clinical Audit → Billing Codes → FHIR Bundle
              </p>
            </div>
          )}

          {!isProcessing && !result && (
            <div className="surface p-8 text-center">
              <p className="text-[13px] text-[#71717a]">No results yet. Record a consultation and click Finalize.</p>
              <button onClick={() => setView('record')} className="text-[12px] text-[#6366f1] hover:text-[#818cf8] font-medium mt-2 transition-colors">
                ← Go to recording
              </button>
            </div>
          )}

          {result && (
            <>
              {/* Summary bar */}
              <div className="surface px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-[12px] text-[#a1a1aa]">Patient: <span className="text-white font-medium">{patientId}</span></span>
                  <span className="text-[12px] text-[#a1a1aa]">Segments: <span className="text-white font-medium">{segments.length}</span></span>
                  <span className="text-[12px] text-[#a1a1aa]">Confidence: <span className="text-[#34d399] font-medium">{result.confidence_score}%</span></span>
                </div>
                <button onClick={() => setView('record')} className="text-[11px] text-[#6366f1] hover:text-[#818cf8] font-medium transition-colors">
                  ← Back to recording
                </button>
              </div>

              <SOAPNote soap={result.soap} confidenceScore={result.confidence_score} isLoading={false} />
              <SafetyAlerts flags={result.safety_flags || []} />
              <BillingCodes codes={result.billing_codes || []} />
              <FHIRActions intents={result.intents || []} fhirBundle={result.fhir_bundle} />

              {/* PDF Download */}
              <div className="surface p-5 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-white">Clinical Report</p>
                  <p className="text-[11px] text-[#71717a] mt-0.5">Download complete consultation report with diagnosis, prescription & billing</p>
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
