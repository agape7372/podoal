'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ClayButton from '@/components/ClayButton';
import ClayInput from '@/components/ClayInput';
import ClayCard from '@/components/ClayCard';
import { api } from '@/lib/api';
import { BOARD_SIZES, REWARD_TYPE_LABELS } from '@/types';
import type { RewardType } from '@/types';

export default function CreateBoardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalStickers, setTotalStickers] = useState(10);
  const [rewardType, setRewardType] = useState<RewardType>('letter');
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardContent, setRewardContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요'); return; }
    if (!rewardTitle.trim()) { setError('보상 제목을 입력해주세요'); return; }
    if (!rewardContent.trim()) { setError('보상 내용을 입력해주세요'); return; }

    setLoading(true);
    setError('');
    try {
      const data = await api<{ board: { id: string } }>('/api/boards', {
        method: 'POST',
        json: {
          title: title.trim(),
          description: description.trim(),
          totalStickers,
          reward: {
            type: rewardType,
            title: rewardTitle.trim(),
            content: rewardContent.trim(),
          },
        },
      });
      router.replace(`/board/${data.board.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성에 실패했어요');
    }
    setLoading(false);
  };

  const quickTitles = [
    '매일 운동하기 💪',
    '책 읽기 📚',
    '일찍 일어나기 ⏰',
    '물 마시기 💧',
    '공부하기 ✏️',
    '칭찬 받기 ⭐',
  ];

  return (
    <div className="pb-4">
      <h1 className="text-2xl font-bold text-grape-700 mb-6">🍇 새 포도판 만들기</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step >= s
                  ? 'bg-gradient-to-br from-grape-400 to-grape-500 text-white'
                  : 'bg-grape-100 text-warm-light'
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div className={`w-8 h-0.5 ${step > s ? 'bg-grape-400' : 'bg-grape-100'}`} />
            )}
          </div>
        ))}
        <span className="text-sm text-warm-sub ml-2">
          {step === 1 ? '기본 정보' : step === 2 ? '포도 크기' : '보상 설정'}
        </span>
      </div>

      {/* Step 1: Basic info */}
      {step === 1 && (
        <div className="space-y-5 animate-fade-in">
          <ClayInput
            label="포도판 제목"
            placeholder="어떤 목표인가요?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {/* Quick title buttons */}
          <div className="flex flex-wrap gap-2">
            {quickTitles.map((t) => (
              <button
                key={t}
                onClick={() => setTitle(t)}
                className={`clay-button px-3 py-1.5 rounded-xl text-sm ${
                  title === t ? 'ring-2 ring-grape-300' : ''
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <ClayInput
            label="설명 (선택)"
            placeholder="자세한 설명을 적어주세요"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <ClayButton
            fullWidth
            size="lg"
            onClick={() => { if (title.trim()) setStep(2); else setError('제목을 입력해주세요'); }}
          >
            다음 →
          </ClayButton>
        </div>
      )}

      {/* Step 2: Board size */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-sm text-warm-sub mb-2">포도알 개수를 선택하세요</p>
          <div className="grid grid-cols-2 gap-3">
            {BOARD_SIZES.map((size) => (
              <ClayCard
                key={size.value}
                onClick={() => setTotalStickers(size.value)}
                color={totalStickers === size.value ? 'lavender' : 'white'}
                className={`text-center ${totalStickers === size.value ? 'ring-2 ring-grape-400' : ''}`}
              >
                <div className="text-3xl mb-2">
                  {size.value <= 10 ? '🍇' : size.value <= 15 ? '🍇🍇' : size.value <= 20 ? '🍇🍇🍇' : '🍇🍇🍇🍇'}
                </div>
                <p className="font-bold text-grape-700">{size.label}</p>
                <p className="text-xs text-warm-sub">{size.description}</p>
              </ClayCard>
            ))}
          </div>

          <div className="flex gap-3 mt-4">
            <ClayButton variant="ghost" onClick={() => setStep(1)} fullWidth>
              ← 이전
            </ClayButton>
            <ClayButton fullWidth onClick={() => setStep(3)}>
              다음 →
            </ClayButton>
          </div>
        </div>
      )}

      {/* Step 3: Reward */}
      {step === 3 && (
        <div className="space-y-5 animate-fade-in">
          <p className="text-sm text-warm-sub">달성하면 받을 보상을 설정해요</p>
          <p className="text-xs text-warm-light">달성 전까지 내용은 비밀이에요! 🤫</p>

          {/* Reward type */}
          <div className="flex gap-2">
            {(Object.entries(REWARD_TYPE_LABELS) as [RewardType, string][]).map(([type, label]) => (
              <button
                key={type}
                onClick={() => setRewardType(type)}
                className={`
                  flex-1 clay-button px-3 py-3 rounded-xl text-sm font-medium text-center
                  ${rewardType === type ? 'ring-2 ring-grape-400 clay-pressed' : ''}
                `}
              >
                {label}
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
            <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">
              보상 내용
            </label>
            <textarea
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

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <div className="flex gap-3">
            <ClayButton variant="ghost" onClick={() => setStep(2)} fullWidth>
              ← 이전
            </ClayButton>
            <ClayButton fullWidth onClick={handleCreate} loading={loading}>
              🍇 만들기
            </ClayButton>
          </div>
        </div>
      )}
    </div>
  );
}
