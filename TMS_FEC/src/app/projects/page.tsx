'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import { api, toast } from '@/lib/util';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

function ProjectsInner() {
  const [projects, setProjects] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState('');

  const load = () => api('/api/projects').then((d) => setProjects(d.projects));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setErr('');
    try {
      await api('/api/projects', { method: 'POST', body: JSON.stringify({ name, description: desc }) });
      toast.success('Project created');
      setOpen(false); setName(''); setDesc(''); load();
    } catch (e: any) { setErr(e.message); toast.errorFrom(e); }
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Projects</h1>
        <Button onClick={() => setOpen(true)}>+ New project</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="block">
            <Card className="transition hover:ring-brand-500">
              <CardContent>
                <div className="font-bold">{p.name}</div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description || 'No description'}</div>
                <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
                  <span>👤 {p.member_count} members</span>
                  <span>✓ {p.open_tasks} open tasks</span>
                  <span>· {p.owner_name}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {projects.length === 0 && (
          <Card className="sm:col-span-2">
            <CardContent className="py-10 text-center text-muted-foreground">No projects yet.</CardContent>
          </Card>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New project">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-desc">Description</Label>
            <Textarea id="project-desc" className="min-h-[70px]" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          {err && (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
          <Button className="w-full" onClick={create} disabled={!name.trim()}>Create project</Button>
        </div>
      </Modal>
    </>
  );
}

export default function ProjectsPage() {
  return <Shell><ProjectsInner /></Shell>;
}
