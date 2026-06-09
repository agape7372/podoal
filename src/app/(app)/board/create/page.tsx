'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ClayButton from '@/components/ClayButton';
import ClayInput from '@/components/ClayInput';
import NumberStepper from '@/components/NumberStepper';
import TemplatePicker from '@/components/create/TemplatePicker';
import RewardEditor from '@/components/create/RewardEditor';
import { api } from '@/lib/api';
import type { RewardType } from '@/types';
import type { HabitTemplate } from '@/lib/templates';
import EmojiIcon from '@/components/EmojiIcon';
import { feedbackSuccess, feedbackTap } from '@/lib/feedback';

// 빠른 선택용 포도알 개수 프리셋. NumberStepper로 이후 미세조정 가능.
const SIZE_PRESETS = [5, 10, 15, 20, 25, 30];

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
      <div className="flex items-center justify-center gap-2 mb-6">
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
        <TemplatePicker
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onSelectTemplate={handleSelectTemplate}
          onSkip={handleSkipTemplate}
        />
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
          {/* Quick presets — tap to set, then fine-tune with the stepper below. */}
          <div className="grid grid-cols-3 gap-2">
            {SIZE_PRESETS.map((n) => (
              <button
                key={n}
                onClick={() => { feedbackTap(); setTotalStickers(n); }}
                aria-pressed={totalStickers === n}
                className={`clay-button py-2.5 rounded-xl text-sm font-medium tabular-nums transition-all ${
                  totalStickers === n ? 'ring-2 ring-grape-400 clay-pressed text-grape-700' : 'text-warm-sub'
                }`}
              >
                {n}알
              </button>
            ))}
          </div>
          <div className="clay-sm p-6 flex flex-col items-center">
            <NumberStepper value={totalStickers} onChange={setTotalStickers} min={2} max={60} />
          </div>
          <p className="text-xs text-warm-sub text-center">2~60알까지 자유롭게 설정할 수 있어요</p>

          <div className="flex gap-3 mt-4">
            <ClayButton variant="ghost" onClick={() => setStep(1)} fullWidth>
              ← 이전
            </ClayButton>
            <ClayButton
              fullWidth
              // 숫자 직접입력 중 탭하면 input blur(commit)를 click보다 먼저 강제해 1탭으로 진행되게 한다.
              onPointerDown={() => (document.activeElement as HTMLElement | null)?.blur?.()}
              onClick={() => setStep(3)}
            >
              다음 →
            </ClayButton>
          </div>
        </div>
      )}

      {/* Step 3: Reward */}
      {step === 3 && (
        <div className="space-y-5 animate-fade-in">
          <RewardEditor
            rewardType={rewardType}
            setRewardType={setRewardType}
            rewardTitle={rewardTitle}
            setRewardTitle={setRewardTitle}
            rewardContent={rewardContent}
            setRewardContent={setRewardContent}
          />

          <p className="text-xs text-warm-sub">
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
