'use client';

import { useCachedApi } from '@/lib/cachedApi';
import EmojiIcon from '@/components/EmojiIcon';
import EmptyState from '@/components/EmptyState';
import RetryButton from '@/components/RetryButton';

interface ActivityItem {
  type: 'sticker' | 'board_complete' | 'capsule_open';
  date: string;
  title: string;
  description: string;
  icon: string;
}

interface DateGroup {
  date: string;
  activities: ActivityItem[];
}

const typeColors: Record<string, string> = {
  sticker: 'bg-grape-400',
  board_complete: 'bg-leaf-500',
  capsule_open: 'bg-grape-300',
};

const typeBgColors: Record<string, string> = {
  sticker: 'bg-grape-50/60',
  board_complete: 'bg-leaf-100/60',
  capsule_open: 'bg-grape-50/60',
};

export default function VinePage() {
  // SWR 캐시: 재방문 시 직전 타임라인으로 즉시 렌더 + 무음 재검증.
  const { data, loading, error, refresh } = useCachedApi<{ timeline: DateGroup[] }>('/api/vine');
  const timeline = data?.timeline ?? [];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return { month, day, weekday };
  };

  if (loading) {
    return (
      <div className="pb-4">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold text-grape-700 mb-1">
            <span className="inline-flex items-center gap-1.5"><EmojiIcon emoji="🌿" size={22} /> 포도덩굴</span>
          </h1>
          <p className="text-sm text-warm-sub">나의 성장 기록</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="skeleton w-16 h-16 shrink-0" />
              <div className="skeleton h-16 flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pb-4">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold text-grape-700 mb-1">
            <span className="inline-flex items-center gap-1.5"><EmojiIcon emoji="🌿" size={22} /> 포도덩굴</span>
          </h1>
          <p className="text-sm text-warm-sub">나의 성장 기록</p>
        </div>
        <div className="text-center py-20">
          <EmojiIcon emoji="😥" size={48} className="block mx-auto mb-4" />
          <p className="text-sm text-warm-text mb-1">불러오지 못했어요</p>
          <p className="text-xs text-warm-sub mb-5">잠시 후 다시 시도해주세요</p>
          <RetryButton onRetry={refresh} />
        </div>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="pb-4">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold text-grape-700 mb-1">
            <span className="inline-flex items-center gap-1.5"><EmojiIcon emoji="🌿" size={22} /> 포도덩굴</span>
          </h1>
          <p className="text-sm text-warm-sub">나의 성장 기록</p>
        </div>
        <EmptyState
          art="/illustrations/empty/empty-vine-v2.webp"
          fallbackEmoji="🌱"
          title="아직 활동 기록이 없어요"
          description="포도알을 채우면 여기에 기록이 남아요!"
        />
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl font-bold text-grape-700 mb-1">
          <span className="inline-flex items-center gap-1.5"><EmojiIcon emoji="🌿" size={22} /> 포도덩굴</span>
        </h1>
        <p className="text-sm text-warm-sub">나의 성장 기록</p>
      </div>

      {/* Summary */}
      <div className="clay-sm p-4 mb-6 bg-leaf-100/60 text-center">
        <p className="text-sm text-warm-text">
          최근 90일간 <span className="font-bold text-grape-600 tabular-nums">{timeline.length}</span>일 활동했어요
        </p>
      </div>

      {/* Vine Timeline */}
      <div className="relative pl-8">
        {/* Vertical vine line */}
        <div
          className="absolute left-[14px] top-2 bottom-2 w-0.5 bg-grape-300"
          style={{ borderRadius: '1px' }}
        />

        {timeline.map((group, groupIndex) => {
          const { month, day, weekday } = formatDate(group.date);

          return (
            <div
              key={group.date}
              className="relative mb-8 last:mb-0 stagger-item"
              style={{ '--stagger-i': Math.min(groupIndex, 8) } as React.CSSProperties}
            >
              {/* Node circle on the vine */}
              <div className="absolute -left-8 top-0 flex items-center justify-center">
                <div className="w-[29px] h-7 flex flex-col items-center justify-center">
                  {/* Outer ring */}
                  <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-xs border-2 border-grape-300">
                    <div className="w-2 h-2 rounded-full bg-grape-400" />
                  </div>
                </div>
              </div>

              {/* Date label */}
              <div className="mb-3">
                <span className="text-sm font-bold text-grape-600 tabular-nums">
                  {month}.{day}
                </span>
                <span className="text-xs text-warm-sub ml-1.5">
                  {weekday}요일
                </span>
                {groupIndex === 0 && (
                  <span className="ml-2 text-[10px] bg-grape-100 text-grape-600 px-2 py-0.5 rounded-full font-medium">
                    최근
                  </span>
                )}
              </div>

              {/* Activity cards */}
              <div className="space-y-2">
                {group.activities.map((activity, actIndex) => (
                  <div
                    key={`${group.date}-${actIndex}`}
                    className={`
                      clay-sm p-3.5 ${typeBgColors[activity.type] || ''}
                      transition-all duration-300
                    `}
                    style={{
                      animationDelay: `${groupIndex * 100 + actIndex * 50}ms`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Type indicator dot */}
                      <div className="shrink-0 flex items-center gap-2">
                        <EmojiIcon emoji={activity.icon} size={20} />
                        <div className={`w-1.5 h-1.5 rounded-full ${typeColors[activity.type] || 'bg-grape-400'}`} />
                      </div>

                      {/* Description */}
                      <p className="text-sm text-warm-text flex-1">
                        {activity.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Bottom vine end */}
        <div className="absolute -left-8 bottom-0 flex items-center justify-center">
          <div className="w-[29px] flex justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-grape-200" />
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="text-center mt-8 mb-4">
        <p className="text-xs text-warm-sub">
          최근 90일간의 활동을 보여드려요 <EmojiIcon emoji="🌿" size={13} />
        </p>
      </div>
    </div>
  );
}
