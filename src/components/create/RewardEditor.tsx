'use client';

import ClayInput from '@/components/ClayInput';
import EmojiIcon from '@/components/EmojiIcon';
import { REWARD_TYPE_LABELS } from '@/types';
import { REWARD_TYPE_ICON } from '@/lib/icons';
import type { RewardType } from '@/types';

interface RewardEditorProps {
  rewardType: RewardType;
  setRewardType: (t: RewardType) => void;
  rewardTitle: string;
  setRewardTitle: (s: string) => void;
  rewardContent: string;
  setRewardContent: (s: string) => void;
}

/** 보상 타입 선택 + 제목 + 내용 — board/create, relay/create 공용. */
export default function RewardEditor({
  rewardType, setRewardType,
  rewardTitle, setRewardTitle,
  rewardContent, setRewardContent,
}: RewardEditorProps) {
  return (
    <>
      <p className="text-sm text-warm-sub">달성하면 받을 보상을 설정해요</p>
      <p className="text-xs text-warm-sub">달성 전까지 내용은 비밀이에요! <EmojiIcon emoji="🤫" size={13} /></p>

      {/* Reward type */}
      <div className="flex gap-2">
        {(Object.keys(REWARD_TYPE_LABELS) as RewardType[]).map((type) => (
          <button
            key={type}
            onClick={() => setRewardType(type)}
            className={`
              flex-1 clay-button px-3 py-3 rounded-xl text-sm font-medium text-center
              ${rewardType === type ? 'ring-2 ring-grape-400 clay-pressed' : ''}
            `}
          >
            <EmojiIcon emoji={REWARD_TYPE_ICON[type]} size={16} className="mr-1" />{REWARD_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <ClayInput
        label="보상 제목"
        placeholder={
          rewardType === 'letter' ? '예: 엄마의 편지' :
          rewardType === 'giftcard' ? '예: 치킨 기프티콘' :
          '예: 소원 하나 들어주기'
        }
        value={rewardTitle}
        onChange={(e) => setRewardTitle(e.target.value)}
      />

      <div>
        <label htmlFor="reward-content" className="block text-sm font-medium text-warm-sub mb-2 ml-1">
          보상 내용
        </label>
        <textarea
          id="reward-content"
          className="clay-input min-h-[120px] resize-none"
          placeholder={
            rewardType === 'letter' ? '편지 내용을 적어주세요...' :
            rewardType === 'giftcard' ? '기프티콘 코드나 설명을 적어주세요...' :
            '소원 내용을 적어주세요...'
          }
          value={rewardContent}
          onChange={(e) => setRewardContent(e.target.value)}
        />
      </div>
    </>
  );
}
