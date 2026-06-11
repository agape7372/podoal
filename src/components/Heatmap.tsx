'use client';

import { useMemo } from 'react';

interface HeatmapProps {
  data: { date: string; count: number }[];
}

// Levels chosen for adjacent-step luminance separation; the empty cell stays a
// faint warm-border so "0 vs 1+" reads even for low-vision users. Color alone is
// not the only cue — filled cells also carry an inset ring (WCAG 1.4.1).
function getColorClass(count: number): string {
  if (count === 0) return 'bg-warm-border/40';
  if (count === 1) return 'bg-grape-300';
  if (count <= 3) return 'bg-grape-400';
  if (count <= 6) return 'bg-grape-500';
  return 'bg-grape-700';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Heatmap({ data }: HeatmapProps) {
  const { grid, monthLabels } = useMemo(() => {
    // Build a 13-column x 7-row grid (weeks x days)
    // Rows: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
    // We need to map the data (last 90 days) into this grid

    const dataMap = new Map<string, number>();
    for (const d of data) {
      dataMap.set(d.date, d.count);
    }

    // Find the start date: go back from today to fill 13 weeks (91 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the Monday of the earliest week that covers our 90-day range
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 89);

    // Adjust startDate to the previous Monday (or same day if Monday)
    const startDow = startDate.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = startDow === 0 ? -6 : 1 - startDow;
    startDate.setDate(startDate.getDate() + mondayOffset);

    // Build grid: each column is a week, each row is a day of week (Mon=0..Sun=6)
    const cells: { date: string; count: number; col: number; row: number }[] = [];
    const months: { label: string; col: number }[] = [];
    let lastMonth = -1;

    const numWeeks = 13;
    for (let col = 0; col < numWeeks; col++) {
      for (let row = 0; row < 7; row++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(cellDate.getDate() + col * 7 + row);
        const dateStr = cellDate.toISOString().split('T')[0];

        // Only include dates up to today
        if (cellDate > today) continue;

        const count = dataMap.get(dateStr) || 0;
        cells.push({ date: dateStr, count, col, row });

        // Track month changes (check first day of each week)
        if (row === 0) {
          const month = cellDate.getMonth();
          if (month !== lastMonth) {
            const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
            months.push({ label: monthNames[month], col });
            lastMonth = month;
          }
        }
      }
    }

    return { grid: cells, monthLabels: months };
  }, [data]);

  const dayLabels = [
    { row: 0, label: '월' },
    { row: 2, label: '수' },
    { row: 4, label: '금' },
  ];

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-block min-w-fit">
        {/* Month labels */}
        <div
          className="grid gap-[2px] ml-7 mb-1"
          style={{
            gridTemplateColumns: `repeat(13, 12px)`,
          }}
        >
          {Array.from({ length: 13 }).map((_, col) => {
            const monthLabel = monthLabels.find((m) => m.col === col);
            return (
              <div key={col} className="text-[9px] text-warm-sub truncate">
                {monthLabel?.label || ''}
              </div>
            );
          })}
        </div>

        {/* Grid with day labels */}
        <div className="flex">
          {/* Day labels */}
          <div
            className="grid gap-[2px] mr-1 shrink-0"
            style={{
              gridTemplateRows: `repeat(7, 12px)`,
            }}
          >
            {Array.from({ length: 7 }).map((_, row) => {
              const label = dayLabels.find((d) => d.row === row);
              return (
                <div key={row} className="flex items-center justify-end w-6">
                  <span className="text-[9px] text-warm-sub">{label?.label || ''}</span>
                </div>
              );
            })}
          </div>

          {/* Heatmap cells */}
          <div
            role="img"
            aria-label="최근 90일 활동 히트맵, 일자별 채운 포도알 수"
            className="grid gap-[2px]"
            style={{
              gridTemplateColumns: `repeat(13, 12px)`,
              gridTemplateRows: `repeat(7, 12px)`,
            }}
          >
            {Array.from({ length: 13 * 7 }).map((_, idx) => {
              const col = Math.floor(idx / 7);
              const row = idx % 7;
              const cell = grid.find((c) => c.col === col && c.row === row);

              if (!cell) {
                return <div key={idx} className="w-3 h-3" aria-hidden="true" />;
              }

              // Inset ring on any active day = a non-color cue distinguishing
              // "filled" from "empty" (the container is role="img", so a per-cell
              // aria-label would be ignored by SR — the title is the hover tooltip).
              return (
                <div
                  key={idx}
                  className={`w-3 h-3 rounded-xs ${getColorClass(cell.count)}${
                    cell.count > 0 ? ' ring-1 ring-inset ring-grape-900/10' : ''
                  } transition-colors`}
                  title={`${formatDate(cell.date)}: ${cell.count}개`}
                />
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1.5 mt-2" aria-hidden="true">
          <span className="text-[9px] text-warm-sub">적음</span>
          <div className="w-3 h-3 rounded-xs bg-warm-border/40" />
          <div className="w-3 h-3 rounded-xs bg-grape-300 ring-1 ring-inset ring-grape-900/10" />
          <div className="w-3 h-3 rounded-xs bg-grape-400 ring-1 ring-inset ring-grape-900/10" />
          <div className="w-3 h-3 rounded-xs bg-grape-500 ring-1 ring-inset ring-grape-900/10" />
          <div className="w-3 h-3 rounded-xs bg-grape-700 ring-1 ring-inset ring-grape-900/10" />
          <span className="text-[9px] text-warm-sub">많음</span>
        </div>
      </div>
    </div>
  );
}
