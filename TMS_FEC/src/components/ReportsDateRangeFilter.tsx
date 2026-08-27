'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { ReportsDateFilterMode } from '@/lib/util';
import { cn } from '@/lib/utils';

const PRESETS: { key: ReportsDateFilterMode; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: 'range', label: 'Date range' },
];

export default function ReportsDateRangeFilter({
  mode,
  fromDate,
  toDate,
  onModeChange,
  onFromDateChange,
  onToDateChange,
  onReset,
  showReset = false,
  showOverall = true,
  onShowOverallChange,
  className,
}: {
  mode: ReportsDateFilterMode;
  fromDate: string;
  toDate: string;
  onModeChange: (mode: ReportsDateFilterMode) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onReset?: () => void;
  showReset?: boolean;
  showOverall?: boolean;
  onShowOverallChange?: (checked: boolean) => void;
  className?: string;
}) {
  const dateFilterActive = mode !== 'all';
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((opt) => (
          <Button
            key={opt.key}
            type="button"
            size="sm"
            variant={mode === opt.key ? 'default' : 'outline'}
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => onModeChange(opt.key)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      {mode === 'range' && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            className="h-8 w-full min-w-[140px] sm:w-auto"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            className="h-8 w-full min-w-[140px] sm:w-auto"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => onToDateChange(e.target.value)}
            aria-label="To date"
          />
        </div>
      )}
      {dateFilterActive && onShowOverallChange && (
        <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-xs">
          <Checkbox
            checked={showOverall}
            onCheckedChange={(checked) => onShowOverallChange(checked === true)}
            aria-label="Show overall data"
          />
          <Label className="cursor-pointer font-normal text-muted-foreground">Show overall</Label>
        </label>
      )}
      {showReset && onReset && (
        <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 text-muted-foreground" onClick={onReset}>
          Reset filters
        </Button>
      )}
    </div>
  );
}
