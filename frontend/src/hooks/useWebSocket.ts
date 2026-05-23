"use client";

/* ===========================================
   Project Cura – WebSocket Hook
   Audio streaming + transcript receiving
   =========================================== */

import { useState, useRef, useCallback, useEffect } from "react";
import { WS_BASE_URL } from "@/lib/constants";
import type { ConnectionStatus, TranscriptChunk } from "@/types";

interface UseWebSocketOptions {
  sessionId: string | null;
  onTranscript?: (chunk: TranscriptChunk) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  status: ConnectionStatus;
  connect: () => void;
  disconnect: () => void;
  sendAudio: (data: ArrayBuffer) => void;
  sendControl: (action: "pause" | "resume" | "stop") => void;
  lastMessage: TranscriptChunk | null;
}

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;

export function useWebSocket({
  sessionId,
  onTranscript,
  onError,
  onStatusChange,
  autoConnect = false,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>("closed");
  const [lastMessage, setLastMessage] = useState<TranscriptChunk | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef(sessionId);
  const callbacksRef = useRef({ onTranscript, onError, onStatusChange });

  // Keep refs up to date
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    callbacksRef.current = { onTranscript, onError, onStatusChange };
  }, [onTranscript, onError, onStatusChange]);

  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    callbacksRef.current.onStatusChange?.(newStatus);
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    retriesRef.current = MAX_RETRIES; // Prevent reconnection
    if (wsRef.current) {
      wsRef.current.close(1000, "Client disconnect");
      wsRef.current = null;
    }
    updateStatus("closed");
  }, [clearReconnectTimer, updateStatus]);

  const connect = useCallback(() => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) {
      callbacksRef.current.onError?.("No session ID provided");
      return;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    clearReconnectTimer();
    retriesRef.current = 0;
    updateStatus("connecting");

    const url = `${WS_BASE_URL}/ws/audio/${currentSessionId}`;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      retriesRef.current = 0;
      updateStatus("open");
    };

    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);

          // Handle wrapped format: {"type": "transcript", "data": {...}}
          if (msg.type === "transcript" && msg.data) {
            const chunk: TranscriptChunk = {
              text: msg.data.text || "",
              speaker: msg.data.speaker || "Unknown",
              timestamp: msg.data.timestamp || 0,
              is_final: msg.data.is_final || false,
            };
            setLastMessage(chunk);
            callbacksRef.current.onTranscript?.(chunk);
          } else if (msg.type === "error") {
            callbacksRef.current.onError?.(msg.message || "Unknown error");
          } else if (msg.text) {
            // Handle direct chunk format
            const chunk: TranscriptChunk = msg as TranscriptChunk;
            setLastMessage(chunk);
            callbacksRef.current.onTranscript?.(chunk);
          }
        } catch {
          console.error("Failed to parse WebSocket message:", event.data);
        }
      }
    };

    ws.onclose = (event) => {
      wsRef.current = null;

      if (event.code === 1000 || retriesRef.current >= MAX_RETRIES) {
        updateStatus("closed");
        return;
      }

      // Exponential backoff reconnect
      const delay = Math.min(
        BASE_DELAY * Math.pow(2, retriesRef.current),
        30000
      );
      retriesRef.current += 1;
      updateStatus("connecting");

      reconnectTimerRef.current = setTimeout(() => {
        if (sessionIdRef.current) {
          connect();
        }
      }, delay);
    };

    ws.onerror = () => {
      updateStatus("error");
      callbacksRef.current.onError?.("WebSocket connection error");
    };
  }, [clearReconnectTimer, updateStatus]);

  const sendAudio = useCallback((data: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const sendControl = useCallback((action: "pause" | "resume" | "stop") => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "control", action }));
    }
  }, []);

  // Auto-connect
  useEffect(() => {
    if (autoConnect && sessionId) {
      connect();
    }
    return () => {
      clearReconnectTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmount");
        wsRef.current = null;
      }
    };
  }, [clearReconnectTimer]);

  return {
    status,
    connect,
    disconnect,
    sendAudio,
    sendControl,
    lastMessage,
  };
}
