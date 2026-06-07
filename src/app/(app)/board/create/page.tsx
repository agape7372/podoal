'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ClayButton from '@/components/ClayButton';
import ClayInput from '@/components/ClayInput';
import NumberStepper from '@/components/NumberStepper';
import { api } from '@/lib/api';
import { REWARD_TYPE_LABELS } from '@/types';
import { REWARD_TYPE_ICON } from '@/lib/icons';
import type { RewardType } from '@/types';
import { TEMPLATE_CATEGORIES, getTemplatesByCategory } from '@/lib/templates';
import type { HabitTemplate } from '@/lib/templates';
import EmojiIcon from '@/components/EmojiIcon';
import { feedbackSuccess, feedbackTap } from '@/lib/feedback';

function CreateBoardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const giftTo = searchParams.get('giftTo');
  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('health');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalStickers, setTotalStickers] = useState(10);
  const [rewardType, setRewardType] = useState<RewardType>('letter');
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardContent, setRewardContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSelectTemplate = (template: HabitTemplate) => {
    feedbackTap();
    setTemplateId(template.id);
    setTitle(template.name);
    setDescription(template.description);
    setTotalStickers(template.suggestedSize);
    setRewardTitle(`${template.name} 달성 보상`);
    setRewardContent(template.suggestedReward);
    setStep(1);
  };

  const handleSkipTemplate = () => {
    setTemplateId(null);
    setTitle('');
    setDescription('');
    setTotalStickers(10);
    setRewardTitle('');
    setRewardContent('');
    setStep(1);
  };

  const handleCreate = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요'); return; }
    if (!rewardTitle.trim()) { setError('보상 제목을 입력해주세요'); return; }
    if (!rewardContent.trim()) { setError('보상 내용을 입력해주세요'); return; }

    // 중간 보상은 생성 후 포도판에서 포도알을 꾹 눌러 심는다. 여기선 완성 보상만.
    const rewardsPayload = [
      { type: rewardType, title: rewardTitle.trim(), content: rewardContent.trim(), triggerAt: totalStickers },
    ];

    setLoading(true);
    setError('');
    try {
      const data = await api<{ board: { id: string } }>('/api/boards', {
        method: 'POST',
        json: {
          title: title.trim(),
          description: description.trim(),
          totalStickers,
          templateId,
          rewards: rewardsPayload,
        },
      });
      if (giftTo) {
        // "선물하기": gift the freshly-made board to the friend (creates their
        // copy), then remove our own copy so only the friend receives it —
        // matching what the "선물하기" action implies.
        try {
          await api(`/api/boards/${data.board.id}/gift`, {
            method: 'POST',
            json: { friendId: giftTo },
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : '선물 전송에 실패했어요');
          setLoading(false);
          return;
        }
        try {
          await api(`/api/boards/${data.board.id}`, { method: 'DELETE' });
        } catch {
          // Best-effort cleanup; the friend already received their copy.
        }
        feedbackSuccess();
        router.replace(`/friends/${giftTo}`);
        return;
      }

      feedbackSuccess();
      router.replace(`/board/${data.board.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성에 실패했어요');
    }
    setLoading(false);
  };

  const categoryTemplates = getTemplatesByCategory(selectedCategory);

  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-6 inline-flex items-center gap-1.5"><EmojiIcon emoji={giftTo ? '🎁' : '🍇'} size={24} /> {giftTo ? '선물할 포도판 만들기' : '새 포도판 만들기'}</h1>

      {giftTo && (
        <div className="clay-sm p-3 mb-5 bg-grape-50/70 flex items-center gap-2">
          <EmojiIcon emoji="🎁" size={18} />
          <p className="text-sm text-grape-700">완성하면 친구에게 포도판이 전달돼요</p>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[0, 1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold tabular-nums transition-all ${
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
      </div>

      {/* Step 0: Template selection */}
      {step === 0 && (
        <div className="space-y-5 animate-fade-in">
          <p className="text-sm text-warm-sub">추천 템플릿으로 빠르게 시작하거나, 직접 만들어보세요!</p>

          {/* Category tabs — single horizontal scroll row (chips keep their
              width via whitespace-nowrap/flex-shrink-0). -mx-1 px-1 gives the
              selected chip's ring room at the scroll edges; py-2 keeps the ring
              from being clipped vertically (overflow-x promotes overflow-y). */}
          <div className="flex gap-2 py-2 -mx-1 px-1 overflow-x-auto scrollbar-hide">
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`
                  clay-button px-3 py-2 rounded-xl text-sm whitespace-nowrap flex-shrink-0
                  ${selectedCategory === cat.id
                    ? 'ring-2 ring-grape-400 clay-pressed bg-grape-50'
                    : ''
                  }
                `}
              >
                <span className="inline-flex items-center gap-1"><EmojiIcon emoji={cat.icon} size={15} /> {cat.name}</span>
              </button>
            ))}
          </div>

          {/* Template grid */}
          <div className="grid grid-cols-2 gap-3">
            {categoryTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className={`
                  clay p-4 text-left transition-all active:scale-[0.97]
                  hover:bg-grape-50/40
                `}
              >
                <div className="mb-2"><EmojiIcon emoji={template.icon} size={26} /></div>
                <p className="font-semibold text-sm text-grape-700 mb-1">{template.name}</p>
                <p className="text-xs text-warm-sub line-clamp-2">{template.description}</p>
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-xs text-grape-600 tabular-nums">{template.suggestedSize}알</span>
                </div>
              </button>
            ))}
          </div>

          {/* Skip to custom */}
          <div className="pt-2">
            <ClayButton
              variant="ghost"
              fullWidth
              size="lg"
              onClick={handleSkipTemplate}
            >
              <EmojiIcon emoji="✨" size={16} className="mr-1" />직접 만들기
            </ClayButton>
          </div>
        </div>
      )}

      {/* Step 1: Basic info */}
      {step === 1 && (
        <div className="space-y-5 animate-fade-in">
          <ClayInput
            label="포도판 제목"
            placeholder="어떤 목표인가요?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <ClayInput
            label="설명 (선택)"
            placeholder="자세한 설명을 적어주세요"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {error && <p role="alert" className="text-grape-700 text-sm text-center">{error}</p>}

          <div className="flex gap-3">
            <ClayButton variant="ghost" onClick={() => setStep(0)} fullWidth>
              ← 이전
            </ClayButton>
            <ClayButton
              fullWidth
              size="lg"
              onClick={() => { if (title.trim()) { setError(''); setStep(2); } else setError('제목을 입력해주세요'); }}
            >
              다음 →
            </ClayButton>
          </div>
        </div>
      )}

      {/* Step 2: Board size */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-sm text-warm-sub mb-2">포도알 개수를 정해주세요</p>
          <div className="clay-sm p-6 flex flex-col items-center gap-4">
            <NumberStepper value={totalStickers} onChange={setTotalStickers} min={2} max={60} />
            <div className="flex flex-wrap justify-center items-end gap-0.5 max-w-[230px]">
              {Array.from({ length: Math.min(totalStickers, 30) }).map((_, i) => (
                <EmojiIcon key={i} emoji="🍇" size={16} />
              ))}
              {totalStickers > 30 && (
                <span className="text-xs text-warm-sub ml-1 tabular-nums">+{totalStickers - 30}</span>
              )}
            </div>
          </div>
          <p className="text-xs text-warm-light text-center">2~60알까지 자유롭게 설정할 수 있어요</p>

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
          <p className="text-xs text-warm-light">달성 전까지 내용은 비밀이에요! <EmojiIcon emoji="🤫" size={13} /></p>

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

          <p className="text-xs text-warm-light">
            <span className="text-grape-400 font-bold mr-0.5">*</span>만들어진 포도알을 꾹 눌러 중간 보상을 설정할 수 있어요!
          </p>

          {error && <p role="alert" className="text-grape-700 text-sm text-center">{error}</p>}

          <div className="flex gap-3">
            <ClayButton variant="ghost" onClick={() => setStep(2)} fullWidth>
              ← 이전
            </ClayButton>
            <ClayButton fullWidth onClick={handleCreate} loading={loading}>
              <EmojiIcon emoji={giftTo ? '🎁' : '🍇'} size={16} className="mr-1" />{giftTo ? '선물하기' : '만들기'}
            </ClayButton>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreateBoardPage() {
  return (
    <Suspense fallback={<div className="pb-4"><div className="skeleton h-8 w-48 mb-6" /><div className="skeleton h-64 w-full" /></div>}>
      <CreateBoardInner />
    </Suspense>
  );
}
