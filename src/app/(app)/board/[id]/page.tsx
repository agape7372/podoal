'use client';

import { useEffect, useMemo, useState, useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { api, ApiError } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import GrapeBoard, { type GrapeBoardHandle, CELEBRATION_PEAK_MS } from '@/components/GrapeBoard';
import Confetti from '@/components/Confetti';
import GiftUnboxModal from '@/components/GiftUnboxModal';
import SurpriseRevealModal from '@/components/SurpriseRevealModal';
import MidRewardModal from '@/components/MidRewardModal';
import PlantGiftModal from '@/components/PlantGiftModal';
import RewardRevealModal from '@/components/RewardRevealModal';
// 채움 텀 C1(RipeningSheet) — 탭 즉시 반응이 중요한 소프트 가드라 위 보상 모달들과
// 같은 이유로 정적 유지(지연로딩 대상 아님).
import RipeningSheet from '@/components/RipeningSheet';
import Avatar from '@/components/Avatar';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmojiIcon from '@/components/EmojiIcon';
// 무거운/메뉴로 여는 모달은 상호작용 시점에만 청크를 받도록 지연로딩(초기 First Load JS 축소).
// ShareCardModal은 Canvas+cardEngine으로 가장 무겁다. 즉시성이 중요한 보상 경로
// (RewardRevealModal·SurpriseRevealModal·GiftUnboxModal)는 청크 fetch 지연을 피해 정적 유지(#89).
const ShareCardModal = dynamic(() => import('@/components/ShareCardModal'), { ssr: false });
const CapsuleModal = dynamic(() => import('@/components/CapsuleModal'), { ssr: false });
const GiftBoardModal = dynamic(() => import('@/components/GiftBoardModal'), { ssr: false });
const EditBoardInfoModal = dynamic(() => import('@/components/EditBoardInfoModal'), { ssr: false });
const CustomImageModal = dynamic(() => import('@/components/CustomImageModal'), { ssr: false });
import { invalidateCachedApi, invalidateCachedApiPrefix, markCachedApiStale, readCachedApi, writeCachedApi } from '@/lib/cachedApi';
import { createLatestGuard } from '@/lib/latestGuard';
import {
  applyOptimisticFill,
  applyFillResult,
  applyBatchFillResult,
  planFillBatches,
  rollbackFill,
  mergeServerBoard,
  stripTempsForCache,
  shouldFlushFillBuffer,
  needsSingleFillPost,
} from '@/lib/boardFillState';
import type { BoardDetail, BoardSummary, PlantedGiftInfo, RewardInfo, RewardType, TimeCapsuleInfo } from '@/types';
import { REWARD_TYPE_ICON, ICON } from '@/lib/icons';
import { feedbackTap } from '@/lib/feedback';
import { stripTitleEmoji } from '@/lib/title';
import { computePaceState, type PaceState } from '@/lib/cadence';
import { track, trackFirst } from '@/lib/analytics';

// 채움 POST 직렬화 큐 — 재진입에도 살아남는 모듈 레벨 상태라 라우트 전환 없이
// 홈에서도 참조할 수 있게 src/lib/fillQueue.ts로 이전됨. 상세 설계 근거는 그쪽 주석.
import {
  fillQueues,
  fillResumeAt,
  fillPendingCounts,
  fillPendingPositions,
  markFillStart,
  markFillEnd,
  isFillInFlight,
} from '@/lib/fillQueue';

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

// ── 배치 코얼레싱 버퍼 (FREE 보드 전용, 모듈 레벨) ──────────────────────────
// 연타 탭을 칸당 POST 대신 버퍼에 모아 ~200ms 아이들 디바운스로 한 번에 영속한다
// (배치 API {positions[]}). 큐 Map들과 같은 이유로 모듈 레벨: 버퍼가 인스턴스에
// 묶이면 이탈 시 타이머가 사라져 버퍼분이 유실된다(#88 좀비 의미론 — 타이머·버퍼가
// 화면보다 오래 살아 플러시를 완주하고, 결과는 liveBoards/캐시로 흐른다).
// resolve: 그 탭의 handleFillSticker 반환 Promise를 배치 확정 시점에 푼다.
type FillBatchEntry = { position: number; tempId: string; resolve: () => void };
const fillBatchBuffers = new Map<
  string,
  { entries: FillBatchEntry[]; totalStickers: number; triggerAts: number[] }
>();
const fillBatchTimers = new Map<string, ReturnType<typeof setTimeout>>();
// ⚠ 2026-07-23: 종전 200ms **아이들 디바운스**를 폐기하고 큐 기반 코얼레싱으로 바꿨다
// (판정은 shouldFlushFillBuffer). 실측 연타 간격이 ~320ms라 타이머가 탭 사이마다 울려
// 배치가 1알씩 쪼개졌고, 15알 보드가 직렬 왕복 15번이 되면서 완성 응답(= 보상 content를
// 실어오는 응답)이 마지막 탭 +10초에 도착했다. 이제 발사 시점은 시계가 아니라 큐 상태다.
// 이 타이머는 그 대체가 아니라 **백스톱**이다: 어떤 이유로든 settle 웨이크업이 유실되면
// 버퍼가 영영 안 나가 채움이 통째로 유실되므로, 대기로 갈 때마다 느슨한 시한을 걸어둔다.
// 백스톱이 in-flight 중에 울려도 무해하다(직렬 큐라 뒤에 붙을 뿐 — 왕복 1회 추가가 전부).
const FILL_BATCH_BACKSTOP_MS = 2000;

// M1(리뷰): 백그라운드 전환/앱 종료 시 버퍼 유실 방지. 연타(<200ms 간격)는 디바운스를
// 계속 리셋하므로, 마지막 탭 직후 홈 제스처로 JS가 정지되면(iOS PWA) 타이머가 영영 안
// 울리고 스와이프킬/OS 축출 시 낙관 표시된 채움이 전부 유실됐다(구 단건 경로는 첫
// POST부터 점진 커밋이라 없던 회귀). pagehide·visibilitychange(hidden)에서 모든 보드의
// 대기 버퍼를 즉시 플러시하고, 이 경로의 POST만 keepalive로 발사해 페이지 teardown
// 후에도 브라우저가 완송한다(배치 본문은 수백 바이트 — keepalive 64KB 캡과 무관.
// 일반 플러시는 keepalive 불필요라 미사용). 페이지 내 내비게이션은 종전대로 좀비
// 타이머가 커버 — 이 리스너는 '정지/킬' 갭 전용이다. 플러시 함수는 인스턴스 콜백이라
// 버퍼에 탭이 쌓일 때 최신 것을 레지스트리에 등록해 모듈 리스너가 호출한다.
const fillBatchFlushers = new Map<string, (opts?: { keepalive?: boolean }) => void>();
if (typeof window !== 'undefined') {
  const flushAllFillBatches = () => {
    // flush가 레지스트리 엔트리를 지우므로 스냅샷 순회. 이중 발화(pagehide와 hidden이
    // 연달아 옴)는 무해 — 버퍼 드레인이 take-and-clear(동기 get+delete)라 두 번째
    // 호출은 빈 버퍼를 보고 no-op.
    for (const flush of [...fillBatchFlushers.values()]) flush({ keepalive: true });
  };
  window.addEventListener('pagehide', flushAllFillBatches);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAllFillBatches();
  });
}

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

/** 삭제 확정 후 캐시 정리(정합 감사: 삭제 고스트) — 상세 키 무효화 + 홈 리스트에서
 *  제거 write-through. 구독 알림으로 마운트/5초 창 재진입 홈이 고스트 없이 그려진다. */
