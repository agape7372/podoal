'use client';

import { useState } from 'react';
import { CHEER_EMOJIS } from '@/types';
import { feedbackCheer } from '@/lib/feedback';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';

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
  const [selectedEmoji, setSelectedEmoji] = useState('💜');
  const [selectedMsg, setSelectedMsg] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!selectedMsg) return;
    setSending(true);
    await onSend(selectedMsg, selectedEmoji);
    feedbackCheer();
    setSending(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg bg-clay-bg rounded-t-[32px] clay-float p-6 pb-8 safe-bottom animate-slide-up">
        <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />

        <h3 className="font-display text-xl font-bold text-grape-700 text-center mb-1">
          응원 보내기
        </h3>
        <p className="text-sm text-warm-sub text-center mb-5">
          {recipientName}님에게 응원 메시지를 보내요
        </p>

        {/* Emoji selector */}
        <div className="flex flex-wrap justify-center gap-2 mb-5">
          {CHEER_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => setSelectedEmoji(emoji)}
              className={`
                w-11 h-11 rounded-xl text-xl flex items-center justify-center transition-all
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
        <div className="flex flex-wrap gap-2 mb-6">
          {quickMessages.map((m) => {
            const value = m.emoji ? `${m.text} ${m.emoji}` : m.text;
            return (
              <button
                key={value}
                onClick={() => setSelectedMsg(value)}
                className={`
                  px-3 py-2 rounded-xl text-sm font-medium transition-all inline-flex items-center gap-1
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

        <div className="flex gap-3">
          <ClayButton variant="ghost" onClick={onClose} fullWidth>
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
      </div>
    </div>
  );
}
