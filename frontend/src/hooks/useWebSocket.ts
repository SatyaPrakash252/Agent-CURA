'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { WS_BASE_URL, API_BASE_URL } from '../lib/constants';
import type { TranscriptChunk } from '../types';

interface UseWebSocketOptions {
  sessionId: string;
  onTranscriptChunk: (chunk: TranscriptChunk) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
  language?: string;
}

type WSStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export function useWebSocket({ sessionId, onTranscriptChunk, onStatusChange, onError, language }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const [sttEngine, setSttEngine] = useState<string>('deepgram');
  const maxReconnectAttempts = 10; // Increased from 5 for long sessions
  const baseDelay = 1000; // 1 second

  const updateStatus = useCallback((newStatus: WSStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    updateStatus('connecting');

    try {
      // 1. Try to fetch a temporary direct Deepgram token from the backend
      let tempToken = "";
      try {
        const tokenResp = await fetch(`${API_BASE_URL}/api/v1/transcribe/token`);
        if (tokenResp.ok) {
          const tokenData = await tokenResp.json();
          tempToken = tokenData.token;
        }
      } catch (tokenErr) {
        console.warn("Could not fetch temporary Deepgram token from backend, falling back to proxy:", tokenErr);
      }

      let ws: WebSocket;

      if (tempToken) {
        // Direct Client-to-Deepgram Streaming (Industry Standard)
        console.log("Establishing DIRECT Client-to-Deepgram WebSocket connection...");
        const url = `wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=16000&channels=1&punctuate=true&interim_results=true&no_delay=true&endpointing=150&utterance_end_ms=1000&vad_events=true&diarize=true`;
        ws = new WebSocket(url, ["token", tempToken]);
        setSttEngine('deepgram');
      } else {
        // Fallback: Backend-proxied WebSocket Streaming
        console.log("Establishing backend-proxied WebSocket connection...");
        const url = language
          ? `${WS_BASE_URL}/ws/v1/audio/${sessionId}?language=${encodeURIComponent(language)}`
          : `${WS_BASE_URL}/ws/v1/audio/${sessionId}`;
        ws = new WebSocket(url);
      }
      
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        updateStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle Direct Deepgram responses
          if (data.channel && data.channel.alternatives) {
            const alt = data.channel.alternatives[0];
            const text = alt.transcript;
            if (text && text.trim().length > 0) {
              let speakerLabel = 'Doctor';
              const words = alt.words || [];
              if (words.length > 0) {
                const speakerCounts: Record<number, number> = {};
                for (const w of words) {
                  const spk = w.speaker ?? 0;
                  speakerCounts[spk] = (speakerCounts[spk] || 0) + 1;
                }
                let maxCount = 0;
                let activeSpeaker = 0;
                for (const spk in speakerCounts) {
                  const cnt = speakerCounts[spk];
                  if (cnt > maxCount) {
                    maxCount = cnt;
                    activeSpeaker = parseInt(spk);
                  }
                }
                speakerLabel = activeSpeaker === 0 ? 'Doctor' : 'Patient';
              }

              onTranscriptChunk({
                text: text,
                speaker: speakerLabel,
                timestamp: data.start || 0,
                is_final: data.is_final || false,
              });
            }
            return;
          }

          if (data.type === 'transcript' && data.data) {
            onTranscriptChunk({
              text: data.data.text,
              speaker: data.data.speaker || 'Unknown',
              timestamp: data.data.timestamp || 0,
              is_final: data.data.is_final || false,
            });
          } else if (data.type === 'ping') {
            // Respond to heartbeat
            try {
              ws.send(JSON.stringify({ type: 'pong', data: { ts: data.data?.ts } }));
            } catch {}
          } else if (data.type === 'status') {
            const statusData = data.data;
            if (statusData?.status === 'reconnecting') {
              // Backend is reconnecting to Deepgram — keep recording, it'll resume
              setSttEngine('reconnecting');
              onStatusChange?.('reconnecting_stt');
            } else if (statusData?.status === 'connected' && statusData?.stt_engine) {
              setSttEngine(statusData.stt_engine);
              onStatusChange?.('connected');
            } else if (statusData?.status === 'fallback') {
              setSttEngine(statusData.stt_engine || 'whisper');
              onStatusChange?.('connected');
            } else {
              onStatusChange?.(statusData?.status || 'unknown');
            }
          }
        } catch {}
      };

      ws.onclose = (event) => {
        wsRef.current = null;

        // Don't reconnect on normal closure
        if (event.code === 1000 || event.code === 1001) {
          updateStatus('disconnected');
          return;
        }

        // Auto-reconnect with exponential backoff (capped at 16s)
        if (reconnectAttemptRef.current < maxReconnectAttempts) {
          reconnectAttemptRef.current += 1;
          const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptRef.current - 1), 16000);
          updateStatus('reconnecting');

          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          updateStatus('disconnected');
          onError?.('WebSocket connection lost after multiple attempts. Please restart recording.');
        }
      };

      ws.onerror = () => {
        // Don't immediately surface transient errors — let onclose handle reconnection
      };
    } catch (err) {
      updateStatus('disconnected');
      onError?.('Failed to create WebSocket connection');
    }
  }, [sessionId, onTranscriptChunk, onStatusChange, onError, updateStatus, language]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = maxReconnectAttempts; // prevent reconnect
    if (wsRef.current) {
      wsRef.current.close(1000);
      wsRef.current = null;
    }
    updateStatus('disconnected');
  }, [updateStatus]);

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(audioData);
    }
  }, []);

  const sendControl = useCallback((action: string, extra?: Record<string, string>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'control',
        action,
        ...extra,
      }));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000);
      }
    };
  }, []);

  return {
    status,
    sttEngine,
    connect,
    disconnect,
    sendAudio,
    sendControl,
    isConnected: status === 'connected',
  };
}
