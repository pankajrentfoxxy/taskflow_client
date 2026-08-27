'use client';

import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ListTodo,
  PenLine,
  Folder,
  BarChart3,
  LogOut,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
} from 'lucide-react';
import { api } from '@/lib/util';
import { onMeRefresh } from '@/lib/socket';
import { cn } from '@/lib/utils';
import NotificationMenu from '@/components/NotificationMenu';
import { useChatUnreadOptional } from '@/components/ChatUnreadProvider';
import TaskFlowLogo from '@/components/TaskFlowLogo';
import { useFaviconBadge } from '@/hooks/useFaviconBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

type Me = {
  id: number; name: string; email: string; role: string; team_id: number | null; team: string | null;
};

const MeContext = createContext<{ me: Me | null; unread: number; refreshMe: () => void } | null>(null);
export const useMe = () => useContext(MeContext)?.me ?? null;
export const useNotifications = () => {
  const ctx = useContext(MeContext);
  return { unread: ctx?.unread ?? 0, refreshMe: ctx?.refreshMe ?? (() => {}) };
};

const NAV = [
  { href: '/home', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', Icon: ListTodo },
  { href: '/projects', label: 'Projects', Icon: Folder },
  { href: '/chat', label: 'Chat', Icon: MessageCircle },
  { href: '/scribble', label: 'Scribble', Icon: PenLine },
  { href: '/reports', label: 'Reports', Icon: BarChart3, managerial: true },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Super Admin',
  CEO: 'CEO',
  MANAGER: 'Manager',
  MEMBER: 'Member',
};

function canSeeReports(me: Me | null): boolean {
  return !!me;
}

const userInitials = (name?: string | null) =>
  (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const displayName = (name?: string | null) => name?.split(' (')[0] || 'User';

function SidebarNav({
  pathname,
  nav,
  collapsed,
  canManage,
  adminLabel,
  chatNavBadge,
  onNavigate,
}: {
  pathname: string;
  nav: typeof NAV;
  collapsed: boolean;
  canManage: boolean;
  adminLabel: string;
  chatNavBadge?: number;
  onNavigate?: () => void;
}) {
  const linkClass = (active: boolean) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
      active
        ? 'bg-muted font-semibold text-foreground'
        : 'font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      collapsed && 'justify-center px-2'
    );

  return (
    <div>
      {!collapsed && (
        <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Navigation
        </div>
      )}
      <nav className="space-y-0.5">
        {nav.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} onClick={onNavigate} className={linkClass(active)} title={collapsed ? label : undefined}>
              <Icon className="size-[18px] shrink-0" />
              {!collapsed && label}
              {href === '/chat' && chatNavBadge != null && chatNavBadge > 0 && (
                <span className="ml-auto flex size-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold text-background">
                  {chatNavBadge > 9 ? '9+' : chatNavBadge}
                </span>
              )}
            </Link>
          );
        })}
        {canManage && (
          <Link
            href="/admin"
            onClick={onNavigate}
            className={linkClass(pathname.startsWith('/admin'))}
            title={collapsed ? adminLabel : undefined}
          >
            <Settings2 className="size-[18px] shrink-0" />
            {!collapsed && adminLabel}
          </Link>
        )}
      </nav>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [unread, setUnread] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('tf-sidebar-collapsed');
    if (saved === '1') setCollapsed(true);
  }, []);

  const chatUnreadCtx = useChatUnreadOptional();
  const chatUnread = chatUnreadCtx?.chatUnread ?? 0;
  const chatEntries = chatUnreadCtx?.chatEntries ?? [];
  const totalUnread = unread + chatUnread;

  useEffect(() => {
    let alive = true;
    const load = () =>
      api('/api/me')
        .then((d) => { if (alive) { setMe(d.user); setUnread(d.unread); } })
        .catch(() => router.push('/login'));
    load();
    const iv = setInterval(load, 30000);
    return () => { alive = false; clearInterval(iv); };
  }, [router]);

  const refreshMe = useCallback(() => {
    api('/api/me')
      .then((d) => { setMe(d.user); setUnread(d.unread); })
      .catch(() => router.push('/login'));
  }, [router]);

  useEffect(() => onMeRefresh(refreshMe), [refreshMe]);

  useFaviconBadge(totalUnread);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('tf-sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  };

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
  };

  const nav = NAV.filter((n) => !n.managerial || canSeeReports(me));
  const canManage = me && ['ADMIN', 'CEO', 'MANAGER'].includes(me.role);
  const adminLabel = me?.role === 'ADMIN' ? 'Admin' : 'Manage';
  const roleLabel = ROLE_LABEL[me?.role || ''] || me?.role || '';
  const isFullBleed = pathname.startsWith('/chat');

  return (
    <MeContext.Provider value={{ me, unread, refreshMe }}>
      <div className="min-h-screen bg-background">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-sidebar transition-[width] duration-200 md:flex',
            collapsed ? 'w-[68px]' : 'w-[260px]'
          )}
        >
          <div className={cn('flex h-16 shrink-0 items-center border-b border-border', collapsed ? 'justify-center px-2' : 'gap-3 px-4')}>
            <TaskFlowLogo size={36} />
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-bold tracking-tight">TaskFlow</div>
                <div className="truncate text-[11px] text-muted-foreground">Task Management</div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-4">
            <SidebarNav
              pathname={pathname}
              nav={nav}
              collapsed={collapsed}
              canManage={!!canManage}
              adminLabel={adminLabel}
              chatNavBadge={!pathname.startsWith('/chat') ? chatUnread : 0}
            />
          </div>

          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
              {!collapsed && 'Collapse'}
            </button>
          </div>
        </aside>

        {/* Main column */}
        <div
          className={cn(
            'flex flex-col transition-[padding] duration-200',
            collapsed ? 'md:pl-[68px]' : 'md:pl-[260px]',
            isFullBleed ? 'h-dvh overflow-hidden' : 'min-h-screen'
          )}
        >
          {/* Top header */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <Button
              variant="outline"
              size="icon-sm"
              className="shrink-0 md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <PanelLeftOpen className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden shrink-0 md:inline-flex"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </Button>

            <div className="min-w-0 flex-1 text-center md:text-left">
              <span className="text-sm font-medium text-foreground">Task Management System</span>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <NotificationMenu
                unread={unread}
                chatUnread={chatUnread}
                chatEntries={chatEntries}
                refreshMe={refreshMe}
                onOpenChat={(conversationId) => {
                  chatUnreadCtx?.markConversationRead(conversationId);
                  router.push(`/chat?conversationId=${conversationId}`);
                }}
              />
              {me && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded-full outline-none ring-offset-background transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label="Account menu"
                    >
                      <Avatar size="sm" className="size-8 cursor-pointer">
                        <AvatarFallback className="bg-foreground text-[10px] font-semibold text-background">
                          {userInitials(me.name)}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate font-medium text-foreground">{displayName(me.name)}</span>
                        <span className="truncate text-xs font-normal text-muted-foreground">{me.email}</span>
                        <Badge variant="outline" className="mt-1.5 w-fit text-[10px]">{roleLabel}</Badge>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      className="cursor-pointer gap-2"
                      onClick={logout}
                    >
                      <LogOut className="size-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </header>

          <main
            className={cn(
              'flex-1',
              isFullBleed ? 'flex min-h-0 flex-col overflow-hidden' : 'px-4 py-6 md:px-8 md:py-8'
            )}
          >
            {isFullBleed ? children : <div className="mx-auto w-full max-w-7xl">{children}</div>}
          </main>
        </div>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetHeader className="border-b px-4 py-4 text-left">
              <div className="flex items-center gap-3">
                <TaskFlowLogo size={36} />
                <div>
                  <SheetTitle className="text-sm">TaskFlow</SheetTitle>
                  <p className="text-[11px] text-muted-foreground">Task Management</p>
                </div>
              </div>
            </SheetHeader>
            <div className="px-2 py-4">
              <SidebarNav
                pathname={pathname}
                nav={nav}
                collapsed={false}
                canManage={!!canManage}
                adminLabel={adminLabel}
                chatNavBadge={!pathname.startsWith('/chat') ? chatUnread : 0}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
            <Separator />
            <div className="p-4">
              <div className="mb-1 text-sm font-medium">{displayName(me?.name)}</div>
              {me?.email && <div className="mb-3 truncate text-xs text-muted-foreground">{me.email}</div>}
              <Badge variant="outline" className="mb-3">{roleLabel}</Badge>
              <Button variant="outline" className="w-full gap-2" onClick={logout}>
                <LogOut className="size-4" />
                Logout
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </MeContext.Provider>
  );
}
