'use client';

import type { RewardInfo } from '@/types';
import { REWARD_TYPE_LABELS } from '@/types';
import { REWARD_TYPE_ICON, ICON } from '@/lib/icons';
import Modal, { useModalClose } from './Modal';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';
import Confetti from './Confetti';

interface RewardRevealModalProps {
  reward: RewardInfo;
  /** 본문이 아직 스트리밍 중인가 — 부모가 명시적으로 관리한다. content의
   *  truthiness로 분기하면 '내용 없는 보상'(빈 문자열 허용)이 영구 스켈레톤에
   *  갇힌다(2026-06-13 무한로딩 수정). */
  loading?: boolean;
  /** 스켈레톤이 왜 길어지는지 설명하는 한 줄(예: 연타 직후 채움 저장 대기).
   *  말 없는 스켈레톤은 몇 초만 지나도 '안 나온다'로 읽힌다(2026-06-13 영상). */
  loadingNote?: string;
  onClose: () => void;
}

/**
 * Prominent popup for opening a reward — used both when a MID reward is reached
 * (auto, synced to the confetti beat) and when any reward chip/card is tapped.
 * Opens INSTANTLY; while `loading` it shows a shimmer placeholder. 내용이 없는
 * 보상(빈 content·imageUrl)은 본문 박스를 생략하고 제목만 보여준다.
 */
export default function RewardRevealModal({ reward, loading = false, loadingNote, onClose }: RewardRevealModalProps) {
  const { closeRef, requestClose } = useModalClose(onClose);
  return (
    <Modal
      variant="center"
      onClose={onClose}
      closeRef={closeRef}
      label={`보상 개봉 — ${reward.title}`}
      backdropClassName="z-95 bg-black/40 backdrop-blur-xs p-6"
      overlay={<Confetti trigger={1} />}
    >
      <p className="text-sm text-warm-sub mb-2">보상 개봉!</p>
        <EmojiIcon emoji={REWARD_TYPE_ICON[reward.type]} size={56} className="block mx-auto mb-2" />
        <div className="text-xs font-medium text-grape-600 mb-1">{REWARD_TYPE_LABELS[reward.type]}</div>
        <h3 className="font-display text-xl font-bold text-grape-700 mb-3 wrap-break-word">{reward.title}</h3>
        {loading ? (
          <div className="clay-sm bg-white p-4 mb-5 text-center space-y-2" aria-label="내용 불러오는 중">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-2/3" />
            {loadingNote && <p className="text-xs text-warm-sub pt-1">{loadingNote}</p>}
          </div>
        ) : reward.content ? (
          <div className="clay-sm bg-white p-4 mb-5 text-center">
            <p className="text-sm text-warm-text whitespace-pre-wrap leading-relaxed wrap-break-word">
              {reward.content}
            </p>
          </div>
        ) : null}
        {reward.imageUrl && (
          <div className="mb-5 rounded-2xl overflow-hidden clay-sm">
            <img src={reward.imageUrl} alt={reward.title} className="w-full object-cover max-h-60" />
          </div>
        )}
      <ClayButton variant="joyful" onClick={requestClose} fullWidth>
        <EmojiIcon emoji={ICON.heart} size={16} className="mr-1" />확인
      </ClayButton>
    </Modal>
  );
}
