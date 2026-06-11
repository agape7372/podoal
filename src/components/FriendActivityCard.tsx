'use client';

import Avatar from '@/components/Avatar';
import EmojiIcon from '@/components/EmojiIcon';
import { stripTitleEmoji } from '@/lib/title';
import type { FriendActivity } from '@/lib/activity';

export type CheerState = 'idle' | 'sending' | 'sent';

interface FriendActivityCardProps {
  activity: FriendActivity;
  /** fetch 시점 기준으로 미리 계산된 상대시간 문자열 (렌더 중 현재시각 호출 금지). */
  timeText: string;
  cheerState: CheerState;
  onCheer: () => void;
}

// 친구 소식: 아바타 + '○○님이 포도판을 완성했어요'(1줄) + 「제목」(1줄) + 상대시간 + 원탭 축하 버튼.
// 불변 명사 '포도판'을 목적어로 써 조사 받침 문제를 회피 (vine 피드의 '○○ 포도판 완성!' 선례).
export default function FriendActivityCard({
  activity,
  timeText,
  cheerState,
  onCheer,
}: FriendActivityCardProps) {
  const sent = cheerState === 'sent';
  const sending = cheerState === 'sending';

  return (
    <div className="clay-sm p-3.5 flex items-center gap-3">
      <Avatar avatar={activity.actor.avatar} size="md" className="shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-warm-text leading-snug truncate">
          <span className="font-semibold">{activity.actor.name}</span>
          님이 포도판을 완성했어요 <EmojiIcon emoji="🎉" size={14} />
        </p>
        <p className="text-sm text-warm-text leading-snug truncate">
          「{stripTitleEmoji(activity.title)}」
        </p>
        <p className="text-[11px] text-warm-sub mt-0.5">
          포도알 <span className="tabular-nums">{activity.totalStickers}</span>알
          {timeText && <> · {timeText}</>}
        </p>
      </div>

      <button
        onClick={onCheer}
        disabled={sending || sent}
        aria-label={
          sent
            ? `${activity.actor.name}님에게 축하를 보냈어요`
            : `${activity.actor.name}님에게 축하 보내기`
        }
        className={`
          shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1
          ${sent
            ? 'clay-pressed text-warm-sub'
            : 'clay-button text-grape-700'
          }
          ${sending ? 'opacity-60' : ''}
        `}
      >
        {sent ? (
          <>{'✓ 축하 보냈어요'}</>
        ) : sending ? (
          <>보내는 중…</>
        ) : (
          <>
            <EmojiIcon emoji="🎉" size={14} />
            축하
          </>
        )}
      </button>
    </div>
  );
}
