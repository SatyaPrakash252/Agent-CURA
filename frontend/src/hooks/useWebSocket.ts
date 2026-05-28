'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { WS_BASE_URL } from '../lib/constants';
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

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    updateStatus('connecting');

    try {
      const url = language
        ? `${WS_BASE_URL}/ws/v1/audio/${sessionId}?language=${encodeURIComponent(language)}`
        : `${WS_BASE_URL}/ws/v1/audio/${sessionId}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        updateStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

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
