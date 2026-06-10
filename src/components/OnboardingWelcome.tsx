'use client';

import { useRouter } from 'next/navigation';
import Modal from './Modal';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';
import Podo from './mascot/Podo';
import { feedbackTap } from '@/lib/feedback';

interface OnboardingWelcomeProps {
  /** 닫기/시작 후 다시 보지 않도록 부모가 처리(localStorage 기록). */
  onClose: () => void;
}

const STEPS: { emoji: string; title: string; desc: string }[] = [
  { emoji: '🍇', title: '포도판 만들기', desc: '이루고 싶은 습관·목표로 빈 포도판을 만들어요' },
  { emoji: '✅', title: '매일 한 알씩', desc: '실천한 날마다 포도알을 톡 채워요' },
  { emoji: '🎁', title: '보상 개봉', desc: '다 채우면 숨겨둔 보상이 열려요' },
];

// 첫 방문(보드 0개 + 미온보딩) 시 핵심 루프를 한 번에 알려주는 환영 모달.
// "빈 홈에서 뭘 해야 하지?" 이탈을 줄이는 목적 — 만들기로 바로 보낸다.
export default function OnboardingWelcome({ onClose }: OnboardingWelcomeProps) {
  const router = useRouter();

  const start = () => {
    feedbackTap();
    onClose();
    router.push('/board/create');
  };

  return (
    <Modal
      variant="center"
      onClose={onClose}
      label="포도알 시작하기"
      backdropClassName="z-[92] bg-black/40 backdrop-blur-sm p-6"
      sheetClassName="w-full max-w-sm bg-clay-bg rounded-[28px] clay-float p-6 text-center animate-bounce-in"
    >
      <div className="flex justify-center mb-3">
        <Podo size={64} />
      </div>
      <h2 className="font-display text-xl font-bold text-grape-700 mb-1">
        포도알에 오신 걸 환영해요
      </h2>
      <p className="text-sm text-warm-sub mb-5 [text-wrap:balance]">
        한 알씩 채우며 목표를 이루는 습관 앱이에요
      </p>

      <ol className="text-left space-y-3 mb-6">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-center gap-3">
            <span className="flex-shrink-0 w-9 h-9 rounded-full clay-sm grid place-items-center">
              <EmojiIcon emoji={s.emoji} size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-warm-text">
                <span className="text-grape-600 tabular-nums mr-1">{i + 1}</span>{s.title}
              </span>
              <span className="block text-xs text-warm-sub leading-snug">{s.desc}</span>
            </span>
          </li>
        ))}
      </ol>

      <ClayButton variant="joyful" fullWidth onClick={start}>
        <EmojiIcon emoji="🍇" size={16} className="mr-1" />첫 포도판 만들기
      </ClayButton>
      <button
        onClick={() => { feedbackTap(); onClose(); }}
        className="w-full text-sm text-warm-sub mt-2.5 py-1.5"
      >
        둘러볼게요
      </button>
    </Modal>
  );
}
