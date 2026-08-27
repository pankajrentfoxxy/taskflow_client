'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function isVoiceRecordingSupported(): boolean {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function useVoiceRecorder({
  onRecorded,
  onError,
}: {
  onRecorded: (file: File, durationSec: number) => void;
  onError?: (message: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const durationRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (!isVoiceRecordingSupported()) {
      onError?.('Voice recording is not supported in this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        clearTimer();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
        onRecorded(file, durationRef.current);
        recorderRef.current = null;
        chunksRef.current = [];
        stopStream();
        setRecording(false);
        setDurationSec(0);
        durationRef.current = 0;
      };

      recorder.onerror = () => {
        clearTimer();
        onError?.('Recording failed');
        stopStream();
        setRecording(false);
        setDurationSec(0);
        durationRef.current = 0;
      };

      startedAtRef.current = Date.now();
      durationRef.current = 0;
      setDurationSec(0);
      clearTimer();
      timerRef.current = setInterval(() => {
        const next = Math.floor((Date.now() - startedAtRef.current) / 1000);
        durationRef.current = next;
        setDurationSec(next);
      }, 200);

      recorder.start();
      setRecording(true);
    } catch {
      clearTimer();
      onError?.('Microphone permission denied');
      stopStream();
      setRecording(false);
      setDurationSec(0);
      durationRef.current = 0;
    }
  }, [clearTimer, onError, onRecorded, stopStream]);

  const toggle = useCallback(() => {
    if (recording) stop();
    else void start();
  }, [recording, start, stop]);

  return { supported: isVoiceRecordingSupported(), recording, durationSec, start, stop, toggle };
}
