'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Shell, { useMe } from '@/components/Shell';
import Modal from '@/components/Modal';
import {
  api,
  fmtDateTime,
  STATUS_LABEL,
  STATUS_COLOR,
  STATUS_COLOR_FALLBACK,
  SLA_BREACH_BADGE,
  reportsDateQueryParams,
} from '@/lib/util';
import { IconInbox, IconClock, IconMute, IconAlert, IconScale, IconCalendar, IconCheckCircle, IconZap, IconActivity, IconTag, IconUsers, IconDownload } from '@/components/Icons';
import ReportsDateRangeFilter from '@/components/ReportsDateRangeFilter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { NativeSelect } from '@/components/ui/native-select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  clearReportsPageFilters,
  DEFAULT_REPORTS_PAGE_FILTERS,
  loadReportsPageFilters,
  saveReportsPageFilters,
} from '@/lib/taskListFilters';

function Stat({ icon, chip, label, value, tone, onClick, bar }: {
  icon: React.ReactNode; chip: string; label: string; value: any; tone?: string; onClick?: () => void; bar?: number | null;
}) {
  return (
    <Card
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={cn(
        'text-left w-full group transition gap-0 py-4',
        onClick ? 'cursor-pointer hover:border-brand-300 hover:shadow-md' : 'cursor-default',
      )}
    >
      <CardContent>
        <div className="flex items-center justify-between">
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${chip}`}>{icon}</span>
          {onClick && <span className="text-gray-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition text-sm">→</span>}
        </div>
        <div className={`text-[24px] font-bold mt-2.5 leading-none tracking-tight tnum ${tone || 'text-gray-900'}`}>{value ?? '—'}</div>
        <div className="text-xs text-gray-500 mt-1.5 font-medium">{label}</div>
        {bar != null && (
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2.5">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${bar}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Num({ value, tone, onClick }: { value: any; tone?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`font-semibold underline decoration-dotted decoration-gray-300 underline-offset-4 hover:text-brand-600 hover:decoration-brand-400 transition ${tone || ''}`}>
      {value}
    </button>
  );
}

const TH = 'px-3 py-3 text-left text-[11px] text-gray-400 uppercase tracking-wider font-semibold';
const TD = 'px-3 py-3';

function ReportsInner() {
  const me = useMe();
  const [dateMode, setDateMode] = useState(DEFAULT_REPORTS_PAGE_FILTERS.dateMode);
  const [fromDate, setFromDate] = useState(DEFAULT_REPORTS_PAGE_FILTERS.fromDate);
  const [toDate, setToDate] = useState(DEFAULT_REPORTS_PAGE_FILTERS.toDate);
  const [data, setData] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [teamId, setTeamId] = useState(DEFAULT_REPORTS_PAGE_FILTERS.teamId);
  const [typeId, setTypeId] = useState(DEFAULT_REPORTS_PAGE_FILTERS.typeId);
  const [showOverall, setShowOverall] = useState(DEFAULT_REPORTS_PAGE_FILTERS.showOverall);
  const [filtersReady, setFiltersReady] = useState(false);
  const [drill, setDrill] = useState<{ title: string; tasks: any[] } | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const skipTypeResetRef = useRef(true);

  const buildQueryParams = (extra: Record<string, string> = {}) => {
    const sp = new URLSearchParams(reportsDateQueryParams(dateMode, fromDate, toDate));
    if (teamId) sp.set('teamId', teamId);
    if (typeId) sp.set('taskTypeId', typeId);
    const hasDateRange = sp.has('createdFrom') || sp.has('days');
    if (hasDateRange) sp.set('overall', showOverall ? 'true' : 'false');
    for (const [k, v] of Object.entries(extra)) sp.set(k, v);
    return sp;
  };

  const hasActiveFilters =
    !!teamId ||
    !!typeId ||
    dateMode !== 'all' ||
    !!fromDate ||
    !!toDate ||
    !showOverall;

  const resetFilters = () => {
    setTeamId(DEFAULT_REPORTS_PAGE_FILTERS.teamId);
    setTypeId(DEFAULT_REPORTS_PAGE_FILTERS.typeId);
    setDateMode(DEFAULT_REPORTS_PAGE_FILTERS.dateMode);
    setFromDate(DEFAULT_REPORTS_PAGE_FILTERS.fromDate);
    setToDate(DEFAULT_REPORTS_PAGE_FILTERS.toDate);
    setShowOverall(DEFAULT_REPORTS_PAGE_FILTERS.showOverall);
    clearReportsPageFilters();
  };

  useEffect(() => {
    const stored = loadReportsPageFilters();
    setDateMode(stored.dateMode);
    setFromDate(stored.fromDate);
    setToDate(stored.toDate);
    setTeamId(stored.teamId);
    setTypeId(stored.typeId);
    setShowOverall(stored.showOverall);
    skipTypeResetRef.current = true;
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    saveReportsPageFilters({
      dateMode,
      fromDate,
      toDate,
      teamId,
      typeId,
      showOverall,
    });
  }, [dateMode, fromDate, toDate, teamId, typeId, showOverall, filtersReady]);

  useEffect(() => {
    if (!filtersReady) return;
    api(`/api/reports?${buildQueryParams()}`).then(setData);
  }, [dateMode, fromDate, toDate, teamId, typeId, showOverall, filtersReady]);

  useEffect(() => {
    if (me && ['ADMIN', 'CEO'].includes(me.role)) {
      api('/api/teams').then((d) => setTeams(d.teams)).catch(() => {});
    }
  }, [me]);

  useEffect(() => {
    if (!filtersReady) return;
    if (skipTypeResetRef.current) {
      skipTypeResetRef.current = false;
    } else {
      setTypeId('');
    }
    const tid = me && ['ADMIN', 'CEO'].includes(me.role) ? teamId : me?.team_id ? String(me.team_id) : '';
    if (!tid) { setTypes([]); return; }
    api(`/api/task-types?teamId=${tid}`).then((d) => setTypes(d.types)).catch(() => setTypes([]));
  }, [teamId, me, filtersReady]);

  const openDrill = async (metric: string, title: string, extra: Record<string, any> = {}) => {
    setDrillLoading(true);
    setDrill({ title, tasks: [] });
    try {
      const sp = buildQueryParams({ list: metric });
      for (const [k, v] of Object.entries(extra)) sp.set(k, String(v));
      const d = await api(`/api/reports?${sp}`);
      setDrill({ title, tasks: d.tasks });
    } finally { setDrillLoading(false); }
  };

  if (!data) {
    return (
      <div className="space-y-4">
        <Card className="h-24 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[...Array(6)].map((_, i) => <Card key={i} className="h-28 animate-pulse" />)}</div>
      </div>
    );
  }
  const s = data.summary;

  const exportCsv = () => {
    const header = 'Name,Team,Open,Overdue,No response,Escalations,Done,Done on time,Avg response (min)\n';
    const rows = data.people.map((p: any) =>
      [p.name, p.team_name || '', p.open, p.overdue, p.no_response, p.escalations, p.done, p.done_ontime, p.avg_response_min ?? ''].join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'taskflow-report.csv';
    a.click();
  };

  const attention = s.overdue + s.noResponse + s.escalatedAwaiting + s.escalatedPendingReview;

  return (
    <>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            {data.scope === 'MEMBER' ? 'Your tasks' : data.scope === 'MANAGER' ? 'Your team' : 'Entire organization'}
          </p>
          <h1 className="text-[24px] font-bold tracking-tight mt-1">Reports</h1>
        </div>
        <Badge className={`!px-3 !py-1.5 !text-xs h-auto gap-1 ${attention > 0 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
          {attention > 0 ? <IconAlert className="w-3.5 h-3.5" /> : <IconCheckCircle className="w-3.5 h-3.5" />}
          {attention} need{attention === 1 ? 's' : ''} attention
        </Badge>
      </div>

      {/* Report filters */}
      <div className="mb-5 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Report filters</p>
        <div className="flex gap-2 flex-wrap items-center">
          {me && ['ADMIN', 'CEO'].includes(me.role) && (
            <NativeSelect className="w-auto" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">All teams</option>
              {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </NativeSelect>
          )}
          {types.length > 0 && (
            <NativeSelect className="w-auto" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">All task types</option>
              {types.map((tt: any) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
            </NativeSelect>
          )}
          {data.people.length > 0 && (
            <Button variant="outline" className="ml-auto" onClick={exportCsv}>
              <IconDownload className="w-4 h-4" /> CSV
            </Button>
          )}
        </div>
        <ReportsDateRangeFilter
          mode={dateMode}
          fromDate={fromDate}
          toDate={toDate}
          onModeChange={setDateMode}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          showOverall={showOverall}
          onShowOverallChange={setShowOverall}
          showReset={hasActiveFilters}
          onReset={resetFilters}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <Stat icon={<IconInbox className="w-4 h-4" />} chip="bg-brand-50 text-brand-500" label="Open tasks" value={s.open} onClick={() => openDrill('open', 'Open tasks')} />
        <Stat icon={<IconClock className="w-4 h-4" />} chip="bg-red-50 text-red-500" label="Overdue" value={s.overdue} tone={s.overdue > 0 ? 'text-red-600' : ''} onClick={() => openDrill('overdue', 'Overdue tasks')} />
        <Stat icon={<IconMute className="w-4 h-4" />} chip="bg-red-50 text-red-500" label="No response (SLA breach)" value={s.noResponse} tone={s.noResponse > 0 ? 'text-red-600' : ''} onClick={() => openDrill('no_response', 'No response (SLA breached)')} />
        <Stat icon={<IconAlert className="w-4 h-4" />} chip="bg-orange-50 text-orange-500" label="Awaiting explanation" value={s.escalatedAwaiting} tone={s.escalatedAwaiting > 0 ? 'text-orange-600' : ''} onClick={() => openDrill('esc_awaiting', 'Escalations awaiting explanation')} />
        <Stat icon={<IconScale className="w-4 h-4" />} chip="bg-amber-50 text-amber-500" label="Pending review" value={s.escalatedPendingReview} tone={s.escalatedPendingReview > 0 ? 'text-amber-600' : ''} onClick={() => openDrill('esc_pending', 'Explanations pending review')} />
        <Stat icon={<IconCalendar className="w-4 h-4" />} chip="bg-sky-50 text-sky-500" label="Due this week" value={s.dueThisWeek} onClick={() => openDrill('due_week', 'Due this week')} />
        <Stat icon={<IconCheckCircle className="w-4 h-4" />} chip="bg-emerald-50 text-emerald-500" label="Done" value={s.done} tone="text-emerald-600" onClick={() => openDrill('done', 'Done tasks')} />
        <Stat icon={<IconActivity className="w-4 h-4" />} chip="bg-emerald-50 text-emerald-500" label="On-time completion" value={s.onTimePct != null ? `${s.onTimePct}%` : '—'} tone="text-emerald-600" bar={s.onTimePct} />
        <Stat icon={<IconZap className="w-4 h-4" />} chip="bg-violet-50 text-violet-500" label="Avg response time" value={s.avgResponseMin != null ? `${s.avgResponseMin}m` : '—'} />
      </div>

      {/* By task type */}
      {data.byType && data.byType.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-6 h-6 rounded-md bg-brand-50 text-brand-500 flex items-center justify-center"><IconTag className="w-3.5 h-3.5" /></span>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-600">By task type</h2>
            <div className="flex-1 h-px bg-gray-200/70 ml-1" />
          </div>
          <Card className="overflow-hidden py-0 gap-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-gray-50/80">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={`${TH} !pl-4`}>Team</TableHead>
                    <TableHead className={TH}>Task type</TableHead>
                    <TableHead className={TH}>Total</TableHead>
                    <TableHead className={TH}>Open</TableHead>
                    <TableHead className={`${TH} !text-red-500`}>Overdue</TableHead>
                    <TableHead className={TH}>No resp.</TableHead>
                    <TableHead className={TH}>Done</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byType.map((bt: any) => {
                    const x = { taskTypeId: bt.id };
                    return (
                      <TableRow key={bt.id} className="border-t border-gray-50 hover:bg-brand-50/30 transition">
                        <TableCell className={`${TD} !pl-4 text-xs text-gray-500`}>{bt.team_name}</TableCell>
                        <TableCell className={TD}>
                          <div className="font-semibold">{bt.name}</div>
                        </TableCell>
                        <TableCell className={TD}><Num value={bt.total} onClick={() => openDrill('total', `${bt.name} — all tasks`, x)} /></TableCell>
                        <TableCell className={TD}><Num value={bt.open} onClick={() => openDrill('open', `${bt.name} — open`, x)} /></TableCell>
                        <TableCell className={TD}><Num value={bt.overdue} tone={bt.overdue > 0 ? 'text-red-600' : 'text-gray-400'} onClick={() => openDrill('overdue', `${bt.name} — overdue`, x)} /></TableCell>
                        <TableCell className={TD}><Num value={bt.no_response} tone={bt.no_response > 0 ? 'text-red-600' : 'text-gray-400'} onClick={() => openDrill('no_response', `${bt.name} — no response`, x)} /></TableCell>
                        <TableCell className={TD}><Num value={bt.done} tone={bt.done > 0 ? 'text-emerald-600' : 'text-gray-400'} onClick={() => openDrill('done', `${bt.name} — done`, x)} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Per person */}
      {data.people.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-6 h-6 rounded-md bg-violet-50 text-violet-500 flex items-center justify-center"><IconUsers className="w-3.5 h-3.5" /></span>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-600">
              {data.scope === 'MEMBER' ? 'Your performance' : 'By person'}
            </h2>
            <div className="flex-1 h-px bg-gray-200/70 ml-1" />
          </div>
          <Card className="overflow-hidden py-0 gap-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-gray-50/80">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={`${TH} !pl-4`}>Person</TableHead>
                    <TableHead className={TH}>Open</TableHead>
                    <TableHead className={`${TH} !text-red-500`}>Overdue</TableHead>
                    <TableHead className={TH}>No resp.</TableHead>
                    <TableHead className={TH}>Escal.</TableHead>
                    <TableHead className={TH}>Done</TableHead>
                    <TableHead className={TH}>On time</TableHead>
                    <TableHead className={TH}>Avg resp.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.people.map((p: any) => {
                    const x = { personId: p.id };
                    const initials = p.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('');
                    return (
                      <TableRow key={p.id} className="border-t border-gray-50 hover:bg-brand-50/30 transition">
                        <TableCell className={`${TD} !pl-4`}>
                          <div className="flex items-center gap-2.5">
                            <Avatar>
                              <AvatarFallback className="bg-gradient-to-br from-brand-100 to-violet-100 text-brand-700 text-[11px] font-bold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold">{p.name.split(' (')[0]}</div>
                              <div className="text-[11px] text-gray-400">{p.team_name || '—'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className={TD}><Num value={p.open} onClick={() => openDrill('open', `${p.name} — open`, x)} /></TableCell>
                        <TableCell className={TD}><Num value={p.overdue} tone={p.overdue > 0 ? 'text-red-600' : 'text-gray-400'} onClick={() => openDrill('overdue', `${p.name} — overdue`, x)} /></TableCell>
                        <TableCell className={TD}><Num value={p.no_response} tone={p.no_response > 0 ? 'text-red-600' : 'text-gray-400'} onClick={() => openDrill('no_response', `${p.name} — no response`, x)} /></TableCell>
                        <TableCell className={TD}><Num value={p.escalations} tone={p.escalations > 0 ? 'text-orange-600' : 'text-gray-400'} onClick={() => openDrill('escalations', `${p.name} — escalations`, x)} /></TableCell>
                        <TableCell className={TD}><Num value={p.done} tone={p.done > 0 ? 'text-emerald-600' : 'text-gray-400'} onClick={() => openDrill('done', `${p.name} — done`, x)} /></TableCell>
                        <TableCell className={TD}>
                          {p.done ? (
                            <Badge className={Math.round((100 * p.done_ontime) / p.done) >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                              {Math.round((100 * p.done_ontime) / p.done)}%
                            </Badge>
                          ) : <span className="text-gray-300">—</span>}
                        </TableCell>
                        <TableCell className={`${TD} text-gray-500`}>{p.avg_response_min != null ? `${p.avg_response_min}m` : '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Drill-down modal */}
      <Modal open={!!drill} onClose={() => setDrill(null)} title={drill?.title || ''} wide>
        {drillLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : drill && drill.tasks.length > 0 ? (
          <div className="space-y-2">
            <div className="hidden md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-3 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <span>Task</span>
              <span>Assignee</span>
              <span>Due date</span>
              <span>ETA</span>
              <span>Status</span>
            </div>
            {drill.tasks.map((tk: any) => (
              <Link
                key={tk.id}
                href={`/tasks/${tk.id}`}
                className="block border border-gray-200 rounded-xl px-3.5 py-3 hover:border-brand-400 hover:shadow-sm transition text-sm"
                onClick={() => setDrill(null)}
              >
                {/* Mobile card */}
                <div className="md:hidden space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-bold text-gray-400">#{tk.id}</span>
                      <div className="font-semibold text-gray-900 break-words leading-snug mt-0.5">{tk.title}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      <Badge className={cn('shrink-0', STATUS_COLOR[tk.status] || STATUS_COLOR_FALLBACK)}>
                        {STATUS_LABEL[tk.status] || tk.status}
                      </Badge>
                      {tk.sla_breached_at && tk.status === 'ASSIGNED' && (
                        <Badge className={cn('shrink-0', SLA_BREACH_BADGE)}>NO RESPONSE</Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs border-t border-gray-100 pt-2.5">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Assignee</div>
                      <div className="text-gray-700 mt-0.5 break-words">{tk.assignee_name || 'Unassigned'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Due date</div>
                      <div className="text-gray-700 mt-0.5">{fmtDateTime(tk.due_at)}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">ETA</div>
                      <div className="text-gray-700 mt-0.5">{tk.eta_at ? fmtDateTime(tk.eta_at) : '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Desktop row */}
                <div className="hidden md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-3 md:items-start">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-gray-400 mr-1.5">#{tk.id}</span>
                    <span className="font-semibold text-gray-900 break-words leading-snug">{tk.title}</span>
                  </div>
                  <div className="min-w-0 break-words text-gray-600">{tk.assignee_name || 'Unassigned'}</div>
                  <div className="min-w-0 text-xs text-gray-500">{fmtDateTime(tk.due_at)}</div>
                  <div className="min-w-0 text-xs text-gray-500">{tk.eta_at ? fmtDateTime(tk.eta_at) : '—'}</div>
                  <div className="flex flex-wrap items-start gap-1">
                    <Badge className={cn('shrink-0', STATUS_COLOR[tk.status] || STATUS_COLOR_FALLBACK)}>
                      {STATUS_LABEL[tk.status] || tk.status}
                    </Badge>
                    {tk.sla_breached_at && tk.status === 'ASSIGNED' && (
                      <Badge className={cn('shrink-0', SLA_BREACH_BADGE)}>NO RESPONSE</Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🎉</div>
            <div className="text-sm text-gray-400">No tasks in this bucket.</div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function ReportsPage() {
  return <Shell><ReportsInner /></Shell>;
}
