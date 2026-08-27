'use client';
import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { api, apiUpload, deleteUpload, fromLocalInput, toLocalInput, toast } from '@/lib/util';
import type { AttachmentLike } from '@/components/AttachmentMedia';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import DescriptionEditor from '@/components/DescriptionEditor';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect } from '@/components/ui/native-select';
import SearchableSelect, { buildUserTeamSelectOptions } from '@/components/SearchableSelect';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Composer({
  open, onClose, onCreated, presetProjectId, presetParentId, presetAttachmentIds, presetBoardId, presetTitle, presetAssigneeId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (ids: number[], detail?: { title?: string; description?: string; assigneeId?: number | null; lines?: string[] }) => void;
  presetProjectId?: number | null;
  presetParentId?: number | null;
  presetAttachmentIds?: number[];
  presetBoardId?: number | null;
  presetTitle?: string;
  presetAssigneeId?: number | null;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [title, setTitle] = useState(presetTitle || '');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [due, setDue] = useState('');
  const [projectId, setProjectId] = useState<string>(presetProjectId ? String(presetProjectId) : '');
  const [multiple, setMultiple] = useState(false);
  const [linesText, setLinesText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [voiceAttachments, setVoiceAttachments] = useState<AttachmentLike[]>([]);
  const [pendingVoiceIds, setPendingVoiceIds] = useState<number[]>([]);
  const pendingVoiceIdsRef = useRef<number[]>([]);
  pendingVoiceIdsRef.current = pendingVoiceIds;
  const [taskTypes, setTaskTypes] = useState<any[]>([]);
  const [taskTypeId, setTaskTypeId] = useState('');
  const [collaboratorIds, setCollaboratorIds] = useState<number[]>([]);
  const [watcherIds, setWatcherIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    api('/api/users').then((d) => setUsers(d.users.filter((u: any) => u.is_active)));
    api('/api/teams').then((d) => setTeams(d.teams));
    api('/api/projects').then((d) => setProjects(d.projects));
    setTitle(presetTitle || '');
    setAssignee(presetAssigneeId ? `u:${presetAssigneeId}` : '');
    setCollaboratorIds([]);
    setWatcherIds([]);
    setErr('');
  }, [open, presetTitle, presetAssigneeId]);

  // Task types follow the selected person's team (or the selected team)
  useEffect(() => {
    setTaskTypeId('');
    setCollaboratorIds([]);
    setWatcherIds([]);
    if (!assignee) { setTaskTypes([]); return; }
    const [kind, idStr] = assignee.split(':');
    const q = kind === 't' ? `teamId=${idStr}` : `userId=${idStr}`;
    api(`/api/task-types?${q}`).then((d) => setTaskTypes(d.types)).catch(() => setTaskTypes([]));
  }, [assignee]);

  const selectedTeamId = (() => {
    if (!assignee) return null;
    const [kind, idStr] = assignee.split(':');
    if (kind === 't') return Number(idStr);
    return users.find((u) => u.id === Number(idStr))?.team_id ?? null;
  })();
  const teamMembers = assignee.startsWith('t:')
    ? users.filter((u) => u.team_id === Number(assignee.split(':')[1]))
    : [];
  const primaryUserId = assignee.startsWith('u:') ? Number(assignee.split(':')[1]) : null;
  const extraMemberCandidates = users.filter((u) => u.id !== primaryUserId);

  const toggleId = (list: number[], id: number, other: number[]) => {
    if (other.includes(id)) return list;
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  };

  const quickDue = (label: string) => {
    const d = new Date();
    if (label === 'eod') d.setHours(19, 0, 0, 0);
    if (label === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); }
    if (label === '2d') { d.setDate(d.getDate() + 2); d.setHours(19, 0, 0, 0); }
    setDue(toLocalInput(d.getTime()));
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAssignee('');
    setLinesText('');
    setFiles([]);
    setVoiceAttachments([]);
    setPendingVoiceIds([]);
    setMultiple(false);
    setDue('');
    setTaskTypeId('');
    setCollaboratorIds([]);
    setWatcherIds([]);
  };

  const handleClose = () => {
    const ids = [...pendingVoiceIdsRef.current];
    void Promise.all(
      ids.map((id) =>
        deleteUpload(id).catch(() => {
          /* best effort */
        })
      )
    ).finally(() => {
      resetForm();
      onClose();
    });
  };

  const submit = async () => {
    setErr('');
    const dueAt = fromLocalInput(due);
    if (!dueAt) { const msg = 'Pick a due date & time'; setErr(msg); toast.error(msg); return; }
    if (!assignee) { const msg = 'Pick an assignee'; setErr(msg); toast.error(msg); return; }
    if (multiple) {
      const lines = linesText.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) { const msg = 'Enter at least one task title'; setErr(msg); toast.error(msg); return; }
    } else if (!title.trim()) {
      const msg = 'Title is required'; setErr(msg); toast.error(msg); return;
    }
    setBusy(true);
    try {
      // upload files first
      const attachmentIds: number[] = [...(presetAttachmentIds || [])];
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        const d = await apiUpload('/api/uploads', fd);
        attachmentIds.push(d.id);
      }
      const [kind, idStr] = assignee.split(':');
      const payload: any = {
        title, description, priority, dueAt,
        assigneeId: kind === 'u' ? Number(idStr) : null,
        teamId: kind === 't' ? Number(idStr) : null,
        projectId: projectId ? Number(projectId) : null,
        parentId: presetParentId || null,
        boardId: presetBoardId || null,
        attachmentIds,
        descriptionAttachmentIds: pendingVoiceIds,
        taskTypeId: taskTypeId ? Number(taskTypeId) : null,
        collaboratorIds,
        watcherIds,
        multiple,
        lines: multiple ? linesText.split('\n').map((l) => l.trim()).filter(Boolean) : [],
      };
      const d = await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
      const count = Array.isArray(d.ids) ? d.ids.length : 1;
      if (presetParentId) {
        toast.success(count > 1 ? `${count} subtasks created` : 'Subtask created');
      } else if (multiple) {
        toast.success(`${count} task${count > 1 ? 's' : ''} created`);
      } else {
        toast.success('Task created');
      }
      onCreated?.(d.ids, {
        title: multiple ? undefined : title.trim(),
        description: description.trim(),
        assigneeId: kind === 'u' ? Number(idStr) : null,
        lines: multiple ? linesText.split('\n').map((l) => l.trim()).filter(Boolean) : undefined,
      });
      resetForm();
      onClose();
    } catch (e: any) {
      setErr(e.message);
      toast.errorFrom(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={presetParentId ? 'New subtask' : 'New task'}>
      <div className="space-y-4">
        {!presetParentId && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="composer-multiple"
              checked={multiple}
              onCheckedChange={(v) => setMultiple(v === true)}
            />
            <Label htmlFor="composer-multiple" className="text-sm font-medium text-muted-foreground">
              Multiple tasks (one per line — like the CEO&apos;s 3-in-one message)
            </Label>
          </div>
        )}
        {multiple ? (
          <div className="space-y-2">
            <Label>Tasks — one per line</Label>
            <Textarea
              className="min-h-[100px]"
              placeholder={'Prepare sales report\nCall vendor about invoice\nUpdate pricing page'}
              value={linesText}
              onChange={(e) => setLinesText(e.target.value)}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              className="h-10"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
            />
          </div>
        )}
        <div className="relative z-20 space-y-2">
          <Label>Assign to</Label>
          <SearchableSelect
            className="h-10"
            value={assignee}
            onChange={setAssignee}
            placeholder={users.length ? 'Choose person or team…' : 'Loading people…'}
            searchPlaceholder="Search people or teams…"
            emptyMessage={users.length ? 'No matching people or teams' : 'No users available'}
            disabled={users.length === 0 && teams.length === 0}
            options={buildUserTeamSelectOptions(users, teams, { includeTeams: !presetParentId })}
          />
        </div>
        {teamMembers.length > 0 && (
          <div className="text-xs text-muted-foreground -mt-2">
            <span className="font-semibold">Team members</span> (tap to assign a person):
            <div className="flex flex-wrap gap-1.5 mt-1">
              {teamMembers.map((m) => (
                <Button
                  key={m.id}
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => setAssignee(`u:${m.id}`)}
                >
                  {m.name}
                </Button>
              ))}
            </div>
          </div>
        )}
        {primaryUserId && extraMemberCandidates.length > 0 && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional members (optional)</p>
            <div className="space-y-2">
              <Label className="text-xs">Collaborators — can view &amp; comment</Label>
              <div className="max-h-28 space-y-1 overflow-y-auto">
                {extraMemberCandidates.map((u) => (
                  <label key={`c-${u.id}`} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={collaboratorIds.includes(u.id)}
                      disabled={watcherIds.includes(u.id)}
                      onCheckedChange={() => setCollaboratorIds((ids) => toggleId(ids, u.id, watcherIds))}
                    />
                    <span>{u.name}{u.team_name ? ` (${u.team_name})` : ''}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Watchers — view updates only</Label>
              <div className="max-h-28 space-y-1 overflow-y-auto">
                {extraMemberCandidates.map((u) => (
                  <label key={`w-${u.id}`} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={watcherIds.includes(u.id)}
                      disabled={collaboratorIds.includes(u.id)}
                      onCheckedChange={() => setWatcherIds((ids) => toggleId(ids, u.id, collaboratorIds))}
                    />
                    <span>{u.name}{u.team_name ? ` (${u.team_name})` : ''}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
        {assignee && !presetParentId && (taskTypes.length === 0 ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800">
            <AlertDescription className="text-xs text-amber-800">
              This team has no task types yet. A Head/Admin can add them from the <b>Admin</b> page. The task can still be created without a type.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            <Label>Task type</Label>
            <NativeSelect className="h-10" value={taskTypeId} onChange={(e) => setTaskTypeId(e.target.value)}>
              <option value="">None</option>
              {taskTypes.map((tt) => (
                <option key={tt.id} value={tt.id}>{tt.name}</option>
              ))}
            </NativeSelect>
          </div>
        ))}
        <div className="space-y-2">
          <Label>Due date & time</Label>
          <div className="flex gap-1.5 mb-2 flex-wrap">
            <Button type="button" variant="outline" size="xs" onClick={() => quickDue('eod')}>Today EOD</Button>
            <Button type="button" variant="outline" size="xs" onClick={() => quickDue('tomorrow')}>Tomorrow noon</Button>
            <Button type="button" variant="outline" size="xs" onClick={() => quickDue('2d')}>+2 days</Button>
          </div>
          <Input
            type="datetime-local"
            className="h-10"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Priority</Label>
            <NativeSelect className="h-10" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option>URGENT</option><option>HIGH</option><option>NORMAL</option><option>LOW</option>
            </NativeSelect>
          </div>
          {!presetParentId && (
            <div className="space-y-2">
              <Label>Project (optional)</Label>
              <NativeSelect className="h-10" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </NativeSelect>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Description (optional)</Label>
          <DescriptionEditor
            value={description}
            onChange={setDescription}
            rows={3}
            voiceAttachments={voiceAttachments}
            onVoiceUploaded={(id, durationSec) => {
              setPendingVoiceIds((prev) => [...prev, id]);
              setVoiceAttachments((prev) => [
                ...prev,
                {
                  id,
                  file_name: durationSec
                    ? `Voice note (${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')})`
                    : 'Voice note',
                  mime_type: 'audio/webm',
                  context: 'description',
                },
              ]);
            }}
            onRemoveVoiceAttachment={(id) => {
              setVoiceAttachments((prev) => prev.filter((a) => a.id !== id));
              setPendingVoiceIds((prev) => prev.filter((x) => x !== id));
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Attachments</Label>
          <Input
            type="file"
            multiple
            className="h-10 text-sm"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {(presetAttachmentIds?.length || 0) > 0 && (
            <div className="text-xs text-emerald-700 mt-1">✓ Drawing from Scribble attached</div>
          )}
        </div>
        {err && (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}
        <Button className="w-full" size="lg" disabled={busy} onClick={submit}>
          {busy ? 'Creating…' : multiple ? 'Create tasks' : 'Create task'}
        </Button>
      </div>
    </Modal>
  );
}
