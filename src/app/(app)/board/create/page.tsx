'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ClayButton from '@/components/ClayButton';
import ClayInput from '@/components/ClayInput';
import ClayCard from '@/components/ClayCard';
import { api } from '@/lib/api';
import { BOARD_SIZES, REWARD_TYPE_LABELS } from '@/types';
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
  const [midRewards, setMidRewards] = useState<{ triggerAt: number; title: string; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const stepLabels = ['템플릿', '기본 정보', '포도 크기', '보상 설정'];

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

    const cleanMids = midRewards
      .map((m) => ({ triggerAt: m.triggerAt, title: m.title.trim(), content: m.content.trim() }))
      .filter((m) => m.title || m.content);
    for (const m of cleanMids) {
      if (!m.title || !m.content) { setError('중간 선물의 제목과 내용을 모두 입력해주세요'); return; }
      if (m.triggerAt < 1 || m.triggerAt >= totalStickers) { setError('중간 선물 위치가 올바르지 않아요'); return; }
    }
    const midTriggers = cleanMids.map((m) => m.triggerAt);
    if (new Set(midTriggers).size !== midTriggers.length) { setError('중간 선물 위치가 서로 겹쳐요'); return; }
    const rewardsPayload = [
      ...cleanMids.map((m) => ({ type: 'letter' as RewardType, title: m.title, content: m.content, triggerAt: m.triggerAt })),
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
        <span className="text-sm text-warm-sub ml-2">
          {stepLabels[step]}
        </span>
      </div>

      {/* Step 0: Template selection */}
      {step === 0 && (
        <div className="space-y-5 animate-fade-in">
          <p className="text-sm text-warm-sub">추천 템플릿으로 빠르게 시작하거나, 직접 만들어보세요!</p>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 py-2">
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
          <p className="text-sm text-warm-sub mb-2">포도알 개수를 선택하세요</p>
          <div className="grid grid-cols-2 gap-3">
            {BOARD_SIZES.map((size) => (
              <ClayCard
                key={size.value}
                onClick={() => setTotalStickers(size.value)}
                color={totalStickers === size.value ? 'lavender' : 'white'}
                className={`text-center ${totalStickers === size.value ? 'ring-2 ring-grape-400' : ''}`}
              >
                <div className="mb-2 flex justify-center gap-0.5">
                  {Array.from({ length: size.value <= 10 ? 1 : size.value <= 15 ? 2 : size.value <= 20 ? 3 : 4 }).map((_, i) => (
                    <EmojiIcon key={i} emoji="🍇" size={24} />
                  ))}
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
          <p className="text-xs text-warm-light">달성 전까지 내용은 비밀이에요! <EmojiIcon emoji="🤫" size={13} /></p>

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

          {/* 중간 선물 (선택) — 여러 지점에 깜짝 보상 심기 */}
          <div className="clay-sm p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-warm-text inline-flex items-center">
                <EmojiIcon emoji="🎁" size={15} className="mr-1" />중간 선물 <span className="text-warm-light ml-1">(선택)</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  const used = new Set(midRewards.map((m) => m.triggerAt));
                  if (used.size >= totalStickers - 1) return;
                  let pos = Math.max(1, Math.round(totalStickers / 2));
                  while (used.has(pos)) pos = (pos % (totalStickers - 1)) + 1;
                  setMidRewards((prev) => [...prev, { triggerAt: pos, title: '', content: '' }]);
                }}
                className="text-xs font-medium text-grape-600 clay-button px-2.5 py-1 rounded-lg bg-grape-50"
              >
                + 추가
              </button>
            </div>
            <p className="text-xs text-warm-sub mb-3">중간 칸에 도달하면 깜짝 공개돼요</p>
            {midRewards.length === 0 ? (
              <p className="text-xs text-warm-light">예: 5번째 알에 “여기까지 잘했어!” 쪽지</p>
            ) : (
              <div className="space-y-3">
                {midRewards.map((m, i) => (
                  <div key={i} className="clay-sm p-3 bg-grape-50/40">
                    <div className="flex items-center gap-2 mb-2">
                      <select
                        aria-label="중간 선물 위치"
                        value={m.triggerAt}
                        onChange={(e) => setMidRewards((prev) => prev.map((x, j) => (j === i ? { ...x, triggerAt: Number(e.target.value) } : x)))}
                        className="clay-input py-1.5 px-2 text-sm flex-1"
                      >
                        {Array.from({ length: totalStickers - 1 }, (_, k) => k + 1).map((n) => (
                          <option key={n} value={n}>{n}번째 알에서</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setMidRewards((prev) => prev.filter((_, j) => j !== i))} className="text-xs text-grape-700 px-2 py-1.5">
                        삭제
                      </button>
                    </div>
                    <input
                      value={m.title}
                      onChange={(e) => setMidRewards((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                      placeholder="선물 제목 (예: 응원 쪽지)"
                      maxLength={80}
                      className="clay-input text-sm mb-2"
                    />
                    <textarea
                      value={m.content}
                      onChange={(e) => setMidRewards((prev) => prev.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))}
                      placeholder="내용 (도달하면 공개돼요)"
                      maxLength={500}
                      rows={2}
                      className="clay-input text-sm resize-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

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
