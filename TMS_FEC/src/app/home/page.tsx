'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Shell, { useMe } from '@/components/Shell';
import TaskTable from '@/components/TaskTable';
import CommentsModal from '@/components/CommentsModal';
import AckModal from '@/components/AckModal';
import Composer from '@/components/Composer';
import TaskTemplateButton from '@/components/TaskTemplateButton';
import TaskDateRangeFilter from '@/components/TaskDateRangeFilter';
import { api, isDueInWindow, taskDueDateQueryParams } from '@/lib/util';
import { onPresenceUpdate, onTaskChanged } from '@/lib/socket';
import { IconZap, IconAlert, IconActivity, IconCalendar, IconPlus, IconPen, IconSend, IconCheckCircle } from '@/components/Icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import SearchableSelect, { buildUserTeamSelectOptions } from '@/components/SearchableSelect';
import {
  clearHomePageFilters,
  DEFAULT_HOME_PAGE_FILTERS,
  loadHomePageFilters,
  saveHomePageFilters,
} from '@/lib/taskListFilters';
import { cn } from '@/lib/utils';

function Metric({ icon, chip, value, label, hot }: { icon: React.ReactNode; chip: string; value: number; label: string; hot?: boolean }) {
  return (
    <Card className={cn('py-0', hot && 'ring-red-200')}>
      <CardContent className="flex items-center gap-3 p-4">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', chip)}>{icon}</span>
        <div className="min-w-0">
          <div className={cn('tnum text-xl font-bold leading-none', hot ? 'text-red-600' : 'text-gray-900')}>{value}</div>
          <div className="mt-1 truncate text-[11px] font-medium text-gray-400">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ accent, icon, title, tasks, extra, onOpenComments, onTaskUpdated }: {
  accent: string; icon: React.ReactNode; title: string; tasks: any[];
  extra?: (t: any) => React.ReactNode;
  onOpenComments: (task: any) => void;
  onTaskUpdated?: () => void;
}) {
  if (!tasks.length) return null;
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-md', accent)}>{icon}</span>
        <h2 className="text-[13px] font-semibold tracking-wide text-gray-600 uppercase">{title}</h2>
        <Badge variant="secondary" className="tnum text-[11px]">{tasks.length}</Badge>
        <div className="ml-1 h-px flex-1 bg-gray-200/70" />
      </div>
      <TaskTable tasks={tasks} onOpenComments={onOpenComments} onTaskUpdated={onTaskUpdated} renderAction={extra} />
    </section>
  );
}

