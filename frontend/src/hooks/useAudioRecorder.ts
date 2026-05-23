"use client";

/* ===========================================
   Project Cura – Audio Recorder Hook
   Microphone capture with PCM encoding
   =========================================== */

import { useState, useRef, useCallback, useEffect } from "react";
import { AUDIO_SAMPLE_RATE, AUDIO_CHUNK_INTERVAL } from "@/lib/constants";
import type { PermissionState as MicPermState } from "@/types";

interface UseAudioRecorderOptions {
  sendAudio: (data: ArrayBuffer) => void;
  sampleRate?: number;
  chunkInterval?: number;
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  waveformData: number[];
  error: string | null;
  permissionState: MicPermState;
}

function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function downsampleBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (inputSampleRate === outputSampleRate) return buffer;
  if (inputSampleRate < outputSampleRate) {
    throw new Error("Input sample rate must be >= output sample rate");
  }

  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (
      let i = offsetBuffer;
      i < nextOffsetBuffer && i < buffer.length;
      i++
    ) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = accum / count;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

export function useAudioRecorder({
  sendAudio,
  sampleRate = AUDIO_SAMPLE_RATE,
  chunkInterval = AUDIO_CHUNK_INTERVAL,
}: UseAudioRecorderOptions): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>(
    new Array(30).fill(0)
  );
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] =
    useState<MicPermState>("unknown");

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const isPausedRef = useRef(false);
  const sendAudioRef = useRef(sendAudio);

  useEffect(() => {
    sendAudioRef.current = sendAudio;
  }, [sendAudio]);

  // Check permission state on mount
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.permissions) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((result) => {
          setPermissionState(result.state as MicPermState);
          result.onchange = () => {
            setPermissionState(result.state as MicPermState);
          };
        })
        .catch(() => {
          setPermissionState("unknown");
        });
    }
  }, []);

  const flushAudioBuffer = useCallback(() => {
    if (audioBufferRef.current.length === 0 || isPausedRef.current) return;

    const totalLength = audioBufferRef.current.reduce(
      (sum, buf) => sum + buf.length,
      0
    );
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const buf of audioBufferRef.current) {
      merged.set(buf, offset);
      offset += buf.length;
    }
    audioBufferRef.current = [];

    const inputSampleRate = audioContextRef.current?.sampleRate || 44100;
    const downsampled = downsampleBuffer(merged, inputSampleRate, sampleRate);
    const pcm = floatTo16BitPCM(downsampled);
    sendAudioRef.current(pcm);
  }, [sampleRate]);

  const startRecording = useCallback(async () => {
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: { ideal: sampleRate },
          channelCount: 1,
        },
      });

      setPermissionState("granted");
      streamRef.current = stream;

      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Analyser for waveform visualization
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      source.connect(analyser);

      // ScriptProcessor for raw PCM data
      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (isPausedRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        audioBufferRef.current.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Flush buffer at regular intervals
      flushIntervalRef.current = setInterval(flushAudioBuffer, chunkInterval);

      // Update waveform visualization
      waveformIntervalRef.current = setInterval(() => {
        if (!analyserRef.current || isPausedRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        const bars = 30;
        const step = Math.floor(dataArray.length / bars);
        const levels: number[] = [];
        for (let i = 0; i < bars; i++) {
          const value = dataArray[i * step] || 0;
          levels.push(value / 255);
        }
        setWaveformData(levels);
      }, 50);

      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to access microphone";
      setError(message);
      if (message.includes("Permission denied") || message.includes("NotAllowedError")) {
        setPermissionState("denied");
      }
    }
  }, [sampleRate, chunkInterval, flushAudioBuffer]);

  const stopRecording = useCallback(() => {
    // Flush remaining audio
    flushAudioBuffer();

    // Clear intervals
    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }

    // Disconnect audio nodes
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    audioBufferRef.current = [];
    setIsRecording(false);
    setIsPaused(false);
    isPausedRef.current = false;
    setWaveformData(new Array(30).fill(0));
  }, [flushAudioBuffer]);

  const pauseRecording = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    setWaveformData(new Array(30).fill(0));
  }, []);

  const resumeRecording = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
      if (waveformIntervalRef.current)
        clearInterval(waveformIntervalRef.current);
      if (processorRef.current) processorRef.current.disconnect();
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    isRecording,
    isPaused,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    waveformData,
    error,
    permissionState,
  };
}
