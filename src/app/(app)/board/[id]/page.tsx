'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import GrapeBoard from '@/components/GrapeBoard';
import Confetti from '@/components/Confetti';
import GiftBoardModal from '@/components/GiftBoardModal';
import GiftUnboxModal from '@/components/GiftUnboxModal';
import SurpriseRevealModal from '@/components/SurpriseRevealModal';
import MidRewardModal from '@/components/MidRewardModal';
import EditBoardInfoModal from '@/components/EditBoardInfoModal';
import RewardRevealModal from '@/components/RewardRevealModal';
import ShareCardModal from '@/components/ShareCardModal';
import CapsuleModal from '@/components/CapsuleModal';
import Avatar from '@/components/Avatar';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmojiIcon from '@/components/EmojiIcon';
import { readCachedApi, writeCachedApi } from '@/lib/cachedApi';
import type { BoardDetail, BoardSummary, PlantedGiftInfo, RewardInfo, TimeCapsuleInfo } from '@/types';
import { REWARD_TYPE_ICON, ICON } from '@/lib/icons';
import { feedbackTap } from '@/lib/feedback';
import { stripTitleEmoji } from '@/lib/title';

export default function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  // SWR: 마지막으로 본 보드 상태(또는 홈의 idle 프리페치 결과)가 캐시에 있으면
  // 포도송이까지 즉시 렌더하고 무음 재검증한다 — 상세 진입이 이 앱의 최빈 전환인데
  // 매번 API 왕복(웜 0.2~0.5s, 콜드 2s+) 동안 스켈레톤을 보던 것이 핵심 체감 병목.
  const [board, setBoard] = useState<BoardDetail | null>(
    () => readCachedApi<BoardDetail>(`/api/boards/${id}`) ?? null,
  );
  const [loading, setLoading] = useState<boolean>(() => !readCachedApi(`/api/boards/${id}`));
  // 보드 상태 스냅샷을 캐시에 동기화 — 채움/보상 등 모든 로컬 변화가 다음 진입에도
  // 보인다. 단 temp-* 낙관 스티커는 빼고 저장한다: POST 실패+페이지 이탈 조합에서
  // 롤백이 aliveRef 가드로 스킵되는데, temp를 캐시에 남기면 재진입 시드 → fetchBoard
  // 병합(서버에 없는 temp 보존, #66)이 그 유령을 영원히 못 지운다. 캐시는 '서버가
  // 확인한 마지막 상태'만 — 진행 중 채움은 성공 시 재검증이 즉시 보여준다.
  useEffect(() => {
    if (!board) return;
    const temps = board.stickers.filter((s) => s.id.startsWith('temp-'));
    const snapshot = temps.length === 0
      ? board
      : {
          ...board,
          stickers: board.stickers.filter((s) => !s.id.startsWith('temp-')),
          filledCount: Math.max(0, board.filledCount - temps.length),
        };
    writeCachedApi(`/api/boards/${id}`, snapshot);
  }, [board, id]);
  // 홈이 받아둔 /api/boards 캐시에서 이 보드의 요약을 꺼내 스켈레톤 동안 제목·진행
  // 숫자를 실값으로 선렌더 — '이미 아는 정보를 다시 기다리는' 체감 제거.
  // id 키로 메모 — 같은 컴포넌트 인스턴스가 다른 보드로 재사용돼도 이전 보드의
  // 요약이 남지 않는다. 상세 도착 후엔 쓰이지 않는다.
  const summary = useMemo<BoardSummary | undefined>(
    () => readCachedApi<{ boards: BoardSummary[] }>('/api/boards')?.boards.find((b) => b.id === id),
    [id],
  );
  const [showGift, setShowGift] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showCapsule, setShowCapsule] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditInfo, setShowEditInfo] = useState(false);
  // Burst counter for the shared <Confetti>. Bumped both when a fill unlocks a
  // reward (via GrapeBoard's onCelebrate) and when a reward is opened.
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  // Queue of friend-planted surprises waiting to be revealed one-by-one. A single
  // filled grape can carry several (overlap allowed), shown sequentially.
  const [surpriseQueue, setSurpriseQueue] = useState<PlantedGiftInfo[]>([]);
  // Long-press / "+ 중간 보상" → MidRewardModal targeting this 0-based grape.
  const [plantPos, setPlantPos] = useState<number | null>(null);
  // A mid reward just reached → opened immediately in a popup (instant "쾌감").
  const [rewardPopup, setRewardPopup] = useState<RewardInfo | null>(null);
  // 캐시로 시드됐다면 '첫 로드 완료'로 취급 — 재검증 실패 시 홈으로 튕기는 대신
  // 기존 화면 + 동기화 실패 배너를 유지한다(fetchBoard catch 분기 참조).
  const initialLoadDoneRef = useRef(board !== null);
  // 언마운트 가드 — 큐에서 늦게 도착한 reconcile/rollback이 떠난 화면을 만지지 않게.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true; // StrictMode 재마운트 대응
    return () => { aliveRef.current = false; };
  }, []);
  // 채움 POST 직렬화 큐(보드 단위): 연타 시 낙관적 UI는 즉시 반영하되 서버 POST는
  // 한 번에 1개씩 순차 발송한다. 동시 요청들끼리의 Serializable 자기 경합(P2034
  // 재시도 소진 → 일부 채움 유실)을 원천 제거하고, 응답 도착 순서도 발사 순서와
  // 같아져 reconcile의 filledCount/isCompleted가 역순으로 덮이지 않는다.
  const fillQueueRef = useRef<Promise<void>>(Promise.resolve());

  const fetchBoard = useCallback(async () => {
    try {
      const data = await api<{ board: BoardDetail }>(`/api/boards/${id}`);
      // 서버 스냅샷에 아직 없는 낙관(temp-*) 스티커는 보존하고 병합한다.
      // 통째 교체하면 큐에 대기 중인 채움이 화면에서 사라졌다(진행바 역행) 하나씩
      // 되살아나고, 그 사이 grape-next가 이미 전송한 칸을 가리켜 중복 POST→409가
      // 났다(적대적 리뷰 B1, 2026-06-11). 실패한 temp는 해당 큐 항목의 롤백이
      // tempId로 제거하므로 여기서 남겨도 정합이 깨지지 않는다.
      setBoard((prev) => {
        const server = data.board;
        if (!prev) return server;
        const serverPositions = new Set(server.stickers.map((s) => s.position));
        const pendingTemps = prev.stickers.filter(
          (s) => s.id.startsWith('temp-') && !serverPositions.has(s.position),
        );
        if (pendingTemps.length === 0) return server;
        return {
          ...server,
          stickers: [...server.stickers, ...pendingTemps],
          filledCount: server.filledCount + pendingTemps.length,
        };
      });
      setErrorMessage(null);
      initialLoadDoneRef.current = true;
    } catch {
      // First load failure → board genuinely missing or no permission, bail home.
      // Later failures → keep the UI mounted; surface a banner so the user can retry.
      if (!initialLoadDoneRef.current) {
        router.replace('/home');
      } else {
        setErrorMessage('일시적으로 동기화에 실패했어요. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // 동결건조 캡슐 요약(보드 존재감용) — owner만 조회. 모달에서 생성/개봉 후 갱신.
  const [capsules, setCapsules] = useState<TimeCapsuleInfo[] | null>(null);
  const [capsuleTeaser, setCapsuleTeaser] = useState<{ text: string; glow: boolean } | null>(null);
  const loadCapsules = useCallback(() => {
    api<{ capsules: TimeCapsuleInfo[] }>(`/api/boards/${id}/capsules`)
      .then((d) => setCapsules(d.capsules))
      .catch(() => {});
  }, [id]);
  const ownerViewing = !!board && !!user && user.id === board.owner.id;
  // board 도착을 기다리지 않고 낙관 발사 — 상세 진입의 대부분은 소유자 본인이라
  // board→capsules 2홉 직렬(상세가 '두 번 로딩되는' 체감)을 병렬로 푼다.
  // 비소유자는 서버가 거부하고 catch가 무시. 확정 비소유자(board 도착 후)만 스킵.
  const capsulesRequestedRef = useRef(false);
  useEffect(() => {
    if (!user || capsulesRequestedRef.current) return;
    if (board && user.id !== board.owner.id) return;
    capsulesRequestedRef.current = true;
    loadCapsules();
  }, [user, board, loadCapsules]);
  // Date.now()는 render/useMemo가 아닌 effect에서만 사용(react-hooks/purity 회피).
  useEffect(() => {
    if (!capsules) { setCapsuleTeaser(null); return; }
    const now = Date.now();
    const openable = capsules.find((c) => !c.isOpened && new Date(c.openAt).getTime() <= now);
    const nextLocked = capsules
      .filter((c) => !c.isOpened && new Date(c.openAt).getTime() > now)
      .sort((a, b) => new Date(a.openAt).getTime() - new Date(b.openAt).getTime())[0];
    let text: string | null = null;
    if (openable) text = '지금 개봉할 수 있어요!';
    else if (nextLocked) text = `다음 개봉 D-${Math.max(0, Math.ceil((new Date(nextLocked.openAt).getTime() - now) / 86400000))}`;
    else if (capsules.length > 0) text = `보관함 ${capsules.length}개`;
    setCapsuleTeaser(text ? { text, glow: !!openable } : null);
  }, [capsules]);

  // 실제 서버 POST + reconcile/rollback. fillQueueRef 체인에서 한 번에 하나씩
  // 실행된다. 에러는 내부에서 처리(롤백+배너)하고 reject하지 않으므로 한 요청이
  // 실패해도 큐의 후속 요청은 계속 진행된다.
  const postFillSticker = async (position: number, tempId: string, totalStickers: number) => {
    try {
      const result = await api<{
        sticker: BoardDetail['stickers'][number];
        filledCount: number;
        isCompleted: boolean;
        unlockedReward: { id: string; type: string; title: string; triggerAt: number } | null;
        plantedGift: PlantedGiftInfo | null;
        plantedGifts?: PlantedGiftInfo[];
      }>(`/api/boards/${id}/stickers`, {
        method: 'POST',
        json: { position },
      });
      if (!aliveRef.current) return;
      setErrorMessage(null);

      // Reconcile: replace the temp sticker with the server's authoritative one
      // and lock in the server's filledCount / completion flag.
      setBoard((prev) => prev ? {
        ...prev,
        stickers: [
          ...prev.stickers.filter((s) => s.id !== tempId),
          result.sticker,
        ],
        filledCount: result.filledCount,
        isCompleted: result.isCompleted,
      } : prev);

      // Reward unlocks are rare; only re-fetch when one fires so the
      // reward card can update from "locked" to "tap to reveal".
      if (result.unlockedReward) {
        const u = result.unlockedReward;
        // 중간 보상: GrapeBoard가 컨페티와 같은 비트에 팝업을 이미 열었음
        // (onMidRewardReached). 여기선 reveal로 내용만 채워(공개 처리) 열려 있는
        // 팝업에 흘려보낸다. 최종 보상은 팝업 자동 오픈 없이 카드 탭으로 연다.
        if (u.triggerAt < totalStickers) {
          try {
            const d = await api<{ reward: RewardInfo }>(
              `/api/boards/${id}/rewards/${u.id}/reveal`,
              { method: 'POST' },
            );
            setRewardPopup((prev) => (prev && prev.id === d.reward.id ? d.reward : prev));
          } catch {
            // reveal 실패해도 목록 칩 탭으로 열 수 있음
          }
        }
        fetchBoard();
      }

      // Friends' hidden surprises on this grape — queue them for sequential
      // reveal with confetti. (plantedGifts is the full list; plantedGift is the
      // back-compat single value.)
      const gifts = result.plantedGifts ?? (result.plantedGift ? [result.plantedGift] : []);
      if (gifts.length > 0) {
        setSurpriseQueue((q) => [...q, ...gifts]);
        setConfettiTrigger((t) => t + 1);
      }
    } catch (err) {
      if (!aliveRef.current) return;
      // Rollback the optimistic sticker on failure.
      setBoard((prev) => prev ? {
        ...prev,
        stickers: prev.stickers.filter((s) => s.id !== tempId),
        filledCount: Math.max(0, prev.filledCount - 1),
      } : prev);
      setRewardPopup(null); // close any popup opened optimistically for this fill
      const msg = err instanceof Error ? err.message : '포도알을 채우지 못했어요';
      setErrorMessage(`${msg} — 잠시 후 다시 시도해주세요.`);
      // Best-effort full resync in case the failure was due to drift (e.g.
      // another lambda already created the sticker).
      fetchBoard().catch(() => {});
    }
  };

  const handleFillSticker = (position: number): Promise<void> => {
    if (!board || !user) return Promise.resolve();

    // Optimistic update: show the grape as filled immediately so the tap
    // feels instant even when the round-trip to Neon (us-east) is ~400ms.
    // (이벤트 핸들러라 Date.now() 사용 가능 — 렌더 중이 아님.)
    const tempId = `temp-${position}-${Date.now()}`;
    const optimisticSticker = {
      id: tempId,
      position,
      filledAt: new Date().toISOString(),
      filledBy: { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
    } as BoardDetail['stickers'][number];

    setBoard((prev) => prev ? {
      ...prev,
      stickers: [...prev.stickers, optimisticSticker],
      filledCount: prev.filledCount + 1,
    } : prev);

    // 서버 POST는 큐 체인에 연결 — 이전 요청 완료 후 발송. 페이지 이탈 시에도 이미
    // 시작된 fetch는 계속 진행되고, reconcile/rollback만 aliveRef로 가드된다.
    const totalStickers = board.totalStickers;
    const queued = fillQueueRef.current.then(() => postFillSticker(position, tempId, totalStickers));
    fillQueueRef.current = queued.catch(() => {}); // 방어: 예기치 못한 reject로 체인 단절 방지
    return queued;
  };

  const handleToggleAllowPlant = async () => {
    if (!board) return;
    const next = !(board.allowFriendPlant ?? true);
    setBoard((b) => (b ? { ...b, allowFriendPlant: next } : b)); // optimistic
    try {
      await api(`/api/boards/${id}`, { method: 'PATCH', json: { allowFriendPlant: next } });
    } catch {
      setBoard((b) => (b ? { ...b, allowFriendPlant: !next } : b)); // rollback
    }
  };

  const handleEditInfo = async (next: { title: string; description: string }) => {
    const prev = board;
    setBoard((b) => (b ? { ...b, ...next } : b)); // optimistic
    try {
      await api(`/api/boards/${id}`, { method: 'PATCH', json: next });
      setErrorMessage(null);
    } catch (err) {
      setBoard(prev); // 전체 스냅샷 롤백
      const msg = err instanceof Error ? err.message : '수정에 실패했어요';
      setErrorMessage(`${msg} — 잠시 후 다시 시도해주세요.`);
      throw err; // 모달이 열린 채 자체 에러를 표시하도록 재던짐
    }
  };

  const handleGift = async (friendId: string, message: string) => {
    try {
      await api(`/api/boards/${id}/gift`, {
        method: 'POST',
        json: { friendId, message },
      });
      setErrorMessage(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '선물 전송에 실패했어요';
      setErrorMessage(`${msg} — 잠시 후 다시 시도해주세요.`);
    }
  };

  // Recipient unwraps a gifted board (one-time reveal).
  const handleOpenGift = async () => {
    try {
      await api(`/api/boards/${id}/gift-open`, { method: 'POST' });
    } catch {
      // non-blocking; still let them in
    }
    setBoard((b) => (b ? { ...b, giftOpenedAt: new Date().toISOString() } : b));
    setConfettiTrigger((t) => t + 1);
  };

  const handleDeclineGift = async () => {
    try {
      await api(`/api/boards/${id}`, { method: 'DELETE' });
    } catch {
      // ignore — navigate away regardless
    }
    router.push('/home');
  };

  // Open a reward in the popup (mid chip / final card tap). Opens INSTANTLY; if
  // the content isn't loaded yet (unrevealed → board GET hides it) fetch it via
  // reveal (which also marks it revealed). Revealed rewards already carry content.
  const openReward = async (reward: RewardInfo) => {
    setRewardPopup(reward);
    setConfettiTrigger((t) => t + 1);
    if (!reward.content) {
      try {
        const d = await api<{ reward: RewardInfo }>(
          `/api/boards/${id}/rewards/${reward.id}/reveal`,
          { method: 'POST' },
        );
        setRewardPopup((prev) => (prev && prev.id === d.reward.id ? d.reward : prev));
        fetchBoard();
      } catch {
        setErrorMessage('보상을 여는 데 실패했어요. 잠시 후 다시 시도해주세요.');
      }
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await api(`/api/boards/${id}`, { method: 'DELETE' });
      router.replace('/home');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '삭제에 실패했어요';
      setErrorMessage(`${msg} — 잠시 후 다시 시도해주세요.`);
      setDeleting(false);
    }
  };

  if (loading || !board) {
    // Skeleton mirrors the owner layout (the common case): header → segmented bar →
    // plant toggle → title/desc → grape bunch → reward chips, so content arrival
    // doesn't shift the page. The grape area apes the teardrop bunch (3·4·3 + leaf).
    return (
      <div className="pb-4" aria-busy="true" aria-label="포도판 불러오는 중">
        {/* Header: back + delete */}
        <div className="flex items-center justify-between mb-3">
          <div className="skeleton h-5 w-20" />
          <div className="skeleton h-5 w-10" />
        </div>
        {/* Segmented action bar (동결건조 · 선물 · 공유) */}
        <div className="skeleton h-11 w-full rounded-clay mb-5" />
        {/* Plant-gift toggle */}
        <div className="skeleton h-[52px] w-full rounded-clay mb-5" />
        {/* Title + description (centered) — 홈 캐시에 요약이 있으면 제목·진행을 실값으로 선렌더 */}
        {summary ? (
          <h1 className="font-display text-2xl font-bold text-grape-700 text-center mb-2">
            {stripTitleEmoji(summary.title)}
          </h1>
        ) : (
          <div className="skeleton h-7 w-40 mx-auto mb-2" />
        )}
        <div className="skeleton h-4 w-28 mx-auto mb-6" />
        {/* Grape bunch: progress + teardrop silhouette */}
        <div className="clay-float p-6 mb-6 flex flex-col items-center">
          <div className="skeleton h-3 w-full mb-6" />
          {summary ? (
            <p className="text-sm font-semibold text-warm-sub tabular-nums mb-2">
              {summary.filledCount}/{summary.totalStickers}알
            </p>
          ) : (
            <div className="skeleton h-4 w-10 rounded-full mb-2" aria-hidden="true" />
          )}
          <div className="flex flex-col items-center gap-1.5" aria-hidden="true">
            {[3, 4, 3].map((n, ri) => (
              <div key={ri} className="flex gap-1.5">
                {Array.from({ length: n }).map((_, ci) => (
                  <div key={ci} className="skeleton w-9 h-9 rounded-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Reward chips */}
        <div className="flex gap-2 justify-center">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-14 w-14 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const isOwner = user?.id === board.owner.id;
  const allowPlant = board.allowFriendPlant ?? true;
  const filledCount = board.stickers.length;
  // 중간 보상(아이콘 슬라이더) vs 완성 보상(카드) 분리.
  const midRewards = board.rewards
    .filter((r) => r.triggerAt < board.totalStickers)
    .sort((a, b) => a.triggerAt - b.triggerAt);
  const finalReward = board.rewards.find((r) => r.triggerAt === board.totalStickers) ?? null;

  return (
    <div className="pb-4">
      {/* Shared celebration — fires on grape-fill (reward unlock/완료) and on reward open */}
      <Confetti trigger={confettiTrigger} />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => { feedbackTap(); router.push(isOwner ? '/home' : `/friends/${board.owner.id}`); }} className="text-warm-sub text-sm">
          ← 돌아가기
        </button>
        {isOwner && (
          <button
            onClick={() => { feedbackTap(); setShowDeleteConfirm(true); }}
            disabled={deleting}
            className="text-warm-sub hover:text-grape-700 text-sm disabled:opacity-50 transition-colors"
          >
            삭제
          </button>
        )}
      </div>

      {/* Owner actions — segmented bar (동결건조 · 선물 · 공유) */}
      {isOwner && (
        <div className="clay grid grid-cols-3 divide-x divide-warm-border mb-5 overflow-hidden">
          <button
            onClick={() => { feedbackTap(); setShowCapsule(true); }}
            className="py-2.5 text-sm text-grape-700 active:bg-grape-50 transition-colors"
          >
            동결건조
          </button>
          <button
            onClick={() => { feedbackTap(); setShowGift(true); }}
            className="py-2.5 text-sm text-grape-700 active:bg-grape-50 transition-colors"
          >
            선물
          </button>
          <button
            onClick={() => { feedbackTap(); setShowShare(true); }}
            className="py-2.5 text-sm text-grape-700 active:bg-grape-50 transition-colors"
          >
            공유
          </button>
        </div>
      )}

      {/* 동결건조 존재감 — owner: 캡슐 상태 티저(개봉 가능 / 다음 개봉 D-N / 보관함) */}
      {isOwner && capsuleTeaser && (
        <button
          onClick={() => { feedbackTap(); setShowCapsule(true); }}
          className={`w-full clay-sm px-4 py-2.5 mb-5 flex items-center gap-2 text-sm transition-all active:scale-[0.99] ${capsuleTeaser.glow ? 'reward-glow bg-amber-50/70' : ''}`}
        >
          <EmojiIcon emoji="💊" size={16} />
          <span className="flex-1 text-left text-warm-text">동결건조 · {capsuleTeaser.text}</span>
          <span className="text-warm-sub" aria-hidden>›</span>
        </button>
      )}

      {/* Owner: toggle whether friends may plant surprise gifts here */}
      {isOwner && !board.isCompleted && (
        <button
          onClick={() => { feedbackTap(); handleToggleAllowPlant(); }}
          role="switch"
          aria-checked={allowPlant}
          aria-label="친구가 깜짝 선물 심기"
          className="w-full clay-sm px-4 py-3 mb-5 flex items-center justify-between transition-all active:scale-[0.99]"
        >
          <span className="inline-flex items-center gap-2 text-sm text-warm-text">
            <EmojiIcon emoji="🎁" size={18} />
            <span className="text-left">
              친구가 깜짝 선물 심기
              <span className="block text-[11px] text-warm-sub text-balance">친구가 빈 칸에 선물을 숨길 수 있어요</span>
            </span>
          </span>
          <span className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${allowPlant ? 'bg-grape-400' : 'bg-warm-border'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${allowPlant ? 'translate-x-5' : ''}`} />
          </span>
        </button>
      )}

      {errorMessage && (
        <div className="mb-3 p-3 rounded-2xl bg-grape-100/40 border border-grape-200/60 text-grape-700 text-sm flex items-start gap-2">
          <EmojiIcon emoji="⚠️" size={16} className="leading-tight" />
          <span className="flex-1 leading-snug">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-grape-700 hover:text-grape-800 text-lg leading-none px-1"
            aria-label="알림 닫기"
          >
            ×
          </button>
        </div>
      )}

      {/* Board info */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <h1 className="font-display text-2xl font-bold text-grape-700">{stripTitleEmoji(board.title)}</h1>
          {isOwner && (
            <button
              onClick={() => { feedbackTap(); setShowEditInfo(true); }}
              aria-label="제목·설명 수정"
              className="text-warm-sub hover:text-grape-700 p-1 transition-colors"
            >
              <EmojiIcon emoji="✏️" size={15} />
            </button>
          )}
        </div>
        {board.description && (
          <p className="text-sm text-warm-sub mb-2">{board.description}</p>
        )}

        {/* Gifted info */}
        {board.giftedFrom && (
          <div className="inline-flex items-center gap-2 clay-sm px-3 py-1.5 bg-grape-50">
            <Avatar avatar={board.giftedFrom.avatar} size="sm" />
            <span className="text-xs text-warm-sub">
              {board.giftedFrom.name}님이 선물한 포도판
            </span>
          </div>
        )}
      </div>

      {/* Grape Board */}
      <div className="clay-float p-6 mb-6">
        <GrapeBoard
          board={board}
          onFill={handleFillSticker}
          canFill={isOwner && !board.isCompleted}
          onCelebrate={() => setConfettiTrigger((t) => t + 1)}
          isOwner={isOwner}
          onPlantReward={
            isOwner && !board.isCompleted
              ? (pos) => { feedbackTap(); setPlantPos(pos); }
              : undefined
          }
          onMidRewardReached={(r) => setRewardPopup(r)}
        />
      </div>

      {/* Rewards section — owner-only. A visiting friend (read-only) must not see
          the owner's private rewards; the API also masks content, this hides the
          chips/cards and the dead "open" buttons (reveal is owner/recipient-gated). */}
      {board.rewards.length > 0 && isOwner && (
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-semibold text-warm-sub">
            <EmojiIcon emoji={ICON.gift} size={15} className="mr-0.5" />보상
          </h3>

          {/* 중간 보상 — 가로 스크롤 아이콘 칩 (잠금/도착/공개 상태별) */}
          {midRewards.length > 0 && (
            <div className="flex gap-2.5 overflow-x-auto py-2 px-0.5 scrollbar-hide">
              {midRewards.map((r) => {
                const unlocked = filledCount >= r.triggerAt;
                const revealed = r.revealedAt !== null;
                return (
                  <button
                    key={r.id}
                    onClick={() => { if (unlocked) { feedbackTap(); openReward(r); } }}
                    disabled={!unlocked}
                    aria-label={`${r.triggerAt}알 중간 보상${unlocked ? (revealed ? ' 다시 보기' : ' 열기') : ' (잠김)'}`}
                    className={`relative shrink-0 w-14 h-14 rounded-2xl clay-sm flex items-center justify-center transition-all
                      ${unlocked ? 'cursor-pointer active:scale-95' : 'opacity-50'}
                      ${unlocked && !revealed ? 'reward-glow bg-amber-50/70' : ''}`}
                  >
                    <EmojiIcon emoji={REWARD_TYPE_ICON[r.type]} size={26} />
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-medium text-warm-sub tabular-nums bg-clay-bg border border-warm-border/60 px-1 rounded-full leading-tight">
                      {r.triggerAt}
                    </span>
                    {!unlocked && (
                      <span className="absolute -bottom-1 -right-1">
                        <EmojiIcon emoji={ICON.lock} size={13} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 완성 보상 — 카드 (잠금 / 달성·강조 / 공개됨) */}
          {finalReward && (
            finalReward.revealedAt !== null ? (
              <button
                onClick={() => { feedbackTap(); openReward(finalReward); }}
                className="w-full clay-sm p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
              >
                <EmojiIcon emoji={REWARD_TYPE_ICON[finalReward.type]} size={28} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-grape-700 truncate">{finalReward.title}</p>
                  <p className="text-xs text-warm-sub">완성 보상 · 다시 보기</p>
                </div>
              </button>
            ) : filledCount >= finalReward.triggerAt ? (
              <button
                onClick={() => { feedbackTap(); openReward(finalReward); }}
                className="w-full clay-float p-6 text-center reward-glow active:scale-[0.97] transition-transform bg-linear-to-br from-amber-50 via-clay-cream/60 to-grape-50"
              >
                <div className="animate-float mb-2">
                  <EmojiIcon emoji="🎉" size={48} className="mx-auto" />
                </div>
                <p className="font-display text-xl font-bold text-grape-700">달성! 눌러서 열기</p>
                <p className="text-sm text-warm-sub mt-1">완성 보상이 도착했어요</p>
              </button>
            ) : (
              <div className="w-full clay-sm p-4 bg-grape-50/50">
                <div className="flex items-center justify-center gap-2">
                  <EmojiIcon emoji={ICON.lock} size={20} />
                  <p className="text-sm text-warm-sub">
                    완성 보상 · {finalReward.triggerAt - filledCount}알 더 채우면 열려요
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Recent sticker activity */}
      {board.stickers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-warm-sub mb-3">최근 활동</h3>
          <div className="clay-sm divide-y divide-warm-border/70">
            {board.stickers.slice(-5).reverse().map((sticker) => (
              <div key={sticker.id} className="p-3 flex items-center gap-2">
                <EmojiIcon emoji="🍇" size={18} />
                <span className="text-sm text-warm-text tabular-nums">
                  {sticker.position + 1}번째 포도알
                </span>
                <span className="text-xs text-warm-sub ml-auto tabular-nums">
                  {new Date(sticker.filledAt).toLocaleDateString('ko-KR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="포도판을 삭제할까요?"
        description="삭제하면 되돌릴 수 없어요."
        confirmLabel="삭제"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Share card modal */}
      {showShare && (
        <ShareCardModal
          board={board}
          userName={user?.name || '익명'}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Capsule modal */}
      {showCapsule && (
        <CapsuleModal
          boardId={id}
          isOwner={isOwner}
          onClose={() => { setShowCapsule(false); loadCapsules(); }}
        />
      )}

      {/* Gift unbox — received whole-board gift */}
      {board.giftedFrom && !board.giftOpenedAt && isOwner && (
        <GiftUnboxModal
          senderName={board.giftedFrom.name}
          senderAvatar={board.giftedFrom.avatar}
          boardTitle={stripTitleEmoji(board.title)}
          message={board.giftMessage}
          onOpen={handleOpenGift}
          onDecline={handleDeclineGift}
        />
      )}

      {/* Friend-planted surprise reveals — one at a time (sequential queue).
          key={gift.id} remounts the modal per surprise so its bounce-in and the
          internal one-shot Confetti(trigger=1) replay for the 2nd+ gift too. */}
      {surpriseQueue.length > 0 && (
        <SurpriseRevealModal key={surpriseQueue[0].id} gift={surpriseQueue[0]} onClose={() => setSurpriseQueue((q) => q.slice(1))} />
      )}

      {/* Mid reward reached → instant popup reveal */}
      {rewardPopup && (
        <RewardRevealModal reward={rewardPopup} onClose={() => setRewardPopup(null)} />
      )}

      {/* Plant / edit a 중간 보상 (long-press a grape, or the "+ 중간 보상" button) */}
      {plantPos !== null && (
        <MidRewardModal
          board={{ id, totalStickers: board.totalStickers, filledCount: board.stickers.length }}
          position={plantPos}
          existingReward={board.rewards.find((r) => r.triggerAt === plantPos + 1) ?? null}
          onClose={() => setPlantPos(null)}
          onSaved={() => fetchBoard()}
        />
      )}

      {showGift && (
        <GiftBoardModal
          boardTitle={stripTitleEmoji(board.title)}
          onGift={handleGift}
          onClose={() => setShowGift(false)}
        />
      )}

      {/* Owner: edit board title/description */}
      {showEditInfo && (
        <EditBoardInfoModal
          initialTitle={board.title}
          initialDescription={board.description ?? ''}
          onSave={handleEditInfo}
          onClose={() => setShowEditInfo(false)}
        />
      )}
    </div>
  );
}