function purgeBoardFromCaches(id: string) {
  invalidateCachedApi(`/api/boards/${id}`);
  const home = readCachedApi<{ boards: BoardSummary[] }>('/api/boards');
  if (home?.boards.some((b) => b.id === id)) {
    writeCachedApi('/api/boards', { ...home, boards: home.boards.filter((b) => b.id !== id) });
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
  // 이 보드 id로 서버 검증(fetchBoard 성공)이 있었는가 — 그 전의 캐시 시드를
  // syncBoardCaches로 write-back하면, 상세 캐시가 홈 리스트보다 오래된 경우 스테일이
  // 리스트로 역류하고 구독 알림이 그것을 홈에 '라이브로' 그려버린다. id 키 state라
  // 인스턴스 재사용(/board/A→/board/B)에도 자동으로 게이트가 닫힌다.
  const [serverSyncedId, setServerSyncedId] = useState<string | null>(null);
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
    // 서버 검증 전(캐시 시드만 있는 상태)의 write-back 금지 — 위 serverSyncedId 주석 참조.
    if (serverSyncedId !== id) return;
    syncBoardCaches(id, stripTempsForCache(board));
  }, [board, id, serverSyncedId]);
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
  const [showCustomImage, setShowCustomImage] = useState(false);
  // Burst counter for the shared <Confetti>. Bumped both when a fill unlocks a
  // reward (via GrapeBoard's onCelebrate) and when a reward is opened.
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  // Queue of friend-planted surprises waiting to be revealed one-by-one. A single
  // filled grape can carry several (overlap allowed), shown sequentially.
  const [surpriseQueue, setSurpriseQueue] = useState<PlantedGiftInfo[]>([]);
  // Long-press / "+ 중간 보상" → MidRewardModal targeting this 0-based grape.
  const [plantPos, setPlantPos] = useState<number | null>(null);
  // Friend (non-owner) view: long-press an unfilled grape → PlantGiftModal fixed
  // to that position. Separate from `plantPos` (owner's 중간 보상 target) — the
  // two gestures are mutually exclusive per GrapeBoard's isOwner branch, but keeping
  // the state distinct avoids overloading one variable across two different modals.
  const [plantGiftPos, setPlantGiftPos] = useState<number | null>(null);
  // Brief inline notice when a friend long-presses on a board with allowFriendPlant
  // off — auto-dismisses, no localStorage (W1-C spec 2).
  const [plantGiftHint, setPlantGiftHint] = useState(false);
  const [plantedFeedback, setPlantedFeedback] = useState(false);
  // A mid reward just reached → opened immediately in a popup (instant "쾌감").
  // loading은 팝업 객체에 동봉한 단일 상태 — 분리하면 unlock 응답의 loading 해제가
  // '다른 보상' 팝업의 스켈레톤을 오소거하는 동기화 구멍이 생긴다. content의
  // truthiness로 로딩을 판정하지 않는 이유: content는 빈 문자열이 허용되어(내용
  // 없는 보상) 영구 스켈레톤에 갇힌다.
  // savingFills: 직렬 큐가 드레인 중인 동안 열린 스켈레톤 — 모달이 '저장 중'을
  // 말하게 한다(말 없는 스켈레톤은 몇 초만에 '편지가 안 나온다'로 읽힘, 2026-06-13).
  const [rewardPopup, setRewardPopup] = useState<{ reward: RewardInfo; loading: boolean; savingFills?: boolean } | null>(null);
  // 빠른 응답(웜 네트워크 + 빈 큐 단발 탭)은 unlock 응답이 +300ms 비트보다 먼저
  // 도착한다 — 그 시점엔 팝업이 아직 없어 내용이 버려지고 스켈레톤으로 열렸다
  // (적대적 리뷰 must-fix: '빠를수록 깨지는' 레이스). 보상 id 키로 보관했다가
  // 비트(handleMidRewardReached)가 열 때 소비한다.
  const pendingUnlockContentRef = useRef(
    new Map<string, { title: string; content: string; imageUrl: string }>(),
  );
  // 이 세션에서 이미 팝업으로 본 보상 id — 완성 자동 개봉(2.4s 타이머)이, 사용자가
  // 그 사이 직접 열었다 닫은 보상을 다시 들이밀지 않게 한다(적대 검증에서 잡힌 반례).
  const rewardSeenRef = useRef(new Set<string>());
  // 마지막 알 임팩트 시각(GrapeBoard onCompletionStart) — 완성 보상 자동개봉을 '탭 기준'
  // 으로 스케줄하기 위한 단일 기준점. null이면 이 세션에서 완성 연출이 없었다는 뜻이라
  // (재진입 후 도착한 좀비 응답 등) 종전 동작(응답 도착 + 2.4초)으로 폴백한다.
  const completionImpactAtRef = useRef<number | null>(null);
  // 캐시로 시드됐다면 '첫 로드 완료'로 취급 — 재검증 실패 시 홈으로 튕기는 대신
  // 기존 화면 + 동기화 실패 배너를 유지한다(fetchBoard catch 분기 참조).
  const initialLoadDoneRef = useRef(board !== null);
  // 최신 board 스냅샷 ref — 직렬 큐 콜백(postFillSticker)이 stale 클로저 없이
  // 정적 속성(inRelay 등)을 읽을 때 사용. 파이프라인 로직에는 관여하지 않는다.
  const boardRef = useRef<BoardDetail | null>(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);
  // fetchBoard 역순 응답 가드 — mount/좀비 드레인/복귀 재검증이 겹칠 때 먼저 출발한
  // 느린 응답이 나중 응답을 덮지 않게 한다(임계 필드는 mergeServerBoard 단조 병합이
  // 이중 방어).
  const fetchGuardRef = useRef(createLatestGuard());
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
    const token = fetchGuardRef.current.begin();
    try {
      const data = await api<{ board: BoardDetail }>(`/api/boards/${id}`);
      if (!fetchGuardRef.current.isLatest(token)) return; // 역순 응답 폐기
      // 서버 스냅샷에 없는 position의 로컬 스티커는 temp든 실 스티커든 전부 보존
      // 병합한다. temp만 보존하던 시절(#66)엔 중간 보상 unlock 등으로 큐 드레인
      // 도중 발사된 stale GET이 'GET의 DB 읽기 이후 reconcile로 확정된' 실 스티커를
      // 통째로 지워 화면이 되감기고, GrapeBoard의 filledCount 하락 감시가 진행 중인
      // 완성 연출을 오취소했다. 산식·단조 병합 규칙은 mergeServerBoard 참조.
      setBoard((prev) => mergeServerBoard(prev, data.board));
      setErrorMessage(null);
      initialLoadDoneRef.current = true;
      setServerSyncedId(id); // 이제부터 이 id의 캐시 write-back 허용(시드 역류 게이트 해제)
    } catch (err) {
      if (!fetchGuardRef.current.isLatest(token)) return; // 역순 실패도 무시(배너/바운스 오발 방지)
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

  // 채움 텀 C1(FILL_CADENCE_PLAN §3, W3) — 탭 허용 "앞단" 판정. paceNow는 그 판정에
  // 쓰인 시각을 RipeningSheet의 문구 포맷팅에 그대로 넘겨주기 위한 것(렌더 중
  // new Date() 금지 — 위 캡슐 티저와 동일하게 effect에서만 시각을 읽는다).
  // board.stickers/cadenceType/cadenceN이 바뀔 때마다(채움·재검증) 재계산되므로,
  // 텀 소진 직후 다음 알이 즉시 "익는 중"으로 전환된다(카드 스펙 7).
  const [paceState, setPaceState] = useState<PaceState | null>(null);
  const [paceNow, setPaceNow] = useState<Date | null>(null);
  useEffect(() => {
    if (!board) { setPaceState(null); setPaceNow(null); return; }
    const now = new Date();
    // isBackfill을 실어 보내야 C3 보충 채움이 전날 귀속으로 평가된다(cadence.ts 참조) —
    // 빼먹으면 보충 채움 직후 오늘 몫을 잠식한 것으로 오판해 unripe로 보인다.
    const fills = board.stickers.map((s) => ({ filledAt: new Date(s.filledAt), isBackfill: s.isBackfill }));
    // dayResetHour(C4-b) — me 응답이 흐르는 store user에서 그대로 소비. 클라 판정을
    // 서버 판정(같은 필드 기준)과 같은 경계로 맞춘다. 값 없으면 기존 자정 경계(0).
    setPaceState(
      computePaceState(
        { cadenceType: board.cadenceType, cadenceN: board.cadenceN },
        fills,
        now,
        user?.dayResetHour ?? 0,
      ),
    );
    setPaceNow(now);
  }, [board, user?.dayResetHour]);
  // "그래도 채우기" 오버라이드 배관 — GrapeBoard의 낙관 큐/handleFill 코드는 무수정,
  // ref로만 연결한다(카드 제약). fillNow는 GrapeBoard가 노출하는 임퍼러티브 핸들.
  const grapeBoardRef = useRef<GrapeBoardHandle>(null);
  // postFillSticker가 전송 직전 여기 있으면 POST body에 earlyFill:true를 얹고 제거한다
  // (함수 시그니처 변경 없이 배관 — 낙관 큐 코드 무수정 원칙). 인스턴스 단위 ref라서
  // (fillPendingPositions 등 모듈 Map과 달리 id로 구분되지 않음) App Router가 /board/A →
  // /board/B 전환에서 인스턴스를 재사용하면 이전 보드의 잔여 플래그가 새 보드로 샐 수
  // 있다 — id가 바뀔 때마다 비워 교차 오염을 차단한다(적대 검증 기록 참조).
  const earlyPositionsRef = useRef(new Set<number>());
  // "어제 몫 채우기"(C3) — earlyPositionsRef와 대칭 배관. postFillSticker 전송 직전
  // 여기 있으면 body에 backfill:true를 얹고 제거한다(같은 id 교차오염 방지도 동일).
  const backfillPositionsRef = useRef(new Set<number>());
  useEffect(() => {
    earlyPositionsRef.current.clear();
    backfillPositionsRef.current.clear();
  }, [id]);
  const [showRipeningSheet, setShowRipeningSheet] = useState(false);
  const handleRipeningTap = useCallback(() => setShowRipeningSheet(true), []);
  const handleRipeningOverride = useCallback(() => {
    if (!board) return;
    // ConfirmDialog의 확인 버튼과 동일 패턴 — 이탈 애니 없이 즉시 언마운트(부모가 open
    // 상태를 직접 끄는 경로, Modal.tsx 주석 참조). fillNow가 곧장 그래프 히트 연출을
    // 태우므로 시트가 먼저 사라져야 자연스럽다.
    setShowRipeningSheet(false);
    const position = board.stickers.length; // 순차 채움 — 다음 칸은 항상 현재 채움 수.
    earlyPositionsRef.current.add(position);
    track('fill_early_override', { boardId: id }); // 오버라이드율 — 텀 적정성 역지표(§2)
    grapeBoardRef.current?.fillNow(position);
  }, [board, id]);
  const handleRipeningBackfill = useCallback(() => {
    if (!board) return;
    // onOverride와 동일 패턴(이탈 애니 없이 즉시 언마운트).
    setShowRipeningSheet(false);
    const position = board.stickers.length; // 순차 채움 — 다음 칸은 항상 현재 채움 수.
    backfillPositionsRef.current.add(position);
    track('fill_backfill', { boardId: id });
    grapeBoardRef.current?.fillNow(position);
    // 보충은 1알 한정 — 소비 즉시 낙관 소거해 시트 재진입 시 재노출을 막는다(서버
    // 재판정이 정본이라 실패 롤백은 신경 쓰지 않는다 — 다음 보드 fetch가 수렴).
    setBoard((b) => (b ? { ...b, backfillAvailable: false } : b));
  }, [board, id]);

  // 해제된 보상 1건의 팝업/reveal 배관 — 단건(postFillSticker)과 배치(postFillBatch)가
  // 같은 본문을 공유한다(종전 postFillSticker 인라인 블록을 그대로 추출 — 드리프트 방지).
  const processUnlockedReward = useCallback((
    u: {
      id: string;
      type: string;
      title: string;
      triggerAt: number;
      content?: string;
      imageUrl?: string;
    },
    totalStickers: number,
  ) => {
    track('reward_unlocked', { type: u.type, isMid: u.triggerAt < totalStickers });
    // 중간 보상: GrapeBoard가 컨페티와 같은 비트에 팝업을 이미 열었음
    // (onMidRewardReached). unlock 응답에 실려 온 내용으로 **즉시** 채운다 —
    // 예전엔 reveal 왕복을 한 번 더 기다렸고(직렬 큐를 그만큼 또 막음),
    // reveal이 실패하면 스켈레톤에 갇혔다. reveal은 이제 '열어봤다' 영속화
    // 전용으로 비차단 발사한다(멱등 — 실패해도 다음 열람이 재시도).
    // 최종 보상은 팝업 자동 오픈 없이 카드 탭으로 연다.
    if (u.triggerAt < totalStickers) {
      const body = { title: u.title, content: u.content ?? '', imageUrl: u.imageUrl ?? '' };
      // 비트가 아직 팝업을 안 열었을 수 있다(빠른 응답이 +300ms를 추월) —
      // 버퍼에 먼저 보관하고, 이미 열려 있으면 즉시 머지(id 일치 시에만 —
      // loading 해제도 같은 updater 안에서만 일어나 교차 소거가 없다).
      pendingUnlockContentRef.current.set(u.id, body);
      setRewardPopup((prev) =>
        prev && prev.reward.id === u.id
          ? { reward: { ...prev.reward, ...body }, loading: false }
          : prev,
      );
      api(`/api/boards/${id}/rewards/${u.id}/reveal`, { method: 'POST' })
        .catch(() => {})
        .then(() => {
          if (aliveRef.current) fetchBoard();
        });
    } else {
      // 완성 보상도 같은 즉시-채움 경로를 탄다 — 마지막 채움이 느린 사이 사용자가
      // 카드를 먼저 탭해 스켈레톤 팝업을 열어둔 경우(2026-06-13 영상: 편지 무소식),
      // 이 unlock 응답이 서버가 내용을 아는 가장 이른 순간이다.
      const body = { title: u.title, content: u.content ?? '', imageUrl: u.imageUrl ?? '' };
      pendingUnlockContentRef.current.set(u.id, body);
      setRewardPopup((prev) =>
        prev && prev.reward.id === u.id
          ? { reward: { ...prev.reward, ...body }, loading: false }
          : prev,
      );
      // 완성 자동 개봉(W1-B ④): 완성 연출의 사운드/샤인 비트(임팩트+1650ms)가
      // 지나간 뒤 완성 보상을 자동으로 연다 — '완성했는데 보상이 안 나온다'는
      // 보고(2026-07-06)의 기대 정렬. 사용자가 먼저 탭해 팝업이 열려 있으면
      // no-op(prev 유지 — updater는 순수, StrictMode 이중 실행 안전). reveal은
      // openReward와 중복될 수 있으나 멱등이라 '열어봤다' 영속화만 보장한다.
      //
      // ⚠ 지연의 기준점은 '마지막 알 임팩트'다(2026-07-23). 종전엔 이 setTimeout이
      // POST 응답 도착 시점에 걸려 서버 왕복(웜 0.4~0.8s, 콜드 2s+)이 2.4초 위에 통째로
      // 가산됐다 — 연출이 끝나고도 1~2초 빈 화면이 남던 '보상 로딩이 오래 걸린다'의 실체.
      // 보상 content는 이 응답에 이미 실려 있으므로(fillBoard.ts unlockedRewards) 남은
      // 대기는 순수하게 연출 박자뿐이고, 응답이 박자보다 늦게 오면 delay 0 = 도착 즉시 개봉.
      const impactAt = completionImpactAtRef.current;
      const openDelay = impactAt === null
        ? CELEBRATION_PEAK_MS + 750 // 이 세션에 완성 연출이 없었음(좀비 응답 등) — 종전 동작
        : Math.max(0, CELEBRATION_PEAK_MS + 750 - (Date.now() - impactAt));
      window.setTimeout(() => {
        if (!aliveRef.current) return;
        if (rewardSeenRef.current.has(u.id)) return; // 그 사이 직접 열어봤으면 재개봉 금지
        const buffered = pendingUnlockContentRef.current.get(u.id) ?? body;
        pendingUnlockContentRef.current.delete(u.id);
        setRewardPopup((prev) => prev ?? {
          reward: {
            id: u.id,
            // 서버 보상 type은 validateRewards가 letter|giftcard|wish로 강제 — 단언 안전.
            type: u.type as RewardType,
            title: buffered.title,
            content: buffered.content,
            imageUrl: buffered.imageUrl,
            triggerAt: u.triggerAt,
            unlockedAt: null,
            revealedAt: null,
          },
          loading: false,
        });
        api(`/api/boards/${id}/rewards/${u.id}/reveal`, { method: 'POST' })
          .catch(() => {})
          .then(() => { if (aliveRef.current) fetchBoard(); });
      }, openDelay);
      // 보드 재동기화는 팝업 오픈 '뒤'로 미룬다 — 완성 직후가 네트워크가 가장 붐비는
      // 구간이라(reveal POST + 파생 키 재검증) 전체 보드 GET을 그 앞에 끼우면 개봉이
      // 밀린다. 응답 내용은 이미 손에 있어 화면 정합엔 영향이 없다.
      window.setTimeout(() => { if (aliveRef.current) fetchBoard(); }, openDelay + 250);
    }
  }, [id, fetchBoard]);

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
      // 채움 텀 C1(FILL_CADENCE §8): RipeningSheet의 "그래도 채우기"가 기록해둔 칸이면
      // 전송 직전 POST body에 earlyFill:true를 얹고 제거한다 — 함수 시그니처 변경 없이
      // ref로만 배관(낙관 큐 코드 무수정 원칙). 위 재개-지점 가드로 발사가 폐기(return)된
      // 경우엔 이 줄에 도달하지 않아 플래그가 보존되고, 사용자가 재탭한 실제 재시도에서
      // 그대로 적용된다.
      // 한 요청에 earlyFill과 backfill이 동시에 실리는 일은 없다(시트에서 한 버튼만
      // 택함) — 방어적으로 backfill을 먼저 확인해, 있으면 earlyFill 쪽은 아예 보지 않는다.
      const isBackfill = backfillPositionsRef.current.has(position);
      if (isBackfill) backfillPositionsRef.current.delete(position);
      const isEarlyFill = !isBackfill && earlyPositionsRef.current.has(position);
      if (isEarlyFill) earlyPositionsRef.current.delete(position);
      const result = await api<{
        sticker: BoardDetail['stickers'][number];
        filledCount: number;
        isCompleted: boolean;
        unlockedReward: {
          id: string;
          type: string;
          title: string;
          triggerAt: number;
          content?: string;
          imageUrl?: string;
        } | null;
        plantedGift: PlantedGiftInfo | null;
        plantedGifts?: PlantedGiftInfo[];
        relayAdvanced?: boolean;
        /** additive(2026-07-19): 완료 시각 — 홈 write-through의 completedAt 공백 제거용. */
        completedAt?: string;
      }>(`/api/boards/${id}/stickers`, {
        method: 'POST',
        json: isBackfill
          ? { position, backfill: true }
          : isEarlyFill
            ? { position, earlyFill: true }
            : { position },
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
      if (result.isCompleted || result.relayAdvanced || boardRef.current?.inRelay) {
        // 포도동 연결 보드는 **모든** 채움이 릴레이 진행 미니포도에 반영된다 — 완료/
        // 바통 전달 때만 무효화하던 구멍(일반 채움이 relay 상세에 안 보임)을 메운다.
        // 마운트된 relay 화면은 무효화 통지로 즉시 재검증한다(cachedApi 구독).
        invalidateCachedApiPrefix('/api/relays');
      }
      // 파생 키 TTL 오염(정합 감사) — 채움은 스트릭·덩굴을, 완료는 와이너리 집계까지
      // 바꾼다. 값은 남겨 SWR 페인트를 유지하고, 다음 mount가 5초 창 안이라도 무음
      // 재검증하게만 한다.
      markCachedApiStale('/api/stats');
      markCachedApiStale('/api/vine');
      if (result.isCompleted) markCachedApiStale('/api/winery');
      if (result.unlockedReward) markCachedApiStale('/api/rewards');
      // 계측(A3) — 동기 fire-and-forget, 큐/reconcile 파이프라인 무간섭.
      if (result.isCompleted) track('board_completed', { boardId: id, totalStickers });

      // Reconcile: temp를 서버 확정 스티커로 교체. 카운트는 길이 유도, 완성은
      // 단조, 같은 position 중복 삽입 방지 — 산식은 applyFillResult 참조.
      // 살아있는 화면(자신 또는 재진입한 새 인스턴스)에, 없으면 캐시에 적용 —
      // 이탈 후 도착한 채움/완성이 재진입·홈 첫 페인트에서 후퇴해 보이지 않는다.
      applyBoardUpdate(id, (prev) => applyFillResult(prev, tempId, result));

      if (!aliveRef.current) return;
      setErrorMessage(null);

      // Reward unlocks are rare; only re-fetch when one fires so the
      // reward card can update from "locked" to "tap to reveal".
      // (팝업/reveal 배관은 배치 경로와 공유 — processUnlockedReward로 추출됨.)
      if (result.unlockedReward) processUnlockedReward(result.unlockedReward, totalStickers);

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
      // 품질 지표(§3-4) — 409(사실상 성공)는 위에서 이미 return, 진짜 실패만 계측.
      track('grape_fill_failed', { boardId: id, position });
      if (aliveRef.current) {
        // 이 실패가 낙관 근거였던 '본문 대기 중' 팝업만 닫는다 — 이미 내용이
        // 확정 표시된 무관한 보상 팝업(읽는 중일 수 있음)은 건드리지 않는다.
        setRewardPopup((prev) => (prev && prev.loading ? null : prev));
      }
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
      // 큐 기반 코얼레싱 웨이크업 — 이 왕복이 끝났으니 대기 중이던 버퍼를 발사한다.
      // 북키핑 **뒤**에 둔다: 플러시가 새 세그먼트를 체인에 걸고 fillQueues를 갱신하는데,
      // 그 앞에서 하면 위 remaining===0 분기가 방금 건 체인을 지울 수 있다. markFillEnd가
      // 먼저여야 플러시 안의 markFillStart가 0→1로 정확히 다시 센다.
      markFillEnd(id);
      fillBatchFlushers.get(id)?.();
    }
  }, [id, processUnlockedReward]);

  // 배치 POST + reconcile/rollback — postFillSticker의 배치판.
  // 세그먼트(planFillBatches) 하나가 왕복 1번. 재개 지점·롤백·북키핑 의미론은 단건과
  // 동일하되, 서버가 중복 칸을 관대 수용(skipDuplicates)하므로 409 경로가 없고 모든
  // 에러는 배치 전체 실패(연속 구간이라 부분 성공을 가정할 수 없다 — 통째 롤백).
  const postFillBatch = useCallback(async (
    entries: FillBatchEntry[],
    totalStickers: number,
    // M1: pagehide/hidden 플러시 전용 — teardown 후에도 브라우저가 POST를 완송한다.
    keepalive = false,
  ) => {
    const positions = entries.map((e) => e.position);
    const minPos = positions[0];
    try {
      const resume = fillResumeAt.get(id);
      if (resume !== undefined) {
        if (minPos > resume) {
          // 더 낮은 칸의 실패가 기록돼 있다 — 발사하면 서버에 비연속 구멍이 생긴다.
          // 배치 전체를 폐기하고 낙관 스티커만 회수(단건 경로와 동일 규칙).
          applyBoardUpdate(id, (prev) =>
            entries.reduce((b, e) => rollbackFill(b, e.tempId, e.position), prev),
          );
          return;
        }
        fillResumeAt.delete(id);
      }
      const result = await api<{
        stickers: BoardDetail['stickers'];
        filledCount: number;
        isCompleted: boolean;
        completedAt: string | null;
        unlockedRewards: {
          id: string;
          type: string;
          title: string;
          triggerAt: number;
          content?: string;
          imageUrl?: string;
        }[];
        plantedGifts: (PlantedGiftInfo & { position: number })[];
        relayAdvanced?: boolean;
      }>(`/api/boards/${id}/stickers`, {
        method: 'POST',
        json: { positions },
        // 단건과 동일한 큐 행(hang) 방지 시한. (페이지가 죽으면 abort 타이머도 함께
        // 사라지므로 keepalive 완송을 방해하지 않는다 — 살아있는 경우에만 유효.)
        signal: AbortSignal.timeout(20000),
        // 일반 플러시 경로는 종전과 byte-identical하게 keepalive 미지정.
        ...(keepalive ? { keepalive: true } : {}),
      });
      // 단건 경로와 동일 배선(#133 정합 감사): 포도동 연결 보드는 모든 채움이 릴레이
      // 진행 미니포도에 반영되므로 완료/바통 전달 외에도 relays prefix를 무효화한다.
      if (result.isCompleted || result.relayAdvanced || boardRef.current?.inRelay) {
        invalidateCachedApiPrefix('/api/relays');
      }
      // 파생 키 TTL 오염(#133) — 채움은 스트릭·덩굴을, 완료는 와이너리 집계까지 바꾼다.
      // 값은 남겨 SWR 페인트를 유지하고, 다음 mount가 5초 창 안이라도 무음 재검증만 유도.
      markCachedApiStale('/api/stats');
      markCachedApiStale('/api/vine');
      if (result.isCompleted) markCachedApiStale('/api/winery');
      if (result.unlockedRewards.length > 0) markCachedApiStale('/api/rewards');
      if (result.isCompleted) track('board_completed', { boardId: id, totalStickers });

      // Reconcile: 응답 스티커 전체(이미 차 있던 칸 포함)를 fold — completedAt까지
      // write-through된다(배치 응답의 additive win, syncBoardCaches의 null 주의 해소).
      applyBoardUpdate(id, (prev) => applyBatchFillResult(prev, entries, result));

      if (!aliveRef.current) return;
      setErrorMessage(null);

      // 세그먼트 경계(planFillBatches) 덕에 보통 ≤1개 — 그래도 배열 전체를 단건과
      // 같은 배관으로 순회 처리한다(예외적으로 2개+가 와도 pendingUnlockContentRef가
      // 보상 id 키라 각 팝업이 자기 내용을 정확히 소비한다). 팝업 오픈 비트 자체는
      // GrapeBoard가 탭 시점 로컬 카운트로 이미 처리했다(+300ms/완성 시퀀스).
      for (const u of result.unlockedRewards) processUnlockedReward(u, totalStickers);

      // 깜짝선물 — position 동봉 배열. 순차 공개 큐 병합은 단건과 동일.
      if (result.plantedGifts.length > 0) {
        setSurpriseQueue((q) => [...q, ...result.plantedGifts]);
        setConfettiTrigger((t) => t + 1);
      }
    } catch (err) {
      // 재개 지점 = 배치 최소 칸 — 이후 발사는 폐기되고, 이 지점 이하 재채움에서 재개.
      fillResumeAt.set(id, Math.min(fillResumeAt.get(id) ?? Infinity, minPos));
      applyBoardUpdate(id, (prev) =>
        entries.reduce((b, e) => rollbackFill(b, e.tempId, e.position), prev),
      );
      // 실패율 지표의 분모(grape_filled)가 탭당이므로 실패도 칸당 계측(비율 보존).
      for (const p of positions) track('grape_fill_failed', { boardId: id, position: p });
      if (aliveRef.current) {
        // 단건과 동일: 본문 대기 중(loading) 팝업만 닫는다.
        setRewardPopup((prev) => (prev && prev.loading ? null : prev));
      }
      const msg = err instanceof ApiError ? err.message : '포도알을 채우지 못했어요';
      liveBoards.get(id)?.onFillFailure(msg);
    } finally {
      const pendingSet = fillPendingPositions.get(id);
      for (const p of positions) pendingSet?.delete(p);
      // 각 탭의 반환 Promise 해소 — GrapeBoard의 isFilling 해제가 단건과 같은
      // '서버 확정 시점'에 일어난다(성공·실패·폐기 공통).
      for (const e of entries) e.resolve();
      const remaining = Math.max(0, (fillPendingCounts.get(id) ?? positions.length) - positions.length);
      if (remaining === 0) {
        // 드레인 종료 — 단건 경로와 동일(fillResumeAt만 보존, 그쪽 주석 참조).
        fillQueues.delete(id);
        fillPendingCounts.delete(id);
        fillPendingPositions.delete(id);
      } else {
        fillPendingCounts.set(id, remaining);
      }
      // 단건과 동일 — 이 왕복 종료가 대기 버퍼의 발사 신호다(위 finally 주석 참조).
      markFillEnd(id);
      fillBatchFlushers.get(id)?.();
    }
  }, [id, processUnlockedReward]);

  // 버퍼 플러시 — planFillBatches로 세그먼트를 나눠 기존 직렬 큐 체인에 배치 단위로
  // 연결한다(보드당 in-flight 1개, 비행 중 탭은 다음 버퍼에 쌓임). 타이머·버퍼가
  // 모듈 레벨이라 이탈 후에도 완주한다(#88 좀비 의미론) — reconcile은
  // applyBoardUpdate의 라이브/캐시 경로로 흐른다. /board/A→B 인스턴스 재사용 시에도
  // A의 타이머는 A의 id를 클로저로 잡고 있어 자기 버퍼만 플러시한다.
  const flushFillBatch = useCallback((opts?: { keepalive?: boolean }) => {
    const timer = fillBatchTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      fillBatchTimers.delete(id);
    }
    fillBatchFlushers.delete(id); // 드레인되는 버퍼의 리스너 등록 해제(재탭이 재등록)
    // take-and-clear(동기 get+delete, await 없음) — 리스너·타이머 이중 플러시가
    // 겹쳐도 두 번째는 빈 버퍼를 보고 no-op(M1 이중 발화 무해성의 근거).
    const buf = fillBatchBuffers.get(id);
    fillBatchBuffers.delete(id);
    if (!buf || buf.entries.length === 0) return;
    // 순차 채움 계약: 첫 칸 발사 직전의 서버 확정 카운트 == 첫 칸의 position
    // (그보다 낮은 칸은 전부 확정됐거나 큐에서 이 배치보다 먼저 발사된다).
    const segments = planFillBatches(
      buf.entries.map((e) => e.position),
      buf.triggerAts,
      buf.entries[0].position,
      buf.totalStickers,
    );
    let offset = 0;
    for (const seg of segments) {
      const segEntries = buf.entries.slice(offset, offset + seg.length);
      offset += seg.length;
      // 체인에 '거는' 시점에 in-flight로 센다(실행 시점이 아니라) — 큐에 이미 줄 선
      // 세그먼트가 있는데 새 탭이 또 발사하면 코얼레싱이 무의미해진다. markFillEnd는
      // postFillBatch의 finally가 정확히 한 번 짝을 맞춘다.
      markFillStart(id);
      const queued = (fillQueues.get(id) ?? Promise.resolve()).then(
        () => postFillBatch(segEntries, buf.totalStickers, opts?.keepalive === true),
      );
      fillQueues.set(id, queued.catch(() => {}));
    }
  }, [id, postFillBatch]);

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

    // 계측(A3) — 낙관 삽입 직후, 직렬 큐 밖에서 동기 발사(파이프라인 무간섭).
    track('grape_filled', {
      boardId: id,
      position,
      earlyFill: earlyPositionsRef.current.has(position),
      cadenceType: board.cadenceType,
    });
    trackFirst(user.id, 'fill', 'first_fill');

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

    // 단건 POST를 타는 건 **채움 텀 플래그가 붙은 칸뿐**이다(earlyFill/backfill —
    // RipeningSheet 오버라이드·보충. 배치 본문에 실을 수 없어 칸 단위로 보낸다).
    // 종전엔 텀 보드(DAILY_N 등) '전체'가 이 경로였고, 그래서 15알 연타가 왕복 15번이
    // 됐다(2026-07-23 영상). 이제 보드 종류와 무관하게 플래그 없는 탭은 전부 배치다.
    // 두 경로 모두 fillQueues를 공유하므로 순서는 어떤 조합에서도 직렬이며, 플래그 탭
    // 앞에서는 대기 버퍼를 먼저 비워(flushFillBatch) 낮은 칸이 뒤로 밀리지 않게 한다.
    if (needsSingleFillPost({
      earlyFill: earlyPositionsRef.current.has(position),
      backfill: backfillPositionsRef.current.has(position),
    })) {
      flushFillBatch();
      markFillStart(id);
      const queued = (fillQueues.get(id) ?? Promise.resolve()).then(
        () => postFillSticker(position, tempId, totalStickers),
      );
      fillQueues.set(id, queued.catch(() => {})); // 방어: 예기치 못한 reject로 체인 단절 방지
      return queued;
    }

    // 배치 코얼레싱: 탭을 버퍼에 쌓고 **큐가 빌 때** 플러시 — 연타 N번이 왕복 1번
    // (세그먼트당)으로 영속된다. 반환 Promise는 이 칸이 속한 배치의 서버
    // 확정(reconcile/rollback/폐기)에 묶인다 — GrapeBoard isFilling 해제 시점 보존.
    const settled = new Promise<void>((resolve) => {
      let buf = fillBatchBuffers.get(id);
      if (!buf) {
        buf = { entries: [], totalStickers, triggerAts: [] };
        fillBatchBuffers.set(id, buf);
      }
      // 최신 보드 상태로 갱신(보상 심기 직후의 탭도 새 triggerAt을 반영).
      buf.totalStickers = totalStickers;
      buf.triggerAts = board.rewards.map((r) => r.triggerAt);
      buf.entries.push({ position, tempId, resolve });
    });
    // M1: 정지/킬 리스너가 이 버퍼를 플러시할 수 있게 최신 플러시 함수를 등록.
    fillBatchFlushers.set(id, flushFillBatch);
    const prevTimer = fillBatchTimers.get(id);
    if (prevTimer !== undefined) clearTimeout(prevTimer);
    // 발사 판정(shouldFlushFillBuffer): 경계(보상 임계·완성 칸·버퍼 캡)면 즉시,
    // 아니면 **큐가 비어 있을 때만** 즉시. in-flight면 대기하고, 그 응답의 settle이
    // 플러시를 깨운다(postFillBatch/postFillSticker의 finally) — 미결 왕복이 항상 ≤1개라
    // 탭 속도와 무관하게 완성 응답이 마지막 탭 +1왕복 안에 온다.
    const bufNow = fillBatchBuffers.get(id);
    if (
      bufNow &&
      shouldFlushFillBuffer({
        // 순차 채움이라 칸 p를 채우면 카운트는 p+1로 결정적이다.
        cum: position + 1,
        rewardTriggerAts: bufNow.triggerAts,
        totalStickers,
        bufferedCount: bufNow.entries.length,
        inFlight: isFillInFlight(id),
      })
    ) {
      flushFillBatch();
    } else {
      // 대기 — 백스톱만 걸어둔다(웨이크업 유실 시 버퍼 유실 방지, 위 상수 주석 참조).
      fillBatchTimers.set(id, setTimeout(flushFillBatch, FILL_BATCH_BACKSTOP_MS));
    }
    return settled;
  }, [board, user, id, postFillSticker, flushFillBatch]);

  // GrapeBoard에 내려가는 콜백들을 안정화 — 인라인 화살표로 주면 배너·컨페티·캡슐
  // 티저 등 보드와 무관한 페이지 상태 변화마다 memo(GrapeBoardInner)가 무력화돼,
  // 완성 연출(WAAPI) 중 직렬 큐 reconcile과 겹치며 전 셀 리렌더 폭이 커졌다(버벅).
  const handleCelebrate = useCallback(() => setConfettiTrigger((t) => t + 1), []);
  // 마지막 알 임팩트(t=0) 기록 — processUnlockedReward가 완성 보상 개봉을 이 시각 기준
  // 으로 스케줄한다. 신원 고정(빈 deps)이라 memo(GrapeBoardInner)를 무효화하지 않는다.
  const handleCompletionStart = useCallback(() => {
    completionImpactAtRef.current = Date.now();
  }, []);
  const handlePlantReward = useCallback((pos: number) => {
    feedbackTap();
    setPlantPos(pos);
  }, []);
  // Friend (non-owner) long-press → open PlantGiftModal fixed to that grape, or
  // (if the owner turned surprise gifts off) a brief inline notice instead. The
  // long-press gesture itself always fires so the "turned off" case can still be
  // discovered — only what happens on press depends on allowFriendPlant.
  const handlePlantGift = useCallback((pos: number) => {
    if (board?.allowFriendPlant === false) {
      feedbackTap();
      setPlantGiftHint(true);
      setTimeout(() => setPlantGiftHint(false), 2500);
      return;
    }
    feedbackTap();
    setPlantGiftPos(pos);
  }, [board?.allowFriendPlant]);
  const handleMidRewardReached = useCallback((r: RewardInfo) => {
    // 빠른 응답이 비트를 추월해 버퍼에 둔 내용이 있으면 스켈레톤 없이 즉시 본문.
    const buffered = pendingUnlockContentRef.current.get(r.id);
    if (buffered) {
      pendingUnlockContentRef.current.delete(r.id);
      setRewardPopup({ reward: { ...r, ...buffered }, loading: false });
      return;
    }
    // 보통은 마스킹 상태('')로 열린다 — unlock 응답이 채울 때까지만 스켈레톤.
    setRewardPopup({ reward: r, loading: !r.content && !r.imageUrl });
  }, []);

  // 무한로딩 안전망: 팝업이 5초 넘게 내용을 못 받으면(unlock 응답 누락 — 다른
  // 기기/좀비 큐가 먼저 클레임한 희귀 경합 등) 멱등 reveal로 직접 채운다.
  // '아직 열 수 없어요'(400 = 직렬 큐 드레인 중 서버 카운트 미달)는 실패가 아닌
  // '대기'로 분류해 실패 예산을 소진하지 않고 짧은 간격으로 따라간다 — 드레인
  // 중 건강한 팝업을 강제 종료하지 않는다. 진짜 실패 3회면 닫고 배너.
  useEffect(() => {
    if (!rewardPopup?.loading) return;
    const rewardId = rewardPopup.reward.id;
    let cancelled = false;
    let failures = 0;
    let waits = 0;
    let timer: ReturnType<typeof setTimeout>;
    const fill = (next: { title: string; content: string; imageUrl: string } | RewardInfo) => {
      setRewardPopup((prev) =>
        prev && prev.reward.id === rewardId
          ? { reward: { ...prev.reward, ...next }, loading: false }
          : prev,
      );
    };
    const tryReveal = async () => {
      if (cancelled) return;
      // 그 사이 빠른-응답 버퍼가 찼으면 왕복 없이 소비
      const buffered = pendingUnlockContentRef.current.get(rewardId);
      if (buffered) {
        pendingUnlockContentRef.current.delete(rewardId);
        fill(buffered);
        return;
      }
      try {
        const d = await api<{ reward: RewardInfo }>(
          `/api/boards/${id}/rewards/${rewardId}/reveal`,
          { method: 'POST' },
        );
        if (cancelled) return;
        fill(d.reward);
        if (aliveRef.current) fetchBoard();
      } catch (err) {
        if (cancelled) return;
        const waiting = err instanceof ApiError && err.status === 400;
        // 큐가 아직 드레인 중인 400은 대기 예산도 소진하지 않는다 — 채움이 정말
        // 실패하면 postFillSticker의 catch가 이 loading 팝업을 직접 닫는다(롤백+배너).
        if (waiting && (fillPendingCounts.get(id) ?? 0) === 0) waits += 1;
        else if (!waiting) failures += 1;
        if ((waiting && waits < 12) || (!waiting && failures < 3)) {
          timer = setTimeout(tryReveal, waiting ? 2000 : 4000);
        } else {
          setRewardPopup((prev) => (prev && prev.reward.id === rewardId ? null : prev));
          setErrorMessage('보상을 여는 데 실패했어요. 잠시 후 다시 시도해주세요.');
        }
      }
    };
    // 직렬 큐가 드레인 중이면 고정 타이머가 아니라 드레인 완료에 reveal을 건다 —
    // 마지막 채움이 커밋되는 그 순간이 내용을 받을 수 있는 가장 이른 시점이고,
    // 맹목 폴링(5s+2s 간격)은 그만큼 스켈레톤을 더 보여줬다(2026-06-13 영상).
    // cancelled로 수명을 팝업에 묶는다 — 닫은 뒤 도착한 드레인이 '본 적 없는'
    // 보상의 revealedAt을 영속화해 카드를 '다시 보기'로 오표시하지 않게.
    // 백스톱 타이머는 큐 행(항목별 20s 타임아웃) 대비로만 길게 둔다.
    if ((fillPendingCounts.get(id) ?? 0) > 0) {
      // savingFills 노트는 여기서 굳이 끄지 않는다 — tryReveal 성공이 팝업 객체를
      // 통째로 교체해 함께 사라지고, 중간에 끄면 rewardPopup 의존 effect가 재실행돼
      // cancelled 가드가 진행 중인 reveal을 끊는다(재진입 자기 취소).
      fillQueues.get(id)?.then(() => {
        if (cancelled) return;
        clearTimeout(timer); // 백스톱과의 이중 발사 방지 — reveal은 멱등이지만 왕복 낭비
        tryReveal();
      });
      timer = setTimeout(tryReveal, 25000);
    } else {
      // 첫 시도 5000→800ms(W1-B): openReward의 자체 reveal이 대개 먼저 채우지만,
      // 그 요청이 유실됐을 때 스켈레톤을 5초나 방치하는 건 '안 나온다'로 읽힌다.
      timer = setTimeout(tryReveal, 800);
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rewardPopup, id, fetchBoard]);

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

  const handleSaveCustomImage = async (image: Blob) => {
    const form = new FormData();
    form.append('file', image, 'custom-image.jpg');
    const res = await api<{ customImageUrl: string }>(`/api/boards/${id}/custom-image`, {
      method: 'POST',
      body: form,
    });
    setBoard((b) => (b ? { ...b, customImageUrl: res.customImageUrl } : b));
  };

  const handleRemoveCustomImage = async () => {
    await api(`/api/boards/${id}/custom-image`, { method: 'DELETE' });
    setBoard((b) => (b ? { ...b, customImageUrl: null } : b));
  };

  const handleGift = async (friendId: string, message: string) => {
    try {
      await api(`/api/boards/${id}/gift`, {
        method: 'POST',
        json: { friendId, message },
      });
      track('gift_sent');
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
      purgeBoardFromCaches(id); // 삭제 성공 확정 시에만 — 홈 고스트 방지
    } catch {
      // ignore — navigate away regardless
    }
    router.push('/home');
  };

  // Open a reward in the popup (mid chip / final card tap). 내용은 unlocked
  // 시점부터 board GET에 실려 있어 보통 즉시 보인다. reveal은 '열어봤다' 영속화
  // 전용(멱등)으로 비차단 발사. 스켈레톤은 '구캐시 등으로 내용이 아직 없는'
  // 경우에만 — 응답이 채우거나, 실패 시 닫고 배너(영구 스켈레톤 금지).
  const openReward = (reward: RewardInfo) => {
    // 빠른-응답 버퍼 우선 소비(왕복 0) — 완성/unlock 응답이 이미 내용을 실어 왔다면
    // 여는 이 순간이 소비 시점이다. 예전엔 안전망 폴링(수 초 뒤)만 버퍼를 봤어서,
    // 프로드 RTT에선 fetchBoard가 돌아오기 전 탭이 스켈레톤 창을 만들었다(W1-B ①).
    const buffered = pendingUnlockContentRef.current.get(reward.id);
    if (buffered) {
      pendingUnlockContentRef.current.delete(reward.id);
      reward = { ...reward, ...buffered };
    }
    rewardSeenRef.current.add(reward.id); // 완성 자동 개봉의 재개봉 방지 표식
    // 첫 열람만 계측(revealedAt이 이미 있으면 재열람) — 사전 §2 reward_revealed.
    if (!reward.revealedAt && board) {
      track('reward_revealed', { type: reward.type, isMid: reward.triggerAt < board.totalStickers });
    }
    // 내용이 로컬에 없으면 로딩 — revealedAt이 있어도 stale 마스킹('')일 수 있어
    // (완성 직전 GET 캐시 등) 본문 없는 모달 대신 reveal 재발사로 회복한다(멱등, W1-B ③).
    // 내용이 정말 빈 보상도 이 경로를 타지만 응답의 ''가 loading을 곧 끈다(제목만 표시).
    const loading = !reward.content && !reward.imageUrl;
    // 연타 직후 카드 탭: 낙관 카운트로 카드가 먼저 '달성'이 되지만 서버 커밋(직렬
    // 큐)은 뒤따라온다 — 그 사이의 스켈레톤은 '저장 중'임을 모달이 직접 말한다.
    setRewardPopup({ reward, loading, savingFills: loading && (fillPendingCounts.get(id) ?? 0) > 0 });
    setConfettiTrigger((t) => t + 1);
    if (!reward.revealedAt || loading) {
      api<{ reward: RewardInfo }>(
        `/api/boards/${id}/rewards/${reward.id}/reveal`,
        { method: 'POST' },
      )
        .then((d) => {
          setRewardPopup((prev) =>
            prev && prev.reward.id === d.reward.id ? { reward: d.reward, loading: false } : prev,
          );
          if (aliveRef.current) fetchBoard();
        })
        .catch((err) => {
          // '아직 열 수 없어요'(400): 칩이 낙관 카운트로 일찍 활성화된 경우(큐
          // 드레인 중) — 닫지 않고 로딩 유지, 안전망 루프가 드레인을 따라잡는다.
          if (err instanceof ApiError && err.status === 400) return;
          // 보여줄 내용이 전혀 없으면 빈 팝업 대신 닫고 배너로 안내(모달 뒤에
          // 가려진 배너 + 영구 스켈레톤이 기존 '무한로딩'의 한 갈래였다).
          if (!reward.content && !reward.imageUrl) {
            setRewardPopup((prev) => (prev && prev.reward.id === reward.id ? null : prev));
            setErrorMessage('보상을 여는 데 실패했어요. 잠시 후 다시 시도해주세요.');
          } else {
            setRewardPopup((prev) =>
              prev && prev.reward.id === reward.id ? { ...prev, loading: false } : prev,
            );
          }
        });
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await api(`/api/boards/${id}`, { method: 'DELETE' });
      // 캐시에서 즉시 제거 — 예전엔 아무것도 안 지워서 홈이 삭제된 보드를 계속
      // 그렸고(5초 TTL 창에선 교정 fetch도 없음), 고스트 탭 → 404 무음 바운스가 났다.
      purgeBoardFromCaches(id);
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
  // GrapeBoard의 canFill과 동일 조건 — 채움 텀 paceState/onRipeningTap도 이 조건에서만
  // 전달한다(카드 스펙: "owner 뷰에서만 — canFill과 동일 조건").
  const canFill = isOwner && !board.isCompleted;
  const allowPlant = board.allowFriendPlant ?? true;
  // 포도동 연결 보드는 선물 불가(서버도 gift POST에서 차단). inRelay가 없는 구버전
  // 캐시 응답은 홈 요약의 podong(그룹 전용)으로 폴백.
  const noGift = board.inRelay ?? summary?.podong ?? false;
  // 보상 심기/편집 진입 게이트 — 선물 복사본·비창시자 포도동 보드의 보상은 타인
  // 작성(서프라이즈)이라 편집 모달을 열면 안 된다(서버도 차단, rewardAccess.ts).
  // 필드가 없는 구버전 캐시 응답은 선물 여부만으로 근사(포도동 판정은 재검증 후 도착).
  const canManageRewards = board.canManageRewards ?? !board.giftedFrom;
  const filledCount = board.stickers.length;
  // 친구 뷰: 내가 이 보드에 심은 깜짝 선물(위치·공개 여부). 서버가 본인 것만 내려준다
  // (myPlantedGifts, additive GET 필드) — 주인 뷰에선 항상 빈 배열(위치 힌트 없음 유지).
  const myPlantedGifts = board.myPlantedGifts ?? [];
  const myPlantedPositions = new Map(myPlantedGifts.map((g) => [g.position, g.revealedAt !== null]));
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
          className={`w-full clay-sm px-4 py-2.5 mb-5 flex items-center gap-2 text-sm transition-[transform,background-color] active:scale-[0.99] ${capsuleTeaser.glow ? 'reward-glow bg-amber-50/70' : ''}`}
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
          className="w-full clay-sm px-4 py-3 mb-5 flex items-center justify-between transition-transform active:scale-[0.99]"
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
          {isOwner && (
            <button
              onClick={() => { feedbackTap(); setShowCustomImage(true); }}
              aria-label="알 사진 바꾸기"
              className="text-warm-sub hover:text-grape-700 p-1 transition-colors"
            >
              <EmojiIcon emoji="📸" size={15} />
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

        {/* Owner-only persistent status chip: "깜짝선물 받기 꺼짐" (GAP-04,
            W3-surprise-gift-badge). The "친구가 깜짝 선물 심기" toggle switch further up
            this page already reflects on/off via switch position, but a small switch is
            easy to glance past — this is an always-visible reminder so the owner doesn't
            have to re-check it. Non-interactive by design: the toggle already lives inline
            on this same page (not behind a separate menu/settings sheet), so wiring a tap
            here to "open" it would just re-trigger the same mutation with no real
            navigation benefit — see 검증 로그 for the decision trace. Same !isCompleted gate
            as that toggle / the friend-view caption below / GrapeBoard's onPlantReward·
            onPlantGift props — a completed board has no empty grape left to plant on, so
            the setting is moot there. */}
        {isOwner && !board.isCompleted && !allowPlant && (
          <div className="inline-flex items-center gap-1 clay-sm px-3 py-1.5 mt-2">
            <EmojiIcon emoji="🎁" size={12} />
            <span className="text-xs text-warm-sub">깜짝선물 받기 꺼짐</span>
          </div>
        )}
      </div>

      {/* Friend view: discoverability caption for the long-press plant-gift gesture
          (W1-C spec 5) — always visible, no localStorage. Plus a caption for gifts
          I've already planted here (spec 6). Owner sees neither (no position hints). */}
      {!isOwner && !board.isCompleted && (
        <div className="text-center mb-4 space-y-1">
          <p className="text-xs text-warm-sub">
            {allowPlant
              ? '빈 포도알을 꾹 누르면 깜짝 선물을 숨길 수 있어요'
              : '이 친구는 깜짝 선물 받기를 꺼뒀어요'}
          </p>
          {myPlantedGifts.length > 0 && (
            <p className="text-xs text-warm-sub">
              <EmojiIcon emoji="🎁" size={12} className="mr-0.5" />
              내가 숨긴 선물 {myPlantedGifts.length}개 (
              {myPlantedGifts.map((g) => `${g.position + 1}번째 알`).join(', ')})
            </p>
          )}
        </div>
      )}

      {/* Friend long-pressed a grape but this owner turned surprise gifts off —
          brief self-dismissing notice (W1-C spec 2). */}
      {plantGiftHint && (
        <div className="clay-sm p-3 mb-4 bg-grape-50/70 text-center animate-bounce-in">
          <span className="text-sm font-medium text-grape-600">이 친구는 깜짝 선물 받기를 꺼뒀어요</span>
        </div>
      )}

      {/* Friend planted a gift just now — confirmation banner (mirrors the old
          friends/[id] plantedFeedback banner, now shown at the plant site). */}
      {plantedFeedback && (
        <div className="clay-sm p-3 mb-4 bg-leaf-100/60 text-center animate-bounce-in">
          <span className="text-sm font-medium text-grape-600">
            <EmojiIcon emoji="🎁" size={14} className="mr-0.5" />깜짝 선물을 숨겨놨어요!
          </span>
        </div>
      )}

      {/* Grape Board */}
      <div className="clay-float p-6 mb-6">
        <GrapeBoard
          ref={grapeBoardRef}
          board={board}
          onFill={handleFillSticker}
          canFill={canFill}
          onCelebrate={handleCelebrate}
          isOwner={isOwner}
          onPlantReward={isOwner && !board.isCompleted && canManageRewards ? handlePlantReward : undefined}
          onPlantGift={!isOwner && !board.isCompleted ? handlePlantGift : undefined}
          onMidRewardReached={handleMidRewardReached}
          onCompletionStart={handleCompletionStart}
          paceState={canFill ? paceState : null}
          onRipeningTap={canFill ? handleRipeningTap : undefined}
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
                    className={`relative shrink-0 w-14 h-14 rounded-2xl clay-sm flex items-center justify-center transition-[transform,background-color,opacity]
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
        <RewardRevealModal
          reward={rewardPopup.reward}
          loading={rewardPopup.loading}
          loadingNote={rewardPopup.savingFills ? '포도알을 저장하고 있어요…' : undefined}
          onClose={() => setRewardPopup(null)}
        />
      )}

      {/* 채움 텀 C1 소프트 가드 — 다음 알이 아직 안 익었을 때 탭하면 뜬다(GrapeBoard의
          onRipeningTap). paceNow는 paceState와 같은 effect에서 캡처된 시각(문구 포맷용). */}
      {showRipeningSheet && paceState?.nextRipeAt && paceNow && (
        <RipeningSheet
          cadenceType={board.cadenceType ?? 'FREE'}
          nextRipeAt={paceState.nextRipeAt}
          now={paceNow}
          strictMode={board.strictMode}
          backfillAvailable={board.backfillAvailable}
          onOverride={handleRipeningOverride}
          onBackfill={handleRipeningBackfill}
          onClose={() => setShowRipeningSheet(false)}
        />
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

      {/* Friend (non-owner) long-pressed an empty grape → plant a surprise gift
          fixed to that position (W1-C: moved in from friends/[id]'s standalone
          button). onSaved refetches so myPlantedGifts (and the 🎁 marker) update. */}
      {plantGiftPos !== null && (
        <PlantGiftModal
          board={{ id, title: board.title, totalStickers: board.totalStickers, filledCount: board.stickers.length }}
          fixedPosition={plantGiftPos}
          onClose={() => setPlantGiftPos(null)}
          onPlanted={() => {
            setPlantedFeedback(true);
            setTimeout(() => setPlantedFeedback(false), 2500);
            fetchBoard();
          }}
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

      {/* Owner: custom grape photo (사용자 요청, docs/cards/2026-07-08-custom-grape-photo.md) */}
      {showCustomImage && (
        <CustomImageModal
          initialImageUrl={board.customImageUrl ?? null}
          onSave={handleSaveCustomImage}
          onRemove={handleRemoveCustomImage}
          onClose={() => setShowCustomImage(false)}
        />
      )}
    </div>
  );
}
