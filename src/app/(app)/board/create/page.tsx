'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ClayButton from '@/components/ClayButton';
import ClayInput from '@/components/ClayInput';
import NumberStepper from '@/components/NumberStepper';
import TemplatePicker from '@/components/create/TemplatePicker';
import RewardEditor from '@/components/create/RewardEditor';
import StepProgress from '@/components/create/StepProgress';
import CadencePicker from '@/components/create/CadencePicker';
import { api } from '@/lib/api';
import type { RewardType, CadenceType } from '@/types';
import type { HabitTemplate } from '@/lib/templates';
import EmojiIcon from '@/components/EmojiIcon';
import { feedbackSuccess, feedbackTap } from '@/lib/feedback';
import { track, trackFirst } from '@/lib/analytics';
import { useAppStore } from '@/lib/store';

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
  // 채움 텀(FILL_CADENCE_PLAN §2 C1). giftTo(선물 생성)는 v1 FREE 고정 — 섹션
  // 자체를 숨기고(JSX), 제출 시에도 아래 payload에서 한 번 더 강제한다(이중 방어).
  const [cadenceType, setCadenceType] = useState<CadenceType>('FREE');
  const [cadenceN, setCadenceN] = useState(3);
  // 엄격 모드(C4-a additive) — cadenceType과 동일한 giftTo/FREE 이중 방어(아래 handleCreate).
  const [strictMode, setStrictMode] = useState(false);
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
    // 템플릿 권장 리듬 자동 제안(giftTo면 v1 FREE 고정 — 선물 보드는 텀 미노출).
    const rec = !giftTo ? template.recommendedCadence : undefined;
    setCadenceType(rec?.type ?? 'FREE');
    setCadenceN(rec?.n ?? 3);
    setStrictMode(false);
    setStep(1);
  };

  const handleSkipTemplate = () => {
    setTemplateId(null);
    setTitle('');
    setDescription('');
    setTotalStickers(10);
    setCadenceType('FREE');
    setCadenceN(3);
    setStrictMode(false);
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

    // giftTo(선물 생성)는 v1 FREE 고정 — CadencePicker를 숨겨도 템플릿 자동제안으로
    // state가 이미 채워져 있을 수 있어(예: giftTo 진입 전 템플릿에서 넘어온 값), 제출
    // 시점에도 한 번 더 강제한다(이중 방어 — 근거: 위 handleSelectTemplate의 giftTo 분기와 쌍).
    const effectiveCadenceType: CadenceType = giftTo ? 'FREE' : cadenceType;
    const effectiveCadenceN =
      !giftTo && (cadenceType === 'DAILY_N' || cadenceType === 'WEEKLY_N') ? cadenceN : undefined;
    // 엄격 모드(C4-a) — giftTo/FREE는 이중 방어로 강제 false(cadenceType과 동일 패턴).
    const effectiveStrictMode = !giftTo && effectiveCadenceType !== 'FREE' ? strictMode : false;

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
          cadenceType: effectiveCadenceType,
          cadenceN: effectiveCadenceN,
          strictMode: effectiveStrictMode,
          rewards: rewardsPayload,
        },
      });
      // 계측(A3) — 동기 fire-and-forget 한 줄, 흐름 무간섭. 속성은 사전(§2)의 것만.
      track('board_created', {
        templateId,
        size: totalStickers,
        cadenceType: effectiveCadenceType,
        cadenceN: effectiveCadenceN ?? null,
      });
      const uid = useAppStore.getState().user?.id;
      if (uid) {
        trackFirst(uid, 'board', 'first_board_created', {
          templateId,
          size: totalStickers,
          cadenceType: effectiveCadenceType,
        });
      }
      if (giftTo) {
        // "선물하기": gift the freshly-made board to the friend (creates their
        // copy), then remove our own copy so only the friend receives it —
        // matching what the "선물하기" action implies.
        try {
          await api(`/api/boards/${data.board.id}/gift`, {
            method: 'POST',
            json: { friendId: giftTo },
          });
          track('gift_sent');
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
    // 240px 보정치 = 상단 헤더 + 하단 pb-[160px] 몫. 내비/배너 높이 변경 시 갱신.
    <div className="pb-4 flex flex-col min-h-[calc(100dvh-240px)]">
      {/* 컴팩트 상단: 뒤로 + 제목 한 줄 (하단탭 '만들기' 제거 후 이탈 경로) */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => { feedbackTap(); router.push(giftTo ? `/friends/${giftTo}` : '/home'); }}
          aria-label={giftTo ? '친구 페이지로 돌아가기' : '홈으로 돌아가기'}
          className="clay-button w-9 h-9 rounded-full flex items-center justify-center text-warm-sub shrink-0"
        >
          ←
        </button>
        <h1 className="font-display text-lg font-bold text-grape-700 inline-flex items-center gap-1.5">
          <EmojiIcon emoji={giftTo ? '🎁' : '🍇'} size={18} /> {giftTo ? '선물할 포도판 만들기' : '새 포도판 만들기'}
        </h1>
      </div>

      {giftTo && (
        <div className="clay-sm p-3 mb-5 bg-grape-50/70 flex items-center gap-2">
          <EmojiIcon emoji="🎁" size={18} />
          <p className="text-sm text-grape-700">완성하면 친구에게 포도판이 전달돼요</p>
        </div>
      )}

      {/* 점프 시 이전 단계의 에러 문구가 따라오지 않게 비움 — 다음 진행 시 재검증됨 */}
      <StepProgress total={4} current={step} onJump={(s) => { setError(''); setStep(s); }} />

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

          {error && <p role="alert" className="text-rose-700 text-sm text-center">{error}</p>}
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
                className={`clay-button py-2.5 rounded-xl text-sm font-medium tabular-nums transition-[transform,background-color,box-shadow,color] ${
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
          <p className="text-xs text-warm-sub text-center text-balance">2~60알까지 자유롭게 설정할 수 있어요</p>

          {/* 선물 생성(giftTo)은 v1 FREE 고정 — 섹션 자체를 숨긴다(FILL_CADENCE_PLAN §2). */}
          {!giftTo && (
            <CadencePicker
              cadenceType={cadenceType}
              cadenceN={cadenceN}
              onChange={(type, n) => { setCadenceType(type); setCadenceN(n); track('cadence_selected', { type, n }); }}
              strictMode={strictMode}
              onStrictModeChange={setStrictMode}
            />
          )}
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
            <span className="text-grape-400 font-bold mr-0.5">*</span>포도알을 꾹 눌러 중간 보상을 심을 수 있어요!
          </p>

          {error && <p role="alert" className="text-rose-700 text-sm text-center">{error}</p>}
        </div>
      )}

      {/* 공용 하단 푸터 — step 0(템플릿)은 자체 '직접 입력' CTA가 있어 미표시 */}
      {step > 0 && (
        <div className="mt-auto pt-5 flex gap-3">
          <ClayButton variant="ghost" onClick={() => setStep(step - 1)} fullWidth>
            ← 이전
          </ClayButton>
          {step === 1 && (
            <ClayButton
              fullWidth
              size="lg"
              onClick={() => { if (title.trim()) { setError(''); setStep(2); } else setError('제목을 입력해주세요'); }}
            >
              다음 →
            </ClayButton>
          )}
          {step === 2 && (
            <ClayButton
              fullWidth
              // 숫자 직접입력 중 탭하면 input blur(commit)를 click보다 먼저 강제해 1탭으로 진행되게 한다.
              onPointerDown={() => (document.activeElement as HTMLElement | null)?.blur?.()}
              onClick={() => setStep(3)}
            >
              다음 →
            </ClayButton>
          )}
          {step === 3 && (
            <ClayButton fullWidth onClick={handleCreate} loading={loading}>
              <EmojiIcon emoji={giftTo ? '🎁' : '🍇'} size={16} className="mr-1" />{giftTo ? '선물하기' : '만들기'}
            </ClayButton>
          )}
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
