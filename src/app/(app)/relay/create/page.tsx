'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import ClayButton from '@/components/ClayButton';
import ClayInput from '@/components/ClayInput';
import NumberStepper from '@/components/NumberStepper';
import TemplatePicker from '@/components/create/TemplatePicker';
import RewardEditor from '@/components/create/RewardEditor';
import Avatar from '@/components/Avatar';
import EmojiIcon from '@/components/EmojiIcon';
import { useAppStore } from '@/lib/store';
import type { FriendInfo, RewardType, RelayMode } from '@/types';
import type { HabitTemplate } from '@/lib/templates';
import { feedbackSuccess, feedbackTap } from '@/lib/feedback';

const SIZE_PRESETS = [5, 10, 15, 20, 25, 30];

export default function CreatePodongPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<RelayMode>('relay');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('health');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalStickers, setTotalStickers] = useState(10);
  const [rewardType, setRewardType] = useState<RewardType>('letter');
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardContent, setRewardContent] = useState('');

  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchFriends = useCallback(async () => {
    try {
      const data = await api<{ friends: FriendInfo[] }>('/api/friends');
      setFriends((data.friends || []).filter((f) => f.status === 'accepted'));
    } catch { /* 빈 목록으로 둠 */ }
    setLoadingFriends(false);
  }, []);

  useEffect(() => { fetchFriends(); }, [fetchFriends]);

  const handleSelectTemplate = (template: HabitTemplate) => {
    feedbackTap();
    setTemplateId(template.id);
    setTitle(template.name);
    setDescription(template.description);
    setTotalStickers(template.suggestedSize);
    setRewardTitle(`${template.name} 달성 보상`);
    setRewardContent(template.suggestedReward);
    setStep(2);
  };

  const handleSkipTemplate = () => {
    setTemplateId(null);
    setTitle('');
    setDescription('');
    setTotalStickers(10);
    setRewardTitle('');
    setRewardContent('');
    setStep(2);
  };

  const toggleFriend = (userId: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const moveFriend = (userId: string, direction: -1 | 1) => {
    setSelectedFriendIds((prev) => {
      const idx = prev.indexOf(userId);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const handleCreate = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요'); return; }
    if (!rewardTitle.trim()) { setError('보상 제목을 입력해주세요'); return; }
    if (!rewardContent.trim()) { setError('보상 내용을 입력해주세요'); return; }
    if (selectedFriendIds.length === 0) { setError('친구를 한 명 이상 선택해주세요'); return; }

    setCreating(true);
    setError('');
    try {
      const data = await api<{ relay: { id: string } }>('/api/relays', {
        method: 'POST',
        json: {
          title: title.trim(),
          description: description.trim(),
          totalStickers,
          templateId,
          mode,
          friendIds: selectedFriendIds,
          rewards: [
            { type: rewardType, title: rewardTitle.trim(), content: rewardContent.trim(), triggerAt: totalStickers },
          ],
        },
      });
      feedbackSuccess();
      router.replace(`/relay/${data.relay.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성에 실패했어요');
    }
    setCreating(false);
  };

  // 릴레이 순서 미리보기(릴레이 모드 전용)
  const orderedParticipants = [
    user ? { id: user.id, name: user.name, avatar: user.avatar, isCreator: true } : null,
    ...selectedFriendIds
      .map((fId) => {
        const friend = friends.find((f) => f.user.id === fId);
        return friend
          ? { id: friend.user.id, name: friend.user.name, avatar: friend.user.avatar, isCreator: false }
          : null;
      })
      .filter(Boolean),
  ].filter(Boolean) as { id: string; name: string; avatar: string; isCreator: boolean }[];

  return (
    <div className="pb-4">
      {/* 컴팩트 상단: 뒤로 + 제목 한 줄 → 슬림 진행 바 (상단 혼잡 해소) */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => { feedbackTap(); router.push('/relay'); }}
          aria-label="포도동 목록"
          className="clay-button w-9 h-9 rounded-full flex items-center justify-center text-warm-sub shrink-0"
        >
          ←
        </button>
        <h1 className="font-display text-lg font-bold text-grape-700 inline-flex items-center gap-1.5">
          <EmojiIcon emoji={'🔗'} size={18} /> 새 포도동 만들기
        </h1>
      </div>

      {/* 슬림 6-세그먼트 진행 바 */}
      <div className="flex gap-1 mb-6" aria-label={`${step + 1}/6 단계`}>
        {[0, 1, 2, 3, 4, 5].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? 'bg-grape-400' : 'bg-grape-100'}`} />
        ))}
      </div>

      {/* Step 0: Mode select */}
      {step === 0 && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-sm text-warm-sub">어떤 방식으로 함께할까요?</p>
          <button
            onClick={() => { feedbackTap(); setMode('relay'); setStep(1); }}
            className={`clay p-5 w-full text-left transition-all active:scale-[0.98] ${mode === 'relay' ? 'ring-2 ring-grape-400 bg-grape-50' : ''}`}
          >
            <p className="font-bold text-grape-700 mb-1"><EmojiIcon emoji={'🔗'} size={18} className="mr-1" />릴레이</p>
            <p className="text-sm text-warm-sub [text-wrap:balance]">순서대로 한 명씩, 바통을 이어받아요</p>
          </button>
          <button
            onClick={() => { feedbackTap(); setMode('group'); setStep(1); }}
            className={`clay p-5 w-full text-left transition-all active:scale-[0.98] ${mode === 'group' ? 'ring-2 ring-grape-400 bg-grape-50' : ''}`}
          >
            <p className="font-bold text-grape-700 mb-1"><EmojiIcon emoji={'👥'} size={18} className="mr-1" />그룹</p>
            <p className="text-sm text-warm-sub [text-wrap:balance]">다 같이 동시에! 각자 포도판을 채워요</p>
          </button>
        </div>
      )}

      {/* Step 1: Template */}
      {step === 1 && (
        <>
          <TemplatePicker
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onSelectTemplate={handleSelectTemplate}
            onSkip={handleSkipTemplate}
          />
          <div className="mt-4">
            <ClayButton variant="ghost" onClick={() => setStep(0)} fullWidth>← 이전</ClayButton>
          </div>
        </>
      )}

      {/* Step 2: Title / description */}
      {step === 2 && (
        <div className="space-y-5 animate-fade-in">
          <ClayInput
            label="포도동 제목"
            placeholder="어떤 습관을 함께할까요?"
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
            <ClayButton variant="ghost" onClick={() => setStep(1)} fullWidth>← 이전</ClayButton>
            <ClayButton
              fullWidth
              size="lg"
              onClick={() => { if (title.trim()) { setError(''); setStep(3); } else setError('제목을 입력해주세요'); }}
            >
              다음 →
            </ClayButton>
          </div>
        </div>
      )}

      {/* Step 3: Board size */}
      {step === 3 && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-sm text-warm-sub mb-2">포도알 개수를 정해주세요</p>
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
            <ClayButton variant="ghost" onClick={() => setStep(2)} fullWidth>← 이전</ClayButton>
            <ClayButton
              fullWidth
              onPointerDown={() => (document.activeElement as HTMLElement | null)?.blur?.()}
              onClick={() => setStep(4)}
            >
              다음 →
            </ClayButton>
          </div>
        </div>
      )}

      {/* Step 4: Reward */}
      {step === 4 && (
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
            <span className="text-grape-400 font-bold mr-0.5">*</span>각자의 포도판에 같은 보상이 들어가요. 포도알을 꾹 눌러 중간 보상도 추가할 수 있어요!
          </p>
          {error && <p role="alert" className="text-grape-700 text-sm text-center">{error}</p>}
          <div className="flex gap-3">
            <ClayButton variant="ghost" onClick={() => setStep(3)} fullWidth>← 이전</ClayButton>
            <ClayButton
              fullWidth
              size="lg"
              onClick={() => {
                if (!rewardTitle.trim()) { setError('보상 제목을 입력해주세요'); return; }
                if (!rewardContent.trim()) { setError('보상 내용을 입력해주세요'); return; }
                setError(''); setStep(5);
              }}
            >
              다음 →
            </ClayButton>
          </div>
        </div>
      )}

      {/* Step 5: Friends (+order for relay) */}
      {step === 5 && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <label className="block text-sm font-medium text-warm-sub mb-3 ml-1">함께할 친구 선택</label>
            {loadingFriends ? (
              <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="skeleton h-14 w-full" />)}</div>
            ) : friends.length === 0 ? (
              <div className="clay-sm p-6 text-center">
                <p className="text-sm text-warm-sub mb-1">아직 친구가 없어요</p>
                <p className="text-xs text-warm-sub">친구를 먼저 추가해 주세요!</p>
                <ClayButton size="sm" variant="secondary" className="mt-3" onClick={() => router.push('/friends')}>
                  친구 추가하러 가기
                </ClayButton>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((friend) => {
                  const isSelected = selectedFriendIds.includes(friend.user.id);
                  return (
                    <button
                      key={friend.id}
                      onClick={() => toggleFriend(friend.user.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${isSelected ? 'clay bg-grape-50 ring-2 ring-grape-300' : 'clay-sm'}`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-grape-500 border-grape-500 text-white' : 'border-warm-border bg-white'}`}>
                        {isSelected && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <Avatar avatar={friend.user.avatar} size="sm" />
                      <span className="font-medium text-warm-text text-sm">{friend.user.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Order preview & reorder — 릴레이 모드 전용 */}
          {mode === 'relay' && orderedParticipants.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">릴레이 순서</label>
              <p className="text-xs text-warm-sub mb-3 ml-1">버튼으로 친구 순서를 변경할 수 있어요</p>
              <div className="clay p-4 space-y-2">
                {orderedParticipants.map((p, idx) => (
                  <div key={p.id} className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${p.isCreator ? 'bg-grape-50' : 'bg-white/60'}`}>
                    <span className="text-xs font-bold text-grape-500 w-5 text-center flex-shrink-0 tabular-nums">{idx + 1}</span>
                    <Avatar avatar={p.avatar} size="sm" />
                    <span className="text-sm font-medium text-warm-text flex-1">{p.isCreator ? `${p.name} (나)` : p.name}</span>
                    {!p.isCreator && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => moveFriend(p.id, -1)}
                          disabled={idx <= 1}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all ${idx <= 1 ? 'text-warm-light bg-warm-border/40' : 'text-grape-500 clay-button'}`}
                        >
                          {'▲'}
                        </button>
                        <button
                          onClick={() => moveFriend(p.id, 1)}
                          disabled={idx >= orderedParticipants.length - 1}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all ${idx >= orderedParticipants.length - 1 ? 'text-warm-light bg-warm-border/40' : 'text-grape-500 clay-button'}`}
                        >
                          {'▼'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === 'group' && (
            <p className="text-xs text-warm-sub ml-1 [text-wrap:balance]">다 같이 동시에 시작해요. 친구는 각자 새 포도판을 만들거나 기존 포도판을 불러올 수 있어요.</p>
          )}

          {error && <p className="text-grape-700 text-sm text-center">{error}</p>}

          <div className="flex gap-3">
            <ClayButton variant="ghost" onClick={() => setStep(4)} fullWidth>← 이전</ClayButton>
            <ClayButton
              fullWidth
              size="lg"
              onClick={handleCreate}
              loading={creating}
              disabled={!title.trim() || selectedFriendIds.length === 0}
            >
              포도동 시작!
            </ClayButton>
          </div>
        </div>
      )}
    </div>
  );
}