function HomeInner() {
  const me = useMe();
  const canFilter = me && ['ADMIN', 'CEO'].includes(me.role);
  const [mine, setMine] = useState<any[]>([]);
  const [created, setCreated] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [filterAssignee, setFilterAssignee] = useState(DEFAULT_HOME_PAGE_FILTERS.filterAssignee);
  const [dueDateMode, setDueDateMode] = useState(DEFAULT_HOME_PAGE_FILTERS.dueDateMode);
  const [dueFromDate, setDueFromDate] = useState(DEFAULT_HOME_PAGE_FILTERS.dueFromDate);
  const [dueToDate, setDueToDate] = useState(DEFAULT_HOME_PAGE_FILTERS.dueToDate);
  const [filtersReady, setFiltersReady] = useState(false);
  const [ackTask, setAckTask] = useState<any>(null);
  const [commentsTask, setCommentsTask] = useState<any>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [clock, setClock] = useState<{ greeting: string; date: string } | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (!canFilter) return;
    api('/api/users').then((d) => setUsers(d.users.filter((u: any) => u.is_active)));
    api('/api/teams').then((d) => setTeams(d.teams));
  }, [canFilter]);

  useEffect(() => {
    const stored = loadHomePageFilters();
    setFilterAssignee(stored.filterAssignee);
    setDueDateMode(stored.dueDateMode);
    setDueFromDate(stored.dueFromDate);
    setDueToDate(stored.dueToDate);
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    saveHomePageFilters({
      filterAssignee,
      dueDateMode,
      dueFromDate,
      dueToDate,
    });
  }, [filterAssignee, dueDateMode, dueFromDate, dueToDate, filtersReady]);

  useEffect(() => {
    const d = new Date();
    const h = d.getHours();
    setClock({
      greeting: h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening',
      date: d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
    });
  }, []);

  const viewingFiltered = canFilter && !!filterAssignee;

  const load = useCallback(() => {
    const dueParams = taskDueDateQueryParams(dueDateMode, dueFromDate, dueToDate);
    const withDue = (base: Record<string, string>) => {
      const sp = new URLSearchParams(base);
      Object.entries(dueParams).forEach(([k, v]) => sp.set(k, v));
      return sp;
    };

    if (viewingFiltered) {
      const sp = withDue({ filter: 'all', limit: '300' });
      const [kind, idStr] = filterAssignee.split(':');
      if (kind === 'u') sp.set('assigneeId', idStr);
      else if (kind === 't') sp.set('teamId', idStr);
      api(`/api/tasks?${sp}`).then((d) => {
        setMine(d.tasks);
        setCreated([]);
      });
      return;
    }
    api(`/api/tasks?${withDue({ filter: 'mine', limit: '300' })}`).then((d) => setMine(d.tasks));
    api(`/api/tasks?${withDue({ filter: 'created', limit: '300' })}`).then((d) => setCreated(d.tasks));
  }, [viewingFiltered, filterAssignee, dueDateMode, dueFromDate, dueToDate]);
  useEffect(() => {
    if (!filtersReady) return;
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load, filtersReady]);

  useEffect(() => onTaskChanged(() => load()), [load]);
  useEffect(() => {
    if (!canFilter || !me) return;
    return onPresenceUpdate((detail) => {
      if (detail.onlineUserList) {
        const others = detail.onlineUserList.filter((u) => u.id !== me.id);
        setOnlineUsers(others);
        setOnlineCount(others.length);
        return;
      }
      const ids = (detail.onlineUsers ?? []).filter((id) => id !== me.id);
      setOnlineUsers(
        ids.map((id) => {
          const match = users.find((u) => u.id === id);
          return { id, name: match?.name ?? `User #${id}` };
        })
      );
      setOnlineCount(ids.length > 0 ? ids.length : Math.max(0, (detail.onlineCount ?? 0) - 1));
    });
  }, [canFilter, me, users]);

  const hasActiveFilters =
    !!filterAssignee ||
    dueDateMode !== 'all' ||
    !!dueFromDate ||
    !!dueToDate;

  const resetFilters = () => {
    setFilterAssignee(DEFAULT_HOME_PAGE_FILTERS.filterAssignee);
    setDueDateMode(DEFAULT_HOME_PAGE_FILTERS.dueDateMode);
    setDueFromDate(DEFAULT_HOME_PAGE_FILTERS.dueFromDate);
    setDueToDate(DEFAULT_HOME_PAGE_FILTERS.dueToDate);
    clearHomePageFilters();
  };

  const now = Date.now();
  const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
  const needsAck = mine.filter((t) => ['ASSIGNED', 'DISCUSS'].includes(t.status));
  const escalated = mine.filter((t) => t.status === 'ESCALATED');
  const inProgress = mine.filter((t) => ['ACKNOWLEDGED', 'IN_PROGRESS'].includes(t.status));
  const dueToday = inProgress.filter((t) => isDueInWindow(t.due_at, now, dayEnd.getTime()));
  const doneRecent = mine.filter((t) => t.status === 'DONE').slice(0, 5);
  const createdOpen = viewingFiltered
    ? []
    : created.filter((t) => !['DONE', 'CANCELLED', 'REJECTED'].includes(t.status) && t.assignee_id !== me?.id);

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase">{clock?.date ?? ' '}</p>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight">
            {clock?.greeting ?? 'Hello'}{me ? `, ${me.name.split(' ')[0]}` : ''}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canFilter && (
            <>
              <SearchableSelect
                className="h-8 min-w-[200px] max-w-[280px] text-sm"
                value={filterAssignee}
                onChange={setFilterAssignee}
                aria-label="View tasks for user or team"
                placeholder="Everyone (my dashboard)"
                searchPlaceholder="Search users or teams…"
                options={buildUserTeamSelectOptions(users, teams, {
                  emptyOption: { value: '', label: 'Everyone (my dashboard)' },
                })}
              />
            </>
          )}
          <TaskTemplateButton onImported={load} />
          <Button variant="outline" asChild>
            <Link href="/scribble">
              <IconPen className="h-4 w-4" /> Scribble
            </Link>
          </Button>
          <Button onClick={() => setComposerOpen(true)}>
            <IconPlus className="h-4 w-4" /> New task
          </Button>
        </div>
      </div>

      <TaskDateRangeFilter
        className="mb-6"
        mode={dueDateMode}
        fromDate={dueFromDate}
        toDate={dueToDate}
        onModeChange={setDueDateMode}
        onFromDateChange={setDueFromDate}
        onToDateChange={setDueToDate}
        showReset={hasActiveFilters}
        onReset={resetFilters}
        onlineCount={canFilter ? onlineCount : null}
        onlineUsers={canFilter ? onlineUsers : []}
        userChatHref={canFilter ? (user) => `/chat?userId=${user.id}` : undefined}
      />

      {/* Focus metrics */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={<IconZap className="h-[18px] w-[18px]" />} chip="bg-red-50 text-red-500" value={needsAck.length} label="Accept response" hot={needsAck.length > 0} />
        <Metric icon={<IconAlert className="h-[18px] w-[18px]" />} chip="bg-orange-50 text-orange-500" value={escalated.length} label="Escalated" hot={escalated.length > 0} />
        <Metric icon={<IconActivity className="h-[18px] w-[18px]" />} chip="bg-brand-50 text-brand-500" value={inProgress.length} label="In progress" />
        <Metric icon={<IconCalendar className="h-[18px] w-[18px]" />} chip="bg-sky-50 text-sky-500" value={dueToday.length} label="Due today" />
      </div>

      {needsAck.length > 0 && (
        <Section
          accent="bg-red-50 text-red-500" icon={<IconZap className="h-3.5 w-3.5" />}
          title={viewingFiltered ? 'Accept response · 30-min SLA' : 'Accept response · 30-min SLA'} tasks={needsAck}
          onOpenComments={setCommentsTask}
          onTaskUpdated={load}
          extra={(t) => (
            <Button size="xs" onClick={() => setAckTask(t)}>
              Accept + ETA
            </Button>
          )}
        />
      )}

      <Section accent="bg-red-50 text-red-500" icon={<IconAlert className="h-3.5 w-3.5" />} title="Escalated · explanation required" tasks={escalated} onOpenComments={setCommentsTask} onTaskUpdated={load} />
      <Section accent="bg-orange-50 text-orange-500" icon={<IconCalendar className="h-3.5 w-3.5" />} title="Due today" tasks={dueToday} onOpenComments={setCommentsTask} onTaskUpdated={load} />
      <Section accent="bg-brand-50 text-brand-500" icon={<IconActivity className="h-3.5 w-3.5" />} title="In progress" tasks={inProgress.filter((t) => !dueToday.includes(t))} onOpenComments={setCommentsTask} onTaskUpdated={load} />
      <Section accent="bg-violet-50 text-violet-500" icon={<IconSend className="h-3.5 w-3.5" />} title="Assigned by me · open" tasks={createdOpen} onOpenComments={setCommentsTask} onTaskUpdated={load} />
      <Section accent="bg-emerald-50 text-emerald-500" icon={<IconCheckCircle className="h-3.5 w-3.5" />} title="Recently done" tasks={doneRecent} onOpenComments={setCommentsTask} onTaskUpdated={load} />

      {mine.length === 0 && created.length === 0 && (
        <Card className="py-0">
          <CardContent className="p-14 text-center">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <IconCheckCircle className="h-7 w-7" />
            </span>
            <div className="font-bold text-gray-800">{viewingFiltered ? 'No matching tasks' : 'All clear'}</div>
            <p className="mt-1 mb-6 text-[13px] text-gray-400">
              {viewingFiltered
                ? 'Try another person or team.'
                : 'Nothing on your plate. Create a task or sketch one on the board.'}
            </p>
            {!viewingFiltered && (
            <div className="flex justify-center gap-2.5">
              <Button onClick={() => setComposerOpen(true)}><IconPlus className="h-4 w-4" /> New task</Button>
              <Button variant="outline" asChild>
                <Link href="/scribble"><IconPen className="h-4 w-4" /> Open Scribble</Link>
              </Button>
            </div>
            )}
          </CardContent>
        </Card>
      )}

      {ackTask && <AckModal task={ackTask} open={!!ackTask} onClose={() => setAckTask(null)} onDone={load} />}
      <CommentsModal
        task={commentsTask}
        open={!!commentsTask}
        onClose={() => setCommentsTask(null)}
        onChanged={load}
      />
      <Composer open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={load} />
    </>
  );
}

export default function HomePage() {
  return <Shell><HomeInner /></Shell>;
}
