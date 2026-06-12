'use client';

import { useEffect, useMemo, useState, useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
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
import { invalidateCachedApi, invalidateCachedApiPrefix, readCachedApi, writeCachedApi } from '@/lib/cachedApi';
import {
  applyOptimisticFill,
  applyFillResult,
  rollbackFill,
  mergeServerBoard,
  stripTempsForCache,
} from '@/lib/boardFillState';
import type { BoardDetail, BoardSummary, PlantedGiftInfo, RewardInfo, TimeCapsuleInfo } from '@/types';
import { REWARD_TYPE_ICON, ICON } from '@/lib/icons';
import { feedbackTap } from '@/lib/feedback';
import { stripTitleEmoji } from '@/lib/title';

// ── 채움 POST 직렬화 큐 (보드 단위, 모듈 레벨) ──────────────────────────────
// 연타 시 낙관적 UI는 즉시 반영하되 서버 POST는 한 번에 1개씩 순차 발송한다.
// 동시 요청들끼리의 Serializable 자기 경합(P2034 재시도 소진 → 일부 채움 유실)을
// 원천 제거하고, 응답 도착 순서도 발사 순서와 같아진다.
//
// 컴포넌트 ref가 아닌 **모듈 레벨**인 이유(2026-06-12 진단): 큐가 인스턴스 단위면
// 이탈 후에도 잔여 POST가 계속 도는데(좀비 큐), 재진입한 새 인스턴스가 새 큐로
// 같은 보드에 병렬 POST를 쏴 직렬화 전제가 인스턴스 경계에서 무너졌다(P2034 부활,
// 같은 칸 중복 POST→409). 모듈 큐는 재진입 탭을 좀비 잔여분 *뒤에* 이어 붙인다.
// (직렬화 범위는 JS 컨텍스트 = 단일 탭 한정 — 두 탭 동시 연타는 서버 재시도와
//  클라 409 처리가 수습한다.)
//
// fillResumeAt: 항목이 (409 외로) 실패하면 그 position을 기록한다 — 그보다 높은
// position의 항목은 발사 *직전에* 폐기(낙관 스티커만 회수)된다. 실패 칸을 건너뛴
// 후속 성공이 서버에 비연속 구멍(영구 미완성 보드)을 만들기 때문이며, 서버는
// position 연속성을 검증하지 않는다(서로 다른 칸 동시 채움 허용 계약 —
// fillBoard.integration.test 참조). '카운터(epoch)'가 아닌 '재개 지점(position)'인
// 이유: 실패 직후 롤백이 화면에 그려지기 전(stale 렌더 창)에 들어온 탭은 어떤
// 카운터를 캡처해도 통과하지만, position 비교는 발사 시점 큐 이력만으로 차단된다.
// 기록은 실패 지점 이하를 다시 채우는 발사가 나타날 때 해제된다.
const fillQueues = new Map<string, Promise<void>>();
const fillResumeAt = new Map<string, number>();
const fillPendingCounts = new Map<string, number>();
// 큐에 들어갔지만 아직 확정(reconcile/rollback)되지 않은 position들 — 재진입한
// 인스턴스가 이 칸들을 낙관 temp로 재주입해 '비어 보이는 in-flight 칸'을 재탭
// (→확정 409)하지 않게 한다.
const fillPendingPositions = new Map<string, Set<number>>();

interface LiveBoardHandle {
  setBoard: Dispatch<SetStateAction<BoardDetail | null>>;
  /** 채움 실패를 살아있는 화면에 표면화 — msg가 null이면 조용한 재동기화만(409). */
  onFillFailure: (msg: string | null) => void;
}
// '지금 이 보드를 보고 있는' 인스턴스 — 큐는 인스턴스보다 오래 살므로(좀비),
// reconcile/rollback/실패 통지는 항목을 만든 인스턴스가 아니라 현재 화면으로
// 흐른다. 재진입 화면이 드레인 진행을 실시간으로 따라가고, 좀비 항목의 실패가
// 새 인스턴스의 탭을 '무음으로' 폐기하는 일이 없어진다.
const liveBoards = new Map<string, LiveBoardHandle>();

/** 채움 상태 전이를 현재 살아있는 인스턴스의 상태에, 없으면 캐시에 적용한다.
 *  캐시 경로는 temp를 벗겨 '서버 확인 상태'만 남긴다(라이브 경로는 컴포넌트의
 *  캐시 동기화 effect가 같은 일을 한다 — 캐시 기록자는 항상 하나). */
function applyBoardUpdate(id: string, updater: (prev: BoardDetail) => BoardDetail) {
  const live = liveBoards.get(id);
  if (live) {
    live.setBoard((prev) => (prev ? updater(prev) : prev));
    return;
  }
  const cached = readCachedApi<BoardDetail>(`/api/boards/${id}`);
  if (cached) syncBoardCaches(id, stripTempsForCache(updater(cached)));
}

/** 보드 상세 캐시 + 홈 /api/boards write-through. snapshot은 temp 없는(서버 확인)
 *  상태여야 한다. 라이브 캐시 effect와 좀비 reconcile(언마운트 후) 양쪽이 같은
 *  산식을 쓴다 — 홈 재진입의 캐시 첫 페인트가 마지막 서버 확인 상태와 일치한다. */
function syncBoardCaches(id: string, snapshot: BoardDetail) {
  writeCachedApi(`/api/boards/${id}`, snapshot);
  const home = readCachedApi<{ boards: BoardSummary[] }>('/api/boards');
  if (home?.boards.some((b) => b.id === id)) {
    writeCachedApi('/api/boards', {
      ...home,
      boards: home.boards.map((b) =>
        b.id === id
          ? {
              ...b,
              filledCount: snapshot.filledCount,
              isCompleted: snapshot.isCompleted,
              // 마지막 칸 채움의 reconcile은 completedAt을 안 채운다(POST 응답에 없음).
              // null로 덮으면 isCompleted:true·completedAt:null 조합이 캐시에 들어가므로
              // 스냅샷이 실값일 때만 병합한다.
              completedAt: snapshot.completedAt ?? b.completedAt,
            }
          : b,
      ),
    });
  }
}

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
  // (카운트 산식·홈 write-through는 stripTempsForCache/syncBoardCaches로 추출 —
  //  이중 차감 회귀는 boardFillState.test가 고정한다.)
  useEffect(() => {
    // id 가드: App Router가 /board/A → /board/B 전환에서 인스턴스를 재사용하면
    // 새 id의 캐시에 이전 보드 스냅샷이 적힐 수 있다(현행 내비게이션엔 그 경로가
    // 없지만 비용 0의 방어 — summary useMemo의 id 키 메모와 같은 철학).
    if (!board || board.id !== id) return;
    syncBoardCaches(id, stripTempsForCache(board));
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
  // 백그라운드 복귀 재검증의 기준 시각(mount/수동 재검증 포함, 5초 스로틀).
  const lastFetchAtRef = useRef(0);

  const fetchBoard = useCallback(async () => {
    lastFetchAtRef.current = Date.now();
    try {
      const data = await api<{ board: BoardDetail }>(`/api/boards/${id}`);
      // 서버 스냅샷에 없는 position의 로컬 스티커는 temp든 실 스티커든 전부 보존
      // 병합한다. temp만 보존하던 시절(#66)엔 중간 보상 unlock 등으로 큐 드레인
      // 도중 발사된 stale GET이 'GET의 DB 읽기 이후 reconcile로 확정된' 실 스티커를
      // 통째로 지워 화면이 되감기고, GrapeBoard의 filledCount 하락 감시가 진행 중인
      // 완성 연출을 오취소했다. 산식·단조 병합 규칙은 mergeServerBoard 참조.
      setBoard((prev) => mergeServerBoard(prev, data.board));
      setErrorMessage(null);
      initialLoadDoneRef.current = true;
    } catch (err) {
      // First load failure → board genuinely missing or no permission, bail home.
      // Later failures → keep the UI mounted; surface a banner so the user can retry.
      // 단 접근 상실(404 삭제/403 권한 해제)은 예외 — 복귀 재검증 리스너가 닫은
      // 배너를 5초마다 되살리며 영구 stale 화면에 머무르게 하므로 홈으로 나간다.
      if (!initialLoadDoneRef.current) {
        router.replace('/home');
      } else if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        invalidateCachedApi(`/api/boards/${id}`);
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
    // 재진입 시 이전 인스턴스의 큐가 아직 드레인 중이면(좀비 큐), 끝난 뒤 한 번 더
    // 서버 기준으로 따라잡는다 — mount 1회 fetch가 드레인 중간 상태(k'/N)를 받아
    // 완성이 화면에 영영 안 보이던 고착의 해소.
    if ((fillPendingCounts.get(id) ?? 0) > 0) {
      fillQueues.get(id)?.then(() => {
        if (aliveRef.current) fetchBoard();
      });
    }
  }, [fetchBoard, id]);

  // 라이브 핸들 등록 — 좀비 큐의 reconcile/rollback/실패 통지가 이 인스턴스로 흐른다.
  const onFillFailure = useCallback((msg: string | null) => {
    if (msg) setErrorMessage(`${msg} — 잠시 후 다시 시도해주세요.`);
    // 실패 원인이 드리프트(이미 채워짐 등)일 수 있으니 서버 기준 재동기화.
    fetchBoard().catch(() => {});
  }, [fetchBoard]);
  useEffect(() => {
    const handle = { setBoard, onFillFailure };
    liveBoards.set(id, handle);
    return () => {
      if (liveBoards.get(id) === handle) liveBoards.delete(id);
    };
  }, [id, onFillFailure]);

  // 재진입 시 이전 인스턴스 큐가 아직 확정 못 한 칸(in-flight/대기)을 낙관 temp로
  // 재주입 — 캐시 시드(temp 제외)만 보면 그 칸이 비어 보여 grape-next가 가리키고,
  // 탭하면 좀비 항목과 같은 칸을 두 번 POST(직렬화 탓에 확정 409)하게 된다.
  // reconcile/rollback은 position 기준으로 이 temp를 교체/회수한다.
  useEffect(() => {
    const pending = fillPendingPositions.get(id);
    if (!pending || pending.size === 0) return;
    const positions = [...pending];
    setBoard((prev) => {
      if (!prev) return prev;
      let next = prev;
      for (const p of positions) {
        if (next.stickers.some((s) => s.position === p)) continue;
        next = applyOptimisticFill(next, {
          id: `temp-${p}-reseed`,
          position: p,
          filledAt: new Date().toISOString(),
          filledBy: prev.owner,
        });
      }
      return next;
    });
  }, [id]);

  // 백그라운드 복귀 재검증 — useCachedApi 훅과 동일 패턴(보드 상세는 자체 fetch라
  // 훅 미사용 → 이 리스너가 없던 게 좀비 큐/다른 기기 진행과의 괴리 고착 원인 중
  // 하나). 오프라인 복귀 전엔 sw.js가 /api/*를 즉시 503으로 응답하므로 건너뛴다.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (navigator.onLine === false) return;
      if (Date.now() - lastFetchAtRef.current < 5000) return;
      fetchBoard();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
    };
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

  // 실제 서버 POST + reconcile/rollback. 보드 단위 모듈 큐 체인에서 한 번에
  // 하나씩 실행된다. 에러는 내부에서 처리(롤백+배너)하고 reject하지 않되, 실패
  // 시 그 position을 재개 지점으로 기록해 더 높은 position의 항목은 발사 전에
  // 폐기된다(모듈 큐 주석 참조 — 비연속 구멍 방지).
  const postFillSticker = useCallback(async (
    position: number,
    tempId: string,
    totalStickers: number,
  ) => {
    try {
      const resume = fillResumeAt.get(id);
      if (resume !== undefined) {
        if (position > resume) {
          // 더 낮은 칸의 실패가 기록돼 있다 — 여기서 발사하면 서버에 비연속 구멍이
          // 생긴다. 발사를 포기하고 낙관 스티커만 회수(배너·재동기화는 실패 시점에
          // onFillFailure가 이미 처리).
          applyBoardUpdate(id, (prev) => rollbackFill(prev, tempId, position));
          return;
        }
        // 실패 지점(이하)을 다시 채우러 온 발사 — 재개.
        fillResumeAt.delete(id);
      }
      const result = await api<{
        sticker: BoardDetail['stickers'][number];
        filledCount: number;
        isCompleted: boolean;
        unlockedReward: { id: string; type: string; title: string; triggerAt: number } | null;
        plantedGift: PlantedGiftInfo | null;
        plantedGifts?: PlantedGiftInfo[];
        relayAdvanced?: boolean;
      }>(`/api/boards/${id}/stickers`, {
        method: 'POST',
        json: { position },
        // 모바일 라디오 핸드오프 등으로 fetch가 무기한 행하면 직렬 큐 전체가
        // 정지한다(후속 발사도 멈춤) — 시한을 걸어 실패(롤백+배너) 경로로 합류.
        // Neon 콜드 + Serializable 재시도 백오프(최악 ~9.6s)를 여유 있게 덮는 값.
        signal: AbortSignal.timeout(20000),
      });
      // 보드 완성/포도동 자동 진행 시 relay 상세 캐시 일괄 무효화 — 연타 채움의
      // 직렬화 큐가 in-flight인 사이 relay 페이지가 재검증을 끝내면 미완성 카운트가
      // 캐시에 남는데, 완료 응답 시점에 비워두면 다음 진입이 서버 기준으로 시작한다.
      // aliveRef 가드보다 먼저 실행: 핵심 경합이 '채우고 곧장 포도동 진입'이라 완료
      // 응답은 대개 이 페이지가 떠난 뒤 도착한다(화면 상태가 아닌 모듈 캐시 조작).
      if (result.isCompleted || result.relayAdvanced) {
        invalidateCachedApiPrefix('/api/relays');
      }

      // Reconcile: temp를 서버 확정 스티커로 교체. 카운트는 길이 유도, 완성은
      // 단조, 같은 position 중복 삽입 방지 — 산식은 applyFillResult 참조.
      // 살아있는 화면(자신 또는 재진입한 새 인스턴스)에, 없으면 캐시에 적용 —
      // 이탈 후 도착한 채움/완성이 재진입·홈 첫 페인트에서 후퇴해 보이지 않는다.
      applyBoardUpdate(id, (prev) => applyFillResult(prev, tempId, result));

      if (!aliveRef.current) return;
      setErrorMessage(null);

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
      const status = err instanceof ApiError ? err.status : undefined;
      if (status === 409) {
        // '이미 채워진 칸' — 그 칸이 서버에 *있다*는 뜻이라 비연속 구멍 위험이
        // 없는 유일한 실패다. 후속 항목은 계속 진행하고(재개 지점 기록 없음),
        // 배너 없이 조용한 재동기화로 수렴한다(더블탭 레이스·타임아웃 뒤 늦은
        // 커밋 재탭 모두 여기로 합류 — 사실상 성공이므로 에러 연출이 과잉).
        applyBoardUpdate(id, (prev) => rollbackFill(prev, tempId, position));
        liveBoards.get(id)?.onFillFailure(null);
        return;
      }
      // 재개 지점 기록 — 화면 생존 여부와 무관하게(좀비 큐의 실패도 후속을 멈춰야
      // 구멍이 안 생긴다) 가장 먼저. 더 낮은 실패가 이미 있으면 그쪽 유지.
      fillResumeAt.set(id, Math.min(fillResumeAt.get(id) ?? Infinity, position));
      // Rollback the optimistic sticker on failure.
      applyBoardUpdate(id, (prev) => rollbackFill(prev, tempId, position));
      if (aliveRef.current) setRewardPopup(null); // close any popup opened optimistically for this fill
      // ApiError(서버의 해요체 메시지)만 본문 그대로 — 네트워크/타임아웃 예외의
      // 영문 메시지가 배너에 새지 않게 한다. 배너+재동기화는 살아있는 화면으로
      // 라우팅 — 좀비 항목의 실패가 재진입 인스턴스의 탭을 무음 폐기하지 않게.
      const msg = err instanceof ApiError ? err.message : '포도알을 채우지 못했어요';
      liveBoards.get(id)?.onFillFailure(msg);
    } finally {
      fillPendingPositions.get(id)?.delete(position);
      const remaining = Math.max(0, (fillPendingCounts.get(id) ?? 1) - 1);
      if (remaining === 0) {
        // 드레인 종료 — 세션 내 키 성장 방지. fillResumeAt만 보존: 실패 직후
        // stale 렌더 창에서 들어온 탭이 새 체인으로 발사돼 구멍을 만드는 것을
        // 다음 재채움(재개 지점 이하 발사)까지 계속 막아야 한다.
        fillQueues.delete(id);
        fillPendingCounts.delete(id);
        fillPendingPositions.delete(id);
      } else {
        fillPendingCounts.set(id, remaining);
      }
    }
  }, [id, fetchBoard]);

  const handleFillSticker = useCallback((position: number): Promise<void> => {
    if (!board || !user) return Promise.resolve();
    // 더블탭 레이스 등 같은 칸 중복 발사 가드(temp·실 스티커 불문 점유 시 no-op).
    if (board.stickers.some((s) => s.position === position)) return Promise.resolve();

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

    setBoard((prev) => (prev ? applyOptimisticFill(prev, optimisticSticker) : prev));

    // 서버 POST는 보드 단위 모듈 큐 체인에 연결 — 이전 요청 완료 후 발송. 페이지
    // 이탈 시에도 이미 시작된 체인은 계속 진행되고(좀비 큐), 그 결과는 liveBoards/
    // 캐시로 흐른다. 재진입 인스턴스의 탭은 같은 체인 뒤에 선다.
    const totalStickers = board.totalStickers;
    let pendingSet = fillPendingPositions.get(id);
    if (!pendingSet) {
      pendingSet = new Set<number>();
      fillPendingPositions.set(id, pendingSet);
    }
    pendingSet.add(position);
    fillPendingCounts.set(id, (fillPendingCounts.get(id) ?? 0) + 1);
    const queued = (fillQueues.get(id) ?? Promise.resolve()).then(
      () => postFillSticker(position, tempId, totalStickers),
    );
    fillQueues.set(id, queued.catch(() => {})); // 방어: 예기치 못한 reject로 체인 단절 방지
    return queued;
  }, [board, user, id, postFillSticker]);

  // GrapeBoard에 내려가는 콜백들을 안정화 — 인라인 화살표로 주면 배너·컨페티·캡슐
  // 티저 등 보드와 무관한 페이지 상태 변화마다 memo(GrapeBoardInner)가 무력화돼,
  // 완성 연출(WAAPI) 중 직렬 큐 reconcile과 겹치며 전 셀 리렌더 폭이 커졌다(버벅).
  const handleCelebrate = useCallback(() => setConfettiTrigger((t) => t + 1), []);
  const handlePlantReward = useCallback((pos: number) => {
    feedbackTap();
    setPlantPos(pos);
  }, []);
  const handleMidRewardReached = useCallback((r: RewardInfo) => setRewardPopup(r), []);

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
      const msg = err instanceof ApiError ? err.message : '수정에 실패했어요';
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
      const msg = err instanceof ApiError ? err.message : '선물 전송에 실패했어요';
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
      const msg = err instanceof ApiError ? err.message : '삭제에 실패했어요';
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
  // 포도동 연결 보드는 선물 불가(서버도 gift POST에서 차단). inRelay가 없는 구버전
  // 캐시 응답은 홈 요약의 podong(그룹 전용)으로 폴백.
  const noGift = board.inRelay ?? summary?.podong ?? false;
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
            disabled={noGift}
            aria-label={noGift ? '포도동 포도판은 선물할 수 없어요' : undefined}
            title={noGift ? '포도동 포도판은 선물할 수 없어요' : undefined}
            className="py-2.5 text-sm text-grape-700 active:bg-grape-50 transition-colors disabled:opacity-40"
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
          onCelebrate={handleCelebrate}
          isOwner={isOwner}
          onPlantReward={isOwner && !board.isCompleted ? handlePlantReward : undefined}
          onMidRewardReached={handleMidRewardReached}
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
          // strip은 모달 내부에서(표시 전용 — PlantGiftModal과 동일 패턴) 처리한다.
          boardTitle={board.title}
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
