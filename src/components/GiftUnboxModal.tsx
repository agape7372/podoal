'use client';

import { useState } from 'react';
import Modal from './Modal';
import Avatar from './Avatar';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';
import Confetti from './Confetti';

interface GiftUnboxModalProps {
  senderName: string;
  senderAvatar: string;
  boardTitle: string;
  message?: string;
  onOpen: () => Promise<void> | void;
  onDecline: () => Promise<void> | void;
}

// One-time "unwrap" moment shown when a recipient first opens a gifted board.
export default function GiftUnboxModal({
  senderName,
  senderAvatar,
  boardTitle,
  message,
  onOpen,
  onDecline,
}: GiftUnboxModalProps) {
  const [busy, setBusy] = useState(false);
  const [confetti, setConfetti] = useState(0);

  const handleOpen = async () => {
    if (busy) return;
    setBusy(true);
    setConfetti((t) => t + 1);
    try {
      await onOpen();
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onDecline();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      variant="center"
      onClose={handleDecline}
      dismissable={false}
      label={`${senderName}님의 선물 — ${boardTitle}`}
      backdropClassName="z-95 bg-black/40 backdrop-blur-xs p-6"
      overlay={<Confetti trigger={confetti} />}
      sheetClassName="w-full max-w-sm bg-clay-bg rounded-[28px] clay-float p-6 text-center animate-bounce-in"
    >
      <EmojiIcon emoji="🎁" size={64} className="block mx-auto mb-3" />
        <div className="flex items-center justify-center gap-2 mb-1">
          <Avatar avatar={senderAvatar} size="sm" />
          <p className="text-sm text-warm-sub">
            <b className="text-grape-700">{senderName}</b>님의 선물
          </p>
        </div>
        <h3 className="font-display text-xl font-bold text-grape-700 mb-3">{boardTitle}</h3>
        {message ? (
          <div className="clay-sm bg-grape-50 p-3 mb-5 text-sm text-warm-text whitespace-pre-wrap wrap-break-word">
            &ldquo;{message}&rdquo;
          </div>
        ) : (
          <p className="text-sm text-warm-sub mb-5">포도판을 선물받았어요! 함께 채워볼까요?</p>
        )}
        <div className="flex flex-col gap-2">
          <ClayButton variant="joyful" onClick={handleOpen} loading={busy} fullWidth>
            <EmojiIcon emoji="🍇" size={16} className="mr-1" />선물 받기
          </ClayButton>
          <button
            onClick={handleDecline}
            disabled={busy}
            className="text-xs text-warm-sub underline py-1"
          >
            정중히 거절하기
          </button>
        </div>
    </Modal>
  );
}
