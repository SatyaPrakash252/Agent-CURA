'use client';

import React from 'react';
import Button from '../ui/Button';

interface SessionControlsProps {
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onFinalize: () => void;
  onClear: () => void;
  isRecording: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  hasTranscript: boolean;
}

export default function SessionControls({
  onStart, onPause, onStop, onFinalize, onClear,
  isRecording, isPaused, isProcessing, hasTranscript,
}: SessionControlsProps) {
  return (
    <div className="flex items-center gap-2 surface px-4 py-2.5">
      {!isRecording ? (
        <Button variant="primary" size="sm" onClick={onStart} disabled={isProcessing}>Start recording</Button>
      ) : (
        <>
          <Button variant="secondary" size="sm" onClick={onPause}>{isPaused ? 'Resume' : 'Pause'}</Button>
          <Button variant="danger" size="sm" onClick={onStop}>Stop</Button>
        </>
      )}
      <div className="flex-1" />
      <Button variant="primary" size="sm" onClick={onFinalize} disabled={!hasTranscript || isRecording || isProcessing}>
        {isProcessing ? 'Processing…' : 'Finalize'}
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear} disabled={isRecording || isProcessing}>Clear</Button>
    </div>
  );
}
