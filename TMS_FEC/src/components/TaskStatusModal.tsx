'use client';

import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import {
  api,
  fromLocalInput,
  fmtDateTime,
  STATUS_COLOR,
  STATUS_COLOR_FALLBACK,
  STATUS_LABEL,
  TASK_ACTION_TOAST,
  timeAgo,
  toast,
  toLocalInput,
} from '@/lib/util';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type View = 'actions' | 'ack' | 'reason' | 'eta' | 'request_input' | 'provide_input';

export default function TaskStatusModal({
  task,
  open,
  onClose,
  onDone,
}: {
  task: { id: number; title?: string; status?: string } | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [view, setView] = useState<View>('actions');
  const [pendingAction, setPendingAction] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [eta, setEta] = useState('');
  const [explanation, setExplanation] = useState('');
  const [propEta, setPropEta] = useState('');
  const [inputRequestNote, setInputRequestNote] = useState('');
  const [inputPayload, setInputPayload] = useState('');

  const reset = useCallback(() => {
    setErr('');
    setView('actions');
    setPendingAction('');
    setReasonText('');
    setEta('');
    setExplanation('');
    setPropEta('');
    setInputRequestNote('');
    setInputPayload('');
  }, []);

  const load = useCallback(async () => {
    if (!task?.id) return;
    setLoading(true);
    setErr('');
    try {
      const data = await api(`/api/tasks/${task.id}`);
      setDetail(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load task');
      toast.errorFrom(e, 'Failed to load task');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [task?.id]);

  useEffect(() => {
    if (open && task?.id) {
      reset();
      load();
    } else if (!open) {
      setDetail(null);
      reset();
    }
  }, [open, task?.id, load, reset]);

  const act = async (body: Record<string, unknown>) => {
    if (!task?.id) return;
    setBusy(true);
    setErr('');
    try {
      await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      const action = String(body.action || '');
      toast.success(TASK_ACTION_TOAST[action] || 'Task updated');
      onDone();
      onClose();
    } catch (e: any) {
      if (e.code === 'OPEN_SUBTASKS') {
        const reason = prompt(`${e.message}\n\nCreator/Admin override — enter a reason:`);
        if (reason) await act({ ...body, overrideReason: reason });
      } else {
        setErr(e.message || 'Action failed');
        toast.errorFrom(e, 'Action failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const quickEta = (hours: number, eod = false) => {
    const d = new Date();
    if (eod) d.setHours(19, 0, 0, 0);
    else d.setTime(d.getTime() + hours * 3600 * 1000);
    setEta(toLocalInput(d.getTime()));
  };

  const submitAck = () => {
    const etaAt = fromLocalInput(eta);
    if (!etaAt) {
      const msg = 'Set your ETA — it is mandatory';
      setErr(msg);
      toast.error(msg);
      return;
    }
    act({ action: 'acknowledge', etaAt });
  };

  const submitReason = () => {
    if (pendingAction === 'discuss') {
      act({ action: 'discuss', reason: reasonText.trim() || undefined });
      return;
    }
    if (!reasonText.trim()) {
      const msg = 'A reason is required';
      setErr(msg);
      toast.error(msg);
      return;
    }
    act({ action: pendingAction, reason: reasonText.trim() });
  };

  const submitEta = () => {
    const etaAt = fromLocalInput(eta);
    if (!etaAt) {
      const msg = 'Pick an ETA';
      setErr(msg);
      toast.error(msg);
      return;
    }
    act({ action: 'update_eta', etaAt });
  };

  const submitRequestInput = () => {
    const note = inputRequestNote.trim();
    if (note.length < 10) {
      const msg = 'Describe what you need (at least 10 characters)';
      setErr(msg);
      toast.error(msg);
      return;
    }
    act({ action: 'request_input', inputRequestNote: note });
  };

  const submitProvideInput = () => {
    const payload = inputPayload.trim();
    if (!payload) {
      const msg = 'Enter the requested information';
      setErr(msg);
      toast.error(msg);
      return;
    }
    act({ action: 'provide_input', inputPayload: payload });
  };

  const submitExplanation = async () => {
    if (!task?.id) return;
    setBusy(true);
    setErr('');
    try {
      await api(`/api/tasks/${task.id}/escalation`, {
        method: 'POST',
        body: JSON.stringify({ explanation, proposedEtaAt: fromLocalInput(propEta) }),
      });
      toast.success('Explanation submitted');
      onDone();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to submit explanation';
      setErr(msg);
      toast.errorFrom(e, 'Failed to submit explanation');
    } finally {
      setBusy(false);
    }
  };

  const reviewEscalation = async (result: 'ACCEPTED' | 'REJECTED') => {
    if (!task?.id) return;
    setBusy(true);
    setErr('');
    try {
      await api(`/api/tasks/${task.id}/escalation`, {
        method: 'POST',
        body: JSON.stringify({ review: result }),
      });
      toast.success(result === 'ACCEPTED' ? 'Escalation accepted' : 'Escalation rejected');
      onDone();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Review failed';
      setErr(msg);
      toast.errorFrom(e, 'Review failed');
    } finally {
      setBusy(false);
    }
  };

  const openReason = (action: string) => {
    setPendingAction(action);
    setReasonText('');
    setErr('');
    setView('reason');
  };

  const t = detail?.task;
  const perm = detail?.permissions;
  const escalation = detail?.escalation;
  const status = t?.status || task?.status || '';
  const title = t?.title || task?.title || 'Task';

  const isEscalated = status === 'ESCALATED';
  const showReview = Boolean(perm?.canReview && escalation?.explanation && isEscalated);
  const showProvideInput = Boolean(perm?.canProvideInput && status === 'WAITING_FOR_INPUT');
  const showResumeInput = Boolean(perm?.canResumeAfterInput && status === 'INPUT_PROVIDED');
  const modalTitle = perm?.mustExplain
    ? 'Explanation required'
    : showReview
      ? 'Review escalation'
      : showProvideInput
        ? 'Provide information'
        : showResumeInput
          ? 'Review provided data'
          : 'Change status';
  const actionButtons: { label: string; onClick: () => void; variant?: 'default' | 'outline'; className?: string }[] = [];

  if (perm?.mustExplain) {
    // Explanation form shown below — blocks other actions until submitted.
  } else if (perm && isEscalated) {
    if (perm.canReject) {
      actionButtons.push({
        label: 'Reject',
        variant: 'outline',
        className: 'text-red-600',
        onClick: () => openReason('reject'),
      });
    }
    if (perm.canDone) {
      actionButtons.push({
        label: 'Mark done',
        onClick: () => act({ action: 'done' }),
        className: 'bg-emerald-600 text-white hover:bg-emerald-700',
      });
    }
    if (perm.canCancel) {
      actionButtons.push({
        label: 'Cancel task',
        variant: 'outline',
        className: 'text-red-600',
        onClick: () => openReason('cancel'),
      });
    }
    if (perm.canStart) {
      actionButtons.push({
        label: 'Mark in progress',
        onClick: () => act({ action: 'start' }),
      });
    }
    if (perm.canEditEta) {
      actionButtons.push({
        label: 'Update ETA',
        variant: 'outline',
        onClick: () => {
          setEta(t?.eta_at ? toLocalInput(t.eta_at) : '');
          setErr('');
          setView('eta');
        },
      });
    }
  } else if (perm) {
    if (perm.canAcknowledge) {
      actionButtons.push({
        label: 'Accept + ETA',
        onClick: () => {
          setEta('');
          setErr('');
          setView('ack');
        },
      });
    }
    if (perm.canDiscuss) {
      actionButtons.push({
        label: 'Discuss',
        variant: 'outline',
        onClick: () => openReason('discuss'),
      });
    }
    if (perm.canReject) {
      actionButtons.push({
        label: 'Reject',
        variant: 'outline',
        className: 'text-red-600',
        onClick: () => openReason('reject'),
      });
    }
    if (perm.canStart) {
      actionButtons.push({ label: 'Start', onClick: () => act({ action: 'start' }) });
    }
    if (perm.canRequestInput) {
      actionButtons.push({
        label: 'Request information',
        variant: 'outline',
        onClick: () => {
          setInputRequestNote('');
          setErr('');
          setView('request_input');
        },
      });
    }
    if (perm.canDone) {
      actionButtons.push({
        label: 'Mark done',
        onClick: () => act({ action: 'done' }),
        className: 'bg-emerald-600 text-white hover:bg-emerald-700',
      });
    }
    if (perm.canBlock && !t?.blocked_reason) {
      actionButtons.push({
        label: 'Mark blocked',
        variant: 'outline',
        onClick: () => openReason('block'),
      });
    }
    if (t?.blocked_reason && perm.canUnblock) {
      actionButtons.push({
        label: 'Unblock',
        variant: 'outline',
        onClick: () => act({ action: 'unblock' }),
      });
    }
    if (perm.canReopen) {
      actionButtons.push({
        label: 'Reopen',
        variant: 'outline',
        onClick: () => openReason('reopen'),
      });
    }
    if (perm.canCancel) {
      actionButtons.push({
        label: 'Cancel task',
        variant: 'outline',
        className: 'text-red-600',
        onClick: () => openReason('cancel'),
      });
    }
    if (perm.canEditEta) {
      actionButtons.push({
        label: 'Update ETA',
        variant: 'outline',
        onClick: () => {
          setEta(t?.eta_at ? toLocalInput(t.eta_at) : '');
          setErr('');
          setView('eta');
        },
      });
    }
  }

  const reasonTitle =
    pendingAction === 'block'
      ? 'What is blocking you?'
      : pendingAction === 'reopen'
        ? 'Why reopen this task?'
        : pendingAction === 'reject'
          ? 'Why reject this task?'
          : pendingAction === 'discuss'
            ? 'What should be discussed? (optional)'
            : 'Why cancel this task?';

  return (
    <Modal open={open} onClose={onClose} title={modalTitle}>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{title}</span>
          </p>
          <div className="mt-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current status</span>
            <div className="mt-1">
              <Badge className={cn(STATUS_COLOR[status] || STATUS_COLOR_FALLBACK)}>
                <span className="mr-1.5 size-1.5 rounded-full bg-current opacity-70" />
                {STATUS_LABEL[status] || status}
              </Badge>
            </div>
          </div>
        </div>

        {loading && <div className="h-16 animate-pulse rounded-lg bg-muted/50" />}

        {!loading && perm?.mustExplain && (
          <Card className="border-red-300 bg-red-50 py-0">
            <CardContent className="p-3">
              <h3 className="mb-1 font-bold text-red-700">🚨 Explanation required</h3>
              <p className="mb-3 text-sm text-red-600">
                Submit a written explanation (min 20 characters) and propose a new ETA before doing anything else.
              </p>
              <Textarea
                className="mb-2 min-h-[80px] bg-white"
                placeholder="Why was this task delayed?"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />
              <Label className="text-red-800">Proposed new ETA</Label>
              <Input
                type="datetime-local"
                className="mb-3 mt-1.5 bg-white"
                value={propEta}
                onChange={(e) => setPropEta(e.target.value)}
              />
              <Button variant="destructive" className="w-full" disabled={busy} onClick={submitExplanation}>
                {busy ? 'Submitting…' : 'Submit explanation'}
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && showReview && (
          <Card className="border-amber-300 bg-amber-50 py-0">
            <CardContent className="p-3">
              <h3 className="mb-1 font-bold text-amber-800">Escalation explanation</h3>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{escalation.explanation}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Proposed ETA: {fmtDateTime(escalation.proposed_eta_at)} · submitted {timeAgo(escalation.explanation_at)}
              </p>
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" disabled={busy} onClick={() => reviewEscalation('ACCEPTED')}>
                  Accept & re-plan
                </Button>
                <Button variant="destructive" className="flex-1" disabled={busy} onClick={() => reviewEscalation('REJECTED')}>
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && showProvideInput && (
          <Card className="border-cyan-300 bg-cyan-50 py-0">
            <CardContent className="p-3">
              <h3 className="mb-1 font-bold text-cyan-900">Information requested</h3>
              {t?.input_request_note && (
                <div className="mb-3 rounded-md border border-cyan-200 bg-white px-3 py-2 text-sm text-gray-800">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-cyan-800">What they need</p>
                  <p className="whitespace-pre-wrap">{t.input_request_note}</p>
                </div>
              )}
              <Label className="text-cyan-900">Provide the data</Label>
              <Textarea
                className="mt-1.5 min-h-[120px] bg-white font-mono text-sm"
                placeholder={'Example:\nSMTP_HOST=smtp.gmail.com\nSMTP_PORT=587\nSMTP_USER=...\nSMTP_PASS=...'}
                value={inputPayload}
                onChange={(e) => setInputPayload(e.target.value)}
              />
              <Button className="mt-3 w-full" disabled={busy} onClick={submitProvideInput}>
                {busy ? 'Saving…' : 'Submit information'}
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && showResumeInput && (
          <Card className="border-emerald-300 bg-emerald-50 py-0">
            <CardContent className="p-3">
              <h3 className="mb-1 font-bold text-emerald-900">Data provided</h3>
              {t?.input_request_note && (
                <p className="mb-2 text-xs text-emerald-800">
                  Request: <span className="whitespace-pre-wrap">{t.input_request_note}</span>
                </p>
              )}
              {t?.input_payload && (
                <pre className="mb-3 max-h-48 overflow-auto rounded-md border border-emerald-200 bg-white p-3 text-xs whitespace-pre-wrap">
                  {t.input_payload}
                </pre>
              )}
              <Button className="w-full" disabled={busy} onClick={() => act({ action: 'resume_after_input' })}>
                {busy ? 'Saving…' : 'Continue working'}
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && status === 'WAITING_FOR_INPUT' && perm?.canActAsAssignee && !showProvideInput && (
          <Alert>
            <AlertDescription>
              Waiting for the task creator or Admin to provide:{' '}
              <span className="font-medium">{t?.input_request_note || 'requested information'}</span>
            </AlertDescription>
          </Alert>
        )}

        {!loading && view === 'actions' && !perm?.mustExplain && !showProvideInput && !showResumeInput && (
          <>
            {actionButtons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No status changes available for you on this task.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {actionButtons.map((btn) => (
                  <Button
                    key={btn.label}
                    type="button"
                    variant={btn.variant || 'default'}
                    className={cn('justify-start', btn.className)}
                    disabled={busy}
                    onClick={btn.onClick}
                  >
                    {btn.label}
                  </Button>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && view === 'ack' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">An ETA is mandatory when accepting this task.</p>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => quickEta(0, true)}>
                Today EOD
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => quickEta(24)}>
                +24 hours
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => quickEta(48)}>
                +2 days
              </Button>
            </div>
            <Input type="datetime-local" className="h-10" value={eta} onChange={(e) => setEta(e.target.value)} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setView('actions')} disabled={busy}>
                Back
              </Button>
              <Button type="button" className="flex-1" disabled={busy} onClick={submitAck}>
                {busy ? 'Saving…' : 'Accept'}
              </Button>
            </div>
          </div>
        )}

        {!loading && view === 'reason' && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{reasonTitle}</p>
            <Textarea rows={3} value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setView('actions')} disabled={busy}>
                Back
              </Button>
              <Button type="button" className="flex-1" disabled={busy} onClick={submitReason}>
                {busy ? 'Saving…' : 'Confirm'}
              </Button>
            </div>
          </div>
        )}

        {!loading && view === 'request_input' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Describe exactly what you need (credentials, access, files, etc.). This will be visible to the person who provides it.
            </p>
            <Textarea
              rows={4}
              placeholder="Example: Need SMTP credentials — host, port, user, and app password for noreply@company.com"
              value={inputRequestNote}
              onChange={(e) => setInputRequestNote(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setView('actions')} disabled={busy}>
                Back
              </Button>
              <Button type="button" className="flex-1" disabled={busy} onClick={submitRequestInput}>
                {busy ? 'Sending…' : 'Send request'}
              </Button>
            </div>
          </div>
        )}

        {!loading && view === 'eta' && (
          <div className="space-y-3">
            {isEscalated && (
              <p className="text-xs text-muted-foreground">The due date will be updated to match this ETA.</p>
            )}
            <Input type="datetime-local" className="h-10" value={eta} onChange={(e) => setEta(e.target.value)} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setView('actions')} disabled={busy}>
                Back
              </Button>
              <Button type="button" className="flex-1" disabled={busy} onClick={submitEta}>
                {busy ? 'Saving…' : 'Save ETA'}
              </Button>
            </div>
          </div>
        )}

        {err && (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}
      </div>
    </Modal>
  );
}
