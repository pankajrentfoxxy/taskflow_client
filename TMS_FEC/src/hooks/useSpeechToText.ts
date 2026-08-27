'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionResultEvent = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorLike = Event & { error?: string };

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechToTextSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export function useSpeechToText({
  lang = 'en-IN',
  onTranscript,
  onError,
}: {
  lang?: string;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(isSpeechToTextSupported);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onErrorRef.current = onError;
  }, [onTranscript, onError]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onErrorRef.current?.('Speech to text is not supported in this browser. Use Chrome or Edge.');
      return;
    }

    recognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) transcript += result[0]?.transcript ?? '';
      }
      const text = transcript.trim();
      if (text) onTranscriptRef.current(text);
    };

    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      const message =
        event.error === 'not-allowed'
          ? 'Microphone access denied. Allow the mic in browser settings.'
          : event.error === 'network'
            ? 'Speech recognition needs an internet connection in this browser.'
            : `Speech recognition failed (${event.error}).`;
      onErrorRef.current?.(message);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      onErrorRef.current?.('Could not start speech recognition.');
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, start, stop, toggle };
}
