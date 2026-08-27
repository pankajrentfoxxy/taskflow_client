'use client';
import { useEffect, useState } from 'react';
import Shell, { useMe } from '@/components/Shell';
import Modal from '@/components/Modal';
import { api, getErrorMessage, toast } from '@/lib/util';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { NativeSelect } from '@/components/ui/native-select';
import SearchableSelect, { buildUserSelectOptions } from '@/components/SearchableSelect';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Pencil, Trash2 } from 'lucide-react';

function AdminInner() {
  const me = useMe();
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [userOpen, setUserOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'MEMBER', teamId: '' });
  const [teamForm, setTeamForm] = useState({ name: '', managerId: '' });
  const [editTeam, setEditTeam] = useState<any>(null);
  const [editTeamForm, setEditTeamForm] = useState({ name: '', managerId: '', memberIds: [] as number[] });
  const [savingTeam, setSavingTeam] = useState(false);
  const [types, setTypes] = useState<any[]>([]);
  const [typeForm, setTypeForm] = useState({ teamId: '', name: '' });
  const [editType, setEditType] = useState<any>(null);
  const [editTypeForm, setEditTypeForm] = useState({ name: '' });
  const [savingType, setSavingType] = useState(false);
  const [err, setErr] = useState('');

  const notifyErr = (e: unknown) => {
    setErr(getErrorMessage(e));
    toast.errorFrom(e);
  };

  const load = () => {
    api('/api/users').then((d) => setUsers(d.users)).catch(() => {});
    api('/api/teams').then((d) => setTeams(d.teams)).catch(() => {});
    api('/api/task-types?manage=1').then((d) => setTypes(d.types)).catch(() => setTypes([]));
  };
  useEffect(() => { load(); }, []);

  const isAdmin = me?.role === 'ADMIN';
  const isHead = me?.role === 'MANAGER';
  if (me && !isAdmin && !isHead && me.role !== 'CEO') {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-400">
          Admin or Team Head access only.
        </CardContent>
      </Card>
    );
  }

  const createType = async () => {
    setErr('');
    try {
      const teamId = isAdmin || me?.role === 'CEO' ? Number(typeForm.teamId) : me?.team_id;
      await api('/api/task-types', { method: 'POST', body: JSON.stringify({ teamId, name: typeForm.name }) });
      toast.success('Task type created');
      setTypeForm({ teamId: '', name: '' }); load();
    } catch (e: any) { notifyErr(e); }
  };

  const createUser = async () => {
    setErr('');
    try {
      await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({ ...form, teamId: form.teamId ? Number(form.teamId) : null }),
      });
      setUserOpen(false); setForm({ name: '', email: '', password: '', role: 'MEMBER', teamId: '' }); load();
      toast.success('User created');
    } catch (e: any) { notifyErr(e); }
  };

  const createTeam = async () => {
    setErr('');
    try {
      await api('/api/teams', {
        method: 'POST',
        body: JSON.stringify({ name: teamForm.name, managerId: teamForm.managerId ? Number(teamForm.managerId) : null }),
      });
      setTeamOpen(false); setTeamForm({ name: '', managerId: '' }); load();
      toast.success('Team created');
    } catch (e: any) { notifyErr(e); }
  };

  const patchUser = (id: number, body: any) =>
    api('/api/users', { method: 'PATCH', body: JSON.stringify({ id, ...body }) })
      .then(() => { toast.success('User updated'); load(); })
      .catch((e) => notifyErr(e));

  const deleteType = async (tt: any) => {
    if (Number(tt.used_count) > 0) {
      const msg = 'Cannot delete a task type that is in use — deactivate it instead';
      setErr(msg);
      toast.error(msg);
      return;
    }
    if (!confirm(`Delete task type "${tt.name}"? This cannot be undone.`)) return;
    setErr('');
    try {
      await api(`/api/task-types?id=${tt.id}`, { method: 'DELETE' });
      toast.success('Task type deleted');
      load();
    } catch (e: any) {
      notifyErr(e);
    }
  };

  const openEditType = (tt: any) => {
    setErr('');
    setEditType(tt);
    setEditTypeForm({ name: tt.name });
  };

  const saveTypeEdit = async () => {
    if (!editType) return;
    setErr('');
    setSavingType(true);
    try {
      await api('/api/task-types', {
        method: 'PATCH',
        body: JSON.stringify({ id: editType.id, name: editTypeForm.name.trim() }),
      });
      setEditType(null);
      toast.success('Task type updated');
      load();
    } catch (e: any) {
      notifyErr(e);
    } finally {
      setSavingType(false);
    }
  };

  const deleteUser = async (u: any) => {
    if (u.id === me?.id) {
      const msg = 'You cannot delete your own account';
      setErr(msg);
      toast.error(msg);
      return;
    }
    if (!confirm(`Permanently delete "${u.name}" and all of their tasks, comments, notifications, projects, and uploads? This cannot be undone.`)) return;
    setErr('');
    try {
      await api(`/api/users?id=${u.id}`, { method: 'DELETE' });
      toast.success('User removed');
      load();
    } catch (e: any) {
      notifyErr(e);
    }
  };

  const deleteTeam = async (t: any) => {
    if (!confirm(`Delete team "${t.name}"? Remove all members first.`)) return;
    setErr('');
    try {
      await api(`/api/teams?id=${t.id}`, { method: 'DELETE' });
      toast.success('Team deleted');
      load();
    } catch (e: any) {
      notifyErr(e);
    }
  };

  const openEditTeam = (team: any) => {
    setErr('');
    setEditTeam(team);
    setEditTeamForm({
      name: team.name,
      managerId: team.manager_id ? String(team.manager_id) : '',
      memberIds: users.filter((u) => u.team_id === team.id && u.is_active).map((u) => u.id),
    });
  };

  const toggleTeamMember = (userId: number, checked: boolean) => {
    setEditTeamForm((f) => ({
      ...f,
      memberIds: checked
        ? [...new Set([...f.memberIds, userId])]
        : f.memberIds.filter((id) => id !== userId),
    }));
  };

  const saveTeamEdit = async () => {
    if (!editTeam) return;
    setErr('');
    setSavingTeam(true);
    try {
      let memberIds = [...editTeamForm.memberIds];
      if (editTeamForm.managerId) {
        const mid = Number(editTeamForm.managerId);
        if (!memberIds.includes(mid)) memberIds = [...memberIds, mid];
      }
      await api('/api/teams', {
        method: 'PATCH',
        body: JSON.stringify({
          id: editTeam.id,
          name: editTeamForm.name.trim(),
          managerId: editTeamForm.managerId ? Number(editTeamForm.managerId) : null,
          memberIds,
        }),
      });
      setEditTeam(null);
      toast.success('Team updated');
      load();
    } catch (e: any) {
      notifyErr(e);
    } finally {
      setSavingTeam(false);
    }
  };

  const activeUsers = users.filter((u) => u.is_active);

  return (
    <>
      <h1 className="text-xl font-bold mb-4">Admin</h1>
      {err && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm">Task Types — category per team</h2>
      </div>
      <Card className="mb-3 overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-left text-xs text-gray-400 uppercase border-b border-gray-100 hover:bg-transparent">
                <TableHead className="px-4 py-2.5">Team</TableHead>
                <TableHead className="px-2 py-2.5">Task type</TableHead>
                <TableHead className="px-2 py-2.5">Used</TableHead>
                <TableHead className="px-2 py-2.5">Status</TableHead>
                <TableHead className="px-2 py-2.5 w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((tt) => (
                <TableRow key={tt.id} className="border-b border-gray-50 last:border-0">
                  <TableCell className="px-4 py-2 text-xs text-gray-500">{tt.team_name}</TableCell>
                  <TableCell className="px-2 py-2 font-medium">{tt.name}</TableCell>
                  <TableCell className="px-2 py-2 text-xs text-gray-400">{tt.used_count} task{tt.used_count === 1 ? '' : 's'}</TableCell>
                  <TableCell className="px-2 py-2">
                    <Badge
                      role="button"
                      className={`cursor-pointer ${tt.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}
                      onClick={() => api('/api/task-types', { method: 'PATCH', body: JSON.stringify({ id: tt.id, isActive: !tt.is_active }) }).then(() => { toast.success(tt.is_active ? 'Task type deactivated' : 'Task type activated'); load(); }).catch((e) => notifyErr(e))}
                    >
                      {tt.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        title={`Edit ${tt.name}`}
                        onClick={() => openEditType(tt)}
                      >
                        <Pencil />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive hover:text-destructive"
                        disabled={Number(tt.used_count) > 0}
                        title={Number(tt.used_count) > 0 ? `Used by ${tt.used_count} task(s) — cannot delete` : 'Delete task type'}
                        onClick={() => deleteType(tt)}
                      >
                        <Trash2 />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {types.length === 0 && (
                <TableRow>
                  <TableCell className="px-4 py-4 text-gray-400" colSpan={5}>No task types yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="mb-6">
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-2">
            {(isAdmin || me?.role === 'CEO') ? (
              <NativeSelect value={typeForm.teamId} onChange={(e) => setTypeForm({ ...typeForm, teamId: e.target.value })}>
                <option value="">Team…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </NativeSelect>
            ) : (
              <div className="flex h-8 items-center rounded-lg border border-input bg-gray-50 px-2.5 text-sm text-gray-500">
                {me?.team || 'My team'}
              </div>
            )}
            <Input placeholder="Type name (e.g. Lead Follow-up)" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} />
            <Button
              onClick={createType}
              disabled={!typeForm.name.trim() || ((isAdmin || me?.role === 'CEO') && !typeForm.teamId)}
            >
              + Add type
            </Button>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (<>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm">Users ({users.length})</h2>
        <Button size="sm" className="text-xs" onClick={() => setUserOpen(true)}>+ Add user</Button>
      </div>
      <Card className="mb-6 overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-left text-xs text-gray-400 uppercase border-b border-gray-100 hover:bg-transparent">
                <TableHead className="px-4 py-2.5">Name</TableHead>
                <TableHead className="px-2 py-2.5">Role</TableHead>
                <TableHead className="px-2 py-2.5">Team</TableHead>
                <TableHead className="px-2 py-2.5">Status</TableHead>
                <TableHead className="px-2 py-2.5"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="border-b border-gray-50 last:border-0">
                  <TableCell className="px-4 py-2">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-[11px] text-gray-400">{u.email}</div>
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <NativeSelect className="w-auto py-1 text-xs h-auto" value={u.role} onChange={(e) => patchUser(u.id, { role: e.target.value })}>
                      <option>ADMIN</option><option>CEO</option><option>MANAGER</option><option>MEMBER</option>
                    </NativeSelect>
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <NativeSelect className="w-auto py-1 text-xs h-auto" value={u.team_id ?? ''} onChange={(e) => patchUser(u.id, { teamId: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">—</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </NativeSelect>
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <Badge
                      role="button"
                      className={`cursor-pointer ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}
                      onClick={() => patchUser(u.id, { isActive: !u.is_active })}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button className="text-xs text-brand-600 underline"
                        onClick={() => { const p = prompt(`New password for ${u.name}:`); if (p) patchUser(u.id, { password: p }); }}>
                        Reset pw
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive hover:text-destructive"
                        disabled={u.id === me?.id}
                        title={u.id === me?.id ? 'Cannot delete your own account' : `Delete ${u.name}`}
                        onClick={() => deleteUser(u)}
                      >
                        <Trash2 />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm">Teams ({teams.length})</h2>
        <Button size="sm" className="text-xs" onClick={() => setTeamOpen(true)}>+ Add team</Button>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {teams.map((t) => (
          <Card key={t.id}>
            <CardContent>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold">{t.name}</div>
                  <div className="text-xs text-gray-500 mt-1">Manager: {t.manager_name || '—'}</div>
                  <div className="text-xs text-gray-400">{t.member_count} member{t.member_count === 1 ? '' : 's'}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="icon-xs" title={`Edit ${t.name}`} onClick={() => openEditTeam(t)}>
                    <Pencil />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-destructive hover:text-destructive"
                    title={`Delete ${t.name}`}
                    onClick={() => deleteTeam(t)}
                  >
                    <Trash2 />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      </>)}

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-xs text-gray-700">System settings</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-gray-500 leading-relaxed">
          Working hours: <strong>10:00 – 19:00 IST, Mon–Sat</strong> · Response SLA: <strong>30 working minutes</strong> · Escalation: automatic when a task passes its due date.
          External cron (optional): <code className="bg-gray-100 px-1 rounded">GET {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/cron/sla-check</code> every minute — the backend also sweeps automatically on activity.
        </CardContent>
      </Card>

      <Modal open={!!editType} onClose={() => setEditType(null)} title={editType ? `Edit ${editType.name}` : 'Edit task type'}>
        <div className="space-y-4">
          <div>
            <Label>Team</Label>
            <div className="flex h-8 items-center rounded-lg border border-input bg-muted/40 px-2.5 text-sm text-muted-foreground">
              {editType?.team_name || '—'}
            </div>
          </div>
          <div>
            <Label>Task type name</Label>
            <Input
              value={editTypeForm.name}
              onChange={(e) => setEditTypeForm({ name: e.target.value })}
            />
          </div>
          {editType && Number(editType.used_count) > 0 && (
            <p className="text-xs text-muted-foreground">
              Used by {editType.used_count} task{editType.used_count === 1 ? '' : 's'}. Rename is allowed; delete is blocked while in use.
            </p>
          )}
          <Button className="w-full" onClick={saveTypeEdit} disabled={savingType || !editTypeForm.name.trim()}>
            {savingType ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </Modal>

      <Modal open={userOpen} onClose={() => setUserOpen(false)} title="Add user">
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Password</Label>
            <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role</Label>
              <NativeSelect value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option>MEMBER</option><option>MANAGER</option><option>CEO</option><option>ADMIN</option>
              </NativeSelect>
            </div>
            <div>
              <Label>Team</Label>
              <NativeSelect value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
                <option value="">None</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </NativeSelect>
            </div>
          </div>
          <Button className="w-full" onClick={createUser} disabled={!form.name || !form.email || !form.password}>Create user</Button>
        </div>
      </Modal>

      <Modal open={teamOpen} onClose={() => setTeamOpen(false)} title="Add team">
        <div className="space-y-3">
          <div>
            <Label>Team name</Label>
            <Input value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
          </div>
          <div>
            <Label>Manager</Label>
            <SearchableSelect
              className="h-10"
              value={teamForm.managerId}
              onChange={(v) => setTeamForm({ ...teamForm, managerId: v })}
              placeholder="Choose later"
              searchPlaceholder="Search users…"
              options={[
                { value: '', label: 'Choose later' },
                ...buildUserSelectOptions(users.filter((u) => u.is_active), { activeOnly: false }),
              ]}
            />
          </div>
          <Button className="w-full" onClick={createTeam} disabled={!teamForm.name}>Create team</Button>
        </div>
      </Modal>

      <Modal open={!!editTeam} onClose={() => setEditTeam(null)} title={editTeam ? `Edit ${editTeam.name}` : 'Edit team'}>
        <div className="space-y-4">
          <div>
            <Label>Team name</Label>
            <Input
              value={editTeamForm.name}
              onChange={(e) => setEditTeamForm({ ...editTeamForm, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Manager</Label>
            <SearchableSelect
              className="h-10"
              value={editTeamForm.managerId}
              onChange={(v) => setEditTeamForm({ ...editTeamForm, managerId: v })}
              placeholder="No manager"
              searchPlaceholder="Search users…"
              options={[
                { value: '', label: 'No manager' },
                ...buildUserSelectOptions(activeUsers, { activeOnly: false }),
              ]}
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Members</Label>
              <span className="text-xs text-muted-foreground">{editTeamForm.memberIds.length} selected</span>
            </div>
            <ScrollArea className="h-52 rounded-lg border">
              <div className="p-2 space-y-1">
                {activeUsers.map((u) => {
                  const checked = editTeamForm.memberIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60',
                        checked && 'bg-muted/40'
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleTeamMember(u.id, v === true)}
                      />
                      <span className="min-w-0 flex-1 truncate">{u.name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{u.role}</span>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
          <Button className="w-full" onClick={saveTeamEdit} disabled={savingTeam || !editTeamForm.name.trim()}>
            {savingTeam ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </Modal>
    </>
  );
}

export default function AdminPage() {
  return <Shell><AdminInner /></Shell>;
}
