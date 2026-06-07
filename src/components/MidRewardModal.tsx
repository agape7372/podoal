'use client';

import { useEffect, useState } from 'react';
import ClayButton from './ClayButton';
import ClayInput from './ClayInput';
import EmojiIcon from './EmojiIcon';
import { api } from '@/lib/api';
import { feedbackSuccess } from '@/lib/feedback';
import { REWARD_TYPE_LABELS } from '@/types';
import { REWARD_TYPE_ICON } from '@/lib/icons';
import type { RewardInfo, RewardType } from '@/types';

interface MidRewardModalProps {
  board: { id: string; totalStickers: number; filledCount: number };
  /** 0-based grape index the reward is tied to (triggerAt = position + 1). */
  position: number;
  /** When set, the modal edits an existing mid-reward instead of creating one. */
  existingReward?: RewardInfo | null;
  onClose: () => void;
  onSaved: () => void;
}

const placeholders: Record<RewardType, { title: string; content: string }> = {
  letter: { title: '예: 응원 쪽지', content: '편지 내용을 적어주세요...' },
  giftcard: { title: '예: 커피 기프티콘', content: '기프티콘 코드나 설명을 적어주세요...' },
  wish: { title: '예: 소원 하나', content: '소원 내용을 적어주세요...' },
};

export default function MidRewardModal({ board, position, existingReward, onClose, onSaved }: MidRewardModalProps) {
  const editing = !!existingReward;
  const [type, setType] = useState<RewardType>(existingReward?.type ?? 'letter');
  const [title, setTitle] = useState(existingReward?.title ?? '');
  const [content, setContent] = useState(existingReward?.content ?? '');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // The board GET blanks an unrevealed reward's content (kept secret until
  // opened), so when editing such a reward we pull the full row (owner-only) to
  // prefill the textarea.
  useEffect(() => {
    if (!existingReward || existingReward.content) return;
    let alive = true;
    (async () => {
      try {
        const data = await api<{ reward: RewardInfo }>(
          `/api/boards/${board.id}/rewards/${existingReward.id}`,
        );
        if (!alive) return;
        setType(data.reward.type);
        setTitle(data.reward.title);
        setContent(data.reward.content);
      } catch {
        // Keep whatever we have; the user can retype the content.
      }
    })();
    return () => {
      alive = false;
    };
    // Depend on the stable id, not the object — board re-fetches rebuild the
    // RewardInfo reference each time and would otherwise re-run this effect,
    // overwriting the user's in-progress edits with the server value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id, existingReward?.id]);

  const save = async () => {
    if (!title.trim()) {
      setError('보상 제목을 입력해주세요');
      return;
    }
    if (!content.trim()) {
      setError('보상 내용을 입력해주세요');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (editing) {
        await api(`/api/boards/${board.id}/rewards/${existingReward!.id}`, {
          method: 'PATCH',
          json: { type, title: title.trim(), content: content.trim() },
        });
      } else {
        await api(`/api/boards/${board.id}/rewards`, {
          method: 'POST',
          json: { type, title: title.trim(), content: content.trim(), position },
        });
      }
      feedbackSuccess();
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '보상을 저장하지 못했어요');
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existingReward) return;
    setDeleting(true);
    setError('');
    try {
      await api(`/api/boards/${board.id}/rewards/${existingReward.id}`, { method: 'DELETE' });
      feedbackSuccess();
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '보상을 삭제하지 못했어요');
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-clay-bg rounded-t-[32px] clay-float p-6 pb-8 safe-bottom animate-slide-up">
        <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />
        <h3 className="font-display text-xl font-bold text-grape-700 text-center mb-1">
          <EmojiIcon emoji="🎁" size={22} className="mr-1" />
          {editing ? '중간 보상 수정' : '중간 보상'}
        </h3>
        <p className="text-sm text-warm-sub text-center mb-5">
          <span className="tabular-nums">{position + 1}</span>번째 포도알을 채우면 깜짝 공개돼요
        </p>

        {/* Reward type */}
        <div className="flex gap-2 mb-4">
          {(Object.keys(REWARD_TYPE_LABELS) as RewardType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`
                flex-1 clay-button px-3 py-3 rounded-xl text-sm font-medium text-center
                ${type === t ? 'ring-2 ring-grape-400 clay-pressed' : ''}
              `}
            >
              <EmojiIcon emoji={REWARD_TYPE_ICON[t]} size={16} className="mr-1" />{REWARD_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <ClayInput
            label="보상 제목"
            placeholder={placeholders[type].title}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
          />
        </div>

        <div className="mb-3">
          <label htmlFor="mid-reward-content" className="block text-sm font-medium text-warm-sub mb-2 ml-1">
            보상 내용
          </label>
          <textarea
            id="mid-reward-content"
            className="clay-input min-h-[100px] resize-none"
            placeholder={placeholders[type].content}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
          />
        </div>

        {error && <p role="alert" className="text-rose-700 text-xs text-center mb-3">{error}</p>}

        <div className="flex gap-3">
          <ClayButton variant="ghost" onClick={onClose} fullWidth disabled={busy || deleting}>
            취소
          </ClayButton>
          <ClayButton variant="primary" onClick={save} fullWidth loading={busy} disabled={deleting}>
            <EmojiIcon emoji="🎁" size={16} className="mr-1" />
            {editing ? '저장' : '심기'}
          </ClayButton>
        </div>

        {editing && (
          <button
            type="button"
            onClick={remove}
            disabled={busy || deleting}
            className="w-full text-center text-sm text-grape-700 mt-3 py-2 disabled:opacity-50"
          >
            {deleting ? '삭제 중…' : '이 보상 삭제'}
          </button>
        )}
      </div>
    </div>
  );
}
