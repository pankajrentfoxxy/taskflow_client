'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Link2, Mic, Square, Subtitles } from 'lucide-react';
import { insertDescriptionLink, normalizeDescriptionUrl } from '@/lib/descriptionLinks';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import AttachmentMedia, { type AttachmentLike } from '@/components/AttachmentMedia';
import VoiceRecordingBar from '@/components/VoiceRecordingBar';
import { apiUpload, deleteUpload, toast } from '@/lib/util';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Modal from '@/components/Modal';
import DescriptionContent from '@/components/DescriptionContent';
import { cn } from '@/lib/utils';

type PendingLink = { name: string; url: string };

export default function DescriptionEditor({
  value,
  onChange,
  placeholder = 'Add a description…',
  rows = 4,
  voiceAttachments = [],
  onVoiceUploaded,
  onRemoveVoiceAttachment,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  voiceAttachments?: AttachmentLike[];
  onVoiceUploaded?: (attachmentId: number, durationSec?: number) => void;
  onRemoveVoiceAttachment?: (attachmentId: number) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(value);
  const mountedRef = useRef(true);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [addedLinks, setAddedLinks] = useState<PendingLink[]>([]);

  const appendSpeech = useCallback(
    (transcript: string) => {
      const el = textareaRef.current;
      const current = valueRef.current;
      const start = el?.selectionStart ?? current.length;
      const end = el?.selectionEnd ?? current.length;
      const before = current.slice(0, start);
      const after = current.slice(end);
      const needsSpace = before.length > 0 && !/[\s]$/.test(before);
      const chunk = `${needsSpace ? ' ' : ''}${transcript}`;
      const next = before + chunk + after;
      valueRef.current = next;
      onChange(next);
      requestAnimationFrame(() => {
        if (!el) return;
        const cursor = before.length + chunk.length;
        el.focus();
        el.setSelectionRange(cursor, cursor);
      });
    },
    [onChange]
  );

  const { supported: speechSupported, listening, toggle: toggleSpeech } = useSpeechToText({
    onTranscript: appendSpeech,
    onError: (msg) => toast.error(msg),
  });

  const [uploadingVoice, setUploadingVoice] = useState(false);
  const { supported: voiceSupported, recording: recordingVoice, durationSec: recordingSeconds, stop: stopVoiceRecording, toggle: toggleVoice } = useVoiceRecorder({
    onRecorded: async (file, durationSec) => {
      if (!onVoiceUploaded) return;
      setUploadingVoice(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const d = await apiUpload<{ id: number }>('/api/uploads', fd);
        if (!mountedRef.current) {
          await deleteUpload(d.id).catch(() => {});
          return;
        }
        onVoiceUploaded(d.id, durationSec);
        toast.success('Voice note added');
      } catch (e) {
        toast.errorFrom(e);
      } finally {
        setUploadingVoice(false);
      }
    },
    onError: (msg) => toast.error(msg),
  });

  useEffect(() => () => stopVoiceRecording(), [stopVoiceRecording]);

  const removeVoiceAttachment = async (attachmentId: number) => {
    try {
      await deleteUpload(attachmentId);
      onRemoveVoiceAttachment?.(attachmentId);
    } catch (e) {
      toast.errorFrom(e);
    }
  };

  const openLinkModal = () => {
    setLinkName('');
    setLinkUrl('');
    setAddedLinks([]);
    setLinkModalOpen(true);
  };

  const closeLinkModal = () => {
    setLinkModalOpen(false);
    setLinkName('');
    setLinkUrl('');
    setAddedLinks([]);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const insertLink = () => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const result = insertDescriptionLink(value, start, end, linkName, linkUrl);
    if (!result) {
      toast.error('Enter both name and link');
      return;
    }

    onChange(result.value);
    setAddedLinks((prev) => [...prev, { name: linkName.trim(), url: linkUrl.trim() }]);
    setLinkName('');
    setLinkUrl('');
    toast.success('Link inserted');

    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(result.cursor, result.cursor);
    });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn('min-h-[88px] resize-y', (speechSupported || voiceSupported) ? 'pr-[6.5rem]' : 'pr-10')}
          rows={rows}
        />
        <div className="absolute top-2 right-2 flex items-center gap-0.5">
          {onVoiceUploaded && voiceSupported && (
            <Button
              type="button"
              variant={recordingVoice ? 'secondary' : 'ghost'}
              size="icon-sm"
              className={cn(
                'text-muted-foreground hover:text-foreground',
                recordingVoice && 'text-red-600 ring-1 ring-red-200'
              )}
              onClick={toggleVoice}
              disabled={uploadingVoice}
              title={recordingVoice ? 'Stop recording' : 'Record voice note'}
              aria-pressed={recordingVoice}
            >
              {recordingVoice ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}
            </Button>
          )}
          {speechSupported && (
            <Button
              type="button"
              variant={listening ? 'secondary' : 'ghost'}
              size="icon-sm"
              className={cn(
                'text-muted-foreground hover:text-foreground',
                listening && 'text-primary ring-1 ring-primary/30'
              )}
              onClick={toggleSpeech}
              title={listening ? 'Stop dictation' : 'Speech to text — converts speech into text'}
              aria-pressed={listening}
              aria-label={listening ? 'Stop speech to text' : 'Start speech to text'}
            >
              <Subtitles className={cn('size-4', listening && 'animate-pulse')} />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={openLinkModal}
            title="Add hyperlink"
          >
            <Link2 className="size-4" />
          </Button>
        </div>
      </div>

      {recordingVoice && <VoiceRecordingBar durationSec={recordingSeconds} onStop={toggleVoice} />}

      {voiceAttachments.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Voice notes</div>
          {voiceAttachments.map((attachment) => (
            <div key={attachment.id} className="flex items-start gap-2 rounded-lg border bg-muted/10 p-2">
              <div className="min-w-0 flex-1">
                <AttachmentMedia attachment={attachment} compact />
              </div>
              {onRemoveVoiceAttachment && (
                <Button type="button" variant="ghost" size="xs" onClick={() => void removeVoiceAttachment(attachment.id)}>
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {value.trim() && (
        <div className="rounded-lg border bg-muted/10 p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</div>
          <DescriptionContent text={value} />
        </div>
      )}

      <Modal open={linkModalOpen} onClose={closeLinkModal} title="Add hyperlinks">
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="desc-link-name">Name</Label>
              <Input
                id="desc-link-name"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="Display text"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('desc-link-url')?.focus();
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="desc-link-url">Link</Label>
              <Input
                id="desc-link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    insertLink();
                  }
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={insertLink}>
              Insert
            </Button>
            <Button type="button" variant="outline" onClick={closeLinkModal}>
              Done
            </Button>
          </div>

          {addedLinks.length > 0 && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Added in this session ({addedLinks.length})
              </div>
              <ul className="space-y-1.5 text-sm">
                {addedLinks.map((link, i) => (
                  <li key={`${link.name}-${link.url}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium text-primary underline underline-offset-2">
                      {link.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {normalizeDescriptionUrl(link.url)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Add more links above, then click Done when finished.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
