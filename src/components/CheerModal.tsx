'use client';

import { useState } from 'react';
import { CHEER_EMOJIS } from '@/types';
import { feedbackCheer } from '@/lib/feedback';
import { ellipsizeName } from '@/lib/title';
import Modal, { useModalClose } from './Modal';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';
import { track } from '@/lib/analytics';

interface CheerModalProps {
  recipientName: string;
  onSend: (message: string, emoji: string) => Promise<void>;
  onClose: () => void;
}

const quickMessages: { text: string; emoji?: string }[] = [
  { text: '화이팅!', emoji: '💪' },
  { text: '잘하고 있어!' },
  { text: '응원해! 할 수 있어!' },
  { text: '오늘도 최고야!' },
  { text: '대단해! 계속 가자!' },
  { text: '너무 잘하는데?' },
  { text: '거의 다 됐어!' },
  { text: '포기하지 마!' },
];

export default function CheerModal({ recipientName, onSend, onClose }: CheerModalProps) {
  const { closeRef, requestClose } = useModalClose(onClose);
  const [selectedEmoji, setSelectedEmoji] = useState('💜');
  const [selectedMsg, setSelectedMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!selectedMsg) return;
    setSending(true);
    setError('');
    try {
      await onSend(selectedMsg, selectedEmoji);
      track('cheer_sent'); // 메시지 내용·이모지는 계측 안 함(PII 원칙 §2)
      feedbackCheer();
      requestClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '응원을 보내지 못했어요');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      closeRef={closeRef}
      label="응원 보내기"
      backdropClassName="z-90 bg-black/30 backdrop-blur-xs"
    >
      <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />

        <h3 className="font-display text-xl font-bold text-grape-700 text-center mb-1">
          응원 보내기
        </h3>
        <p className="text-sm text-warm-sub text-center mb-5">
          {ellipsizeName(recipientName)}님에게 응원을 보내요
        </p>

        {/* Emoji selector */}
        <div className="flex flex-wrap justify-center gap-2 mb-5">
          {CHEER_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => setSelectedEmoji(emoji)}
              aria-pressed={selectedEmoji === emoji}
              aria-label={`이모지 ${emoji}`}
              className={`
                w-11 h-11 rounded-xl text-xl flex items-center justify-center transition-[transform,background-color,box-shadow]
                ${selectedEmoji === emoji
                  ? 'clay-pressed scale-110 ring-2 ring-grape-300'
                  : 'clay-button'
                }
              `}
            >
              <EmojiIcon emoji={emoji} size={22} />
            </button>
          ))}
        </div>

        {/* Quick messages */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {quickMessages.map((m) => {
            const value = m.emoji ? `${m.text} ${m.emoji}` : m.text;
            return (
              <button
                key={value}
                onClick={() => setSelectedMsg(value)}
                className={`
                  px-3 py-2 rounded-xl text-sm font-medium transition-[color,background-color,box-shadow] flex items-center justify-center gap-1 w-full
                  ${selectedMsg === value
                    ? 'clay-pressed text-grape-600 ring-2 ring-grape-300'
                    : 'clay-button text-warm-text'
                  }
                `}
              >
                {m.text}
                {m.emoji && <EmojiIcon emoji={m.emoji} size={15} />}
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="text-rose-700 text-xs text-center mb-3">{error}</p>
        )}

        <div className="flex gap-3">
          <ClayButton variant="ghost" onClick={requestClose} fullWidth>
            취소
          </ClayButton>
          <ClayButton
            variant="primary"
            onClick={handleSend}
            fullWidth
            loading={sending}
            disabled={!selectedMsg}
          >
            <EmojiIcon emoji={selectedEmoji} size={16} className="mr-1" />보내기
          </ClayButton>
        </div>
    </Modal>
  );
}
