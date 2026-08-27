'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type SearchableSelectOption = {
  value: string;
  label: string;
  group?: string;
  keywords?: string;
  disabled?: boolean;
};

type UserLike = {
  id: number;
  name: string;
  email?: string | null;
  team_name?: string | null;
  is_active?: boolean;
};

type TeamLike = {
  id: number;
  name: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  positionMode: 'fixed' | 'absolute';
};

function getPortalContainer(trigger: HTMLElement | null): HTMLElement {
  const dialog = trigger?.closest('[data-slot="dialog-content"]');
  return (dialog as HTMLElement | null) ?? document.body;
}

export function buildUserSelectOptions(
  users: UserLike[],
  opts?: {
    valuePrefix?: 'id' | 'u';
    excludeIds?: number[];
    activeOnly?: boolean;
  }
): SearchableSelectOption[] {
  const valuePrefix = opts?.valuePrefix ?? 'id';
  const exclude = new Set(opts?.excludeIds ?? []);
  return users
    .filter((u) => (opts?.activeOnly === false ? true : u.is_active !== false) && !exclude.has(u.id))
    .map((u) => {
      const team = u.team_name ? ` (${u.team_name})` : '';
      return {
        value: valuePrefix === 'u' ? `u:${u.id}` : String(u.id),
        label: `${u.name}${team}`,
        group: 'Users',
        keywords: [u.name, u.email, u.team_name].filter(Boolean).join(' '),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildUserTeamSelectOptions(
  users: UserLike[],
  teams: TeamLike[],
  opts?: {
    emptyOption?: SearchableSelectOption;
    includeTeams?: boolean;
    activeOnly?: boolean;
  }
): SearchableSelectOption[] {
  const userOptions = buildUserSelectOptions(users, {
    valuePrefix: 'u',
    activeOnly: opts?.activeOnly,
  });
  const teamOptions =
    opts?.includeTeams === false
      ? []
      : teams.map((t) => ({
          value: `t:${t.id}`,
          label: `Team: ${t.name}`,
          group: 'Teams',
          keywords: t.name,
        }));
  const options = [...userOptions, ...teamOptions].sort((a, b) => {
    if (a.group !== b.group) return a.group === 'Users' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  return opts?.emptyOption ? [opts.emptyOption, ...options] : options;
}

function computeMenuPosition(trigger: HTMLElement, container: HTMLElement): MenuPosition {
  const triggerRect = trigger.getBoundingClientRect();
  const viewportPadding = 8;
  const gap = 4;
  const preferredHeight = 320;
  const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
  const spaceAbove = triggerRect.top - viewportPadding;
  const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(preferredHeight, openUp ? spaceAbove - gap : spaceBelow - gap);
  const height = Math.max(160, maxHeight);
  const width = Math.max(triggerRect.width, 220);

  if (container === document.body) {
    const top = openUp
      ? Math.max(viewportPadding, triggerRect.top - gap - height)
      : triggerRect.bottom + gap;
    const left = Math.min(
      Math.max(viewportPadding, triggerRect.left),
      window.innerWidth - width - viewportPadding
    );
    return { top, left, width, maxHeight: height, positionMode: 'fixed' };
  }

  const containerRect = container.getBoundingClientRect();
  const top = openUp
    ? triggerRect.top - gap - height - containerRect.top
    : triggerRect.bottom + gap - containerRect.top;
  const left = Math.min(
    Math.max(0, triggerRect.left - containerRect.left),
    Math.max(0, containerRect.width - width)
  );

  return { top, left, width, maxHeight: height, positionMode: 'absolute' };
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results',
  className,
  disabled,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.keywords || '').toLowerCase().includes(q)
    );
  }, [options, query]);

  const groups = useMemo(() => {
    const map = new Map<string, SearchableSelectOption[]>();
    for (const opt of filtered) {
      const key = opt.group || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(opt);
    }
    return [...map.entries()];
  }, [filtered]);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const container = getPortalContainer(triggerRef.current);
    setPortalContainer(container);
    setMenuPosition(computeMenuPosition(triggerRef.current, container));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      setPortalContainer(null);
      return;
    }
    updateMenuPosition();
    const onLayout = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      updateMenuPosition();
    };
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const id = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      if (next && triggerRef.current) {
        const container = getPortalContainer(triggerRef.current);
        setPortalContainer(container);
        setMenuPosition(computeMenuPosition(triggerRef.current, container));
      }
      return next;
    });
  };

  const menu =
    open && menuPosition && portalContainer && mounted ? (
      <div
        ref={menuRef}
        data-searchable-select-menu
        style={{
          position: menuPosition.positionMode,
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
          zIndex: menuPosition.positionMode === 'absolute' ? 60 : 100000,
        }}
        className="overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg"
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
                e.stopPropagation();
              }}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        <div
          className="overflow-y-auto overscroll-contain p-1"
          style={{ maxHeight: Math.max(120, menuPosition.maxHeight - 52) }}
          role="listbox"
          onWheel={(e) => e.stopPropagation()}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            groups.map(([group, items]) => (
              <div key={group || 'default'}>
                {group && (
                  <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </div>
                )}
                {items.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={value === opt.value}
                    disabled={opt.disabled}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(opt.value);
                    }}
                    className={cn(
                      'flex w-full rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
                      value === opt.value ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                      opt.disabled && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => toggleOpen()}
        className={cn(
          'flex h-full w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors',
          'hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !selected && 'text-muted-foreground'
        )}
      >
        <span className="min-w-0 truncate text-left">{selected?.label || placeholder}</span>
        <ChevronDown className={cn('size-4 shrink-0 opacity-50 transition', open && 'rotate-180')} />
      </button>

      {mounted && menu ? createPortal(menu, portalContainer) : null}
    </div>
  );
}
