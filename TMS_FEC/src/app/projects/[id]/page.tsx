'use client';
import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import Shell, { useMe } from '@/components/Shell';
import TaskTable from '@/components/TaskTable';
import CommentsModal from '@/components/CommentsModal';
import AuthImage from '@/components/AuthImage';
import Composer from '@/components/Composer';
import { api, apiUpload, timeAgo, fmtDate, uploadUrl, activityTypeLabel, toast } from '@/lib/util';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import SearchableSelect, { buildUserSelectOptions } from '@/components/SearchableSelect';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

function ProjectInner({ id }: { id: string }) {
  const me = useMe();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<'overview' | 'tasks' | 'files' | 'activity'>('overview');
  const [note, setNote] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentsTask, setCommentsTask] = useState<any>(null);
  const [addUserId, setAddUserId] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    api(`/api/projects/${id}`).then(setData).catch((e) => { setErr(e.message); toast.errorFrom(e); });
  }, [id]);
  useEffect(() => { load(); api('/api/users').then((d) => setUsers(d.users.filter((u: any) => u.is_active))); }, [load]);

  if (err) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="py-6 text-center">{err}</AlertDescription>
      </Alert>
    );
  }
  if (!data) return <Card className="h-60 animate-pulse" />;
  const { project, members, notes, tasks, files, activity, canManage } = data;

  const patch = (body: any, successMsg = 'Project updated') =>
    api(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
      .then(() => { toast.success(successMsg); load(); })
      .catch((e) => { setErr(e.message); toast.errorFrom(e); });

  const uploadFile = async (f: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('projectId', id);
      await apiUpload('/api/uploads', fd);
      toast.success('File uploaded');
      load();
    } catch (e) {
      toast.errorFrom(e);
    } finally { setUploading(false); }
  };

  return (
    <>
      <Link href="/projects" className="text-sm text-muted-foreground hover:text-brand-600">← Projects</Link>
      <Card className="mt-2 mb-4">
        <CardContent>
          <h1 className="text-lg font-bold">{project.name}</h1>
          <div className="mt-0.5 text-xs text-muted-foreground">Owner: {project.owner_name} · created {fmtDate(project.created_at)}</div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="mb-4 h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{project.description || '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">Notes — visible to every member</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 space-y-2">
                {notes.map((n: any) => (
                  <div key={n.id} className={`rounded-lg px-3 py-2 text-sm ${n.pinned ? 'border border-amber-200 bg-amber-50' : 'bg-muted'}`}>
                    {n.pinned ? '📌 ' : ''}{n.body}
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {n.author_name} · {timeAgo(n.created_at)}
                      {canManage && (
                        <Button
                          variant="link"
                          size="xs"
                          className="ml-2 h-auto p-0 text-brand-600"
                          onClick={() => patch({ togglePinNoteId: n.id }, n.pinned ? 'Note unpinned' : 'Note pinned')}
                        >
                          {n.pinned ? 'unpin' : 'pin'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input className="flex-1" placeholder="Add a note for the team…" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button disabled={!note.trim()} onClick={() => { patch({ note }, 'Note added'); setNote(''); }}>Add</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">Members ({members.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 space-y-1.5">
                {members.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <span>{m.name} <span className="text-xs text-muted-foreground">({m.role})</span></span>
                    {canManage && m.id !== project.owner_id && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-red-400 hover:text-red-600"
                        onClick={() => patch({ removeMemberId: m.id }, 'Member removed')}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <SearchableSelect
                    className="flex-1 h-10"
                    value={addUserId}
                    onChange={setAddUserId}
                    placeholder="Add member…"
                    searchPlaceholder="Search users…"
                    options={buildUserSelectOptions(users.filter((u) => !members.some((m: any) => m.id === u.id)))}
                  />
                  <Button disabled={!addUserId} onClick={() => { patch({ addMemberId: Number(addUserId) }, 'Member added'); setAddUserId(''); }}>Add</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Button className="mb-3" onClick={() => setComposerOpen(true)}>+ New task in this project</Button>
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">No tasks in this project yet.</CardContent>
            </Card>
          ) : (
            <TaskTable tasks={tasks} onOpenComments={setCommentsTask} onTaskUpdated={load} />
          )}
        </TabsContent>

        <TabsContent value="files">
          <Button asChild variant="outline" className="mb-3 cursor-pointer">
            <label>
              {uploading ? 'Uploading…' : '⬆ Upload file to project'}
              <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            </label>
          </Button>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {files.map((f: any) => (
              <a key={f.id} href={uploadUrl(f.id)} target="_blank" className="block">
                <Card className="overflow-hidden transition hover:ring-brand-500">
                  {f.mime_type.startsWith('image/') ? (
                    <AuthImage id={f.id} alt={f.file_name} className="h-28 w-full object-cover" />
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-muted text-3xl">📄</div>
                  )}
                  <CardContent className="px-2 py-1.5">
                    <div className="truncate text-[11px] font-medium">{f.file_name}</div>
                    <div className="text-[10px] text-muted-foreground">{f.uploader_name} · {timeAgo(f.created_at)}</div>
                  </CardContent>
                </Card>
              </a>
            ))}
            {files.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">No files yet.</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardContent className="space-y-2">
              {activity.map((a: any) => (
                <div key={a.id} className="border-b border-border/50 pb-2 text-xs text-muted-foreground last:border-0">
                  <span className="font-semibold text-foreground">{a.actor_name || 'System'}</span>
                  {' '}{activityTypeLabel(a.type)}
                  {a.task_title && <> on <Link href={`/tasks/${a.task_id}`} className="text-brand-600 underline">{a.task_title}</Link></>}
                  {' · '}{timeAgo(a.created_at)}
                </div>
              ))}
              {activity.length === 0 && <div className="py-4 text-center text-muted-foreground">No activity yet.</div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CommentsModal
        task={commentsTask}
        open={!!commentsTask}
        onClose={() => setCommentsTask(null)}
        onChanged={load}
      />
      <Composer open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={load} presetProjectId={Number(id)} />
    </>
  );
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Shell><ProjectInner id={id} /></Shell>;
}
