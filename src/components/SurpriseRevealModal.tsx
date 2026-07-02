'use client';

import Modal, { useModalClose } from './Modal';
import Avatar from './Avatar';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';
import Confetti from './Confetti';
import type { PlantedGiftInfo } from '@/types';

interface SurpriseRevealModalProps {
  gift: PlantedGiftInfo;
  onClose: () => void;
}

// Shown the instant a recipient fills a grape that a friend had planted a
// surprise gift on.
export default function SurpriseRevealModal({ gift, onClose }: SurpriseRevealModalProps) {
  const { closeRef, requestClose } = useModalClose(onClose);
  return (
    <Modal
      variant="center"
      onClose={onClose}
      closeRef={closeRef}
      dismissable={false}
      label="포도알 속 깜짝 선물"
      backdropClassName="z-95 bg-black/40 backdrop-blur-xs p-6"
      overlay={<Confetti trigger={1} />}
    >
      <EmojiIcon emoji={gift.emoji || '🎁'} size={64} className="block mx-auto mb-3" />
        <p className="text-sm text-warm-sub mb-1">포도알 속 깜짝 선물!</p>
        <div className="flex items-center justify-center gap-2 mb-3">
          <Avatar avatar={gift.plantedBy.avatar} size="sm" />
          <p className="text-sm">
            <b className="text-grape-700">{gift.plantedBy.name}</b>님이 숨겨놨어요
          </p>
        </div>
        {gift.message && (
          <div className="clay-sm bg-grape-50 p-3 mb-5 text-sm text-warm-text whitespace-pre-wrap wrap-break-word">
            &ldquo;{gift.message}&rdquo;
          </div>
        )}
      <ClayButton variant="joyful" onClick={requestClose} fullWidth>
        <EmojiIcon emoji="💜" size={16} />고마워요!
      </ClayButton>
    </Modal>
  );
}
