'use client';

import { useState } from 'react';
import Modal from './Modal';
import { api, fromLocalInput, toast, toLocalInput } from '@/lib/util';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AckModal({
  task, open, onClose, onDone,
}: { task: any; open: boolean; onClose: () => void; onDone: () => void }) {
  const [eta, setEta] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const quick = (hours: number, eod = false) => {
    const d = new Date();
    if (eod) d.setHours(19, 0, 0, 0);
    else d.setTime(d.getTime() + hours * 3600 * 1000);
    setEta(toLocalInput(d.getTime()));
  };

  const submit = async () => {
    const etaAt = fromLocalInput(eta);
    if (!etaAt) { const msg = 'Set your ETA — it is mandatory'; setErr(msg); toast.error(msg); return; }
    setBusy(true); setErr('');
    try {
      await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'acknowledge', etaAt }) });
      toast.success('Task accepted');
      onDone(); onClose();
    } catch (e: any) { setErr(e.message); toast.errorFrom(e); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Accept & set ETA">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You are accepting <strong className="text-foreground">&quot;{task?.title}&quot;</strong>. An ETA is mandatory.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => quick(0, true)}>Today EOD</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => quick(24)}>+24 hours</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => quick(48)}>+2 days</Button>
        </div>
        <Input
          type="datetime-local"
          className="h-10"
          value={eta}
          onChange={(e) => setEta(e.target.value)}
        />
        {err && (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}
        <Button className="w-full" size="lg" disabled={busy} onClick={submit}>
          {busy ? 'Saving…' : 'Accept with this ETA'}
        </Button>
      </div>
    </Modal>
  );
}
