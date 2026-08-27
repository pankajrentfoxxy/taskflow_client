'use client';
import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import Composer from '@/components/Composer';
import AckModal from '@/components/AckModal';
import CommentsPanel from '@/components/CommentsPanel';
import AuthImage from '@/components/AuthImage';
import { api, fmtDateTime, timeAgo, countdown, toLocalInput, fromLocalInput, STATUS_LABEL, STATUS_COLOR, STATUS_COLOR_FALLBACK, SLA_BREACH_BADGE, PRIORITY_COLOR, uploadUrl, isTaskOverdue, TASK_ACTION_TOAST, activityTypeLabel, toast } from '@/lib/util';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { NativeSelect } from '@/components/ui/native-select';
import SearchableSelect, { buildUserSelectOptions } from '@/components/SearchableSelect';
import { cn } from '@/lib/utils';
import DescriptionContent from '@/components/DescriptionContent';
import AttachmentMedia from '@/components/AttachmentMedia';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-50 py-2 last:border-0">
      <span className="shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</span>
      <span className="min-w-0 text-right text-sm break-words">{children}</span>
    </div>
  );
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="shrink-0 border-b bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
    </div>
  );
}

function TaskDetailInner({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [ackOpen, setAckOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [etaOpen, setEtaOpen] = useState(false);
  const [reasonModal, setReasonModal] = useState<{ action: string; title: string } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [etaVal, setEtaVal] = useState('');
  const [explanation, setExplanation] = useState('');
  const [propEta, setPropEta] = useState('');
  const [showEtaHistory, setShowEtaHistory] = useState(false);
  const [inputRequestOpen, setInputRequestOpen] = useState(false);
  const [inputRequestText, setInputRequestText] = useState('');
  const [inputPayloadText, setInputPayloadText] = useState('');
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [addMemberRole, setAddMemberRole] = useState<'COLLABORATOR' | 'WATCHER'>('COLLABORATOR');
  const [users, setUsers] = useState<any[]>([]);

  const load = useCallback(() => {
    api(`/api/tasks/${id}`).then(setData).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api('/api/users').then((d) => setUsers(d.users.filter((u: any) => u.is_active))).catch(() => {});
  }, []);

  if (err) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-red-600">{err}</CardContent>
      </Card>
    );
  }
  if (!data) return <Card className="h-60 animate-pulse" />;

  const { task, members = [], subtasks, activity, attachments, escalation, batchTasks, permissions: perm } = data;
  const descriptionAttachments = (attachments || []).filter((a: any) => a.context === 'description');
  const fileAttachments = (attachments || []).filter((a: any) => a.context !== 'description');

  const act = async (body: any) => {
    setErr('');
    try {
      await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      const action = String(body.action || '');
      if (TASK_ACTION_TOAST[action]) toast.success(TASK_ACTION_TOAST[action]);
      else toast.success('Task updated');
      load();
    } catch (e: any) {
      if (e.code === 'OPEN_SUBTASKS') {
        const reason = prompt(`${e.message}\n\nCreator/Admin override — enter a reason:`);
        if (reason) act({ ...body, overrideReason: reason });
      } else {
        setErr(e.message);
        toast.errorFrom(e);
      }
    }
  };

  const submitReason = () => {
    if (!reasonModal) return;
    if (reasonModal.action === 'discuss') {
      act({ action: 'discuss', reason: reasonText.trim() || undefined });
    } else {
      if (!reasonText.trim()) {
        setErr('A reason is required');
        toast.error('A reason is required');
        return;
      }
      act({ action: reasonModal.action, reason: reasonText.trim() });
    }
    setReasonModal(null); setReasonText('');
  };

  const submitExplanation = async () => {
    setErr('');
    try {
      await api(`/api/tasks/${id}/escalation`, {
        method: 'POST',
        body: JSON.stringify({ explanation, proposedEtaAt: fromLocalInput(propEta) }),
      });
      setExplanation(''); setPropEta(''); load();
      toast.success('Explanation submitted');
    } catch (e: any) { setErr(e.message); toast.errorFrom(e); }
  };

  const review = async (result: string) => {
    setErr('');
    try {
      await api(`/api/tasks/${id}/escalation`, { method: 'POST', body: JSON.stringify({ review: result }) });
      toast.success(result === 'ACCEPTED' ? 'Escalation accepted' : 'Escalation rejected');
      load();
    } catch (e: any) { setErr(e.message); toast.errorFrom(e); }
  };

  const submitEta = () => {
    const v = fromLocalInput(etaVal);
    if (v) { act({ action: 'update_eta', etaAt: v }); setEtaOpen(false); }
  };

  const memberUserIds = new Set(members.map((m: any) => m.user_id));
  const addMemberCandidates = users.filter(
    (u) => u.id !== task.assignee_id && !memberUserIds.has(u.id),
  );

  const addMember = () => {
    if (!addMemberUserId) {
      toast.error('Choose a user');
      return;
    }
    act({ action: 'add_member', userId: Number(addMemberUserId), role: addMemberRole });
    setAddMemberUserId('');
  };

  const removeMember = (userId: number) => {
    act({ action: 'remove_member', userId });
  };

  const etaHistory = activity.filter((a: any) => a.type === 'ETA_CHANGED');
  const overdue = isTaskOverdue(task.due_at, task.status);
  const showActivity = perm.canViewActivity;

  return (
    <div className="flex max-h-[calc(100dvh-8rem)] min-h-[calc(100dvh-8rem)] flex-col gap-3">
      <Link href="/tasks" className="shrink-0 text-sm text-muted-foreground hover:text-foreground">← Back to tasks</Link>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-2">
        {/* Left — Task details */}
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b lg:border-b-0 lg:border-r">
          <PanelHeader title="Task details" />
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <div className="space-y-4 p-4">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className={STATUS_COLOR[task.status] || STATUS_COLOR_FALLBACK}>{STATUS_LABEL[task.status]}</Badge>
                  {task.sla_breached_at && task.status === 'ASSIGNED' && <Badge className={SLA_BREACH_BADGE}>NO RESPONSE</Badge>}
                  {task.status === 'ASSIGNED' && !task.sla_breached_at && task.sla_deadline_at && (
                    <Badge className="bg-amber-500 text-white">⏱ Respond: {countdown(task.sla_deadline_at)}</Badge>
                  )}
                  {task.blocked_reason && <Badge className="bg-purple-100 text-purple-700">Blocked</Badge>}
                  <span className={`text-xs font-bold ${PRIORITY_COLOR[task.priority]}`}>{task.priority}</span>
                  {task.reopen_count > 0 && <Badge className="bg-gray-100 text-gray-500">Reopened ×{task.reopen_count}</Badge>}
                </div>
                <h1 className="text-lg font-bold leading-snug">{task.title}</h1>
                {task.description && <DescriptionContent text={task.description} className="mt-2" />}
                {descriptionAttachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {descriptionAttachments.map((a: any) => (
                      <AttachmentMedia key={a.id} attachment={a} compact />
                    ))}
                  </div>
                )}
                {task.blocked_reason && (
                  <div className="mt-2 rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-800">🚧 Blocked: {task.blocked_reason}</div>
                )}
                {task.status === 'REJECTED' && task.cancel_reason && (
                  <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">Rejected: {task.cancel_reason}</div>
                )}
                {task.status === 'DISCUSS' && task.discuss_reason && (
                  <div className="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800">Discuss: {task.discuss_reason}</div>
                )}
                {task.input_request_note && perm.canViewInputRequest && (
                  <div className="mt-2 rounded-lg bg-cyan-50 px-3 py-2 text-sm text-cyan-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">Information requested</p>
                    <p className="mt-1 whitespace-pre-wrap">{task.input_request_note}</p>
                  </div>
                )}
                {task.input_payload && perm.canViewInputPayload && (
                  <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Provided data</p>
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs">{task.input_payload}</pre>
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <Row label="Assignee (primary)">{task.assignee_name || (task.team_name ? `Team: ${task.team_name}` : '—')}</Row>
                {members.length > 0 && (
                  <div className="border-b border-gray-50 py-2 last:border-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Additional members</div>
                    <ul className="mt-2 space-y-2">
                      {members.map((m: any) => (
                        <li key={m.user_id} className="flex items-center justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <span className="font-medium">{m.user_name}</span>
                            <Badge variant="secondary" className="ml-2 text-[10px] capitalize">
                              {String(m.role).toLowerCase()}
                            </Badge>
                          </div>
                          {perm.canManageMembers && (
                            <Button type="button" variant="ghost" size="xs" className="text-red-600" onClick={() => removeMember(m.user_id)}>
                              Remove
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {perm.canManageMembers && addMemberCandidates.length > 0 && (
                  <div className="border-t border-gray-50 pt-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Add member</div>
                    <div className="flex flex-wrap gap-2">
                      <SearchableSelect
                        className="h-9 min-w-[160px] flex-1"
                        value={addMemberUserId}
                        onChange={setAddMemberUserId}
                        placeholder="Choose user…"
                        searchPlaceholder="Search users…"
                        options={buildUserSelectOptions(addMemberCandidates)}
                      />
                      <NativeSelect className="h-9 w-36" value={addMemberRole} onChange={(e) => setAddMemberRole(e.target.value as 'COLLABORATOR' | 'WATCHER')}>
                        <option value="COLLABORATOR">Collaborator</option>
                        <option value="WATCHER">Watcher</option>
                      </NativeSelect>
                      <Button type="button" size="sm" variant="outline" onClick={addMember}>Add</Button>
                    </div>
                  </div>
                )}
                <Row label="Created by">{task.creator_name} · {timeAgo(task.created_at)}</Row>
                <Row label="Due">
                  <span className={overdue ? 'font-bold text-red-600' : ''}>{fmtDateTime(task.due_at)}{overdue ? ' (overdue)' : ''}</span>
                </Row>
                <Row label="ETA">
                  <span>
                    {fmtDateTime(task.eta_at)}
                    {etaHistory.length > 0 && (
                      <button className="ml-2 text-xs underline" onClick={() => setShowEtaHistory(!showEtaHistory)}>
                        history ({etaHistory.length})
                      </button>
                    )}
                  </span>
                </Row>
                {showEtaHistory && etaHistory.map((h: any) => {
                  const m = JSON.parse(h.meta || '{}');
                  return (
                    <div key={h.id} className="border-l-2 border-border py-1 pl-2 text-xs text-muted-foreground">
                      {h.actor_name}: {fmtDateTime(m.from)} → <strong>{fmtDateTime(m.to)}</strong> · {timeAgo(h.created_at)}
                    </div>
                  );
                })}
                {task.type_name && <Row label="Task type">{task.type_name}</Row>}
                {task.acknowledged_at && <Row label="Accepted">{fmtDateTime(task.acknowledged_at)}</Row>}
                {task.done_at && <Row label="Done at">{fmtDateTime(task.done_at)}</Row>}
                {task.project_name && (
                  <Row label="Project"><Link className="underline" href={`/projects/${task.project_id}`}>{task.project_name}</Link></Row>
                )}
                {task.parent_id && <Row label="Parent task"><Link className="underline" href={`/tasks/${task.parent_id}`}>#{task.parent_id}</Link></Row>}
              </div>

              {batchTasks.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  📎 Part of a batch: {batchTasks.map((b: any) => (
                    <Link key={b.id} href={`/tasks/${b.id}`} className="mr-2 underline">#{b.id} {b.title}</Link>
                  ))}
                </div>
              )}

              {perm.mustExplain && (
                <Card className="border-red-300 bg-red-50">
                  <CardContent className="p-3">
                    <h3 className="mb-1 font-bold text-red-700">🚨 Explanation required</h3>
                    <p className="mb-3 text-sm text-red-600">
                      Submit a written explanation (min 20 characters) and propose a new ETA before doing anything else.
                    </p>
                    <Textarea className="mb-2 min-h-[80px]" placeholder="Why was this task delayed?" value={explanation} onChange={(e) => setExplanation(e.target.value)} />
                    <Label>Proposed new ETA</Label>
                    <Input type="datetime-local" className="mb-3" value={propEta} onChange={(e) => setPropEta(e.target.value)} />
                    <Button variant="destructive" className="w-full" onClick={submitExplanation}>Submit explanation</Button>
                  </CardContent>
                </Card>
              )}

              {escalation?.explanation && task.status === 'ESCALATED' && (
                <Card className="border-amber-300 bg-amber-50">
                  <CardContent className="p-3">
                    <h3 className="mb-1 font-bold text-amber-800">Escalation explanation</h3>
                    <p className="whitespace-pre-wrap text-sm text-gray-700">{escalation.explanation}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Proposed ETA: {fmtDateTime(escalation.proposed_eta_at)} · submitted {timeAgo(escalation.explanation_at)}</p>
                    {perm.canReview && (
                      <div className="mt-3 flex gap-2">
                        <Button className="flex-1" onClick={() => review('ACCEPTED')}>Accept & re-plan</Button>
                        <Button variant="destructive" className="flex-1" onClick={() => review('REJECTED')}>Reject</Button>
                      </div>
                    )}
                    {escalation.review_status && escalation.review_status !== 'PENDING' && (
                      <div className="mt-2 text-xs font-bold">{escalation.review_status}</div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-wrap gap-2">
                {perm.canAcknowledge && <Button onClick={() => setAckOpen(true)}>✓ Accept + ETA</Button>}
                {perm.canDiscuss && (
                  <Button variant="outline" onClick={() => setReasonModal({ action: 'discuss', title: 'What should be discussed? (optional)' })}>
                    Discuss
                  </Button>
                )}
                {perm.canReject && (
                  <Button variant="outline" className="text-red-600" onClick={() => setReasonModal({ action: 'reject', title: 'Why reject this task?' })}>
                    Reject
                  </Button>
                )}
                {perm.canStart && (
                  <Button onClick={() => act({ action: 'start' })}>
                    {task.status === 'ESCALATED' ? 'Mark in progress' : '▶ Start'}
                  </Button>
                )}
                {perm.canRequestInput && (
                  <Button variant="outline" onClick={() => { setInputRequestText(''); setInputRequestOpen(true); }}>
                    Request information
                  </Button>
                )}
                {perm.canResumeAfterInput && (
                  <Button onClick={() => act({ action: 'resume_after_input' })}>Continue working</Button>
                )}
                {perm.canDone && (
                  <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => act({ action: 'done' })}>
                    ✔ Mark done
                  </Button>
                )}
                {perm.canEditEta && <Button variant="outline" onClick={() => { setEtaVal(toLocalInput(task.eta_at || Date.now())); setEtaOpen(true); }}>Edit ETA</Button>}
                {perm.canBlock && !task.blocked_reason && <Button variant="outline" onClick={() => setReasonModal({ action: 'block', title: 'What is blocking you?' })}>🚧 Blocked</Button>}
                {task.blocked_reason && perm.canUnblock && <Button variant="outline" onClick={() => act({ action: 'unblock' })}>Unblock</Button>}
                {perm.canReopen && <Button variant="outline" onClick={() => setReasonModal({ action: 'reopen', title: 'Why reopen this task?' })}>↩ Reopen</Button>}
                {perm.canCancel && <Button variant="outline" className="text-red-600" onClick={() => setReasonModal({ action: 'cancel', title: 'Why cancel this task?' })}>Cancel task</Button>}
              </div>

              {perm.canProvideInput && task.status === 'WAITING_FOR_INPUT' && (
                <Card className="border-cyan-300 bg-cyan-50">
                  <CardContent className="p-3">
                    <h3 className="mb-2 font-bold text-cyan-900">Provide requested information</h3>
                    {task.input_request_note && (
                      <p className="mb-3 whitespace-pre-wrap text-sm text-cyan-950">{task.input_request_note}</p>
                    )}
                    <Textarea
                      className="min-h-[120px] bg-white font-mono text-sm"
                      placeholder="Paste credentials or details here…"
                      value={inputPayloadText}
                      onChange={(e) => setInputPayloadText(e.target.value)}
                    />
                    <Button
                      className="mt-3 w-full"
                      onClick={() => {
                        if (!inputPayloadText.trim()) {
                          toast.error('Enter the requested information');
                          return;
                        }
                        act({ action: 'provide_input', inputPayload: inputPayloadText.trim() });
                      }}
                    >
                      Submit information
                    </Button>
                  </CardContent>
                </Card>
              )}

              {err && (
                <Alert variant="destructive">
                  <AlertDescription>{err}</AlertDescription>
                </Alert>
              )}

              {fileAttachments.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-bold">Attachments</h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {fileAttachments.map((a: any) => (
                      <AttachmentMedia key={a.id} attachment={a} />
                    ))}
                  </div>
                </div>
              )}

              {!task.parent_id && (
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="min-w-0 text-sm font-bold">
                      Subtasks{subtasks.length > 0 && (
                        <span className="ml-2 text-emerald-600">{subtasks.filter((s: any) => s.status === 'DONE').length} of {subtasks.length} done</span>
                      )}
                    </h3>
                    {perm.canAddSubtask && (
                      <Button variant="outline" size="xs" className="shrink-0" onClick={() => setSubOpen(true)}>+ Add subtask</Button>
                    )}
                  </div>
                  {subtasks.length > 0 && (
                    <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(100 * subtasks.filter((s: any) => s.status === 'DONE').length) / subtasks.length}%` }} />
                    </div>
                  )}
                  <div className="space-y-2">
                    {subtasks.map((s: any) => (
                      <div key={s.id} className="flex min-w-0 items-start gap-2.5">
                        <Checkbox
                          checked={s.status === 'DONE'}
                          disabled={s.status === 'DONE'}
                          onCheckedChange={() =>
                            api(`/api/tasks/${s.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'done' }) })
                              .then(() => { load(); toast.success('Subtask marked done'); })
                              .catch((e) => { setErr(e.message); toast.errorFrom(e); })
                          }
                          className="mt-0.5 size-5 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <Link href={`/tasks/${s.id}`} className={`block text-sm break-words ${s.status === 'DONE' ? 'text-muted-foreground line-through' : 'font-medium'}`}>{s.title}</Link>
                          <div className="text-[11px] text-muted-foreground">
                            {s.assignee_name || 'Unassigned'}
                            {s.done_at && <> · ✔ done {fmtDateTime(s.done_at)}</>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {subtasks.length === 0 && <div className="text-xs text-muted-foreground">No subtasks yet.</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right — Activity (Admin/CEO) + Comments */}
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background">
          {showActivity && (
            <div className="flex h-44 shrink-0 flex-col overflow-hidden border-b">
              <PanelHeader title="Activity" />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-2 p-4">
                  {activity.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">No activity yet.</div>
                  ) : (
                    activity.map((a: any) => {
                      const meta = JSON.parse(a.meta || '{}');
                      const detail = meta.reason || meta.note || meta.message || '';
                      return (
                        <div key={a.id} className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                          <span className="font-semibold text-foreground">{a.actor_name || 'System'}</span>
                          <span className="text-muted-foreground"> · {activityTypeLabel(a.type)} · {timeAgo(a.created_at)}</span>
                          {detail && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{detail}</p>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <PanelHeader title="Comments" />
            <CommentsPanel taskId={Number(id)} onChanged={load} canComment={perm.canComment !== false} />
          </div>
        </section>
      </div>

      <AckModal task={task} open={ackOpen} onClose={() => setAckOpen(false)} onDone={load} />
      <Composer open={subOpen} onClose={() => setSubOpen(false)} onCreated={load} presetParentId={task.id} />
      <Modal open={etaOpen} onClose={() => setEtaOpen(false)} title="Update ETA">
        {task.status === 'ESCALATED' && (
          <p className="mb-3 text-xs text-muted-foreground">The due date will be updated to match this ETA.</p>
        )}
        <Input type="datetime-local" className="mb-3" value={etaVal} onChange={(e) => setEtaVal(e.target.value)} />
        <Button className="w-full" onClick={submitEta}>Save ETA</Button>
      </Modal>
      <Modal open={inputRequestOpen} onClose={() => setInputRequestOpen(false)} title="Request information">
        <p className="mb-3 text-sm text-muted-foreground">
          Describe what you need. This will be visible to the task creator or Admin.
        </p>
        <Textarea
          className="mb-3 min-h-[100px]"
          placeholder="Example: Need SMTP host, port, user, and app password"
          value={inputRequestText}
          onChange={(e) => setInputRequestText(e.target.value)}
        />
        <Button
          className="w-full"
          onClick={() => {
            if (inputRequestText.trim().length < 10) {
              toast.error('Describe what you need (at least 10 characters)');
              return;
            }
            act({ action: 'request_input', inputRequestNote: inputRequestText.trim() });
            setInputRequestOpen(false);
            setInputRequestText('');
          }}
        >
          Send request
        </Button>
      </Modal>
      <Modal open={!!reasonModal} onClose={() => setReasonModal(null)} title={reasonModal?.title || ''}>
        <Textarea className="mb-3 min-h-[80px]" value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
        <Button className="w-full" onClick={submitReason} disabled={!reasonText.trim()}>Submit</Button>
      </Modal>
    </div>
  );
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Shell><TaskDetailInner id={id} /></Shell>;
}
