"use client";

/* ===========================================
   Project Cura – Offline Cache Hook
   Auto-saves session data to IndexedDB
   =========================================== */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  saveSession,
  getSession,
  saveTranscriptChunk,
  getTranscriptChunks,
  clearSession,
  getUnfinishedSessions,
} from "@/lib/offlineDb";
import type { SpeakerSegment } from "@/types";

interface OfflineCacheState {
  patientId: string;
  soapProgress?: Record<string, string>;
  transcriptSegments: SpeakerSegment[];
}

interface UseOfflineCacheReturn {
  saveState: (
    sessionId: string,
    state: Partial<OfflineCacheState>
  ) => Promise<void>;
  recoverSession: (sessionId: string) => Promise<OfflineCacheState | null>;
  hasUnsavedSession: boolean;
  unsavedSessionId: string | null;
  clearCache: (sessionId: string) => Promise<void>;
}

export function useOfflineCache(): UseOfflineCacheReturn {
  const [hasUnsavedSession, setHasUnsavedSession] = useState(false);
  const [unsavedSessionId, setUnsavedSessionId] = useState<string | null>(null);
  const pendingSegmentsRef = useRef<
    Map<string, SpeakerSegment[]>
  >(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check for unfinished sessions on mount
  useEffect(() => {
    const checkUnfinished = async () => {
      try {
        const sessions = await getUnfinishedSessions();
        if (sessions.length > 0) {
          setHasUnsavedSession(true);
          setUnsavedSessionId(sessions[0].sessionId);
        }
      } catch {
        // IndexedDB may not be available (SSR)
      }
    };
    checkUnfinished();
  }, []);

  // Auto-save pending segments every 1 second
  useEffect(() => {
    saveTimerRef.current = setInterval(async () => {
      const pending = pendingSegmentsRef.current;
      if (pending.size === 0) return;

      const entries = Array.from(pending.entries());
      for (const [sessionId, segments] of entries) {
        for (const segment of segments) {
          try {
            await saveTranscriptChunk(sessionId, {
              speaker: segment.speaker,
              text: segment.text,
              startTime: segment.start_time,
              endTime: segment.end_time,
              confidence: 1.0,
            });
          } catch {
            // Silently fail, will retry next interval
          }
        }
        pending.delete(sessionId);
      }
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  }, []);

  const saveStateCallback = useCallback(
    async (sessionId: string, state: Partial<OfflineCacheState>) => {
      try {
        // Save session metadata
        await saveSession(sessionId, {
          patientId: state.patientId || "",
          isFinalized: false,
          soapProgress: state.soapProgress,
        });

        // Queue transcript segments for batch save
        if (state.transcriptSegments && state.transcriptSegments.length > 0) {
          const existing = pendingSegmentsRef.current.get(sessionId) || [];
          pendingSegmentsRef.current.set(sessionId, [
            ...existing,
            ...state.transcriptSegments,
          ]);
        }

        setHasUnsavedSession(true);
        setUnsavedSessionId(sessionId);
      } catch (err) {
        console.error("Failed to save offline state:", err);
      }
    },
    []
  );

  const recoverSession = useCallback(
    async (sessionId: string): Promise<OfflineCacheState | null> => {
      try {
        const session = await getSession(sessionId);
        if (!session) return null;

        const chunks = await getTranscriptChunks(sessionId);

        const segments: SpeakerSegment[] = chunks.map((chunk) => ({
          speaker: chunk.speaker as string,
          text: chunk.text,
          start_time: chunk.startTime,
          end_time: chunk.endTime,
        }));

        return {
          patientId: session.patientId,
          soapProgress: session.soapProgress as Record<string, string>,
          transcriptSegments: segments,
        };
      } catch {
        return null;
      }
    },
    []
  );

  const clearCacheCallback = useCallback(async (sessionId: string) => {
    try {
      await clearSession(sessionId);
      pendingSegmentsRef.current.delete(sessionId);

      const remaining = await getUnfinishedSessions();
      if (remaining.length === 0) {
        setHasUnsavedSession(false);
        setUnsavedSessionId(null);
      } else {
        setUnsavedSessionId(remaining[0].sessionId);
      }
    } catch {
      console.error("Failed to clear cache");
    }
  }, []);

  return {
    saveState: saveStateCallback,
    recoverSession,
    hasUnsavedSession,
    unsavedSessionId,
    clearCache: clearCacheCallback,
  };
}
